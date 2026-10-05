import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import {db} from '../src/lib/db.ts';
import {documentLocations,documentSection,storageSection,actionSection,pastSection,ensureVisitTemplate,visitTemplateId,sendDeadline,saoPauloDate,priorPlans} from '../src/lib/received-reports.ts';

// ponytail: one HTTP check for the report lifecycle; isolated records are cleaned in finally.
const base='http://localhost:3000',tag=`reports-${Date.now()}`,company=`${tag}-company`,other=`${tag}-other`,coordId=`${tag}-coord`,techId=`${tag}-tech`,otherTech=`${tag}-othertech`,unit=`${tag}-unit`,foreignUnit=`${tag}-foreign`,password='LocalReportTest123!';
const reports:string[]=[];
async function request(route:string,cookie='',body?:Record<string,string>|FormData){return fetch(base+route,{redirect:'manual',headers:cookie?{cookie}:{},...(body?{method:'POST',body:body instanceof FormData?body:new URLSearchParams(body)}:{})});}
async function login(id:string){const response=await request('/api/auth/login','',{email:`${id}@test.local`,password});assert.equal(response.status,303);const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);return cookie;}
async function create(cookie:string,date='2026-09-23'){const response=await request('/api/received-reports',cookie,{unit_id:unit,visit_date:date});assert.equal(response.status,303);const id=response.headers.get('location')!.split('/').at(-1)!;reports.push(id);return id;}
async function save(id:string,cookie:string,code:string,fields:Record<string,string>={}){return request(`/api/inspections/${id}/responses`,cookie,{item_id:`gaya-v1-${code}`,answer:'Sim',comment:'',report_view:'1',...fields});}
async function review(id:string,cookie:string,section:string,decision='APPROVED',note=''){return request(`/api/received-reports/${id}/review`,cookie,{section,decision,note});}
async function status(id:string,cookie:string,value='IN_REVIEW'){return request(`/api/inspections/${id}/status`,cookie,{status:value,report_view:'1'});}
assert.equal(sendDeadline('2026-09-23'),'2026-09-25');assert.equal(sendDeadline('2026-09-24'),'2026-09-28');assert.equal(sendDeadline('2026-09-25'),'2026-09-29');assert.equal(sendDeadline('2026-12-31'),'2027-01-04');assert.equal(saoPauloDate('2026-09-26T01:00:00Z'),'2026-09-25');
try{
  ensureVisitTemplate();
  const catalog=db.prepare('SELECT * FROM template_items WHERE template_id=?').all(visitTemplateId) as {response_type:string;condition_json:string|null}[];
  assert.equal(catalog.filter(item=>item.response_type==='DOCUMENT').length,55);assert.equal(catalog.filter(item=>item.response_type==='YES_NO').length,86);assert.equal(catalog.filter(item=>item.condition_json).length,14);assert.equal(catalog.filter(item=>item.response_type==='ACTION_PLAN').length,9);
  for(const id of [company,other])db.prepare('INSERT INTO companies(id,legal_name,trade_name) VALUES(?,?,?)').run(id,id,id);
  for(const [id,role] of [[coordId,'SUPERVISOR'],[techId,'INSPECTOR'],[otherTech,'INSPECTOR']])db.prepare('INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)').run(id,company,id,`${id}@test.local`,bcrypt.hashSync(password,4),role);
  db.prepare('INSERT INTO units(id,company_id,name,code,responsible_id) VALUES(?,?,?,?,?)').run(unit,company,'Unidade de teste',tag,techId);
  db.prepare('INSERT INTO units(id,company_id,name,code) VALUES(?,?,?,?)').run(foreignUnit,other,'Outra unidade',tag);
  const coord=await login(coordId),tech=await login(techId),unassigned=await login(otherTech);
  assert.equal((await request('/api/received-reports','',{unit_id:unit,visit_date:'2026-09-23'})).status,401);
  assert.equal((await request('/api/received-reports',unassigned,{unit_id:unit,visit_date:'2026-09-23'})).status,403);
  assert.equal((await request('/api/received-reports',coord,{unit_id:foreignUnit,visit_date:'2026-09-23'})).status,403);
  const id=await create(tech);
  assert.equal((await status(id,tech)).status,409);
  const draftListing=await (await request('/relatorios',coord)).text();assert.ok(!draftListing.includes(`/relatorios/${id}`));
  assert.equal((await request(`/relatorios/${id}`,unassigned)).status,404);
  const invalid=await save(id,tech,'DOC-01',{expiry:'2026-02-30'});assert.ok(invalid.headers.get('location')?.includes('erro=documento'));
  assert.equal((await save(id,tech,'DOC-01',{location:documentLocations[0],expiry:'2027-12-23',document_periodicity:'forjado'})).status,303);
  const history=await (await request(`/inspecoes/${id}/itens/gaya-v1-DOC-01`,tech)).text();
  assert.ok(history.includes('>Conforme</b>'),'The item history must present the result in Portuguese.');
  assert.ok(history.includes(`/relatorios/${id}?area=Verifica%C3%A7%C3%A3o+Documental&amp;item=gaya-v1-DOC-01`),'Returning from history must preserve the document in the visit wizard.');
  assert.equal((await save(id,tech,'ARM-02')).status,400);
  assert.equal((await save(id,tech,'ARM-01',{answer:'Não',comment:'Demora na portaria.'})).status,303);
  assert.equal((await status(id,tech)).status,409);
  const media=new FormData();media.set('item_id','gaya-v1-ARM-02');media.set('answer','Não');media.set('comment','Não houve demora significativa.');media.set('report_view','1');media.set('photo',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGOwrEqv2L+YAYiBLAAotAXpQFvwbAAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'test-photo.png');
  assert.equal((await request(`/api/inspections/${id}/responses`,tech,media)).status,303);
  assert.equal((await save(id,tech,'ACTION',{nonconformities:'Pallet danificado',immediate:'Isolar a área',corrective:'Trocar o pallet',preventive:'Inspecionar semanalmente',responsible:'Operações'})).status,303);
  assert.equal((await status(id,tech)).status,303);
  const received=db.prepare('SELECT * FROM inspections WHERE id=?').get(id)!;assert.ok(received.received_at);assert.equal(received.send_due_date,sendDeadline(saoPauloDate(String(received.received_at))));
  const listing=await (await request('/relatorios',coord)).text();assert.ok(listing.includes(`/relatorios/${id}`));assert.ok(listing.includes('Examinar'));assert.ok(listing.includes('Data Limite de Envio'));
  const detail=await (await request(`/relatorios/${id}`,coord)).text();assert.ok(detail.includes('AVCB'));assert.ok(!detail.includes('Contrato de Locação da Unidade'));assert.ok(!detail.includes('gaya-v1-ARM-03'));assert.ok(detail.includes('test-photo.png'));assert.ok(detail.includes('Aprovar planilha'));
  assert.equal((await save(id,tech,'DOC-01',{answer:'Não'})).status,409);
  assert.equal((await review(id,tech,documentSection)).status,403);
  assert.equal((await review(id,coord,'Seção inexistente')).status,400);
  assert.equal((await review(id,coord,actionSection,'REJECTED')).status,400);
  assert.equal((await status(id,coord,'APPROVED')).status,409);
  assert.equal((await review(id,coord,documentSection)).status,303);
  assert.equal((await save(id,coord,'DOC-01',{location:documentLocations[1],expiry:'2028-12-23'})).status,303);
  assert.equal(db.prepare('SELECT status FROM report_section_reviews WHERE inspection_id=? AND section=?').get(id,documentSection)!.status,'PENDING');
  assert.equal((await review(id,coord,documentSection)).status,303);assert.equal((await review(id,coord,storageSection)).status,303);
  assert.equal((await review(id,coord,actionSection,'REJECTED','Detalhar a ação preventiva.')).status,303);
  assert.equal(db.prepare('SELECT status FROM inspections WHERE id=?').get(id)!.status,'CHANGES_REQUESTED');
  assert.ok((await (await request(`/relatorios/${id}`,tech)).text()).includes('Detalhar a ação preventiva.'));
  const returned=await (await request(`/relatorios/${id}`,coord)).text();assert.ok(!returned.includes('Contrato de Locação da Unidade'));assert.ok(!returned.includes('Editar planilha'));
  assert.equal((await save(id,coord,'ARM-01',{answer:'Não'})).status,403);
  assert.equal((await save(id,tech,'DOC-01',{answer:'Não'})).status,409);
  assert.equal((await save(id,tech,'ACTION',{nonconformities:'Pallet danificado',immediate:'Isolar a área',corrective:'Trocar o pallet',preventive:'Inspecionar semanalmente e registrar evidências',responsible:'Operações'})).status,303);
  assert.equal((await status(id,tech)).status,303);
  const resent=db.prepare('SELECT * FROM inspections WHERE id=?').get(id)!;assert.equal(resent.received_at,received.received_at);assert.equal(resent.send_due_date,received.send_due_date);
  assert.equal(db.prepare('SELECT status FROM report_section_reviews WHERE inspection_id=? AND section=?').get(id,documentSection)!.status,'APPROVED');
  assert.equal((await review(id,coord,actionSection)).status,303);assert.equal(db.prepare('SELECT status FROM inspections WHERE id=?').get(id)!.status,'APPROVED');
  assert.equal((await save(id,coord,'DOC-01',{answer:'Não'})).status,409);
  assert.equal((await request(`/api/reports/${id}`,unassigned)).status,403);
  const pdfResponse=await request(`/api/reports/${id}`,coord);assert.equal(pdfResponse.status,200);const pdf=Buffer.from(await pdfResponse.arrayBuffer());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.includes(Buffer.from('/Subtype /Image')),'Foto não incorporada ao PDF');fs.writeFileSync('tmp/received-report-test.pdf',pdf);
  const second=await create(tech,'2026-09-30'),source=db.prepare("SELECT id FROM responses WHERE inspection_id=? AND item_id='gaya-v1-ACTION' AND is_current=1").get(id)!;
  assert.equal(priorPlans({id:second,unit_id:unit,planned_start:'2026-09-30'}).length,1);
  assert.equal((await save(second,tech,'PAST',{checks:JSON.stringify([{id:'invalid',answer:'Sim',comment:''}])})).status,400);
  assert.equal((await save(second,tech,'PAST',{checks:JSON.stringify([{id:source.id,answer:'Sim',comment:'Pallet substituído.'}])})).status,303);
  assert.equal((await status(second,tech)).status,303);assert.equal((await review(second,coord,pastSection)).status,303);
  const snapshot=JSON.parse(String(db.prepare('SELECT template_snapshot FROM inspections WHERE id=?').get(id)!.template_snapshot));assert.equal(snapshot.items.find((item:{code:string})=>item.code==='DOC-01').document_copies,'1');
  assert.equal(db.prepare("SELECT count(*) n FROM responses WHERE inspection_id=? AND item_id='gaya-v1-DOC-01'").get(id)!.n,2);
  const complete=await create(tech,'2026-10-02'),hygiene='Higienização e Controle de Pragas';
  assert.equal((await save(complete,tech,'HIG-18')).status,400);
  assert.equal((await save(complete,tech,'HIG-17')).status,303);assert.equal((await status(complete,tech)).status,303);
  assert.equal((await save(complete,coord,'HIG-17',{answer:'Não'})).status,303);
  assert.equal((await review(complete,coord,hygiene)).status,409);
  assert.equal((await review(complete,coord,hygiene,'REJECTED','Complete a pergunta condicional.')).status,303);
  const wizard=await save(complete,tech,'HIG-17',{answer:'Não',report_wizard:'1'});assert.equal(wizard.status,303);assert.ok(wizard.headers.get('location')?.includes('item=gaya-v1-HIG-18'));
  assert.equal((await status(complete,tech)).status,409);
  assert.equal((await save(complete,tech,'HIG-18',{answer:'Não'})).status,303);assert.equal((await status(complete,tech)).status,303);assert.equal((await review(complete,coord,hygiene)).status,303);
  console.log('Relatórios: catálogo, condicionais, recebimento, prazo, isolamento, revisão por seção, devolução, reenvio, planos anteriores, anexos e PDF validados.');
  if(process.env.REPORT_UI_FIXTURE==='1')fs.writeFileSync('tmp/report-ui-fixture.json',JSON.stringify({tag,company,coordId,techId,password,unit,reports}));
}finally{
  if(process.env.REPORT_UI_FIXTURE!=='1'){
    const files=db.prepare('SELECT e.path FROM evidences e JOIN inspections i ON i.id=e.inspection_id WHERE i.company_id=?').all(company) as {path:string}[];const root=path.resolve('storage');for(const file of files){const full=path.resolve(file.path);assert.ok(full.startsWith(root+path.sep));fs.unlinkSync(full);}
    db.prepare('DELETE FROM audit_logs WHERE company_id IN (?,?)').run(company,other);
    for(const id of reports){for(const table of ['report_section_reviews','evidences','responses','nonconformities','inspection_sessions'])db.prepare(`DELETE FROM ${table} WHERE inspection_id=?`).run(id);db.prepare('DELETE FROM inspections WHERE id=?').run(id);}
    db.prepare('DELETE FROM units WHERE company_id IN (?,?)').run(company,other);db.prepare('DELETE FROM users WHERE company_id=?').run(company);db.prepare('DELETE FROM companies WHERE id IN (?,?)').run(company,other);
  }
}
