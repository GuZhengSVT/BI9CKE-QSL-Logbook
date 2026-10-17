const encoder = new TextEncoder();
const COOKIE = '__Host-qsl_session';
const SESSION_SECONDS = 12 * 60 * 60;
const ITERATIONS = 100_000;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function digest(value) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
function hex(bytes) { return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join(''); }
function random() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
function same(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:ITERATIONS}, key, 256));
}
function cookie(token, seconds = SESSION_SECONDS) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}
function sessionToken(request) {
  return request.headers.get('Cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
}
async function credentials(env) { return env.DB.prepare('SELECT * FROM admin_credentials WHERE id = 1').first(); }
export async function verifySession(request, env) {
  const token = sessionToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, '请先登录管理员账号。');
  const session = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).first();
  if (!session || session.expires_at <= Date.now()) throw new HttpError(401, '登录已过期，请重新登录。');
  return {username:env.ADMIN_USERNAME || 'BI9CKE'};
}
async function limitAttempts(request, env) {
  const bucket = Math.floor(Date.now() / 900_000);
  const key = await digest((request.headers.get('CF-Connecting-IP') || 'local') + ':' + bucket);
  const row = await env.DB.prepare('INSERT INTO auth_attempts (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts')
    .bind(key, (bucket + 1) * 900_000).first();
  if (row.attempts > 10) throw new HttpError(429, '尝试次数过多，请在 15 分钟后重试。');
  return key;
}
async function startSession(env, attemptKey) {
  const token = random(), now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare('DELETE FROM auth_attempts WHERE expires_at <= ? OR key = ?').bind(now, attemptKey),
    env.DB.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)').bind(await digest(token), now + SESSION_SECONDS * 1000)
  ]);
  return Response.json({ok:true}, {headers:{'Set-Cookie':cookie(token),'Cache-Control':'no-store'}});
}
export async function auth(request, env, readBody) {
  const path = new URL(request.url).pathname;
  if (path === '/api/auth/status' && request.method === 'GET') {
    return Response.json({configured:!!await credentials(env),username:env.ADMIN_USERNAME || 'BI9CKE'}, {headers:{'Cache-Control':'no-store'}});
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在。');
  if (request.headers.get('Origin') !== new URL(request.url).origin) throw new HttpError(403, '登录操作仅允许来自本站。');
  if (path === '/api/auth/logout') {
    const token = sessionToken(request);
    if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).run();
    return Response.json({ok:true}, {headers:{'Set-Cookie':cookie('',0),'Cache-Control':'no-store'}});
  }
  if (!['/api/auth/login','/api/auth/setup'].includes(path)) throw new HttpError(404, '接口不存在。');
  const input = await readBody(request), attemptKey = await limitAttempts(request,env), stored = await credentials(env);
  if (typeof input.password !== 'string' || input.password.length > 128) throw new HttpError(400, '密码格式无效。');
  if (path === '/api/auth/setup') {
    if (stored) throw new HttpError(409, '管理员已设置，请使用密码登录。');
    if (!env.ADMIN_SETUP_HASH || typeof input.setupToken !== 'string' || !same(await digest(input.setupToken),env.ADMIN_SETUP_HASH)) throw new HttpError(403, '首次设置链接无效。请使用部署时生成的专用链接。');
    if (input.password.length < 12) throw new HttpError(400, '请使用至少 12 位的密码。');
    const salt = random(), hash = await passwordHash(input.password,salt);
    const result = await env.DB.prepare('INSERT OR IGNORE INTO admin_credentials (id, salt, password_hash) VALUES (1, ?, ?)').bind(salt,hash).run();
    if (result.meta.changes !== 1) throw new HttpError(409, '管理员已设置，请使用密码登录。');
  } else {
    if (!stored) throw new HttpError(403, '请先通过专用链接设置管理员密码。');
    const valid = same(await passwordHash(input.password,stored.salt),stored.password_hash);
    if (!valid || input.username !== (env.ADMIN_USERNAME || 'BI9CKE')) throw new HttpError(401, '账号或密码不正确。');
  }
  return startSession(env,attemptKey);
}
