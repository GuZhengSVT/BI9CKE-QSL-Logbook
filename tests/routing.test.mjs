import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.mjs';
test('Dashboard and legacy URLs serve the same shell with namespaced assets and private APIs',async()=>{
  const seen=[],env={PUBLIC_SITE_URL:'https://radio.example/',ASSETS:{fetch:async request=>{seen.push(new URL(request.url).pathname);return new Response('asset');}}};
  for(const path of ['/dashboard','/dashboard/','/dashboard/login','/dashboard/setup','/admin/']) {
    const response=await worker.fetch(new Request('https://radio.example'+path),env);
    assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Frame-Options'),'DENY');assert.equal(seen.pop(),'/admin/index.html');
  }
  for(const file of ['admin/admin.js','css/style.css','css/solar.css','js/solar.js','js/satellite-tools.js','js/satellite-worker.js','assets/world-land-dots.json']) {
    assert.equal((await worker.fetch(new Request('https://radio.example/dashboard/static/'+file),env)).status,200);assert.equal(seen.pop(),'/'+file);
  }
  assert.equal((await worker.fetch(new Request('https://radio.example/dashboard/static/admin/index.html'),env)).status,404);
});
test('Public CORS accepts both migration origins without allowing foreign origins',async()=>{
  const env={PUBLIC_SITE_ORIGIN:'https://bi9cke.example',LEGACY_PUBLIC_SITE_ORIGIN:'https://www.example'};
  for(const origin of [env.PUBLIC_SITE_ORIGIN,env.LEGACY_PUBLIC_SITE_ORIGIN]) {
    const response=await worker.fetch(new Request('https://backend.example/api/public',{method:'OPTIONS',headers:{Origin:origin}}),env);
    assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
    const error=await worker.fetch(new Request('https://backend.example/api/satellites/invalid',{headers:{Origin:origin}}),env);
    assert.equal(error.status,400);assert.equal(error.headers.get('Access-Control-Allow-Origin'),origin);
  }
  const foreign=await worker.fetch(new Request('https://backend.example/api/satellites/invalid',{headers:{Origin:'https://foreign.example'}}),env);
  assert.equal(foreign.headers.get('Access-Control-Allow-Origin'),null);
});
