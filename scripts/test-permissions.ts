import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {db} from '../src/lib/db.ts';

// ponytail: HTTP checks against the local server; temporary records are removed in finally.
const base='http://localhost:3000';
const prefix=`permission-${Date.now()}`;
const password='LocalTest123!';
const company=`${prefix}-company`,other=`${prefix}-other`,coordinator=`${prefix}-coordinator`,technician=`${prefix}-technician`,foreignTechnician=`${prefix}-foreign-rt`,imported=`${prefix}-imported`,directImported=`${prefix}-direct-imported`,admin=`${prefix}-admin`,unit=`${prefix}-unit`,foreignUnit=`${prefix}-foreign`,inspection=`${prefix}-inspection`;
async function request(path:string,cookie='',body?:Record<string,string>,origin?:string){return fetch(base+path,{redirect:'manual',headers:{...(cookie?{cookie}:{}),...(origin?{origin}:{})},...(body?{method:'POST',body:new URLSearchParams(body)}:{})});}
async function login(email:string,loginPassword=password){const response=await request('/api/auth/login','',{email,password:loginPassword});assert.equal(response.status,303);const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);return cookie;}
function redirected(response:Response,message:string){assert.equal(response.status,303);assert.ok(response.headers.get('location')?.includes(message),response.headers.get('location')||'Sem redirecionamento');}
try{
  for(const id of [company,other])db.prepare('INSERT INTO companies(id,legal_name,trade_name) VALUES(?,?,?)').run(id,id,id);
  for(const [id,role] of [[coordinator,'SUPERVISOR'],[technician,'INSPECTOR']])db.prepare('INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)').run(id,company,id,`${id}@test.local`,bcrypt.hashSync(password,4),role);
  db.prepare("INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES(?,?,?,?,?,'INSPECTOR')").run(foreignTechnician,other,foreignTechnician,`${foreignTechnician}@test.local`,bcrypt.hashSync(password,4));
  db.prepare("INSERT INTO users(id,name,email,password_hash,role) VALUES(?,?,?,?,'SUPER_ADMIN')").run(admin,admin,`${admin}@test.local`,bcrypt.hashSync(password,4));
  for(const id of [imported,directImported])db.prepare("INSERT INTO users(id,company_id,name,email,password_hash,role,active) VALUES(?,?,?,?,?,'INSPECTOR',0)").run(id,company,id,`${id}@importado.invalid`,bcrypt.hashSync('UnusableImportPassword123!',4));
  db.prepare('INSERT INTO units(id,company_id,name,code,responsible_id) VALUES(?,?,?,?,?)').run(unit,company,'Unidade atribuída',prefix,technician);
  db.prepare('INSERT INTO units(id,company_id,name,code) VALUES(?,?,?,?)').run(foreignUnit,other,'Unidade de outra empresa',prefix);
  db.prepare("INSERT INTO templates(id,company_id,name) VALUES(?,?,?)").run(prefix,company,'Roteiro de teste');
  db.prepare("INSERT INTO template_items(id,template_id,area,code,title,expected_answer,sort_order) VALUES(?,?,?,?,?,?,?)").run(prefix,prefix,'Área','T1','Pergunta','Sim',1);
  const snapshot=JSON.stringify({items:db.prepare('SELECT * FROM template_items WHERE id=?').all(prefix)});
  db.prepare("INSERT INTO inspections(id,company_id,unit_id,template_id,control_code,title,status,inspector_id,progress,template_snapshot) VALUES(?,?,?,?,?,?,'IN_REVIEW',?,100,?)").run(inspection,company,unit,prefix,prefix,'Inspeção de teste',technician,snapshot);
  db.prepare("INSERT INTO responses(id,inspection_id,item_id,user_id,answer,compliance,comment) VALUES(?,?,?,?,'Não','NON_COMPLIANT','Resposta enviada pelo RT')").run(`${prefix}-response`,inspection,prefix,technician);
  const coord=await login(`${coordinator}@test.local`),tech=await login(`${technician}@test.local`);
  const userFields={name:'Responsável de teste',email:`${prefix}-new@test.local`,password,role:'INSPECTOR',company_id:other};
  assert.equal((await request('/api/users',coord,userFields,'https://origem-invalida.example')).status,403);
  assert.ok(!db.prepare('SELECT id FROM users WHERE email=?').get(userFields.email));
  const invalidOrigin='https://origem-invalida.example';
  assert.equal((await request('/api/units',coord,{code:'CSRF-TEST',responsible_id:technician},invalidOrigin)).status,403);
  assert.ok(!db.prepare("SELECT id FROM units WHERE company_id=? AND code='CSRF-TEST'").get(company));
  assert.equal((await request(`/api/units/${unit}`,coord,{name:'Alteração indevida',code:'CSRF-EDIT',active:'1'},invalidOrigin)).status,403);
  assert.equal(db.prepare('SELECT name FROM units WHERE id=?').get(unit)!.name,'Unidade atribuída');
  assert.equal((await request(`/api/units/${unit}`,coord,{intent:'deactivate'},invalidOrigin)).status,403);
  assert.equal(db.prepare('SELECT active FROM units WHERE id=?').get(unit)!.active,1);
  assert.equal((await request(`/api/users/${technician}`,coord,{name:'Nome malicioso',email:`${technician}@test.local`,password:'',role:'INSPECTOR',active:'1'},'https://origem-invalida.example')).status,403);
  assert.equal(db.prepare('SELECT name FROM users WHERE id=?').get(technician)!.name,technician);
  assert.equal((await request('/api/users',coord,{...userFields,role:'SUPER_ADMIN'})).status,403);
  const createdUser=await request('/api/users',coord,userFields);assert.equal(createdUser.status,303);
  const createdUserId=new URL(createdUser.headers.get('location')!).pathname.split('/')[2],newUser=db.prepare('SELECT * FROM users WHERE id=?').get(createdUserId)!;
  assert.equal(newUser.company_id,company);assert.equal(newUser.role,'INSPECTOR');assert.ok(bcrypt.compareSync(password,String(newUser.password_hash)));
  redirected(await request('/api/users',coord,{...userFields,email:userFields.email.toUpperCase()}),'erro=email');
  assert.equal(db.prepare('SELECT count(*) n FROM users WHERE lower(email)=?').get(userFields.email)!.n,1);
  for(const target of [foreignTechnician,admin]){
    assert.equal((await request(`/api/users/${target}`,coord,{name:'Fora do escopo',role:'INSPECTOR',active:'0'})).status,403);
    assert.equal((await request(`/api/users/${target}`,coord,{intent:'deactivate'})).status,403);
    assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get(target)!.active,1);
  }
  redirected(await request(`/api/users/${technician}`,coord,{name:'Duplicado',email:`${coordinator}@test.local`.toUpperCase(),password:'',role:'INSPECTOR',active:'1'}),'erro=email');
  assert.equal(db.prepare('SELECT name FROM users WHERE id=?').get(technician)!.name,technician);
  const changedEmail=`${prefix}-edited@test.local`,changedPassword='UpdatedUser123!';
  redirected(await request(`/api/users/${technician}`,coord,{name:'Responsável editado',email:changedEmail.toUpperCase(),password:changedPassword,role:'INSPECTOR',active:'1',company_id:other}),'ok=1');
  const edited=db.prepare('SELECT * FROM users WHERE id=?').get(technician)!;assert.equal(edited.email,changedEmail);assert.equal(edited.name,'Responsável editado');assert.equal(edited.company_id,company);assert.ok(bcrypt.compareSync(changedPassword,String(edited.password_hash)));await login(changedEmail,changedPassword);
  const importedFields={name:'Responsável importado',email:`${imported}@importado.invalid`,password:'',role:'INSPECTOR',active:'1'};
  for(const fields of [importedFields,{...importedFields,password:changedPassword},{...importedFields,email:`${imported}@example.com`},{...importedFields,email:`${imported}@example.com`,active:'0'}])redirected(await request(`/api/users/${imported}`,coord,fields),'erro=ativacao');
  const unchangedImport=db.prepare('SELECT email,active FROM users WHERE id=?').get(imported)!;assert.equal(unchangedImport.email,importedFields.email);assert.equal(unchangedImport.active,0);
  redirected(await request(`/api/users/${imported}`,coord,{...importedFields,email:`${imported}@example.com`,password:changedPassword,active:'0'}),'ok=1');
  assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get(imported)!.active,0);
  redirected(await request(`/api/users/${imported}`,coord,{...importedFields,email:`${imported}@example.com` }),'ok=1');await login(`${imported}@example.com`,changedPassword);
  redirected(await request(`/api/users/${directImported}`,coord,{...importedFields,email:`${directImported}@example.com`,password:changedPassword}),'ok=1');await login(`${directImported}@example.com`,changedPassword);
  redirected(await request(`/api/users/${coordinator}`,coord,{intent:'deactivate'}),'erro=propria-conta');assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get(coordinator)!.active,1);
  redirected(await request(`/api/users/${coordinator}`,coord,{name:'Coordenador de teste',email:`${coordinator}@test.local`,role:'SUPERVISOR',active:'0',password:''}),'ok=1');assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get(coordinator)!.active,1);
  const listing=await (await request('/unidades',tech)).text();assert.ok(listing.includes(`/unidades/${unit}`));assert.ok(!listing.includes(`/unidades/${foreignUnit}`));assert.ok(!listing.includes('Adicionar entrada'));
  const detail=await request(`/unidades/${unit}`,tech);assert.equal(detail.status,200);const html=await detail.text();assert.ok(html.includes('fieldset disabled'));assert.ok(!html.includes('Salvar alterações'));
  assert.equal((await request(`/unidades/${foreignUnit}`,tech)).status,404);
  assert.equal((await request(`/unidades/${foreignUnit}`,coord)).status,404);
  for(const path of ['/api/units',`/api/units/${unit}`,'/api/users','/api/projects','/api/templates','/api/inspections'])assert.equal((await request(path,tech,{})).status,403,path);
  for(const path of ['/usuarios','/projetos','/modelos','/nao-conformidades'])assert.equal((await request(path,tech)).status,307,path);
  assert.equal((await request(`/api/inspections/${inspection}/status`,tech,{status:'APPROVED'})).status,403);
  assert.equal((await request(`/api/inspections/${inspection}/responses`,tech,{item_id:prefix,answer:'Sim',comment:''})).status,409);
  assert.equal((await request(`/api/inspections/${inspection}/responses`,coord,{item_id:prefix,answer:'Sim',comment:'Correção do coordenador'})).status,303);
  assert.equal((await request(`/api/units/${unit}`,coord,{name:'Unidade atribuída',code:'TEST',address:'',city:'',state:'',active:'1',responsible_id:coordinator})).status,400);
  assert.equal((await request(`/api/units/${unit}`,coord,{name:'Unidade atribuída',code:'TEST',address:'Endereço atualizado',city:'',state:'',active:'1',responsible_id:technician,maps_url:'https://maps.example.com/test',contact_name:'Contato teste',contact_email:'teste@example.com',contact_phones:'(11) 99999-9999 e (11) 88888-8888',form_url:'Ainda não informado'})).status,303);
  const saved=db.prepare('SELECT * FROM units WHERE id=?').get(unit)!;
  assert.equal(saved.contact_name,'Contato teste');assert.equal(saved.contact_email,'teste@example.com');assert.equal(saved.form_url,'Ainda não informado');
  const table=await (await request('/unidades',tech)).text();assert.ok(table.includes('<table'));assert.ok(table.includes('Contato teste'));assert.ok(table.includes('https://maps.example.com/test'));assert.ok(!table.includes('Editar dados'));
  const created=await request('/api/units',coord,{code:'ADDED',address:'Endereço novo',responsible_id:technician,maps_url:'Ainda não recebido',form_url:'javascript:alert(1)'});
  assert.equal(created.status,303);assert.equal((db.prepare("SELECT name FROM units WHERE company_id=? AND code='ADDED'").get(company)!).name,'ADDED');
  const safeTable=await (await request('/unidades',tech)).text();assert.ok(!safeTable.includes('href="javascript:'));assert.ok(safeTable.includes('Ainda não recebido'));
  assert.equal((await request(`/api/received-reports/${inspection}/review`,coord,{section:'Área',decision:'APPROVED',note:''})).status,303);
  db.prepare('UPDATE units SET responsible_id=NULL WHERE id=?').run(unit);
  assert.equal((await request(`/unidades/${unit}`,tech)).status,404);
  redirected(await request(`/api/users/${technician}`,coord,{intent:'deactivate'}),'ok=desativado');assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get(technician)!.active,0);
  assert.equal((await request('/unidades',tech)).status,307);
  console.log('Permissões HTTP validadas: origem, e-mail único, edição de RT, ativação importada, bloqueio da própria conta, isolamento, consulta, atribuição e revisão.');
}finally{
  db.prepare('DELETE FROM audit_logs WHERE company_id IN (?,?)').run(company,other);
  db.prepare('DELETE FROM responses WHERE inspection_id=?').run(inspection);
  db.prepare('DELETE FROM nonconformities WHERE inspection_id=?').run(inspection);
  db.prepare('DELETE FROM report_section_reviews WHERE inspection_id=?').run(inspection);
  db.prepare('DELETE FROM inspections WHERE id=?').run(inspection);
  db.prepare('DELETE FROM template_items WHERE id=?').run(prefix);
  db.prepare('DELETE FROM templates WHERE id=?').run(prefix);
  db.prepare('DELETE FROM units WHERE company_id IN (?,?)').run(company,other);
  db.prepare('DELETE FROM users WHERE company_id IN (?,?) OR id=?').run(company,other,admin);
  db.prepare('DELETE FROM companies WHERE id IN (?,?)').run(company,other);
}
