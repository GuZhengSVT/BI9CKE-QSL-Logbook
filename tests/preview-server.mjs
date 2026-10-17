// Isolated local UI test harness. Never included in either deployment artifact.
// Uses the production password/session flow with test-only credentials and an in-memory database.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import worker from '../worker/src/index.mjs';
import {database} from './helpers.mjs';
import {digest} from '../worker/src/auth.mjs';
const db=database(),base='http://localhost:8002';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.adi':'text/plain'};
async function asset(directory,path) {
  const root=resolve(directory),file=resolve(root,'.'+decodeURIComponent(path));
  if(!file.startsWith(root+'/'))return new Response('Not found',{status:404});
  try {return new Response(await readFile(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}});}catch{return new Response('Not found',{status:404});}
}
const env={ADMIN_USERNAME:'BI9CKE',ADMIN_SETUP_HASH:await digest('local-preview-only'),DB:db,PUBLIC_SITE_ORIGIN:base,PUBLIC_SITE_URL:base+'/',ASSETS:{fetch:request=>asset('dist/backend',new URL(request.url).pathname)}};
await worker.fetch(new Request(base+'/api/auth/setup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({setupToken:'local-preview-only',password:'preview-password-only'})}),env);
createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,base).pathname;
    let response;
    if(path==='/__mobile') response=new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>Local mobile preview</title><body style="margin:0;background:#263440"><iframe title="390px mobile preview" src="/admin/" style="border:0;width:390px;height:844px;display:block;margin:20px auto"></iframe>',{headers:{'Content-Type':'text/html'}});
    else if(path==='/data/config.json') {
      const cfg=JSON.parse(await readFile('dist/public/data/config.json','utf8'));cfg.apiBaseUrl=base;
      response=Response.json(cfg,{headers:{'Cache-Control':'no-store'}});
    } else if(path==='/js/insights.js') response=await asset('dist/backend',path);
    else if(path.startsWith('/api/') || path.startsWith('/admin/')) {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const request=new Request(new URL(req.url,base),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
      response=await worker.fetch(request,env);
    } else response=await asset('dist/public',path==='/'?'/index.html':path);
    const headers=new Headers(response.headers);
    // Only this isolated, in-memory UI fixture permits framing for breakpoint checks.
    if(path.startsWith('/admin/')) headers.delete('X-Frame-Options');
    res.writeHead(response.status,Object.fromEntries(headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error(error);res.writeHead(500);res.end('Test harness failure');}
}).listen(8002,'127.0.0.1',()=>console.log('Isolated UI test fixture: '+base+' (account BI9CKE / preview-password-only, in-memory database)'));
