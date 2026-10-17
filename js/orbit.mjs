import {twoline2satrec,propagate,gstime,eciToGeodetic,eciToEcf,ecfToLookAngles,degreesLat,degreesLong} from 'satellite.js';
export {parseTles} from './tle.mjs';
const DEG=180/Math.PI,R=6371.0088;
export function record(tle) {const sat=twoline2satrec(tle.line1,tle.line2);if(sat.error||!Number.isFinite(sat.no)||sat.no<=0)throw new Error('Invalid orbit');return sat;}
export function state(sat,time,observer=null) {
  const date=new Date(time),pv=propagate(sat,date);
  if(!pv||!pv.position||sat.error) return null;
  const gmst=gstime(date),geo=eciToGeodetic(pv.position,gmst),ecf=eciToEcf(pv.position,gmst);
  const value={lat:degreesLat(geo.latitude),lon:degreesLong(geo.longitude),altitude:geo.height};
  if(!Object.values(value).every(Number.isFinite)||value.altitude<0)return null;
  if(observer) {
    const look=ecfToLookAngles({latitude:observer.lat/DEG,longitude:observer.lon/DEG,height:(observer.height||0)/1000},ecf);
    Object.assign(value,{azimuth:(look.azimuth*DEG+360)%360,elevation:look.elevation*DEG,range:look.rangeSat});
  }
  return value;
}
export function radialSpeed(sat,time,observer) {
  if(!observer)return null;
  const a=state(sat,time-500,observer),b=state(sat,time+500,observer);
  return a&&b?b.range-a.range:null; // km/s, positive when receding; includes observer rotation.
}
export function doppler(frequencyMHz,speed) {
  if(!Number.isFinite(frequencyMHz)||frequencyMHz<=0||!Number.isFinite(speed))return null;
  const shift=frequencyMHz*1e6*speed/299792.458;
  return {receiveMHz:frequencyMHz-shift/1e6,transmitMHz:frequencyMHz+shift/1e6,receiveShiftHz:-shift,transmitShiftHz:shift};
}
export function mapPoint(p) {return {x:(p.lon+180)*2,y:(90-p.lat)*2};}
export function splitTrack(points) {
  const segments=[];let line=[];
  for(const p of points) {if(!p){if(line.length)segments.push(line);line=[];continue;}if(line.length&&Math.abs(p.lon-line.at(-1).lon)>180){segments.push(line);line=[];}line.push(p);}
  if(line.length)segments.push(line);return segments;
}
export function groundTrack(sat,time,minutes=90) {
  const part=(from,to)=>splitTrack(Array.from({length:Math.round((to-from)/60_000)+1},(_,i)=>state(sat,from+i*60_000)));
  return {past:part(time-minutes*60_000,time),future:part(time,time+minutes*60_000)};
}
export function footprint(position) {
  const angle=Math.acos(R/(R+position.altitude)),lat=position.lat/DEG,lon=position.lon/DEG,points=[];
  for(let bearing=0;bearing<=360;bearing+=3) {
    const b=bearing/DEG,p=Math.asin(Math.sin(lat)*Math.cos(angle)+Math.cos(lat)*Math.sin(angle)*Math.cos(b));
    const l=lon+Math.atan2(Math.sin(b)*Math.sin(angle)*Math.cos(lat),Math.cos(angle)-Math.sin(lat)*Math.sin(p));
    points.push({lat:p*DEG,lon:((l*DEG+540)%360)-180});
  }
  return splitTrack(points);
}
export function predictPasses(sat,observer,start,hours=24,minElevation=10) {
  if(!observer||!Number.isFinite(observer.lat)||!Number.isFinite(observer.lon)||Math.abs(observer.lat)>90||Math.abs(observer.lon)>180)throw new Error('Invalid observer');
  const elevation=t=>{const p=state(sat,t,observer);if(!p)throw new Error('Orbit propagation failed');return p.elevation;};
  const step=20_000,end=start+Math.min(48,Math.max(1,hours))*3600_000,passes=[];
  function crossing(a,b,rising) {while(b-a>500){const mid=(a+b)/2;if((elevation(mid)>=0)===rising)b=mid;else a=mid;}return (a+b)/2;}
  let above=elevation(start)>=0,aos=null,maxAt=start,maxEl=elevation(start);
  if(above) {
    const back=Math.min(86400_000,Math.max(7200_000,Math.PI*2/sat.no*60_000*1.2));
    for(let t=start-60_000;t>=start-back;t-=60_000)if(elevation(t)<0){aos=crossing(t,t+60_000,true);break;}
    if(aos!=null)for(let t=aos;t<start;t+=step){const el=elevation(t);if(el>maxEl){maxAt=t;maxEl=el;}}
  }
  function emit(los) {
    let a=Math.max(aos??start,maxAt-step),b=Math.min(los??end,maxAt+step);
    for(let i=0;i<20;i++){const x=a+(b-a)/3,y=b-(b-a)/3;if(elevation(x)<elevation(y))a=x;else b=y;}
    const peak=(a+b)/2,maximum=elevation(peak);
    if(maximum<minElevation)return;
    const from=aos??start,to=Math.min(los??end,end),points=[];
    for(let t=from;t<to;t+=Math.max(5000,(to-from)/100)) {const p=state(sat,t,observer);points.push({time:t,azimuth:p.azimuth,elevation:p.elevation});}
    const p=state(sat,to,observer);points.push({time:to,azimuth:p.azimuth,elevation:p.elevation});
    passes.push({aos,los,peak,maxElevation:maximum,aosAzimuth:aos==null?null:state(sat,aos,observer).azimuth,losAzimuth:los==null?null:state(sat,los,observer).azimuth,ongoing:aos==null||aos<start,points});
  }
  for(let previous=start,t=Math.min(start+step,end);previous<end;previous=t,t=Math.min(t+step,end)) {
    const el=elevation(t),up=el>=0;
    if(up&&!above){aos=crossing(previous,t,true);maxAt=t;maxEl=el;}
    if(up&&el>maxEl){maxAt=t;maxEl=el;}
    if(!up&&above)emit(crossing(previous,t,false));
    above=up;
  }
  if(above)emit(null);
  return passes;
}
