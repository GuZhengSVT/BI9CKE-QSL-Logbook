import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import '../js/adif.js';
const ADIF=globalThis.ADIF;
const publicFiles=['index.html','css/style.css','css/satellites.css','css/solar.css','js/solar.js','js/theme.js','js/i18n.js','js/adif.js','js/geo.js','js/store.js','js/app.js','js/map.js','js/stats.js','js/cards.js','assets','vendor','qsl-cards'];
const backendFiles=['admin','css/style.css','css/satellites.css','css/solar.css','js/solar.js','js/theme.js','js/insights.js','js/adif.js','js/geo.js','assets/favicon.svg','assets/world-land-dots.json'];
await rm('dist',{recursive:true,force:true});
for(const [directory,files] of [['dist/public',publicFiles],['dist/backend',backendFiles]]) {
  for(const file of files) {
    const dest=`${directory}/${file}`;
    await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});
    await cp(file,dest,{recursive:true});
  }
}
await build({entryPoints:['js/satellite-worker.mjs'],bundle:true,minify:true,platform:'browser',target:'es2022',outfile:'dist/public/js/satellite-worker.js'});
const workerHash=createHash('sha256').update(await readFile('dist/public/js/satellite-worker.js')).digest('hex').slice(0,12);
await build({entryPoints:['js/satellite-tools.mjs'],bundle:true,minify:true,platform:'browser',target:'es2022',format:'iife',globalName:'QslSat',define:{__SAT_WORKER_HASH__:JSON.stringify(workerHash)},outfile:'dist/public/js/satellite-tools.js'});
for(const file of ['satellite-tools.js','satellite-worker.js'])await cp('dist/public/js/'+file,'dist/backend/js/'+file);
for(const directory of ['dist/public','dist/backend'])await cp('node_modules/satellite.js/LICENSE.md',directory+'/assets/satellite-js-LICENSE.txt');
await mkdir('dist/public/data',{recursive:true});
const config=JSON.parse(await readFile('data/config.json','utf8'));
if(process.env.QSL_API_BASE_URL) config.apiBaseUrl=process.env.QSL_API_BASE_URL.replace(/\/$/,'');
if(config.apiBaseUrl) {
  const url=new URL(config.apiBaseUrl);
  if(url.protocol!=='https:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Backend URL must use HTTPS');
}
await writeFile('dist/public/data/config.json',JSON.stringify(config,null,2)+'\n');
const publicFields=new Set(['CALL','QSO_DATE','TIME_ON','BAND','MODE','SUBMODE','FREQ','RST_SENT','RST_RCVD','GRIDSQUARE','LAT','LON','DXCC','COUNTRY','QSL_SENT','QSL_RCVD','LOTW_QSL_RCVD','SAT_NAME','PROP_MODE']);
const records=ADIF.parse(await readFile('data/log.adi','utf8')).records.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>publicFields.has(k))));
await writeFile('dist/public/data/log.adi',ADIF.serialize(records,{header:{ADIF_VER:'3.1.4',PROGRAMID:'ham-qsl-log'}}));
// Content hashes prevent old JS/CSS from mixing with new navigation markup.
for(const [dir,file] of [['dist/public','index.html'],['dist/backend','admin/index.html']]) {
  let html=await readFile(`${dir}/${file}`,'utf8');
  for(const match of [...html.matchAll(/(?:src|href)="((?:\/dashboard\/static\/|\/)?(?:js|css|admin)\/[^"?]+\.(?:js|css))(?:\?[^\"]*)?"/g)]) {
    const path=match[1].replace(/^\/dashboard\/static\//,'').replace(/^\//,'');
    const hash=createHash('sha256').update(await readFile(`${dir}/${path}`)).digest('hex').slice(0,12);
    html=html.replace(match[0],match[0].replace(/=".*"$/,`="${match[1]}?v=${hash}"`));
  }
  await writeFile(`${dir}/${file}`,html);
}
console.log(`Built public site (${records.length} contacts) and separate Cloudflare admin assets.`);
