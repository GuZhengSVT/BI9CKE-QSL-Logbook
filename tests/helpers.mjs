import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(path=':memory:') {
  const sqlite=new DatabaseSync(path);
  sqlite.exec(readFileSync('worker/migrations/0001_initial.sql','utf8'));
  sqlite.exec(readFileSync('worker/migrations/0002_repository_seed.sql','utf8'));
  sqlite.exec(readFileSync('worker/migrations/0003_admin_auth.sql','utf8'));
  const wrap=(sql,args=[])=>({
    bind(...values){if(values.length>100)throw new Error('D1 parameter limit');return wrap(sql,values);},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async run(){return {success:true,meta:sqlite.prepare(sql).run(...args)};}
  });
  return {
    prepare(sql){return wrap(sql);},
    async batch(statements){if(statements.length>49)throw new Error('D1 Free query limit');sqlite.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},
    close(){sqlite.close();}
  };
}
