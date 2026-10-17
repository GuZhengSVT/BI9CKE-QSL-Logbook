export function checksum(line) {
  return line.length >= 69 && /^\d$/.test(line[68]) && [...line.slice(0,68)].reduce((n,c)=>n+(c==='-'?1:/\d/.test(c)?Number(c):0),0)%10===Number(line[68]);
}
export function parseTles(text) {
  if(typeof text!=='string'||text.length>200_000)throw new Error('TLE data is empty or too large.');
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),records=new Map();
  for(let i=0;i<lines.length-1;i++) {
    const line1=lines[i],line2=lines[i+1];
    if(!line1.startsWith('1 ')||!line2.startsWith('2 ')||!checksum(line1)||!checksum(line2))continue;
    const id=line1.slice(2,7).trim();if(!/^[A-Z0-9]{1,5}$/.test(id)||line2.slice(2,7).trim()!==id)continue;
    const year=Number(line1.slice(18,20)),day=Number(line1.slice(20,32)),fullYear=year<57?2000+year:1900+year;
    const days=(Date.UTC(fullYear+1,0,1)-Date.UTC(fullYear,0,1))/86400000;
    if(!Number.isFinite(day)||day<1||day>=days+1)continue;
    const epoch=new Date(Date.UTC(fullYear,0,1)+(day-1)*86400000).toISOString();
    const previous=lines[i-1],name=previous&&!/^[12] /.test(previous)?previous.replace(/^0 /,'').slice(0,80):`NORAD ${id}`;
    if(!records.has(id)||records.get(id).epoch<epoch)records.set(id,{id,name,line1:line1.slice(0,69),line2:line2.slice(0,69),epoch});
    i++;
  }
  return [...records.values()];
}
