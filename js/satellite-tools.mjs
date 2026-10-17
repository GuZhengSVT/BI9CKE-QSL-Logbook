import {record,state,groundTrack,mapPoint,footprint,radialSpeed,doppler,parseTles} from './orbit.mjs';
const scriptUrl=document.currentScript?.src||new URL('js/satellite-tools.js',location.href).href;
const workerUrl=new URL(`satellite-worker.js?v=${__SAT_WORKER_HASH__}`,scriptUrl);
const copy={
  zh:{title:'卫星工具',satellite:'卫星',refresh:'刷新轨道目录',observer:'观测位置',grid:'临时观测网格',height:'海拔 / m',apply:'应用位置',reset:'使用电台位置',minimum:'最低最大仰角',window:'预报范围',zone:'显示时区',utc:'UTC',local:'北京时间',hours:'小时',live:'实时轨道',past:'过去 90 分钟',future:'未来 90 分钟',footprint:'地平线覆盖边界',az:'方位角',el:'仰角',alt:'轨道高度',range:'斜距',up:'地平线上方',down:'地平线下方',loading:'正在读取轨道目录…',failed:'轨道目录读取失败，请重试或粘贴 TLE。',invalid:'TLE 无效：请粘贴卫星名称和完整的两行数据（含正确校验位）。',noObserver:'请填写观测网格，或在后台设置电台位置。',invalidObserver:'请输入有效的 4、6、8 位网格及 -500～9000 m 海拔。',manual:'粘贴 TLE',manualUse:'使用这些轨道',manualSource:'手动 TLE',manualHint:'只在本页面使用，不会修改电台设置。',source:'轨道来源',epoch:'轨道历元',stale:'轨道历元距当前超过 7 天，预报精度可能下降，请更新 TLE。',next:'下次 AOS',los:'距离 LOS',counting:'正在计算过境…',none:'预报范围内没有符合仰角条件的过境。',continuous:'预报窗口内持续在地平线上方',sky:'过境天空图',skyHint:'北向上 · 中心为天顶 · 外圈为地平线',passes:'过境预报',aos:'升起 AOS',peak:'最高点',end:'落下 LOS',duration:'时长',peakEl:'最大仰角',direction:'升 / 落方位',view:'查看',ongoing:'已在过境',outside:'窗口外',selected:'已选过境',noSky:'选择一次过境查看天线指向。',predictionError:'轨道计算失败，请更换卫星或更新轨道数据。',doppler:'多普勒频移',receive:'下行标称频率 / MHz',transmit:'上行标称频率 / MHz',receiveResult:'预计接收频率',transmitResult:'上行补偿频率',speed:'径向速度',frequencyHint:'填入实际使用的频率。正速度表示远离；结果为一阶多普勒近似。',note:'AOS / LOS 按几何地平线 0° 计算；最低最大仰角仅筛选过境。轨道目录不代表卫星当前可通联，预报不包含地形、建筑遮挡和大气折射。',log:'记录这颗卫星的通联',sourceHint:'每小时缓存 · SGP4 本地计算',fresh:'轨道有效',subpoint:'星下点',manualCount:'已载入轨道',noApi:'未配置轨道接口，可粘贴 TLE 使用。'},
  en:{title:'Satellite tools',satellite:'Satellite',refresh:'Refresh catalog',observer:'Observer',grid:'Temporary Maidenhead grid',height:'Altitude / m',apply:'Apply location',reset:'Station location',minimum:'Minimum peak elevation',window:'Prediction window',zone:'Time zone',utc:'UTC',local:'Beijing time',hours:'hours',live:'Live orbit',past:'Past 90 minutes',future:'Next 90 minutes',footprint:'Horizon footprint',az:'Azimuth',el:'Elevation',alt:'Altitude',range:'Slant range',up:'Above horizon',down:'Below horizon',loading:'Loading orbital elements…',failed:'Catalog unavailable. Retry or paste a TLE.',invalid:'Invalid TLE. Include a name and two complete lines with valid checksums.',noObserver:'Enter a grid, or configure your station location in the console.',invalidObserver:'Use a valid 4, 6 or 8 character grid and altitude from -500 to 9000 m.',manual:'Paste TLE',manualUse:'Use these elements',manualSource:'Manual TLE',manualHint:'Local to this page. Station settings remain separate.',source:'Orbit source',epoch:'Element epoch',stale:'Elements are more than 7 days from the current date. Update them for better accuracy.',next:'Next AOS',los:'Time to LOS',counting:'Predicting passes…',none:'No passes meet the elevation filter in this window.',continuous:'Above the horizon throughout this window',sky:'Pass sky plot',skyHint:'North up · zenith at center · horizon at edge',passes:'Pass predictions',aos:'Rise · AOS',peak:'Culmination',end:'Set · LOS',duration:'Duration',peakEl:'Peak elevation',direction:'AOS / LOS azimuth',view:'View',ongoing:'In progress',outside:'Outside window',selected:'Selected pass',noSky:'Select a pass to see antenna directions.',predictionError:'Propagation failed. Select another satellite or update the elements.',doppler:'Doppler shift',receive:'Nominal downlink / MHz',transmit:'Nominal uplink / MHz',receiveResult:'Expected receive frequency',transmitResult:'Compensated uplink',speed:'Range rate',frequencyHint:'Enter the frequency you actually use. Positive range rate means receding. First-order approximation.',note:'AOS / LOS use a geometric 0° horizon; the peak elevation filter selects passes. Catalog inclusion does not imply current radio availability. Terrain, buildings and atmospheric refraction are excluded.',log:'Log a contact via this satellite',sourceHint:'Hourly cache · local SGP4 propagation',fresh:'Orbital elements loaded',subpoint:'Subsatellite point',manualCount:'Elements loaded',noApi:'No orbit API configured. Paste a TLE to continue.'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const path=segments=>segments.map(line=>'M'+line.map(p=>{const q=mapPoint(p);return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;}).join('L')).join('');
let landPromise;
class SatelliteTools {
  constructor(el,options) {
    this.el=el;this.options=options;this.language=options.language||'zh-CN';this.station=options.station||{};this.observerGrid=this.station.grid||'';this.observer=globalThis.QslGeo.location(this.station);this.tles=[];this.passes=[];this.active=true;this.zone='UTC';this.minElevation=10;this.hours=24;this.height=0;this.job=0;
    this.render();this.load();
    this.visibility=()=>this.setActive(this.active);document.addEventListener('visibilitychange',this.visibility);
    window.addEventListener('pagehide',()=>this.destroy(),{once:true});
  }
  t(key) {return copy[this.language==='en'?'en':'zh'][key]||key;}
  $(selector) {return this.el.querySelector(selector);}
  text(selector,value) {const el=this.$(selector);if(el)el.textContent=value;}
  render() {
    const t=key=>this.t(key),select=(id,label,options)=>`<label>${label}<select data-${id}>${options}</select></label>`;
    this.el.innerHTML=`<div class="sat-tools"><div class="sat-control-card"><div class="sat-section-label">ORBITAL WORKSPACE</div><div class="sat-main-controls"><label class="sat-catalog-label">${t('satellite')}<select data-catalog disabled><option>${t('loading')}</option></select></label><button class="btn" data-refresh>${t('refresh')}</button>${this.options.onLog?`<button class="btn btn-primary" data-log disabled>${t('log')}</button>`:''}</div><div class="sat-observer-controls"><label>${t('grid')}<input data-grid value="${esc(this.station.grid||'')}" placeholder="OM89AA" maxlength="8" autocomplete="off"></label><label>${t('height')}<input data-height type="number" min="-500" max="9000" value="${this.height}" step="10"></label><button class="btn" data-observer>${t('apply')}</button><button class="text-button" data-reset>${t('reset')}</button>${select('minimum',t('minimum'),[0,5,10,20,30,45].map(v=>`<option value="${v}" ${v===this.minElevation?'selected':''}>${v}°</option>`).join(''))}${select('hours',t('window'),[24,48].map(v=>`<option value="${v}" ${v===this.hours?'selected':''}>${v} ${t('hours')}</option>`).join(''))}${select('zone',t('zone'),`<option value="UTC" ${this.zone==='UTC'?'selected':''}>UTC</option><option value="Asia/Shanghai" ${this.zone!=='UTC'?'selected':''}>${t('local')}</option>`)}</div><p class="sat-observer-status" data-observer-status></p><p class="sat-feedback" role="status" data-feedback>${t('loading')}</p><details class="sat-manual"><summary>${t('manual')}</summary><p>${t('manualHint')}</p><textarea data-tle rows="4" maxlength="200000" aria-label="TLE" placeholder="ISS\n1 25544…\n2 25544…"></textarea><button class="btn btn-sm" data-use-tle>${t('manualUse')}</button></details></div>
      <div class="sat-workspace"><section class="sat-map-card"><div class="sat-panel-heading"><div><div class="sat-section-label">GROUND TRACK</div><h2 data-sat-name>${t('live')}</h2></div><span class="sat-live-status" data-live-status>—</span></div><div class="sat-map-wrap"><svg class="sat-world" viewBox="0 0 720 360" role="img" aria-label="${t('live')}"><g class="sat-graticule">${Array.from({length:11},(_,i)=>`<path d="M${(i+1)*60} 0V360"/>`).join('')}${[60,120,180,240,300].map(y=>`<path d="M0 ${y}H720"/>`).join('')}</g><g data-land></g><path class="sat-track-past" data-track-past/><path class="sat-track-future" data-track-future/><path class="sat-footprint" data-footprint/><g data-observer-point></g><g data-satellite-point></g></svg></div><div class="sat-map-legend"><span><i class="past"></i>${t('past')}</span><span><i class="future"></i>${t('future')}</span><span><i class="footprint"></i>${t('footprint')}</span><time data-clock></time></div><div class="sat-live-metrics">${[['az',t('az'),'°'],['el',t('el'),'°'],['alt',t('alt'),'km'],['range',t('range'),'km']].map(([id,label,unit])=>`<div><span>${label}</span><strong data-${id}>—</strong><small>${unit}</small></div>`).join('')}</div><div class="sat-element-status"><span data-subpoint></span><span data-epoch></span></div></section>
      <aside class="sat-side"><section class="sat-countdown-card"><div class="sat-section-label" data-event-label>${t('next')}</div><strong data-countdown>—</strong><p data-event-time>${t('counting')}</p></section><section class="sat-sky-card"><div class="sat-panel-heading"><h2>${t('sky')}</h2><span data-sky-peak></span></div><svg viewBox="0 0 220 220" class="sat-sky" role="img" aria-label="${t('sky')}"><g class="sat-sky-grid"><circle cx="110" cy="110" r="86"/><circle cx="110" cy="110" r="57.33"/><circle cx="110" cy="110" r="28.67"/><path d="M24 110H196M110 24V196"/></g><g class="sat-sky-labels"><text x="110" y="15">N</text><text x="209" y="114">E</text><text x="110" y="213">S</text><text x="11" y="114">W</text></g><path data-sky-track class="sat-sky-track"/><g data-sky-current></g></svg><p data-sky-caption>${t('noSky')}</p><small>${t('skyHint')}</small></section></aside></div>
      <section class="sat-pass-card"><div class="sat-panel-heading"><div><div class="sat-section-label">PASS PLANNER</div><h2>${t('passes')}</h2></div><span data-pass-count></span></div><div class="table-wrap"><table class="log-table"><thead><tr>${['aos','peak','end','duration','peakEl','direction'].map(k=>`<th>${t(k)}</th>`).join('')}<th></th></tr></thead><tbody data-passes><tr><td colspan="7" class="empty">${t('counting')}</td></tr></tbody></table></div></section>
      <section class="sat-doppler-card"><div><div class="sat-section-label">FREQUENCY ASSIST</div><h2>${t('doppler')}</h2><p>${t('frequencyHint')}</p></div><div class="sat-frequency-controls"><label>${t('receive')}<input data-receive type="number" min="0.001" max="100000" step="0.000001" placeholder="145.800000"></label><label>${t('transmit')}<input data-transmit type="number" min="0.001" max="100000" step="0.000001" placeholder="435.000000"></label></div><div class="sat-frequency-results"><div><span>${t('receiveResult')}</span><strong data-receive-result>—</strong></div><div><span>${t('transmitResult')}</span><strong data-transmit-result>—</strong></div><div><span>${t('speed')}</span><strong data-speed>—</strong></div></div></section><footer class="sat-source"><p data-source></p><p>${t('note')}</p><a href="${new URL('../assets/satellite-js-LICENSE.txt',scriptUrl)}" target="_blank" rel="noopener">satellite.js · MIT</a></footer></div>`;
    this.$('[data-refresh]').onclick=()=>this.load();
    this.$('[data-grid]').value=this.observerGrid;
    this.$('[data-use-tle]').onclick=()=>{try{const tles=parseTles(this.$('[data-tle]').value);if(!tles.length)throw new Error();this.controller?.abort();this.controller=null;this.$('[data-refresh]').disabled=false;this.install({satellites:tles,source:this.t('manualSource')});}catch{this.feedback(this.t('invalid'),true);}};
    this.$('[data-catalog]').onchange=()=>this.select(this.$('[data-catalog]').value);
    this.$('[data-observer]').onclick=()=>{
      const point=globalThis.QslGeo.gridCenter(this.$('[data-grid]').value),height=Number(this.$('[data-height]').value);
      if(!point||!Number.isFinite(height)||height<-500||height>9000){this.feedback(this.t('invalidObserver'),true);return;}
      this.temporaryObserver=true;this.observerGrid=this.$('[data-grid]').value.trim().toUpperCase();this.observer={...point,height};this.height=height;this.locationLabel();this.calculate();this.tick(true);
    };
    this.$('[data-reset]').onclick=()=>{this.temporaryObserver=false;this.observerGrid=this.station.grid||'';this.observer=globalThis.QslGeo.location(this.station);if(this.observer)this.observer.height=0;this.height=0;this.$('[data-height]').value=0;this.$('[data-grid]').value=this.observerGrid;this.locationLabel();this.calculate();this.tick(true);};
    this.$('[data-minimum]').onchange=()=>{this.minElevation=Number(this.$('[data-minimum]').value);this.renderPasses();this.tick();};
    this.$('[data-hours]').onchange=()=>{this.hours=Number(this.$('[data-hours]').value);this.calculate();};
    this.$('[data-zone]').onchange=()=>{this.zone=this.$('[data-zone]').value;this.renderPasses();this.tick();};
    this.$('[data-receive]').oninput=()=>this.tick();this.$('[data-transmit]').oninput=()=>this.tick();
    this.$('[data-passes]').onclick=event=>{const button=event.target.closest('[data-pass]');if(button){this.selectedPass=Number(button.dataset.pass);this.renderPasses();this.sky();}};
    if(this.options.onLog)this.$('[data-log]').onclick=()=>{if(this.tle)this.options.onLog(this.tle.name);};
    this.locationLabel();this.loadLand();
  }
  locationLabel() {this.text('[data-observer-status]',this.observer?`${this.t('observer')} · ${this.observer.lat.toFixed(4)}°, ${this.observer.lon.toFixed(4)}° · ${this.height} m`:this.t('noObserver'));}
  feedback(message,error=false) {this.text('[data-feedback]',message);this.$('[data-feedback]').classList.toggle('error',error);}
  async loadLand() {
    try {landPromise ||= fetch(new URL('../assets/world-land-dots.json',scriptUrl)).then(r=>{if(!r.ok)throw new Error();return r.json();});const land=await landPromise;if(this.destroyed)return;this.$('[data-land]').innerHTML=land.points.map(([lon,lat])=>`<circle cx="${(lon+180)*2}" cy="${(90-lat)*2}" r=".75"/>`).join('');}catch{landPromise=null;}
  }
  async load() {
    if(!this.options.apiBaseUrl){this.feedback(this.t('noApi'));return;}
    this.controller?.abort();this.controller=new AbortController();const controller=this.controller,timeout=setTimeout(()=>controller.abort(),15_000);
    this.$('[data-refresh]').disabled=true;this.feedback(this.t('loading'));
    try {const response=await fetch(new URL('/api/satellites',this.options.apiBaseUrl),{credentials:'omit',signal:controller.signal});if(!response.ok)throw new Error();const data=await response.json();if(!Array.isArray(data.satellites)||!data.satellites.length)throw new Error();if(this.destroyed||controller!==this.controller)return;this.install(data);}
    catch{if(!this.destroyed&&controller===this.controller)this.feedback(this.t('failed'),true);}
    finally{clearTimeout(timeout);if(!this.destroyed&&controller===this.controller)this.$('[data-refresh]').disabled=false;}
  }
  install(data) {
    const previous=this.tle?.id;this.tles=data.satellites.filter(t=>t&&typeof t.line1==='string'&&typeof t.line2==='string');
    this.tles.sort((a,b)=>a.name.localeCompare(b.name));
    this.$('[data-catalog]').disabled=false;this.$('[data-catalog]').innerHTML=this.tles.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${esc(t.id)}</option>`).join('');
    this.source=data;this.text('[data-source]',`${this.t('source')} · ${data.source} ${data.fetchedAt?'· '+data.fetchedAt.slice(0,19).replace('T',' ')+' UTC · '+this.t('sourceHint'):'· SGP4'}`);
    this.select(this.tles.find(t=>t.id===previous)?.id||this.tles.find(t=>Number(t.id)===25544)?.id||this.tles[0]?.id);
  }
  select(id) {
    this.worker?.terminate();this.worker=null;this.job++;this.passes=[];this.selectedPass=0;
    this.tle=this.tles.find(t=>t.id===id);if(!this.tle)return;
    this.$('[data-catalog]').value=id;this.text('[data-sat-name]',this.tle.name);this.text('[data-epoch]',`${this.t('epoch')} · ${this.tle.epoch.slice(0,19).replace('T',' ')} UTC`);
    try {this.sat=record(this.tle);this.feedback(Math.abs(Date.now()-Date.parse(this.tle.epoch))>7*86400000?this.t('stale'):this.t('fresh'),Math.abs(Date.now()-Date.parse(this.tle.epoch))>7*86400000);if(this.options.onLog)this.$('[data-log]').disabled=false;this.calculate();this.start();this.tick(true);}
    catch{this.sat=null;this.feedback(this.t('predictionError'),true);}
  }
  date(ms) {return ms==null?'—':new Intl.DateTimeFormat(this.language==='en'?'en-GB':'zh-CN',{timeZone:this.zone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(ms));}
  async calculate() {
    this.worker?.terminate();this.worker=null;this.job++;this.passes=[];this.selectedPass=0;this.lastCalc=Date.now();
    if(!this.sat||!this.observer){this.$('[data-passes]').innerHTML=`<tr><td colspan="7" class="empty">${this.t('noObserver')}</td></tr>`;this.text('[data-event-time]',this.t('noObserver'));this.sky();return;}
    this.$('[data-passes]').innerHTML=`<tr><td colspan="7" class="empty">${this.t('counting')}</td></tr>`;this.text('[data-event-time]',this.t('counting'));
    if(!this.active||document.hidden)return;
    try {
      this.worker=new Worker(workerUrl);this.worker.onmessage=event=>{if(event.data.id!==this.job||this.destroyed)return;this.worker.terminate();this.worker=null;if(event.data.error){this.feedback(this.t('predictionError'),true);this.$('[data-passes]').innerHTML=`<tr><td colspan="7" class="empty">${this.t('predictionError')}</td></tr>`;return;}this.passes=event.data.passes;this.renderPasses();this.tick();};
      this.worker.onerror=()=>{this.worker?.terminate();this.worker=null;this.feedback(this.t('predictionError'),true);this.text('[data-event-time]',this.t('predictionError'));};
      this.worker.postMessage({id:this.job,tle:this.tle,observer:this.observer,start:Date.now(),hours:this.hours,minElevation:0});
    }catch{this.feedback(this.t('predictionError'),true);}
  }
  renderPasses() {
    const list=this.passes.map((p,index)=>({...p,index})).filter(p=>p.maxElevation>=this.minElevation);
    this.text('[data-pass-count]',`${list.length} · ${this.zone}`);
    if(!list.some(p=>p.index===this.selectedPass))this.selectedPass=list[0]?.index;
    this.$('[data-passes]').innerHTML=list.map(p=>`<tr class="${p.index===this.selectedPass?'selected':''}"><td>${p.aos==null?this.t('ongoing'):this.date(p.aos)}</td><td>${this.date(p.peak)}</td><td>${p.los==null?this.t('outside'):this.date(p.los)}</td><td>${p.aos!=null&&p.los!=null?Math.round((p.los-p.aos)/6000)/10+' min':'—'}</td><td class="sat-peak-value">${p.maxElevation.toFixed(1)}°</td><td>${p.aosAzimuth==null?'—':p.aosAzimuth.toFixed(0)+'°'} / ${p.losAzimuth==null?'—':p.losAzimuth.toFixed(0)+'°'}</td><td><button class="btn btn-sm" data-pass="${p.index}" aria-pressed="${p.index===this.selectedPass}">${this.t('view')}</button></td></tr>`).join('')||`<tr><td colspan="7" class="empty">${this.observer?this.t('none'):this.t('noObserver')}</td></tr>`;
    this.sky();
  }
  sky() {
    const pass=this.passes[this.selectedPass],point=p=>({x:110+86*(90-Math.max(0,p.elevation))/90*Math.sin(p.azimuth*Math.PI/180),y:110-86*(90-Math.max(0,p.elevation))/90*Math.cos(p.azimuth*Math.PI/180)});
    this.$('[data-sky-track]').setAttribute('d',pass?'M'+pass.points.map(p=>{const q=point(p);return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;}).join('L'):'');
    this.text('[data-sky-peak]',pass?pass.maxElevation.toFixed(1)+'°':'');this.text('[data-sky-caption]',pass?`${this.t('selected')} · ${this.date(pass.aos)} → ${this.date(pass.los)}`:this.t('noSky'));
  }
  tick(force=false) {
    if(!this.active||document.hidden||!this.sat)return;
    const now=Date.now(),p=state(this.sat,now,this.observer);if(!p){this.feedback(this.t('predictionError'),true);return;}
    this.text('[data-clock]',new Date(now).toISOString().slice(11,19)+' UTC');
    for(const [key,value]of [['az',p.azimuth],['el',p.elevation],['alt',p.altitude],['range',p.range]])this.text(`[data-${key}]`,value==null?'—':value.toFixed(key==='alt'||key==='range'?0:1));
    this.text('[data-live-status]',this.observer?this.t(p.elevation>=0?'up':'down'):'NORAD '+this.tle.id);this.$('[data-live-status]').classList.toggle('above',p.elevation>=0);
    this.text('[data-subpoint]',`${this.t('subpoint')} · ${globalThis.QslGeo.gridAt(p)} · ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°`);
    const q=mapPoint(p);this.$('[data-satellite-point]').innerHTML=`<circle class="sat-point-halo" cx="${q.x}" cy="${q.y}" r="9"/><circle class="sat-point" cx="${q.x}" cy="${q.y}" r="3.5"><title>${esc(this.tle.name)}</title></circle>`;
    this.$('[data-footprint]').setAttribute('d',path(footprint(p)));
    if(this.observer){const o=mapPoint(this.observer);this.$('[data-observer-point]').innerHTML=`<path class="sat-observer-marker" d="M${o.x-4} ${o.y}h8M${o.x} ${o.y-4}v8"><title>${this.t('observer')}</title></path>`;}else this.$('[data-observer-point]').innerHTML='';
    if(force||!this.lastTrack||now-this.lastTrack>30_000){const tracks=groundTrack(this.sat,now);this.$('[data-track-past]').setAttribute('d',path(tracks.past));this.$('[data-track-future]').setAttribute('d',path(tracks.future));this.lastTrack=now;}
    const current=this.passes.find(pass=>(pass.aos==null||pass.aos<=now)&&(pass.los==null||pass.los>now)),next=this.passes.find(pass=>pass.aos>now&&pass.maxElevation>=this.minElevation),target=current?.los||next?.aos;
    this.text('[data-event-label]',this.t(current?'los':'next'));this.text('[data-event-time]',target?this.date(target)+' · '+this.zone:this.worker?this.t('counting'):current?this.t('continuous'):this.observer?this.t('none'):this.t('noObserver'));
    const seconds=target?Math.max(0,Math.floor((target-now)/1000)):null;
    this.text('[data-countdown]',seconds==null?'—':`${Math.floor(seconds/3600).toString().padStart(2,'0')}:${Math.floor(seconds/60%60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`);
    const chosen=this.passes[this.selectedPass];
    if(p.elevation>=0&&chosen&&(chosen.aos==null||chosen.aos<=now)&&(chosen.los==null||chosen.los>now)){const r=86*(90-p.elevation)/90,az=p.azimuth*Math.PI/180;this.$('[data-sky-current]').innerHTML=`<circle cx="${110+r*Math.sin(az)}" cy="${110-r*Math.cos(az)}" r="3.5"/>`;}else this.$('[data-sky-current]').innerHTML='';
    const speed=radialSpeed(this.sat,now,this.observer);this.text('[data-speed]',speed==null?'—':`${speed>=0?'+':''}${speed.toFixed(3)} km/s`);
    for(const [type,result]of [['receive','receiveMHz'],['transmit','transmitMHz']]){const f=this.$(`[data-${type}]`),value=f.value!==''&&f.validity.valid&&speed!=null?doppler(Number(f.value),speed):null;this.text(`[data-${type}-result]`,value?value[result].toFixed(6)+' MHz':'—');}
    if(this.observer&&!this.worker&&now-this.lastCalc>300_000)this.calculate();
  }
  start() {clearInterval(this.timer);if(this.active&&!document.hidden){this.timer=setInterval(()=>this.tick(),1000);}}
  setActive(active) {this.active=active;if(active&&!document.hidden){this.start();if(this.sat&&!this.worker&&(!this.passes.length||Date.now()-this.lastCalc>300_000))this.calculate();this.tick(true);}else{clearInterval(this.timer);this.worker?.terminate();this.worker=null;this.job++;}}
  setStation(station) {if(JSON.stringify(station)===JSON.stringify(this.station))return;this.station=station||{};if(!this.temporaryObserver)this.$('[data-reset]').click();}
  setLanguage(language) {if(language===this.language)return;const values=['receive','transmit','tle'].map(key=>[key,this.$(`[data-${key}]`).value]);this.language=language;this.render();for(const [key,value]of values)this.$(`[data-${key}]`).value=value;if(this.source)this.install(this.source);}
  destroy() {this.destroyed=true;clearInterval(this.timer);this.worker?.terminate();this.controller?.abort();document.removeEventListener('visibilitychange',this.visibility);}
}
export function mount(el,options) {return new SatelliteTools(el,options);}
