import {record,predictPasses} from './orbit.mjs';
self.onmessage=event=>{
  const {id,tle,observer,start,hours,minElevation}=event.data;
  try {self.postMessage({id,passes:predictPasses(record(tle),observer,start,hours,minElevation)});}
  catch {self.postMessage({id,error:true});}
};
