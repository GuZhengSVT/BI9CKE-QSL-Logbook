import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSolar,SOLAR_SOURCE} from '../worker/src/solar.mjs';
import worker from '../worker/src/index.mjs';
const xml=`<?xml version="1.0"?><solar><solardata>
<source url="http://www.hamqsl.com/solar.html">N0NBH</source><updated> 18 Oct 2026 1042 GMT</updated>
<solarflux>132</solarflux><aindex> 6</aindex><kindex> 0</kindex><xray>B6.2</xray><sunspots>87</sunspots>
<solarwind>480.0</solarwind><magneticfield> -1.8</magneticfield><heliumline>112.1</heliumline>
<protonflux>NoRpt</protonflux><electonflux></electonflux><aurora>1</aurora>
<calculatedconditions><band name="80m-40m" time="day">Fair</band><band time="night" name="80m-40m">Good</band><band name="30m-20m" time="day">Good</band><band name="12m-10m" time="night">Poor</band></calculatedconditions>
<calculatedvhfconditions><phenomenon name="vhf-aurora" location="northern_hemi">Band Closed</phenomenon><phenomenon name="E-Skip" location="europe_6m">Band Open</phenomenon></calculatedvhfconditions>
<geomagfield>QUIET</geomagfield><signalnoise>S1-S2</signalnoise></solardata></solar>`;
test('Solar XML preserves UTC, zero, negative Bz, missing readings and regional/day-night labels',()=>{
  const data=parseSolar(xml);
  assert.equal(data.updatedAt,'2026-10-18T10:42:00.000Z');assert.equal(data.metrics.kindex,0);assert.equal(data.metrics.magneticfield,-1.8);
  assert.equal(data.metrics.protonflux,null);assert.equal(data.metrics.electonflux,null);assert.equal(data.xray,'B6.2');
  assert.deepEqual(data.bands[0],{name:'80m-40m',day:'Fair',night:'Good'});assert.equal(data.bands[2].night,null);
  assert.equal(data.vhf[1].location,'europe_6m');assert.equal(data.vhf[1].condition,'Band Open');
  assert.equal(data.geomagneticField,'QUIET');assert.equal(data.signalNoise,'S1-S2');
});
test('Solar parser rejects error pages, incomplete feeds and invalid dates without fabricating readings',()=>{
  for(const input of ['<html>Error</html>',xml.replace('18 Oct','32 Oct'),xml.replace('1042 GMT','2562 GMT'),xml.replace('Oct','Foo'),xml.replace(/<calculatedconditions>[\s\S]*?<\/calculatedconditions>/,''),'x'.repeat(64_001),'<!DOCTYPE solar>'+xml])assert.throws(()=>parseSolar(input));
  assert.equal(parseSolar(xml.replace('<solarflux>132</solarflux>','<solarflux>No Report</solarflux>')).metrics.solarflux,null);
  assert.equal(parseSolar(xml.replace('>Fair</band>','>Unavailable</band>')).bands[0].day,null);
});
test('Solar API uses a fixed source, hourly cache, query-independent key and public CORS',async()=>{
  const originalFetch=globalThis.fetch,originalCaches=globalThis.caches,saved=new Map();let calls=0;
  globalThis.caches={default:{match:async key=>saved.get(key.url)?.clone(),put:async(key,response)=>saved.set(key.url,response)}};
  globalThis.fetch=async(url,options)=>{assert.equal(url,SOLAR_SOURCE);assert.equal(options.cf.cacheTtl,3600);calls++;return new Response(xml);};
  const env={PUBLIC_SITE_ORIGIN:'https://radio.example',LEGACY_PUBLIC_SITE_ORIGIN:'https://old.example'},get=(query='',origin=env.PUBLIC_SITE_ORIGIN,method='GET')=>worker.fetch(new Request('https://backend.example/api/solar'+query,{method,headers:{Origin:origin}}),env);
  try {
    const response=await get();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'public, max-age=3600');assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.PUBLIC_SITE_ORIGIN);
    assert.equal((await response.json()).metrics.solarflux,132);
    const legacy=await get('?refresh=1',env.LEGACY_PUBLIC_SITE_ORIGIN);assert.equal(legacy.headers.get('Access-Control-Allow-Origin'),env.LEGACY_PUBLIC_SITE_ORIGIN);assert.equal(calls,1);
    assert.equal((await get('','https://foreign.example')).headers.get('Access-Control-Allow-Origin'),null);
    assert.equal((await get('',env.PUBLIC_SITE_ORIGIN,'OPTIONS')).status,204);
    assert.equal((await get('',env.PUBLIC_SITE_ORIGIN,'POST')).status,404);assert.equal(calls,1);
    saved.clear();globalThis.fetch=async()=>new Response('<html>not XML</html>');
    const failed=await get();assert.equal(failed.status,503);assert.equal(failed.headers.get('Cache-Control'),'no-store');assert.equal(saved.size,0);
    globalThis.fetch=async()=>new Response('x'.repeat(64_001));assert.equal((await get()).status,503);
    globalThis.fetch=async()=>new Response('Unavailable',{status:503});assert.equal((await get()).status,503);
  }finally{globalThis.fetch=originalFetch;if(originalCaches===undefined)delete globalThis.caches;else globalThis.caches=originalCaches;}
});
