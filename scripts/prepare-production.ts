import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import bcrypt from 'bcryptjs';

// ponytail: one release migration; snapshot persistent data before touching its schema.
const database=path.resolve(process.env.DATABASE_URL?.replace(/^file:/,'')||'data/gaya.sqlite');
const storage=path.resolve(process.env.STORAGE_PATH||'storage');
const backups=path.resolve(process.env.BACKUP_PATH||'backups');
const marker=path.join(backups,'gaya-scope-20261005.complete');
if(!fs.existsSync(marker)){
  fs.mkdirSync(backups,{recursive:true});
  if(fs.existsSync(database)){
    const folder=fs.mkdtempSync(path.join(backups,'gaya-before-scope-'));
    const before=new DatabaseSync(database);
    try{before.exec(`VACUUM INTO '${path.join(folder,'gaya.sqlite').replaceAll("'","''")}'`);}finally{before.close();}
    if(fs.existsSync(storage))fs.cpSync(storage,path.join(folder,'storage'),{recursive:true});
    execFileSync('tar',['-czf',folder+'.tar.gz','-C',folder,'.']);
    console.log('Backup anterior à atualização criado em',folder+'.tar.gz');
  }
  const {db}=await import('../src/lib/db.ts');
  const rows=JSON.parse(fs.readFileSync(new URL('./gaya-units.json',import.meta.url),'utf8')) as {code:string;responsible:string;address:string;maps_url:string;contact_name:string;contact_email:string;contact_phones:string;form_url:string}[];
  const company='c1';
  if(!db.prepare('SELECT id FROM companies WHERE id=?').get(company))throw Error('Empresa da importação não encontrada; nenhum cadastro importado.');
  let units=0,users=0;
  db.exec('BEGIN IMMEDIATE');
  try{
    for(const row of rows){
      if(db.prepare('SELECT id FROM units WHERE company_id=? AND code=?').get(company,row.code))continue;
      let user=db.prepare("SELECT id FROM users WHERE company_id=? AND name=? AND role='INSPECTOR'").get(company,row.responsible);
      if(!user){
        const id='usr_'+crypto.randomUUID();
        db.prepare("INSERT INTO users(id,company_id,name,email,password_hash,role,active) VALUES(?,?,?,?,?,'INSPECTOR',0)").run(id,company,row.responsible,id+'@import.invalid',bcrypt.hashSync(crypto.randomBytes(32).toString('hex'),10));
        user={id};users++;
      }
      db.prepare('INSERT INTO units(id,company_id,name,code,address,responsible_id,maps_url,contact_name,contact_email,contact_phones,form_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('unt_'+crypto.randomUUID(),company,row.code,row.code,row.address,user.id,row.maps_url,row.contact_name,row.contact_email,row.contact_phones,row.form_url);units++;
    }
    // Existing demo units keep their historical RT when no explicit assignment exists.
    db.prepare("UPDATE units SET responsible_id='usr-inspector' WHERE company_id='c1' AND id IN ('u1','u2') AND responsible_id IS NULL AND EXISTS(SELECT 1 FROM users WHERE id='usr-inspector' AND company_id='c1' AND role='INSPECTOR')").run();
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  fs.writeFileSync(marker,JSON.stringify({completedAt:new Date().toISOString(),units,users}));
  console.log('Escopo aplicado:',units,'unidades importadas;',users,'responsáveis aguardando ativação.');
}
