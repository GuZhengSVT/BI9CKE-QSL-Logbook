import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const path='.wrangler/admin-setup.json';
try {await readFile(path);console.log('Existing private setup link retained in '+path);}
catch(error) {
  if(error.code!=='ENOENT') throw error;
  const config=JSON.parse(await readFile('data/config.json','utf8'));
  if(!config.apiBaseUrl) throw new Error('Configure apiBaseUrl before generating the setup link.');
  const token=randomBytes(32).toString('hex');
  await mkdir('.wrangler',{recursive:true});
  await writeFile(path,JSON.stringify({hash:createHash('sha256').update(token).digest('hex'),url:config.apiBaseUrl+'/admin/setup#setup='+token}),{mode:0o600});
  console.log('Private, one-time setup link saved in '+path+' (not included in Git or site builds).');
}
