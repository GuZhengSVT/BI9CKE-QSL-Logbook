import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../js/insights.js';
import '../js/geo.js';
const I=globalThis.QslInsights,G=globalThis.QslGeo;
test('Dashboard counts use UTC, unique calls and deduplicated four-character grids',()=>{
  const records=[
    {CALL:'JA1ABC',QSO_DATE:'20261018',DXCC:'339',GRIDSQUARE:'PM95AA',QSL_RCVD:'Y'},
    {CALL:'JA1ABC',QSO_DATE:'20261017',DXCC:'339',GRIDSQUARE:'PM95BB',QSL_SENT:'Q'},
    {CALL:'VK1ABC',QSO_DATE:'20261016',DXCC:'150',GRIDSQUARE:'QF22AA',LOTW_QSL_RCVD:'Y'},
    {CALL:'OLD',QSO_DATE:'20250918',COUNTRY:'Other'}];
  const s=I.summary(records,new Date('2026-10-18T00:30:00Z'));
  assert.equal(s.total,4);assert.equal(s.today,1);assert.equal(s.month,3);assert.equal(s.year,3);assert.equal(s.streak,3);assert.equal(s.calls,3);
  assert.equal(s.grids,2);assert.equal(s.gridsConfirmed,2);assert.equal(s.dxcc,3);assert.equal(s.dxccConfirmed,2);assert.equal(s.pending,1);
  assert.equal(s.months.length,12);assert.deepEqual(s.months.at(-1),{month:'2026-10',count:3});
  assert.equal(I.summary(records,new Date('2026-10-19T02:00:00Z')).streak,3);
  assert.equal(I.summary(records,new Date('2026-10-20T02:00:00Z')).streak,0);
});
test('Log filters combine search, date, band, mode and independent confirmation states',()=>{
  const records=[{CALL:'JA1ABC',QSO_DATE:'20261018',BAND:'20M',MODE:'SSB',QSL_SENT:'R'},
    {CALL:'JA2ABC',QSO_DATE:'20261017',BAND:'40M',MODE:'CW',LOTW_QSL_RCVD:'Y'},
    {CALL:'VK1ABC',QSO_DATE:'20250918',BAND:'20M',MODE:'SSB',QSL_RCVD:'Y'}];
  assert.equal(I.filter(records,{query:'ja',from:'2026-10-18',to:'2026-10-18',band:'20M',mode:'SSB',qsl:'pending'}).length,1);
  assert.equal(I.filter(records,{qsl:'confirmed'}).length,2);
  assert.equal(I.filter(records,{qsl:'unconfirmed'}).length,1);
  assert.equal(I.filter(records,{band:'10M'}).length,0);
});
test('Short-path bearing is measured clockwise from true north and undefined at singular points',()=>{
  const a={lat:0,lon:0};assert.equal(G.bearing(a,{lat:20,lon:0}),0);assert.equal(G.bearing(a,{lat:0,lon:20}),90);
  assert.equal(G.bearing(a,{lat:0,lon:-20}),270);assert.equal(G.bearing(a,a),null);assert.equal(G.bearing(a,{lat:0,lon:180}),null);
  const target=G.destination({lat:35,lon:110},3000,123);assert(Math.abs(G.bearing({lat:35,lon:110},target)-123)<1e-8);
});
