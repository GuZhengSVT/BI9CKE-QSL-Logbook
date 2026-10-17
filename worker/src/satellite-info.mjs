const DATABASE='https://db.satnogs.org';
const clean=value=>typeof value==='string'&&!['none','unknown','null'].includes(value.trim().toLowerCase())?value.trim().slice(0,500):'';
const frequency=value=>Number.isFinite(value)&&value>0&&value<=100_000_000_000?value:null;
const link=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}};
export function normalizeInfo(id,satellites,transmitters) {
  if(!Array.isArray(satellites)||!Array.isArray(transmitters))throw new Error('Invalid satellite metadata');
  const sat=satellites.find(s=>s.norad_cat_id===id);
  if(!sat)return null;
  return {
    id,name:clean(sat.name),aliases:clean(sat.names),operator:clean(sat.operator),countries:clean(sat.countries),
    launched:clean(sat.launched),status:clean(sat.status),updated:clean(sat.updated),website:link(sat.website),
    source:'SatNOGS DB',sourceUrl:`${DATABASE}/satellite/${encodeURIComponent(sat.sat_id)}/`,
    license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',
    transmitters:transmitters.filter(t=>t.norad_cat_id===id).slice(0,100).map(t=>({
      description:clean(t.description),mode:clean(t.mode),uplinkMode:clean(t.uplink_mode),
      uplinkLow:frequency(t.uplink_low),uplinkHigh:frequency(t.uplink_high),
      downlinkLow:frequency(t.downlink_low),downlinkHigh:frequency(t.downlink_high),
      active:t.alive===true&&t.status==='active',status:clean(t.status),inverting:t.invert===true,
      baud:Number.isFinite(t.baud)&&t.baud>0?t.baud:null,updated:clean(t.updated),citation:link(t.citation)
    }))
  };
}
export async function satelliteInfo(request,ctx) {
  const id=Number(new URL(request.url).pathname.split('/').pop());
  if(!Number.isInteger(id)||id<1||id>999999)return Response.json({error:'NORAD 编号无效。'},{status:400});
  const key=new Request(new URL(`/api/satellites/${id}`,request.url));
  const cache=typeof caches!=='undefined'?caches.default:null,cached=await cache?.match(key);
  if(cached)return cached;
  try {
    const read=async path=>{
      const response=await fetch(DATABASE+path,{signal:AbortSignal.timeout(10_000),headers:{Accept:'application/json'},cf:{cacheTtl:86400,cacheEverything:true}});
      if(!response.ok)throw new Error(`SatNOGS HTTP ${response.status}`);
      return response.json();
    };
    const [satellites,transmitters]=await Promise.all([
      read(`/api/satellites/?norad_cat_id=${id}&format=json`),
      read(`/api/transmitters/?satellite__norad_cat_id=${id}&format=json`)
    ]);
    const info=normalizeInfo(id,satellites,transmitters);
    if(!info)return Response.json({error:'资料库暂未收录这颗卫星。'},{status:404,headers:{'Cache-Control':'public, max-age=3600'}});
    const response=Response.json({...info,fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'public, max-age=86400'}});
    if(cache){const save=cache.put(key,response.clone()).catch(error=>console.warn('Satellite information cache unavailable',error.message));if(ctx)ctx.waitUntil(save);else await save;}
    return response;
  }catch(error){console.warn('Satellite information unavailable',error.message);return Response.json({error:'卫星资料源暂时不可用。'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
