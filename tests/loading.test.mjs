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
  const loading = store.loadConfig();
  await new Promise(resolve => setImmediate(resolve));
  controllers[1].abort(new DOMException('Timed out', 'TimeoutError'));
  assert.equal((await loading).call, 'TEST');
  const records = await store.getRecords();
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
    Store:{loadConfig:() => new Promise(resolve => {finishConfig = resolve;}),getRecords:async () => [{CALL:'TEST1'}],isFallback:() => false}
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
  assert.deepEqual(renders, []);
  finishConfig({call:'TEST'});
  await loading;
  assert.equal(app.state.loading, false);
  assert.equal(app.state.records.length, 1);
  assert.deepEqual(renders, ['cards','map']);
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
