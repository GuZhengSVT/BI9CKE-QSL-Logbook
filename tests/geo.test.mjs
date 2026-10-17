import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../js/geo.js';
const Geo=globalThis.QslGeo;
test('Maidenhead grid centers and ADIF coordinates',()=>{
  assert.deepEqual(Geo.gridCenter('AA00'),{lat:-89.5,lon:-179,source:'grid'});
  assert.deepEqual(Geo.gridCenter('PM95'),{lat:35.5,lon:139,source:'grid'});
  assert.equal(Geo.gridCenter('OM89AA').source,'grid');
  for(const bad of ['','ZZ99','PM9','PM95ZZ','PM9500']) assert.equal(Geo.gridCenter(bad),null);
  assert.equal(Geo.coordinate('N035 30.000',true),35.5);assert.equal(Geo.coordinate('W139 30.000',false),-139.5);
  assert.equal(Geo.coordinate('N035 99.000',true),null);assert.equal(Geo.coordinate('E139 30.000',true),null);
  assert.equal(Geo.coordinate('',true),null);assert.equal(Geo.coordinate(null,true),null);
  assert.equal(Geo.location({lat:0,lon:0,grid:'PM95'}).lat,0);
});
test('farthest contact uses only actual grids/coordinates; unknown stations do not produce fake dots',()=>{
  const logs=[{CALL:'NEAR',GRIDSQUARE:'PM95'},{CALL:'FAR',GRIDSQUARE:'QF22MH'},{CALL:'UNKNOWN',COUNTRY:'United States'}];
  const result=Geo.coverage({grid:'OM89AA'},logs);
  assert.equal(result.contacts.length,2);assert.equal(result.farthest.record.CALL,'FAR');
  assert.equal(Geo.coverage({grid:''},logs).center,null);
  assert.equal(Geo.coverage({grid:'OM89AA'},[{COUNTRY:'Japan'}]).farthest,null);
});
test('every geographic range point is exactly the specified great-circle distance',()=>{
  for(const center of [{lat:39.5,lon:106.5},{lat:75,lon:170},{lat:0,lon:0}]) {
    for(const km of [100,5000,15000]) {
      for(let bearing=0;bearing<360;bearing+=15) assert(Math.abs(Geo.distance(center,Geo.destination(center,km,bearing))-km)<1e-6);

    }
  }
});

test('azimuthal map keeps every distance ring circular and touches the farthest point',()=>{
  const center={lat:39.0208,lon:116.0417};
  assert.deepEqual(Geo.azimuthal(center,center),{x:360,y:180});
  const opposite=Geo.azimuthal({lat:0,lon:0},{lat:0,lon:180});
  assert.equal(Math.hypot(opposite.x-360,opposite.y-180),164);
  for(const km of [500,9030,15000]) for(let bearing=0;bearing<360;bearing+=15) {
    const p=Geo.azimuthal(center,Geo.destination(center,km,bearing));
    assert(Math.abs(Math.hypot(p.x-360,p.y-180)-km/(Math.PI*6371.0088)*164)<1e-8);
  }
});

test('Subsatellite coordinates convert to six-character Maidenhead grids',()=>{
  for(const grid of ['OM89AA','PM95AA','QF22MH','AA00AA','RR99XX'])assert.equal(QslGeo.gridAt(QslGeo.gridCenter(grid)),grid);
  assert.equal(QslGeo.gridAt({lat:91,lon:0}),null);
  assert.match(QslGeo.gridAt({lat:90,lon:180}),/^[A-R]{2}\d{2}[A-X]{2}$/);
});
