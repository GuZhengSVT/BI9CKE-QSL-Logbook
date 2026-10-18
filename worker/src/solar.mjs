export const SOLAR_SOURCE='https://www.hamqsl.com/solarxml.php';
export const HF_BANDS=['80m-40m','30m-20m','17m-15m','12m-10m'];
const MAX_BYTES=64_000;

// Only read the fixed, flat fields used by our panels; never render upstream HTML.
export function parseSolar(xml) {
  if(typeof xml!=='string'||xml.length>MAX_BYTES||!/^[\s\S]*<solar>\s*<solardata>[\s\S]*<\/solardata>\s*<\/solar>\s*$/.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Invalid solar feed');
  const field=name=>xml.match(new RegExp(`<${name}>\\s*([^<>]*?)\\s*</${name}>`))?.[1].trim()||'';
  const number=name=>{const value=field(name);return /^-?\d+(?:\.\d+)?$/.test(value)&&Number.isFinite(Number(value))?Number(value):null;};
  const stamp=field('updated'),parts=stamp.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{2})(\d{2}) GMT$/);
  if(!parts)throw new Error('Missing solar timestamp');
  const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(parts[2]);
  const date=new Date(Date.UTC(+parts[3],month,+parts[1],+parts[4],+parts[5]));
  if(month<0||date.getUTCMonth()!==month||date.getUTCDate()!==+parts[1]||+parts[4]>23||+parts[5]>59)throw new Error('Invalid solar timestamp');
  const metrics=Object.fromEntries(['solarflux','sunspots','aindex','kindex','solarwind','magneticfield','heliumline','protonflux','electonflux','aurora'].map(key=>[key,number(key)]));
  const conditions=xml.match(/<calculatedconditions>([\s\S]*?)<\/calculatedconditions>/)?.[1]||'';
  const bands=HF_BANDS.map(name=>({name,day:null,night:null}));
  for(const match of conditions.matchAll(/<band\b([^>]*)>\s*(Good|Fair|Poor)\s*<\/band>/g)) {
    const name=match[1].match(/\bname="([^"]+)"/)?.[1],time=match[1].match(/\btime="(day|night)"/)?.[1];
    const band=bands.find(row=>row.name===name);if(band&&time)band[time]=match[2];
  }
  if(!Object.values(metrics).some(value=>value!==null)||!bands.some(row=>row.day||row.night))throw new Error('Incomplete solar feed');
  const vhf=[];
  const phenomena=xml.match(/<calculatedvhfconditions>([\s\S]*?)<\/calculatedvhfconditions>/)?.[1]||'';
  for(const match of phenomena.matchAll(/<phenomenon\b([^>]*)>\s*([^<>]*?)\s*<\/phenomenon>/g)) {
    const name=match[1].match(/\bname="(vhf-aurora|E-Skip)"/)?.[1],location=match[1].match(/\blocation="(northern_hemi|europe|north_america|europe_6m|europe_4m)"/)?.[1];
    if(name&&location)vhf.push({name,location,condition:match[2].trim().slice(0,100)});
  }
  return {updatedAt:date.toISOString(),metrics,xray:/^[ABCMX]\d+(?:\.\d+)?$/.test(field('xray'))?field('xray'):null,geomagneticField:field('geomagfield').slice(0,80),signalNoise:field('signalnoise').slice(0,40),bands,vhf};
}

export async function solarConditions(request,ctx) {
  const cache=typeof caches!=='undefined'?caches.default:null,key=new Request(new URL('/api/solar',request.url));
  const cached=await cache?.match(key);if(cached)return cached;
  try {
    const upstream=await fetch(SOLAR_SOURCE,{signal:AbortSignal.timeout(12_000),headers:{Accept:'application/xml, text/xml'},cf:{cacheTtl:3600,cacheEverything:true}});
    if(!upstream.ok)throw new Error(`HAMQSL HTTP ${upstream.status}`);
    const reader=upstream.body.getReader(),decoder=new TextDecoder();let xml='',length=0;
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      length+=value.byteLength;if(length>MAX_BYTES){await reader.cancel();throw new Error('Solar feed too large');}
      xml+=decoder.decode(value,{stream:true});
    }
    xml+=decoder.decode();
    const response=Response.json({...parseSolar(xml),source:'HAMQSL · N0NBH',sourceUrl:'https://www.hamqsl.com/solar.html',fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
    if(cache) {const save=cache.put(key,response.clone()).catch(error=>console.warn('Solar cache unavailable',error.message));if(ctx)ctx.waitUntil(save);else await save;}
    return response;
  }catch(error) {
    console.warn('Solar data unavailable',error.message);
    return Response.json({error:'传播数据源暂时不可用，请稍后重试。'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
