import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import '../js/adif.js';

const source = name => readFile(new URL('../js/' + name, import.meta.url), 'utf8');

test('A stalled public API times out and uses the public repository snapshot', async () => {
  const controllers = [], requests = [];
  const context = vm.createContext({
    ADIF: globalThis.ADIF, URL, console: {warn() {}},
    AbortSignal: {timeout(ms) {
      assert.equal(ms, 8_000);
      const controller = new AbortController();
      controllers.push(controller);
      return controller.signal;
    }},
    fetch: async (url, options) => {
      requests.push(String(url));
      if (String(url) === 'data/config.json') return Response.json({call:'TEST',apiBaseUrl:'https://radio.example'});
      if (String(url) === 'data/log.adi') return new Response('<CALL:5>TEST1 <QSO_DATE:8>20261018 <BAND:3>20M <MODE:2>CW <COMMENT:7>private <EOR>');
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), {once:true}));
    }
  });
  const store = vm.runInContext(await source('store.js') + '\nStore;', context);
  assert.equal((await store.loadConfig()).call, 'TEST');
  assert.deepEqual(requests,['data/config.json']);
  const loading = store.loadSnapshot();
  await new Promise(resolve => setImmediate(resolve));
  controllers[1].abort(new DOMException('Timed out', 'TimeoutError'));
  const {config,records}=await loading;
  assert.equal(config.call, 'TEST');
  assert.equal(records[0].CALL, 'TEST1');
  assert.equal(records[0].COMMENT, undefined);
  assert.equal(store.isFallback(), true);
  assert.deepEqual(requests, ['data/config.json','https://radio.example/api/public','data/log.adi']);
});

test('Clock and navigation start before data arrives; only the selected tab renders', async () => {
  const nodes = new Map(), events = {}, renders = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {classList:{toggle() {}},addEventListener() {}});
    return nodes.get(id);
  };
  let finishConfig;
  const context = vm.createContext({
    console, URL, Date, history:{replaceState() {}}, location:{hash:'#log'},
    window:{addEventListener(name, fn) {events[name] = fn;},scrollTo() {}},
    document:{title:'',getElementById:node,querySelectorAll:() => []},
    setInterval() {},
    I18N:{t:key => key}, StationMap:{render() {renders.push('map');}},
    Store:{loadConfig:() => new Promise(resolve => {finishConfig = resolve;}),loadSnapshot:async () => ({config:{call:'LIVE'},records:[{CALL:'TEST1'}]}),isFallback:() => false}
  });
  const app = vm.runInContext(await source('app.js') + '\nApp;', context);
  app.tabs = {log:() => renders.push('log'),cards:() => renders.push('cards')};
  const loading = app.init();
  assert.match(node('utc-time').textContent, /^\d{2}:\d{2}:\d{2}$/);
  assert.equal(node('data-status').textContent, 'logsLoading');
  assert.equal(node('data-status').hidden, false);
  context.location.hash = '#cards';
  events.hashchange();
  assert.equal(app.state.activeTab, 'cards');
  assert.deepEqual(renders, ['cards']);
  finishConfig({call:'TEST'});
  await loading;
  assert.equal(app.state.loading, false);
  assert.equal(app.state.records.length, 1);
  assert.deepEqual(renders, ['cards']);
  assert.equal(app.state.config.call,'LIVE');
  assert.equal(node('nav-log-count').textContent,'1');
  assert.equal(node('data-status').hidden, true);
});

test('Charts load on demand, share an in-flight request, and retry after failure', async () => {
  let active = false;
  const scripts = [], el = {classList:{contains:() => active}};
  const context = vm.createContext({
    App:{tabs:{}}, I18N:{t:key => key}, Utils:{esc:value => value},
    window:{addEventListener() {}},
    document:{
      getElementById:id => id === 'chart-library'
        ? {content:{querySelector:() => ({getAttribute:() => 'vendor/echarts.min.js?v=hash'})}}
        : el,
      createElement:() => ({remove() {this.removed = true;}}),
      head:{append:script => scripts.push(script)}
    }
  });
  vm.runInContext(await source('stats.js'), context);
  const render = context.App.tabs.stats;
  render();
  assert.equal(scripts.length, 0);
  active = true;
  render(); render();
  assert.equal(scripts.length, 1);
  assert.match(scripts[0].src, /\?v=hash$/);
  scripts[0].onerror();
  assert.match(el.innerHTML, /chartLoadFail/);
  assert.equal(scripts[0].removed, true);
  render();
  assert.equal(scripts.length, 2);
  active = false;
  context.echarts = {};
  scripts[1].onload();
  assert.equal(scripts.length, 2);
});

test('Satellite bundle loads once on demand, retries after a failure, and mounts only on the active tab',async()=>{
  const scripts=[], panel={}, mounts=[];
  const context=vm.createContext({
    window:{}, I18N:{getLang:()=>'en',t:key=>key},
    document:{
      getElementById:id=>id==='satellite-library'
        ? {content:{querySelector:()=>({getAttribute:()=>'js/satellite-tools.js?v=hash'})}}
        : panel,
      createElement:()=>({remove(){this.removed=true;}}),
      head:{append:script=>scripts.push(script)}
    }
  });
  const app=vm.runInContext(await source('app.js')+'\nApp;',context);
  assert.equal(scripts.length,0);
  app.state.activeTab='satellites';app.state.config={apiBaseUrl:'https://radio.example'};
  const first=app.tabs.satellites(),again=app.tabs.satellites();
  assert.equal(scripts.length,1);assert.match(scripts[0].src,/\?v=hash$/);
  scripts[0].onerror();await Promise.all([first,again]);
  assert.equal(panel.textContent,'satelliteLoadFailed');
  const retry=app.tabs.satellites();
  assert.equal(scripts.length,2);
  app.state.activeTab='log';
  context.QslSat=context.window.QslSat={mount:(el,options)=>{mounts.push(options);return {setLanguage(){}};}};
  scripts[1].onload();await retry;
  assert.equal(mounts.length,0);
  app.state.activeTab='satellites';
  await app.tabs.satellites();await app.tabs.satellites();
  assert.equal(mounts.length,1);assert.equal(mounts[0].language,'en');
});
