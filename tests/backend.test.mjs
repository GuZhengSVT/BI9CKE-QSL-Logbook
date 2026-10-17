import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.mjs';
import {database} from './helpers.mjs';
import {digest} from '../worker/src/auth.mjs';

test('Session authentication, D1 persistence and public/admin separation',async t=>{
  const db=database();
  const env={ADMIN_USERNAME:'BI9CKE',ADMIN_SETUP_HASH:await digest('test-bootstrap-key'),DB:db,PUBLIC_SITE_ORIGIN:'https://radio.example',PUBLIC_SITE_URL:'https://radio.example/log/',ASSETS:{fetch:async()=>new Response('<html>admin shell</html>')}};
  let session='';
  const request=(path,options={})=>worker.fetch(new Request('https://backend.example'+path,{...options,headers:{Origin:'https://backend.example',...(options.admin?{Cookie:options.cookie||session}:{}),...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},body:options.body?JSON.stringify(options.body):undefined}),env);
  await t.test('anonymous readers only receive public data',async()=>{
    const response=await request('/api/public',{headers:{Origin:'https://radio.example'}}),data=await response.json();
    assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://radio.example');assert.equal(data.records.length,7);
    assert(data.records.every(r=>!('COMMENT' in r)&&!('QSLMSG' in r)));
    assert.equal((await request('/api/admin/snapshot')).status,401);
    assert.equal((await request('/api/admin/records',{method:'POST',body:{record:{}}})).status,401);
  });
  await t.test('first setup creates a session, cannot repeat, and forged cookies are rejected',async()=>{
    const setup=await request('/api/auth/setup',{method:'POST',body:{password:'test-password-123456',setupToken:'test-bootstrap-key'}});
    assert.equal(setup.status,200);session=setup.headers.get('Set-Cookie').split(';')[0];
    assert.match(setup.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Strict/);
    assert.equal((await request('/api/auth/setup',{method:'POST',body:{password:'another-password',setupToken:'test-bootstrap-key'}})).status,409);
    assert.equal((await request('/api/admin/session',{admin:true,cookie:'__Host-qsl_session='+ 'a'.repeat(64)})).status,401);
    assert.equal((await request('/api/admin/session',{headers:{'Cf-Access-Jwt-Assertion':'forged'}})).status,401);
  });
  await t.test('foreign-origin writes are rejected',async()=>{
    assert.equal((await request('/api/admin/settings',{method:'PUT',admin:true,headers:{Origin:'https://evil.example'},body:{}})).status,403);
    assert.equal((await request('/api/public',{headers:{Origin:'https://evil.example'}})).headers.get('Access-Control-Allow-Origin'),null);
  });
  await t.test('settings support grid centers, coordinates and clearing location',async()=>{
    const input={call:'BI9CKE',name:'Test station',station:{grid:'OM89AA',lat:'',lon:''}};
    assert.equal((await request('/api/admin/settings',{method:'PUT',admin:true,body:input})).status,200);
    assert.equal((await (await request('/api/public')).json()).config.station.grid,'OM89AA');
    assert.equal((await request('/api/admin/settings',{method:'PUT',admin:true,body:{...input,station:{grid:'INVALID'}}})).status,400);
    assert.equal((await request('/api/admin/settings',{method:'PUT',admin:true,body:{...input,station:{lat:91,lon:1}}})).status,400);
    assert.equal((await request('/api/admin/settings',{method:'PUT',admin:true,body:{...input,station:{grid:'',lat:'',lon:''}}})).status,200);
  });
  const record={CALL:'TEST01',QSO_DATE:'20261018',TIME_ON:'123000',BAND:'20M',MODE:'CW',GRIDSQUARE:'PM95',COMMENT:'private note',QSLMSG:'private card message'};
  await t.test('create, edit identity, duplicate protection and public redaction',async()=>{
    const saved=await request('/api/admin/records',{method:'POST',admin:true,body:{record}});assert.equal(saved.status,200);
    const {id}=await saved.json();
    assert.equal((await request('/api/admin/records',{method:'POST',admin:true,body:{record}})).status,409);
    const next={...record,CALL:'TEST02',QSL_RCVD:'Y'};
    assert.equal((await request('/api/admin/records',{method:'POST',admin:true,body:{record:next,originalId:id}})).status,200);
    const publicData=await(await request('/api/public')).json();assert.equal(publicData.records.length,8);assert(!publicData.records.some(r=>r.CALL==='TEST01'));
    assert.equal(publicData.records.find(r=>r.CALL==='TEST02').QSL_RCVD,'Y');assert(!publicData.records.find(r=>r.CALL==='TEST02').COMMENT);
    const adminData=await(await request('/api/admin/snapshot',{admin:true})).json();assert.equal(adminData.records.find(r=>r.CALL==='TEST02').COMMENT,'private note');
  });
  await t.test('import is validated before committing and exports preserve ADIF fields',async()=>{
    const adif='<CALL:6>TEST03 <QSO_DATE:8>20261018 <BAND:3>40M <MODE:3>FT8 <EOR>';
    assert.equal((await request('/api/admin/import',{method:'POST',admin:true,body:{adif}})).status,200);
    assert.equal((await(await request('/api/admin/import',{method:'POST',admin:true,body:{adif}})).json()).skipped,1);
    const invalid=adif.replace('TEST03','TEST04')+'<CALL:3>BAD <EOR>';
    assert.equal((await request('/api/admin/import',{method:'POST',admin:true,body:{adif:invalid}})).status,400);
    const exported=await request('/api/admin/export',{admin:true}),records=ADIF.parse(await exported.text()).records;
    assert.equal(records.length,9);assert(!records.some(r=>r.CALL==='TEST04'));assert.equal(records.find(r=>r.CALL==='TEST02').COMMENT,'private note');
    assert.equal((await request('/api/admin/export')).status,401);
  });
  await t.test('delete requires a session and removes the selected record',async()=>{
    const path='/api/admin/records/'+encodeURIComponent(ADIF.recordId({...record,CALL:'TEST02'}));
    assert.equal((await request(path,{method:'DELETE'})).status,401);
    assert.equal((await request(path,{method:'DELETE',admin:true})).status,200);
    assert.equal((await(await request('/api/public')).json()).records.length,8);
    assert.equal((await request('/admin/index.html')).status,404);
  });
  await t.test('1000-record import respects D1 Free parameter and query limits',async()=>{
    const bulk=ADIF.serialize(Array.from({length:1000},(_,i)=>({CALL:'BULK'+i,QSO_DATE:'20261018',BAND:'20M',MODE:'CW'})));
    const response=await request('/api/admin/import',{method:'POST',admin:true,body:{adif:bulk}});
    assert.equal(response.status,200);assert.equal((await response.json()).added,1000);
    assert.equal((await(await request('/api/public')).json()).records.length,1008);
  });
  db.close();
});
