import { auth, verifySession, HttpError } from './auth.mjs';
import {satelliteCatalog} from './satellites.mjs';
import '../../js/adif.js';
import '../../js/geo.js';
const ADIF = globalThis.ADIF, Geo = globalThis.QslGeo;
const PUBLIC_FIELDS = ['CALL','QSO_DATE','TIME_ON','BAND','MODE','SUBMODE','FREQ','RST_SENT','RST_RCVD','GRIDSQUARE','LAT','LON','DXCC','COUNTRY','QSL_SENT','QSL_RCVD','LOTW_QSL_RCVD','SAT_NAME','PROP_MODE'];
function json(data, status = 200) {
  return Response.json(data, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function validateRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, '通联格式不正确。');
  const record = {};
  for (const [key,value] of Object.entries(raw)) {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/i.test(key) || typeof value !== 'string' || value.length > 2000) throw new HttpError(400, '通联字段不正确。');
    record[key.toUpperCase()] = value.trim();
  }
  for (const key of ['CALL','BAND','MODE','GRIDSQUARE']) if(record[key]) record[key] = record[key].toUpperCase();
  if (!record.CALL || !record.BAND || !record.MODE || !/^\d{8}$/.test(record.QSO_DATE || '')) throw new HttpError(400, '呼号、日期、波段、模式为必填项。');
  const date = record.QSO_DATE;
  const parsed = new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10).replaceAll('-','') !== date) throw new HttpError(400, '通联日期无效。');
  if (record.TIME_ON && !/^(?:[01]\d|2[0-3])[0-5]\d(?:[0-5]\d)?$/.test(record.TIME_ON)) throw new HttpError(400, 'UTC 时间无效。');
  if (record.GRIDSQUARE && !Geo.gridCenter(record.GRIDSQUARE)) throw new HttpError(400, '通联网格无效。');
  if ((record.LAT || record.LON) && (Geo.coordinate(record.LAT,true) === null || Geo.coordinate(record.LON,false) === null)) throw new HttpError(400, '经纬度需要成对填写且范围有效。');
  return record;
}
function validateConfig(raw, previous) {
  if (!raw || typeof raw.call !== 'string' || !raw.call.trim() || typeof raw.name !== 'string' || raw.call.length>30 || raw.name.length>120) throw new HttpError(400,'请填写有效的呼号和电台名称。');
  const value = raw.station || {};
  const grid = String(value.grid || '').trim().toUpperCase();
  if (grid && !Geo.gridCenter(grid)) throw new HttpError(400, '电台网格须为 4、6 或 8 位 Maidenhead 网格。');
  const hasLat = value.lat !== '' && value.lat != null, hasLon = value.lon !== '' && value.lon != null;
  const lat = Geo.coordinate(value.lat,true), lon = Geo.coordinate(value.lon,false);
  if ((hasLat || hasLon) && (!hasLat || !hasLon || lat === null || lon === null)) throw new HttpError(400, '请成对填写有效的经纬度。');
  return {...previous,call:raw.call.trim().toUpperCase(),name:raw.name.trim(),station:{grid,lat:hasLat?lat:null,lon:hasLon?lon:null}};
}
async function config(db) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('station').first();
  if (!row) throw new HttpError(503,'数据库尚未初始化，请先运行 D1 migrations。');
  return JSON.parse(row.value);
}
async function records(db) {
  const rows = await db.prepare('SELECT data FROM records ORDER BY qso_date DESC, id').all();
  return rows.results.map(row=>JSON.parse(row.data));
}
function upsert(db, record) {
  return db.prepare('INSERT INTO records (id, qso_date, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET qso_date=excluded.qso_date, data=excluded.data')
    .bind(ADIF.recordId(record), record.QSO_DATE, JSON.stringify(record));
}
async function body(request) {
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) throw new HttpError(415,'请发送 JSON 数据。');
  const reader = request.body?.getReader(), chunks = [];
  let length = 0;
  if (reader) while (true) {
    const {done,value} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 2_000_000) { await reader.cancel(); throw new HttpError(413,'请将导入文件分为小于 2 MB 的批次。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk,offset);offset += chunk.byteLength;}
  const text = new TextDecoder().decode(bytes);
  try { return JSON.parse(text); } catch { throw new HttpError(400,'JSON 格式不正确。'); }
}
async function api(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path.startsWith('/api/auth/')) return auth(request,env,body);
  if (path === '/api/public' && request.method === 'GET') {
    const [cfg, logs] = await Promise.all([config(env.DB), records(env.DB)]);
    return json({config:{call:cfg.call,name:cfg.name,station:cfg.station},records:logs.map(r=>Object.fromEntries(PUBLIC_FIELDS.filter(k=>r[k]!=null).map(k=>[k,r[k]])))});
  }
  if (!path.startsWith('/api/admin/')) throw new HttpError(404,'接口不存在。');
  const user = await verifySession(request,env);
  if (!['GET','HEAD'].includes(request.method) && request.headers.get('Origin') !== url.origin) throw new HttpError(403,'管理操作仅允许来自同源后台页面。');
  if (path === '/api/admin/session' && request.method === 'GET') return json(user);
  if (path === '/api/admin/snapshot' && request.method === 'GET') return json({user,config:await config(env.DB),records:await records(env.DB)});
  if (path === '/api/admin/settings' && request.method === 'PUT') {
    const next = validateConfig(await body(request), await config(env.DB));
    await env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?').bind(JSON.stringify(next),'station').run();
    return json({config:next});
  }
  if (path === '/api/admin/records' && request.method === 'POST') {
    const input = await body(request), record = validateRecord(input.record), id = ADIF.recordId(record);
    const existing = await env.DB.prepare('SELECT id FROM records WHERE id = ?').bind(id).first();
    if (existing && input.originalId !== id) throw new HttpError(409,'相同通联已存在，请编辑已有记录。');
    const operations = [upsert(env.DB,record)];
    if (input.originalId && input.originalId !== id) {
      const original = await env.DB.prepare('SELECT id FROM records WHERE id = ?').bind(String(input.originalId)).first();
      if(!original) throw new HttpError(409,'原记录已不存在，请刷新。');
      operations.push(env.DB.prepare('DELETE FROM records WHERE id = ?').bind(input.originalId));
    }
    await env.DB.batch(operations);
    return json({record,id});
  }
  if (path.startsWith('/api/admin/records/') && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM records WHERE id = ?').bind(decodeURIComponent(path.slice('/api/admin/records/'.length))).run();
    return json({ok:true});
  }
  if (path === '/api/admin/import' && request.method === 'POST') {
    const input = await body(request);
    if (typeof input.adif !== 'string') throw new HttpError(400,'请提供 ADIF 文本。');
    const incoming = ADIF.parse(input.adif).records.map(validateRecord);
    if (!incoming.length) throw new HttpError(400,'没有可导入的通联记录。');
    if (incoming.length > 1000) throw new HttpError(413,'每批最多导入 1000 条记录。');
    const byId = new Map((await records(env.DB)).map(r=>[ADIF.recordId(r),r]));
    let added = 0, updated = 0, skipped = 0;
    const writes = new Map();
    for(const r of incoming) {
      const id=ADIF.recordId(r), exists=byId.get(id);
      if(exists && !input.merge) {skipped++;continue;}
      const next=exists?{...exists,...r}:r;
      byId.set(id,next); writes.set(id,next); if(exists) updated++; else added++;
    }
    if(writes.size) {
      const values=[...writes.values()], statements=[];
      // 30 records = 90 bound parameters. A 1000-record import stays below
      // D1 Free's 50 queries/invocation and 100 parameters/statement limits.
      for(let i=0;i<values.length;i+=30) {
        const chunk=values.slice(i,i+30);
        statements.push(env.DB.prepare('INSERT INTO records (id,qso_date,data) VALUES '+chunk.map(()=>'(?,?,?)').join(',')+' ON CONFLICT(id) DO UPDATE SET qso_date=excluded.qso_date,data=excluded.data')
          .bind(...chunk.flatMap(r=>[ADIF.recordId(r),r.QSO_DATE,JSON.stringify(r)])));
      }
      await env.DB.batch(statements);
    }
    return json({added,updated,skipped});
  }
  if (path === '/api/admin/export' && request.method === 'GET') return new Response(ADIF.serialize(await records(env.DB),{header:{ADIF_VER:'3.1.4',PROGRAMID:'ham-qsl-log'}}),{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="qsl-log-full.adi"','Cache-Control':'no-store'}});
  throw new HttpError(404,'接口不存在。');
}
export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url), isPublic=['/api/public','/api/satellites'].includes(url.pathname);
    try {
      if(isPublic && request.method==='OPTIONS') return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':env.PUBLIC_SITE_ORIGIN,'Access-Control-Allow-Methods':'GET','Vary':'Origin'}});
      let response;
      if(url.pathname==='/api/satellites'&&request.method==='GET')response=await satelliteCatalog(request,ctx);
      else if(url.pathname.startsWith('/api/')) response=await api(request,env);
      else if(['/admin','/admin/','/admin/login','/admin/setup'].includes(url.pathname)) {
        response=await env.ASSETS.fetch(new Request(new URL('/admin/index.html',url),request));
      } else if(url.pathname==='/') return Response.redirect(env.PUBLIC_SITE_URL,302);
      else if(/^\/(?:admin\/admin\.(?:js|css)|js\/(?:adif|geo|theme|insights|satellite-tools|satellite-worker)\.js|css\/(?:style|satellites)\.css|assets\/[^/]+)$/.test(url.pathname)) response=await env.ASSETS.fetch(request);
      else throw new HttpError(404,'页面不存在。');
      const headers=new Headers(response.headers);
      headers.set('X-Content-Type-Options','nosniff');
      headers.set('Referrer-Policy','no-referrer');
      if(url.pathname.startsWith('/admin')) {headers.set('Cache-Control','no-store');headers.set('X-Frame-Options','DENY');}
      if(isPublic && request.headers.get('Origin')===env.PUBLIC_SITE_ORIGIN) {headers.set('Access-Control-Allow-Origin',env.PUBLIC_SITE_ORIGIN);headers.set('Vary','Origin');}
      return new Response(response.body,{status:response.status,headers});
    } catch(error) {
      if(!error.status) console.error('Backend failure',error);
      const response=json({error:error.status?error.message:'服务暂时不可用。'},error.status||500);
      if(isPublic && request.headers.get('Origin')===env.PUBLIC_SITE_ORIGIN) response.headers.set('Access-Control-Allow-Origin',env.PUBLIC_SITE_ORIGIN);
      return response;
    }
  }
};
