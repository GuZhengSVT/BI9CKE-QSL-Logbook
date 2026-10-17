/* Pure logbook calculations shared by the console and its tests. */
'use strict';
const QslInsights = (() => {
  const utcDate = date => date.toISOString().slice(0,10).replaceAll('-','');
  const confirmed = r => r.QSL_RCVD === 'Y' || r.LOTW_QSL_RCVD === 'Y';
  const pending = r => ['R','Q'].includes(r.QSL_SENT);
  function filter(records,f={}) {
    const query=String(f.query||'').trim().toLowerCase();
    return records.filter(r => (!query || [r.CALL,r.COUNTRY,r.GRIDSQUARE,r.SAT_NAME].some(v=>String(v||'').toLowerCase().includes(query))) &&
      (!f.band || r.BAND===f.band) && (!f.mode || r.MODE===f.mode) &&
      (!f.from || r.QSO_DATE>=f.from.replaceAll('-','')) && (!f.to || r.QSO_DATE<=f.to.replaceAll('-','')) &&
      (!f.qsl || (f.qsl==='pending'?pending(r):f.qsl==='confirmed'?confirmed(r):f.qsl==='unconfirmed'?!confirmed(r):true)));
  }
  function summary(records,now=new Date()) {
    const today=utcDate(now),dates=new Set(records.map(r=>r.QSO_DATE)),day=86400000;
    // A streak remains current until the end of the next UTC day.
    let cursor=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()),streak=0;
    if(!dates.has(today)) cursor-=day;
    while(dates.has(utcDate(new Date(cursor)))) {streak++;cursor-=day;}
    const dxcc=r=>r.DXCC || r.COUNTRY,grid=r=>String(r.GRIDSQUARE||'').slice(0,4).toUpperCase();
    const unique=(source,key)=>new Set(source.map(key).filter(Boolean)).size,yes=records.filter(confirmed);
    const months=Array.from({length:12},(_,i)=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-11+i,1)).toISOString().slice(0,7));
    return {total:records.length,today:records.filter(r=>r.QSO_DATE===today).length,
      month:records.filter(r=>r.QSO_DATE?.startsWith(today.slice(0,6))).length,
      year:records.filter(r=>r.QSO_DATE?.startsWith(today.slice(0,4))).length,streak,
      calls:unique(records,r=>String(r.CALL||'').toUpperCase()),dxcc:unique(records,dxcc),dxccConfirmed:unique(yes,dxcc),
      grids:unique(records,grid),gridsConfirmed:unique(yes,grid),confirmed:yes.length,pending:records.filter(pending).length,
      months:months.map(month=>({month,count:records.filter(r=>r.QSO_DATE?.startsWith(month.replace('-',''))).length}))};
  }
  return {filter,summary,confirmed,pending};
})();
globalThis.QslInsights = QslInsights;
