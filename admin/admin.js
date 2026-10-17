'use strict';
const Admin = {
  records: [], config: {}, page: 1, pageSize: 25, editing: null,
  fields: [
    ['CALL','对方呼号 *','text',true],['QSO_DATE','日期 / UTC *','date',true],['TIME_ON','时间 / UTC','time'],
    ['BAND','波段 *','text',true],['MODE','模式 *','text',true],['FREQ','频率 / MHz','text'],
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
    const labels={records:['通联记录','管理公开展示页中的通联信息。'],entry:['新增通联','记录每一次相遇，保存后更新展示页。'],import:['导入 / 导出','导入标准 ADIF，或下载完整数据备份。'],settings:['电台设置','设置呼号，以及地图上代表本台的位置。']};
    document.querySelectorAll('.admin-section').forEach(el=>el.classList.toggle('active',el.id==='admin-'+name));
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.adminTab===name));
    document.getElementById('admin-title').textContent=labels[name][0];document.getElementById('admin-current').textContent=labels[name][0];document.getElementById('admin-description').textContent=labels[name][1];
    window.scrollTo(0,0);
  },
  async refresh() {
    const data=await this.api('snapshot');this.records=data.records;this.config=data.config;
    document.getElementById('admin-user').textContent=data.user.username;
    this.renderRecords();this.fillSettings();
  },
  renderRecords() {
    const query=document.getElementById('admin-search').value.trim().toLowerCase();
    const records=this.records.filter(r=>[r.CALL,r.COUNTRY,r.GRIDSQUARE].some(v=>String(v||'').toLowerCase().includes(query)));
    const pages=Math.max(1,Math.ceil(records.length/this.pageSize));this.page=Math.min(this.page,pages);
    const start=(this.page-1)*this.pageSize;
    document.getElementById('admin-count').textContent=this.records.length;
    document.getElementById('admin-log-body').innerHTML=records.slice(start,start+this.pageSize).map(r=>`<tr data-id="${this.esc(ADIF.recordId(r))}"><td class="date">${this.esc(ADIF.prettyDate(r.QSO_DATE))}<small>${this.esc(ADIF.prettyTime(r.TIME_ON))} UTC</small></td><td class="call">${this.esc(r.CALL)}<small>${this.esc(r.COUNTRY||'—')}</small></td><td><span class="band-tag">${this.esc(r.BAND)}</span> ${this.esc(r.MODE)}</td><td>${QslGeo.location(r)?this.esc(r.GRIDSQUARE||'经纬度'):'<span class="badge badge-orange">未定位</span>'}</td><td>${this.esc(r.QSL_SENT||'—')} / ${this.esc(r.QSL_RCVD||'—')}</td><td><div class="row-actions"><button class="btn btn-sm" data-record-action="edit">编辑</button><button class="btn btn-sm btn-danger" data-record-action="delete">删除</button></div></td></tr>`).join('')||'<tr><td class="empty" colspan="6">暂无匹配记录。</td></tr>';
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
    document.querySelectorAll('[data-admin-tab]').forEach(el=>el.onclick=()=>{if(el.dataset.adminTab==='entry') this.resetForm();this.tab(el.dataset.adminTab);});
    document.getElementById('record-form').onsubmit=event=>this.save(event);
    document.getElementById('record-reset').onclick=()=>this.resetForm();
    document.getElementById('logout-button').onclick=async()=>{
      try {
        const response=await fetch('/api/auth/logout',{method:'POST'});
        if(!response.ok) throw new Error('退出失败，请重试。');
        location.replace('/admin/');
      }catch(error){this.message(error.message,true);}
    };
    document.getElementById('admin-search').oninput=()=>{this.page=1;this.renderRecords();};
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
