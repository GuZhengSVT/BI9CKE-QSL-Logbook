import {parseTles} from '../../js/tle.mjs';
export const TLE_SOURCE='https://www.amsat.org/tle/current/nasabare.txt';
export async function satelliteCatalog(request,ctx) {
  const cache=typeof caches!=='undefined'?caches.default:null,key=new Request(new URL('/api/satellites',request.url));
  const cached=await cache?.match(key);if(cached)return cached;
  try {
    const upstream=await fetch(TLE_SOURCE,{signal:AbortSignal.timeout(12_000),headers:{Accept:'text/plain'},cf:{cacheTtl:3600,cacheEverything:true}});
    if(!upstream.ok)throw new Error(`AMSAT HTTP ${upstream.status}`);
    const text=await upstream.text(),satellites=parseTles(text);
    if(!satellites.length)throw new Error('Invalid satellite catalog');
    const response=Response.json({source:'AMSAT',sourceUrl:TLE_SOURCE,fetchedAt:new Date().toISOString(),satellites},{headers:{'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
    if(cache) {const save=cache.put(key,response.clone()).catch(error=>console.warn('Satellite cache unavailable',error.message));if(ctx)ctx.waitUntil(save);else await save;}
    return response;
  }catch(error){console.warn('Satellite catalog unavailable',error.message);return Response.json({error:'轨道数据源暂时不可用，请稍后重试或粘贴 TLE。'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
