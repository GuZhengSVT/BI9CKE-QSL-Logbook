'use strict';
const Admin = {
  records: [], config: {}, page: 1, pageSize: 25, editing: null,
  fields: [
    ['CALL','对方呼号 *','text',true],['QSO_DATE','日期 / UTC *','date',true],['TIME_ON','时间 / UTC','time'],
    ['BAND','波段 *','text',true],['MODE','模式 *','text',true],['FREQ','频率 / MHz','text'],
    ['SAT_NAME','卫星名称','text'],['PROP_MODE','传播方式（卫星填 SAT）','text'],
    ['RST_SENT','RST 发出','text'],['RST_RCVD','RST 收到','text'],['GRIDSQUARE','对方网格','text'],
    ['COUNTRY','国家 / 地区','text'],['DXCC','DXCC 实体编号','text'],['LAT','对方纬度','text'],['LON','对方经度','text'],
    ['QSL_SENT','QSL 发出','sent'],['QSL_RCVD','QSL 收到','received'],['QSL_SENT_DATE','寄出日期','date'],['QSL_RCVD_DATE','收到日期','date'],
    ['LOTW_QSL_RCVD','LoTW 确认','received'],['QSL_VIA','QSL 途径','text'],['QSLMSG','卡片附言','text'],['COMMENT','私人备注（不公开）','text']
  ],
  esc(value) { return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  async api(path, options={}) {
    const response=await fetch('/api/admin/'+path,{...options,credentials:'same-origin',headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
    let data;
    try { data=await response.json(); } catch { throw new Error('登录状态可能已过期，请重新打开后台登录。'); }
    if(!response.ok) throw new Error(data.error || '请求失败。');
    return data;
  },
  message(text,error=false) {
    const element=document.getElementById('admin-message'); element.hidden=false; element.textContent=text; element.classList.toggle('error',error);
  },
  tab(name) {
    const labels={dashboard:['电台仪表盘','每一次呼叫，都让世界更近一点。'],satellites:['卫星工具','追踪轨道，等待下一次来自太空的回应。'],qsl:['QSL 管理','整理待寄卡片，记录来自远方的确认。'],records:['通联记录','组合筛选与导出，快速找到每一次通联。'],entry:['新增通联','记录每一次相遇，保存后更新展示页。'],import:['导入 / 导出','导入标准 ADIF，或下载完整数据备份。'],settings:['电台设置','设置呼号，以及地图上代表本台的位置。']};
    document.querySelectorAll('.admin-section').forEach(el=>el.classList.toggle('active',el.id==='admin-'+name));
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.adminTab===name));
    document.getElementById('admin-title').textContent=labels[name][0];document.getElementById('admin-current').textContent=labels[name][0];document.getElementById('admin-description').textContent=labels[name][1];
    if(name==='satellites'&&!this.satelliteTools)this.satelliteTools=QslSat.mount(document.getElementById('admin-satellites'),{apiBaseUrl:location.origin,station:this.config.station,onLog: name=>{
      this.resetForm();this.tab('entry');const form=document.getElementById('record-form');form.elements.SAT_NAME.value=name;form.elements.PROP_MODE.value='SAT';document.getElementById('entry-now').click();form.elements.CALL.focus();
    }});
    this.satelliteTools?.setActive(name==='satellites');
    window.scrollTo(0,0);
  },
  async refresh() {
    const data=await this.api('snapshot');this.records=data.records;this.config=data.config;
    this.satelliteTools?.setStation(this.config.station);
    document.getElementById('admin-user').textContent=data.user.username;
    this.populateFilters();this.renderRecords();this.fillSettings();this.renderDashboard();this.renderQsl();
  },
  populateFilters() {
    for(const [id,key,label] of [['filter-band','BAND','全部波段'],['filter-mode','MODE','全部模式']]) {
      const el=document.getElementById(id),value=el.value;
      el.innerHTML=`<option value="">${label}</option>`+[...new Set(this.records.map(r=>r[key]).filter(Boolean))].sort().map(v=>`<option value="${this.esc(v)}">${this.esc(v)}</option>`).join('');el.value=value;
    }
  },
  filteredRecords() {
    return QslInsights.filter(this.records,{query:document.getElementById('admin-search').value,band:document.getElementById('filter-band').value,mode:document.getElementById('filter-mode').value,from:document.getElementById('filter-from').value,to:document.getElementById('filter-to').value,qsl:document.getElementById('filter-qsl').value});
  },
  distanceText(record) {
    const from=QslGeo.location(this.config.station),to=QslGeo.location(record);
    if(!from||!to) return '';
    const bearing=QslGeo.bearing(from,to);
    return `${Math.round(QslGeo.distance(from,to)).toLocaleString()} km${bearing===null?'':` · ${Math.round(bearing)%360}°`}`;
  },
  qslLabel(value,received=false) {
    return ({Y:received?'已收到':'已寄出',N:received?'未收到':'未寄出',R:received?'已请求':'待寄出',Q:'排队中',I:'忽略',S:'已提交',M:'卡片局'})[value]||'—';
  },
  renderDashboard() {
    const s=QslInsights.summary(this.records),coverage=QslGeo.coverage(this.config.station,this.records),e=value=>this.esc(value);
    const metrics=[['全部通联',s.total,'QSO'],['今年通联',s.year,'QSO'],['本月通联',s.month,'QSO'],['今日通联',s.today,'QSO'],['连续通联',s.streak,'DAYS'],['唯一呼号',s.calls,'CALLS']];
    const max=Math.max(1,...s.months.map(m=>m.count));
    document.getElementById('admin-dashboard').innerHTML=`<div class="dashboard-welcome"><div><span class="eyebrow">ON THE AIR · ${e(this.config.call)}</span><h2>你的电台，正在连接世界。</h2><p>UTC ${new Date().toISOString().slice(0,10)} <span>·</span> ${s.today?`今天已完成 ${s.today} 次通联`:'新的相遇，从下一声 CQ 开始'}</p></div><div class="dashboard-status"><i></i> 日志已同步</div></div>
      <div class="dashboard-metrics">${metrics.map(([label,value,unit],i)=>`<div class="metric-card"><div class="metric-label"><span>${label}</span><span class="metric-index">0${i+1}</span></div><div class="metric-value">${value.toLocaleString()}<small>${unit}</small></div></div>`).join('')}</div>
      <div class="dashboard-grid"><div class="dashboard-card coverage-card"><div class="dashboard-card-head"><div><div class="eyebrow">SIGNAL REACH</div><h2>通联覆盖</h2></div><button class="text-button" data-jump="settings">电台位置 ↗</button></div><div id="dashboard-map" class="dashboard-map"></div><div class="coverage-caption">${!coverage.center?'在电台设置中填写位置，点亮你的通联地图。':coverage.farthest?`最远 ${e(coverage.farthest.record.CALL)} <strong>${Math.round(coverage.farthest.km).toLocaleString()} km</strong> · 已定位 ${coverage.contacts.length} / ${s.total} 条`:'本台位置已设置，等待带有网格或坐标的通联。'}</div></div>
      <div class="dashboard-card"><div class="dashboard-card-head"><div><div class="eyebrow">YOUR PROGRESS</div><h2>探索进度</h2></div><span class="panel-hint">按日志记录统计</span></div><div class="progress-stat"><span>DXCC / 国家</span><strong>${s.dxcc}<small> 已通联</small></strong><p>${s.dxccConfirmed} 个已确认</p><progress value="${s.dxccConfirmed}" max="${Math.max(1,s.dxcc)}" aria-label="DXCC 确认进度"></progress></div><div class="progress-stat"><span>网格覆盖</span><strong>${s.grids}<small> 个四位网格</small></strong><p>${s.gridsConfirmed} 个已确认</p><progress value="${s.gridsConfirmed}" max="${Math.max(1,s.grids)}" aria-label="网格确认进度"></progress></div><button class="dashboard-task" data-jump="qsl"><span>QSL 待寄出 <b>${s.pending}</b></span><span>处理待办 →</span></button></div>
      <div class="dashboard-card dashboard-wide"><div class="dashboard-card-head"><div><div class="eyebrow">ACTIVITY</div><h2>近 12 个月</h2></div><span class="panel-hint">UTC · 每月通联次数</span></div><div class="activity-chart" role="img" aria-label="${s.months.map(m=>`${m.month}：${m.count} 次`).join('；')}">${s.months.map(m=>`<div class="activity-column"><span class="activity-count">${m.count}</span><div class="activity-track"><i style="height:${m.count/max*100}%"></i></div><span class="activity-label">${m.month.slice(2)}</span></div>`).join('')}</div></div>
      <div class="dashboard-card dashboard-wide"><div class="dashboard-card-head"><div><div class="eyebrow">LATEST CONTACTS</div><h2>最近通联</h2></div><button class="text-button" data-jump="records">查看全部 →</button></div><div class="recent-list">${this.records.slice(0,5).map(r=>`<button class="recent-contact" data-open-record="${e(ADIF.recordId(r))}"><span class="recent-avatar">${e(r.CALL.slice(0,2))}</span><span class="recent-call"><strong>${e(r.CALL)}</strong><small>${e(r.COUNTRY||r.GRIDSQUARE||'未填写地区')}</small></span><span class="recent-mode">${e(r.BAND)} · ${e(r.MODE)}</span><span class="recent-date">${ADIF.prettyDate(r.QSO_DATE)}<small>${ADIF.prettyTime(r.TIME_ON)} UTC</small></span><span aria-hidden="true">↗</span></button>`).join('')||'<p class="empty">还没有通联记录，点击右上角开始记录。</p>'}</div></div></div>`;
    this.renderDashboardMap(coverage);
  },
  async renderDashboardMap({center,contacts,farthest}) {
    const el=document.getElementById('dashboard-map');
    if(!center) {el.innerHTML='<div class="map-placeholder"><span>◎</span><strong>从你的坐标出发</strong><small>每一个光点，都是一次远方的回应</small></div>';return;}
    try {
      if(!this.land) {const response=await fetch('/assets/world-land-dots.json');if(!response.ok)throw new Error('map');this.land=(await response.json()).points;}
      if(document.getElementById('dashboard-map')!==el)return;
      const project=p=>QslGeo.azimuthal(center,p),maxDistance=Math.PI*6371.0088;
      el.innerHTML=`<svg viewBox="150 0 420 360" role="img" aria-label="以本台为中心的方位等距通联地图"><circle class="map-disc" cx="360" cy="180" r="164"/>${this.land.map(([lon,lat])=>{const p=project({lat,lon});return `<circle class="land-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r=".8"/>`;}).join('')}${farthest?[1/3,2/3,1].map(scale=>`<circle class="coverage-ring" cx="360" cy="180" r="${farthest.km/maxDistance*164*scale}"/>`).join(''):''}${contacts.map(c=>{const p=project(c.position);return `<circle class="contact-point" cx="${p.x}" cy="${p.y}" r="2.5"><title>${this.esc(c.record.CALL)} · ${Math.round(c.km)} km</title></circle>`;}).join('')}<circle cx="360" cy="180" r="10" class="station-glow"/><circle cx="360" cy="180" r="3.5" class="station-dot"/></svg>`;
    }catch{el.textContent='地图暂时无法加载。';}
  },
  renderQsl() {
    const s=QslInsights.summary(this.records),queue=document.getElementById('qsl-queue')?.value||'pending';
    const records=this.records.filter(r=>queue==='pending'?QslInsights.pending(r):queue==='waiting'?r.QSL_SENT==='Y'&&r.QSL_RCVD!=='Y':r.QSL_RCVD==='Y');
    document.getElementById('admin-qsl').innerHTML=`<div class="qsl-summary"><div class="qsl-summary-item"><b>${s.pending}</b>待寄出 · 已请求 / 排队中</div><div class="qsl-summary-item"><b>${this.records.filter(r=>r.QSL_SENT==='Y').length}</b>已寄出</div><div class="qsl-summary-item"><b>${this.records.filter(r=>r.QSL_RCVD==='Y').length}</b>收到纸质卡片</div><div class="qsl-summary-item"><b>${s.confirmed}</b>已确认 · 纸卡 / LoTW</div></div><div class="log-panel"><div class="panel-heading"><div><h2>卡片工作台</h2><p class="side-hint">寄出与收到为独立状态，快捷标记会同时记录今天的 UTC 日期。</p></div><select id="qsl-queue" aria-label="QSL 队列"><option value="pending" ${queue==='pending'?'selected':''}>待寄出</option><option value="waiting" ${queue==='waiting'?'selected':''}>已寄出 · 待回卡</option><option value="received" ${queue==='received'?'selected':''}>已收到</option></select></div><div class="table-wrap"><table class="log-table"><thead><tr><th>通联日期</th><th>呼号</th><th>波段 / 模式</th><th>QSL 状态</th><th>操作</th></tr></thead><tbody>${records.map(r=>`<tr data-id="${this.esc(ADIF.recordId(r))}"><td class="date">${ADIF.prettyDate(r.QSO_DATE)}</td><td class="call">${this.esc(r.CALL)}</td><td>${this.esc(r.BAND)} · ${this.esc(r.MODE)}</td><td>${this.qslLabel(r.QSL_SENT)} / ${this.qslLabel(r.QSL_RCVD,true)}</td><td><div class="row-actions">${r.QSL_SENT!=='Y'?'<button class="btn btn-sm" data-qsl-action="sent">标记已寄出</button>':''}${r.QSL_RCVD!=='Y'?'<button class="btn btn-sm btn-green" data-qsl-action="received">标记已收到</button>':''}<button class="btn btn-sm" data-qsl-action="edit">查看 / 编辑</button></div></td></tr>`).join('')||'<tr><td class="empty" colspan="5">当前队列已处理完毕。</td></tr>'}</tbody></table></div></div>`;
    document.getElementById('qsl-queue').onchange=()=>this.renderQsl();
  },
  renderRecords() {
    const records=this.filteredRecords();
    const pages=Math.max(1,Math.ceil(records.length/this.pageSize));this.page=Math.min(this.page,pages);
    const start=(this.page-1)*this.pageSize;
    document.getElementById('admin-count').textContent=this.records.length;
    document.getElementById('admin-log-body').innerHTML=records.slice(start,start+this.pageSize).map(r=>`<tr data-id="${this.esc(ADIF.recordId(r))}"><td class="date">${this.esc(ADIF.prettyDate(r.QSO_DATE))}<small>${this.esc(ADIF.prettyTime(r.TIME_ON))} UTC</small></td><td class="call">${this.esc(r.CALL)}<small>${this.esc(r.COUNTRY||'—')}</small></td><td><span class="band-tag">${this.esc(r.BAND)}</span> ${this.esc(r.MODE)}</td><td>${QslGeo.location(r)?this.esc(r.GRIDSQUARE||'经纬度'):'<span class="badge badge-orange">未定位</span>'}<small>${this.distanceText(r)}</small></td><td>${this.qslLabel(r.QSL_SENT)} / ${this.qslLabel(r.QSL_RCVD,true)}</td><td><div class="row-actions"><button class="btn btn-sm" data-record-action="edit">编辑</button><button class="btn btn-sm btn-danger" data-record-action="delete">删除</button></div></td></tr>`).join('')||'<tr><td class="empty" colspan="6">暂无匹配记录。</td></tr>';
    document.getElementById('admin-range').textContent=`显示 ${records.length?start+1:0}–${Math.min(start+this.pageSize,records.length)} 条，共 ${records.length} 条`;
    document.getElementById('admin-page-info').textContent=`${this.page} / ${pages}`;
    document.getElementById('admin-prev').disabled=this.page<=1;document.getElementById('admin-next').disabled=this.page>=pages;
  },
  buildForm() {
    document.getElementById('record-fields').innerHTML=this.fields.map(([key,label,type,required])=>`<label>${label}${['sent','received'].includes(type)?`<select name="${key}"><option value="">未标记</option><option value="N">N · ${type==='sent'?'未发出':'未收到'}</option><option value="Y">Y · ${type==='sent'?'已发出':'已收到'}</option><option value="R">R · 已请求</option>${type==='sent'?'<option value="Q">Q · 待寄出</option><option value="S">S · 已提交</option><option value="M">M · 卡片局</option>':''}<option value="I">I · 忽略</option></select>`:`<input name="${key}" type="${type}" ${required?'required':''} ${type==='time'?'step="1"':''} ${key==='LAT'?'placeholder="例如 35.5 或 N035 30.000"':key==='LON'?'placeholder="例如 139.5 或 E139 30.000"':''}>`}</label>`).join('');
    this.resetForm();
  },
  resetForm() {
    this.editing=null;document.getElementById('record-form').reset();document.querySelector('[name="QSO_DATE"]').value=new Date().toISOString().slice(0,10);document.getElementById('record-form-title').textContent='新增通联';
    this.previewContact();
  },
  edit(record) {
    this.editing=record;this.tab('entry');
    for(const [key,,type] of this.fields) {
      let value=record[key]||'';
      if(type==='date' && value.length===8) value=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
      if(type==='time' && value) value=ADIF.prettyTime(value);
      document.querySelector(`#record-form [name="${key}"]`).value=value;
    }
    document.getElementById('record-form-title').textContent='编辑 '+record.CALL;
    this.previewContact();
  },
  previewContact() {
    const form=document.getElementById('record-form');if(!form.elements.CALL)return;
    const call=form.elements.CALL.value.trim().toUpperCase(),history=this.records.filter(r=>r.CALL?.toUpperCase()===call);
    document.getElementById('entry-contact-history').textContent=call?`与 ${call} 已通联 ${history.length} 次`:'';
    const record=Object.fromEntries(['GRIDSQUARE','LAT','LON'].map(k=>[k,form.elements[k].value]));
    const distance=this.distanceText(record);
    document.getElementById('entry-distance').textContent=distance?`短路径距离 / 真北方位：${distance}`:'填写本台和对方的网格或坐标后，可预览距离与方位。';
  },
  async save(event) {
    event.preventDefault();const button=document.getElementById('record-save');button.disabled=true;
    try {
      const record={...this.editing};
      for(const [key,,type] of this.fields) {
        const value=document.querySelector(`#record-form [name="${key}"]`).value.trim();
        record[key]=type==='date'?value.replaceAll('-',''):type==='time'?value.replaceAll(':',''):value;
      }
      await this.api('records',{method:'POST',body:JSON.stringify({record,originalId:this.editing?ADIF.recordId(this.editing):null})});
      await this.refresh();this.resetForm();this.tab('records');this.message('通联已保存，展示页将读取最新日志。');
    } catch(error) {this.message(error.message,true);} finally {button.disabled=false;}
  },
  fillSettings() {
    const form=document.getElementById('settings-form');
    for(const key of ['call','name']) form.elements[key].value=this.config[key]||'';
    for(const key of ['grid','lat','lon']) form.elements[key].value=this.config.station?.[key]??'';
    this.previewLocation();
  },
  previewLocation() {
    const form=document.getElementById('settings-form');
    const point=QslGeo.location({grid:form.elements.grid.value,lat:form.elements.lat.value,lon:form.elements.lon.value});
    document.getElementById('location-preview').textContent=point?`地图位置：${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}°${point.source==='grid'?'（网格中心）':''}`:'未设置有效位置，公开地图不会显示电台光点。';
  },
  async saveSettings(event) {
    event.preventDefault();const form=event.currentTarget,button=document.getElementById('settings-save');button.disabled=true;
    try {
      const data={call:form.elements.call.value,name:form.elements.name.value,station:{grid:form.elements.grid.value,lat:form.elements.lat.value,lon:form.elements.lon.value}};
      await this.api('settings',{method:'PUT',body:JSON.stringify(data)});await this.refresh();this.message('电台设置已保存，地图将使用这个位置。');
    } catch(error) {this.message(error.message,true);} finally {button.disabled=false;}
  },
  async showLogin() {
    const status=document.getElementById('login-status'),form=document.getElementById('login-form');
    try {
      const response=await fetch('/api/auth/status',{cache:'no-store'});
      if(!response.ok) throw new Error('无法读取登录配置，请稍后刷新。');
      const state=await response.json(),setupToken=new URLSearchParams(location.hash.slice(1)).get('setup');
      // Keep the bootstrap token in memory only, out of history and referrers.
      if(setupToken) history.replaceState(null,'','/admin/setup');
      if(!state.configured && !setupToken) {status.textContent='后台尚未初始化。请使用部署时生成的专用链接设置管理员密码。';return;}
      const setup=!state.configured;
      document.getElementById('login-username').value=state.username;
      document.getElementById('login-username').readOnly=setup;
      document.getElementById('login-title').textContent=setup?'设置管理员密码':'电台管理';
      document.getElementById('login-description').textContent=setup?'首次设置仅生效一次，完成后即可管理电台。':'登录后管理通联记录与电台位置。';
      status.textContent=setup?'请设置至少 12 位密码，并保存在你的密码管理器中。':'会话有效期为 12 小时，请使用管理员账号登录。';
      document.getElementById('login-password').autocomplete=setup?'new-password':'current-password';
      document.getElementById('login-password').minLength=setup?12:1;
      document.getElementById('confirm-label').hidden=!setup;
      document.getElementById('login-confirm').required=setup;
      document.getElementById('login-button').textContent=setup?'设置密码并进入后台':'登录管理后台';
      form.hidden=false;
      form.onsubmit=async event=>{
        event.preventDefault();const button=document.getElementById('login-button');button.disabled=true;
        const password=document.getElementById('login-password').value;
        try {
          if(setup && password!==document.getElementById('login-confirm').value) throw new Error('两次密码不一致。');
          const result=await fetch('/api/auth/'+(setup?'setup':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('login-username').value,password,...(setup?{setupToken}:{})})});
          const data=await result.json();if(!result.ok) throw new Error(data.error || '登录失败。');
          location.replace('/admin/');
        }catch(error){status.textContent=error.message;button.disabled=false;}
      };
    }catch(error){status.textContent=error.message;}
  },
  async init() {
    try {await this.refresh();}
    catch {await this.showLogin();return;}
    document.getElementById('login-screen').hidden=true;document.getElementById('admin-app').hidden=false;this.buildForm();
    this.tab('dashboard');
    document.body.addEventListener('click',event=>{
      const jump=event.target.closest('[data-jump]'),recordButton=event.target.closest('[data-open-record]');
      if(jump)this.tab(jump.dataset.jump);
      if(recordButton){const record=this.records.find(r=>ADIF.recordId(r)===recordButton.dataset.openRecord);if(record)this.edit(record);}
    });
    document.querySelectorAll('[data-admin-tab]').forEach(el=>el.onclick=()=>{if(el.dataset.adminTab==='entry') this.resetForm();this.tab(el.dataset.adminTab);});
    document.getElementById('record-form').onsubmit=event=>this.save(event);
    document.getElementById('record-reset').onclick=()=>this.resetForm();
    document.getElementById('record-form').oninput=()=>this.previewContact();
    document.getElementById('entry-now').onclick=()=>{
      const now=new Date().toISOString(),form=document.getElementById('record-form');form.elements.QSO_DATE.value=now.slice(0,10);form.elements.TIME_ON.value=now.slice(11,19);
    };
    document.getElementById('logout-button').onclick=async()=>{
      try {
        const response=await fetch('/api/auth/logout',{method:'POST'});
        if(!response.ok) throw new Error('退出失败，请重试。');
        location.replace('/admin/');
      }catch(error){this.message(error.message,true);}
    };
    document.getElementById('admin-search').oninput=()=>{this.page=1;this.renderRecords();};
    document.querySelectorAll('#admin-filters input,#admin-filters select').forEach(el=>el.onchange=()=>{this.page=1;this.renderRecords();});
    document.getElementById('filters-reset').onclick=()=>{document.getElementById('admin-search').value='';document.querySelectorAll('#admin-filters input,#admin-filters select').forEach(el=>{el.value='';});this.page=1;this.renderRecords();};
    document.getElementById('export-filtered').onclick=()=>{
      const records=this.filteredRecords();
      if(!records.length){this.message('没有可导出的匹配记录。',true);return;}
      const url=URL.createObjectURL(new Blob([ADIF.serialize(records,{header:{ADIF_VER:'3.1.4',PROGRAMID:'ham-qsl-log'}})],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='qsl-log-filtered.adi';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      this.message(`已导出 ${records.length} 条筛选记录（包含私人字段，请妥善保管）。`);
    };
    document.getElementById('admin-qsl').onclick=async event=>{
      const button=event.target.closest('[data-qsl-action]'),row=event.target.closest('[data-id]');if(!button||!row)return;
      const original=this.records.find(r=>ADIF.recordId(r)===row.dataset.id);if(!original)return;
      if(button.dataset.qslAction==='edit')return this.edit(original);
      const record={...original},today=new Date().toISOString().slice(0,10).replaceAll('-','');
      if(button.dataset.qslAction==='sent'){record.QSL_SENT='Y';record.QSL_SENT_DATE=today;}else{record.QSL_RCVD='Y';record.QSL_RCVD_DATE=today;}
      button.disabled=true;
      try {await this.api('records',{method:'POST',body:JSON.stringify({record,originalId:row.dataset.id})});await this.refresh();this.message(`${record.CALL} 已标记${button.dataset.qslAction==='sent'?'寄出':'收到'}。`);}catch(error){button.disabled=false;this.message(error.message,true);}
    };
    document.getElementById('admin-prev').onclick=()=>{this.page--;this.renderRecords();};document.getElementById('admin-next').onclick=()=>{this.page++;this.renderRecords();};
    document.getElementById('admin-log-body').onclick=async event=>{
      const button=event.target.closest('[data-record-action]'),row=event.target.closest('[data-id]');if(!button||!row)return;
      const record=this.records.find(r=>ADIF.recordId(r)===row.dataset.id);if(!record)return;
      if(button.dataset.recordAction==='edit') return this.edit(record);
      if(!confirm(`确认删除 ${record.CALL} ${ADIF.prettyDate(record.QSO_DATE)}？`))return;
      button.disabled=true;
      try {await this.api('records/'+encodeURIComponent(row.dataset.id),{method:'DELETE'});await this.refresh();this.message('记录已删除。');}catch(error){button.disabled=false;this.message(error.message,true);}
    };
    document.getElementById('settings-form').onsubmit=event=>this.saveSettings(event);document.getElementById('settings-form').oninput=()=>this.previewLocation();
    document.getElementById('adif-file').onchange=async event=>{if(event.target.files[0])document.getElementById('adif-text').value=await event.target.files[0].text();};
    document.getElementById('adif-import').onclick=async event=>{
      event.target.disabled=true;
      try {
        const result=await this.api('import',{method:'POST',body:JSON.stringify({adif:document.getElementById('adif-text').value,merge:document.getElementById('adif-merge').checked})});
        await this.refresh();this.message(`导入完成：新增 ${result.added} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条。`);
      }catch(error){this.message(error.message,true);}finally{event.target.disabled=false;}
    };
  }
};
Admin.init();
