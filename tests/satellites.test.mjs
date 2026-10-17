import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sgp4} from 'satellite.js';
import {parseTles,record,state,predictPasses,splitTrack,radialSpeed,doppler} from '../js/orbit.mjs';
import worker from '../worker/src/index.mjs';
import {TLE_SOURCE} from '../worker/src/satellites.mjs';
import {normalizeInfo} from '../worker/src/satellite-info.mjs';
// Published SGP4 verification vector (Vallado, mirrored by python-sgp4).
// https://github.com/brandon-rhodes/python-sgp4/blob/master/sgp4/tcppver.out
const vanguard=`VANGUARD 1
1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753
2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667`;
// satellite.js upstream test/io.json; frozen epoch makes tests independent of live data.
const iss=`ISS
1 25544U 98067A   23231.51768399  .00014050  00000+0  25837-3 0  9996
2 25544  51.6415  14.7889 0003559 325.3396 149.4637 15.49477580411611`;
test('TLE parsing validates checksums, catalog pairing, epochs and duplicate entries',()=>{
  const rows=parseTles(vanguard+'\r\n'+iss+'\n'+iss);assert.equal(rows.length,2);assert.equal(rows[0].id,'00005');assert(rows[0].epoch.startsWith('2000-06-27'));
  assert.equal(parseTles(iss.replace('9996','9990')).length,0);
  assert.equal(parseTles(iss.replace('2 25544','2 25545')).length,0);
  assert.equal(parseTles('<html>unavailable</html>').length,0);
  assert.throws(()=>parseTles('a'.repeat(200001)));
});
test('SGP4 matches the published epoch position to one centimetre',()=>{
  const sat=record(parseTles(vanguard)[0]),vector=sgp4(sat,0).position;
  for(const [key,expected] of Object.entries({x:7022.46529266,y:-1400.08296755,z:0.03995155}))assert(Math.abs(vector[key]-expected)<0.00001);
});
test('Pass rise and set straddle the geometric horizon, with a valid peak and observer units',()=>{
  const tle=parseTles(iss)[0],sat=record(tle),start=Date.parse(tle.epoch),observer={lat:39,lon:116,height:50};
  const passes=predictPasses(sat,observer,start,24,0);assert(passes.length>2);
  for(const p of passes.filter(p=>p.aos&&p.los)) {
    assert(p.aos<p.peak&&p.peak<p.los);assert(p.maxElevation>=0&&p.maxElevation<=90);
    assert(state(sat,p.aos-1000,observer).elevation<0);assert(state(sat,p.aos+1000,observer).elevation>0);
    assert(state(sat,p.los-1000,observer).elevation>0);assert(state(sat,p.los+1000,observer).elevation<0);
    assert(p.points.length>2);
  }
  const high=predictPasses(sat,observer,start,24,30);assert(high.every(p=>p.maxElevation>=30));assert(high.length<passes.length);
  const p=passes.find(p=>p.maxElevation>10&&p.los),ongoing=predictPasses(sat,observer,p.peak+10_000,1,0)[0];
  assert(ongoing.ongoing);assert(Math.abs(ongoing.peak-p.peak)<1500);assert(Math.abs(ongoing.aos-p.aos)<1000);
  assert.throws(()=>predictPasses(sat,{lat:91,lon:0},start));
});
test('Dateline splitting avoids full-map streaks and Doppler sign follows range rate',()=>{
  const segments=splitTrack([{lat:0,lon:179},{lat:1,lon:-179},{lat:2,lon:-170},null,{lat:3,lon:10}]);assert.equal(segments.length,3);
  for(const line of segments)for(let i=1;i<line.length;i++)assert(Math.abs(line[i].lon-line[i-1].lon)<=180);
  const away=doppler(145.8,7.5),towards=doppler(145.8,-7.5);assert(away.receiveMHz<145.8&&away.transmitMHz>145.8);assert(towards.receiveMHz>145.8);
  assert(Math.abs(away.receiveShiftHz+3647.5)<10);assert.equal(doppler(0,7),null);assert.equal(doppler(145.8,NaN),null);
  const tle=parseTles(iss)[0];assert(Number.isFinite(radialSpeed(record(tle),Date.parse(tle.epoch),{lat:39,lon:116})));
});
test('Public catalog proxy caches validated elements, applies CORS, and fails explicitly',async()=>{
  const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;let calls=0;const saved=new Map();
  globalThis.caches={default:{match:async key=>saved.get(key.url)?.clone(),put:async(key,response)=>{saved.set(key.url,response);}}};
  globalThis.fetch=async url=>{assert.equal(url,TLE_SOURCE);calls++;return new Response(iss);};
  const env={PUBLIC_SITE_ORIGIN:'https://radio.example'},request=()=>new Request('https://backend.example/api/satellites',{headers:{Origin:env.PUBLIC_SITE_ORIGIN}});
  try {
    const response=await worker.fetch(request(),env),data=await response.json();assert.equal(response.status,200);assert.equal(data.satellites[0].name,'ISS');assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.PUBLIC_SITE_ORIGIN);
    assert.equal((await worker.fetch(request(),env)).status,200);assert.equal(calls,1);
    saved.clear();globalThis.fetch=async()=>new Response('unavailable',{status:503});
    assert.equal((await worker.fetch(request(),env)).status,503);
    assert.equal((await worker.fetch(new Request('https://backend.example/api/satellites',{method:'POST'}),env)).status,404);
  }finally{globalThis.fetch=originalFetch;if(originalCaches===undefined)delete globalThis.caches;else globalThis.caches=originalCaches;}
});
test('Satellite profiles preserve frequency ranges, reject foreign rows and do not invent missing facts',()=>{
  const info=normalizeInfo(25544,[{norad_cat_id:25544,sat_id:'test',name:'ISS',operator:'None',countries:'RU,US',website:'javascript:alert(1)'}],[
    {norad_cat_id:25544,description:'Linear',uplink_low:435000000,uplink_high:435100000,downlink_low:-1,mode:'USB',alive:true,status:'active',citation:'https://example.org/radio'},
    {norad_cat_id:25544,description:'Old',alive:false,status:'inactive'},
    {norad_cat_id:123,name:'Unrelated',alive:true,status:'active'}
  ]);
  assert.equal(info.operator,'');assert.equal(info.website,'');assert.equal(info.transmitters.length,2);
  assert.equal(info.transmitters[0].uplinkHigh,435100000);assert.equal(info.transmitters[0].downlinkLow,null);
  assert(info.transmitters[0].active);assert(!info.transmitters[1].active);assert.equal(info.license,'CC BY-SA 4.0');
  assert.equal(normalizeInfo(10,[],[]),null);assert.throws(()=>normalizeInfo(10,{},[]));
});
test('Satellite metadata API uses fixed upstream URLs, caches by NORAD and handles missing/unavailable sources',async()=>{
  const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;let calls=0;const saved=new Map();
  globalThis.caches={default:{match:async key=>saved.get(key.url)?.clone(),put:async(key,response)=>saved.set(key.url,response)}};
  globalThis.fetch=async url=>{assert(url.startsWith('https://db.satnogs.org/api/'));assert(url.includes('norad_cat_id=25544'));calls++;return Response.json(url.includes('/transmitters/')?[]:[{norad_cat_id:25544,sat_id:'test',name:'ISS'}]);};
  const env={PUBLIC_SITE_ORIGIN:'https://radio.example'},get=(path,method='GET')=>worker.fetch(new Request('https://backend.example'+path,{method,headers:{Origin:env.PUBLIC_SITE_ORIGIN}}),env);
  try {
    const response=await get('/api/satellites/25544');assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.PUBLIC_SITE_ORIGIN);assert.equal((await response.json()).name,'ISS');
    assert.equal((await get('/api/satellites/25544?ignored=yes')).status,200);assert.equal(calls,2);
    assert.equal((await get('/api/satellites/not-a-number')).status,400);assert.equal(calls,2);
    saved.clear();globalThis.fetch=async()=>Response.json([]);assert.equal((await get('/api/satellites/123')).status,404);
    globalThis.fetch=async()=>new Response('unavailable',{status:503});assert.equal((await get('/api/satellites/123')).status,503);
    assert.equal((await get('/api/satellites/25544','POST')).status,404);
  }finally{globalThis.fetch=originalFetch;if(originalCaches===undefined)delete globalThis.caches;else globalThis.caches=originalCaches;}
});
