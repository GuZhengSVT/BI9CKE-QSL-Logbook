import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../js/adif.js';
test('ADIF preserves UTF-8 field boundaries and complete imported records',()=>{
  const record={CALL:'TEST01',QSO_DATE:'20261018',BAND:'20M',MODE:'CW',COMMENT:'电波跨越山海 😀 73',COUNTRY:'中国'};
  const text=ADIF.serialize([record],{header:{ADIF_VER:'3.1.4'}});
  assert.deepEqual(ADIF.parse(text).records,[record]);
  assert.equal(ADIF.parse(ADIF.serialize(Array.from({length:1000},(_,i)=>({...record,CALL:'TEST'+i})))).records.length,1000);
});
