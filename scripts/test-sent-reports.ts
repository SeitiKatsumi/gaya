import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import {db} from '../src/lib/db.ts';
import {dayLabel,saoPauloToday,addDays} from '../src/lib/calendar.ts';
import {reportStorage} from '../src/lib/report-export.ts';

// ponytail: verify registration, authorization and the immutable PDF in one isolated lifecycle.
const base='http://localhost:3000',tag=`sent-${Date.now()}`,company=tag+'-company',foreign=tag+'-foreign',coordId=tag+'-coord',techId=tag+'-tech',otherTech=tag+'-other-tech',foreignCoord=tag+'-foreign-coord',unit=tag+'-unit',foreignUnit=tag+'-foreign-unit',template=tag+'-template',item=tag+'-item',password='SentReportTest123!';
const inspections:string[]=[];
async function request(route:string,cookie='',body?:Record<string,string>,origin?:string){return fetch(base+route,{redirect:'manual',headers:{...(cookie?{cookie}:{}),...(origin?{origin}:{})},...(body?{method:'POST',body:new URLSearchParams(body)}:{})});}
async function login(id:string){const response=await request('/api/auth/login','',{email:id+'@test.local',password});assert.equal(response.status,303);return response.headers.get('set-cookie')!.split(';')[0];}
function inspection(suffix:string,status:string,targetUnit=unit,targetCompany=company){const id=tag+'-'+suffix;inspections.push(id);db.prepare('INSERT INTO inspections(id,company_id,unit_id,template_id,control_code,title,status,inspector_id,planned_start,received_at,template_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,targetCompany,targetUnit,template,'RT/área-'+id,id,status,targetCompany===company?techId:null,saoPauloToday(),new Date().toISOString(),JSON.stringify({items:db.prepare('SELECT * FROM template_items WHERE template_id=?').all(template)}));db.prepare('INSERT INTO responses(id,inspection_id,item_id,user_id,answer,compliance,comment,details_json) VALUES(?,?,?,?,?,?,?,?)').run(tag+'-response-'+suffix,id,item,techId,'Sim','COMPLIANT','Conteúdo aprovado preservado','{}');if(status==='APPROVED')db.prepare("INSERT INTO report_section_reviews(inspection_id,section,status,reviewed_by) VALUES(?,'Área','APPROVED',?)").run(id,coordId);return id;}
const body={sent_at:saoPauloToday(),recipient:'matriz@example.test, qualidade@example.test',confirmation:'sent'};
try{
  for(const id of [company,foreign])db.prepare('INSERT INTO companies(id,legal_name,trade_name) VALUES(?,?,?)').run(id,id,id);
  for(const [id,role,target] of [[coordId,'SUPERVISOR',company],[techId,'INSPECTOR',company],[otherTech,'INSPECTOR',company],[foreignCoord,'SUPERVISOR',foreign]])db.prepare('INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)').run(id,target,id,id+'@test.local',bcrypt.hashSync(password,4),role);
  for(const [id,target] of [[unit,company],[foreignUnit,foreign]])db.prepare('INSERT INTO units(id,company_id,name,code,responsible_id) VALUES(?,?,?,?,?)').run(id,target,id,id,target===company?techId:null);
  db.prepare("INSERT INTO templates(id,company_id,name,status) VALUES(?,?,?,'PUBLISHED')").run(template,company,template);db.prepare("INSERT INTO template_items(id,template_id,code,title,area,response_type,expected_answer,sort_order) VALUES(?,?,?,'Item técnico','Área','YES_NO','Sim',1)").run(item,template,'CHECK');
  const approved=inspection('approved','APPROVED'),draft=inspection('draft','IN_PROGRESS'),foreignApproved=inspection('foreign-approved','APPROVED',foreignUnit,foreign),coord=await login(coordId),tech=await login(techId),unassigned=await login(otherTech),outsider=await login(foreignCoord);
  const route=`/api/received-reports/${approved}/send`;
  const defaults={company_id:company,recipients:body.recipient};
  assert.equal((await request('/api/report-recipients','',defaults)).status,401);
  assert.equal((await request('/api/report-recipients',tech,defaults)).status,403);
  assert.equal((await request('/api/report-recipients',outsider,defaults)).status,404);
  assert.equal((await request('/api/report-recipients',coord,defaults,'https://foreign.example.test')).status,403);
  assert.equal((await request('/api/report-recipients',coord,{...defaults,recipients:'one@example.test, two@example.test, three@example.test'})).status,400);
  assert.equal((await request('/api/report-recipients',coord,{...defaults,recipients:'invalid'})).status,400);
  assert.equal((await request('/api/report-recipients',coord,defaults)).status,303);
  assert.equal(db.prepare('SELECT report_recipients FROM companies WHERE id=?').get(company)!.report_recipients,body.recipient);
  assert.equal((await request(route,'',body)).status,401);assert.equal((await request(route,tech,body)).status,403);assert.equal((await request(route,outsider,body)).status,404);assert.equal((await request(`/api/received-reports/${foreignApproved}/send`,coord,body)).status,404);
  assert.equal((await request(`/api/received-reports/${draft}/send`,coord,body)).status,409);assert.equal((await request(route,coord,body,'https://foreign.example.test')).status,403);
  assert.equal((await request(route,coord,{...body,sent_at:addDays(saoPauloToday(),1)})).status,400);assert.equal((await request(route,coord,{...body,sent_at:'2026-02-30'})).status,400);assert.equal((await request(route,coord,{...body,recipient:'invalid'})).status,400);assert.equal((await request(route,coord,{...body,confirmation:'no'})).status,400);
  db.prepare("UPDATE report_section_reviews SET status='PENDING' WHERE inspection_id=?").run(approved);assert.equal((await request(route,coord,body)).status,409);db.prepare("UPDATE report_section_reviews SET status='APPROVED' WHERE inspection_id=?").run(approved);
  const deliveryPage=await (await request(`/relatorios/${approved}/envio`,coord)).text();assert.ok(deliveryPage.includes('Ele não dispara emails'));assert.ok(deliveryPage.includes('Já enviei o PDF aprovado ao cliente'));
  assert.ok(deliveryPage.includes('value="'+body.recipient+'"'));
  assert.equal((await request(route,coord,body)).status,303);const sent=db.prepare("SELECT * FROM reports WHERE inspection_id=? AND status='SENT'").get(approved)!;assert.equal(sent.delivery_method,'MANUAL');assert.equal(sent.recipient,body.recipient);assert.equal(sent.sent_at,body.sent_at);assert.equal(sent.generated_by,coordId);assert.equal(db.prepare('SELECT status FROM inspections WHERE id=?').get(approved)!.status,'APPROVED');
  assert.equal(db.prepare("SELECT count(*) n FROM audit_logs WHERE inspection_id=? AND action='REPORT_SENT_EXTERNALLY'").get(approved)!.n,1);
  const root=reportStorage(),stored=path.resolve(String(sent.path));assert.ok(stored.startsWith(root+path.sep));const snapshot=fs.readFileSync(stored);assert.equal(snapshot.subarray(0,5).toString(),'%PDF-');
  const fileRoute=`/api/sent-reports/${sent.id}`;assert.equal((await request(fileRoute)).status,401);assert.equal((await request(fileRoute,outsider)).status,404);assert.equal((await request(fileRoute,unassigned)).status,404);assert.equal((await request(fileRoute,tech)).status,200);
  const download=await request(fileRoute,coord);assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');assert.match(download.headers.get('content-disposition')!,/^attachment; filename="[A-Za-z0-9._-]+\.pdf"$/);assert.deepEqual(Buffer.from(await download.arrayBuffer()),snapshot);
  db.prepare("UPDATE responses SET comment='Mudança posterior simulada somente no registro de teste' WHERE inspection_id=?").run(approved);assert.deepEqual(Buffer.from(await (await request(fileRoute,coord)).arrayBuffer()),snapshot);db.prepare("UPDATE responses SET comment='Conteúdo aprovado preservado' WHERE inspection_id=?").run(approved);
  assert.equal((await request(route,coord,{...body,recipient:'another@example.test'})).status,303);assert.equal(db.prepare("SELECT count(*) n FROM reports WHERE inspection_id=? AND status='SENT'").get(approved)!.n,1);assert.equal(db.prepare("SELECT recipient FROM reports WHERE inspection_id=? AND status='SENT'").get(approved)!.recipient,body.recipient);
  const listing=await (await request(`/relatorios-enviados?codigo=${unit}`,coord)).text();assert.ok(listing.includes('Data de Envio'));assert.ok(listing.includes('Responsável Técnico'));assert.ok(listing.includes(unit));assert.ok(listing.includes(dayLabel(body.sent_at,{day:'2-digit',month:'2-digit',year:'numeric'})));assert.ok(listing.includes(fileRoute));assert.ok(!listing.includes(foreignUnit));assert.ok(!(await (await request('/relatorios-enviados?codigo=unidade-inexistente',coord)).text()).includes(fileRoute));assert.equal((await request('/relatorios-enviados',tech)).status,307);
  db.prepare('UPDATE reports SET path=? WHERE id=?').run(path.resolve('package.json'),sent.id);try{assert.equal((await request(fileRoute,coord)).status,404);}finally{db.prepare('UPDATE reports SET path=? WHERE id=?').run(stored,sent.id);}
  fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/sent-report-test.pdf',snapshot);console.log('Enviados: aprovação, registro externo, confirmação, origem, data, destinatário, escopo, idempotência e download imutável validados.');
  if(process.env.TEST_UI_FIXTURE==='1')fs.writeFileSync('tmp/sent-report-ui-fixture.json',JSON.stringify({tag,company,foreign,coordId,techId,password,unit,foreignUnit,template,item,inspections,reportId:sent.id}));
}finally{
  if(process.env.TEST_UI_FIXTURE!=='1'){
    const files=db.prepare('SELECT r.path FROM reports r JOIN inspections i ON i.id=r.inspection_id WHERE i.company_id IN (?,?)').all(company,foreign) as {path:string}[];for(const file of files){const full=path.resolve(file.path);assert.ok(full.startsWith(reportStorage()+path.sep));if(fs.existsSync(full))fs.unlinkSync(full);}
    db.prepare('DELETE FROM audit_logs WHERE company_id IN (?,?)').run(company,foreign);
    for(const id of inspections){for(const table of ['reports','report_section_reviews','evidences','responses','nonconformities','inspection_sessions'])db.prepare(`DELETE FROM ${table} WHERE inspection_id=?`).run(id);db.prepare('DELETE FROM inspections WHERE id=?').run(id);}
    db.prepare('DELETE FROM template_items WHERE template_id=?').run(template);db.prepare('DELETE FROM templates WHERE id=?').run(template);db.prepare('DELETE FROM units WHERE company_id IN (?,?)').run(company,foreign);db.prepare('DELETE FROM users WHERE company_id IN (?,?)').run(company,foreign);db.prepare('DELETE FROM companies WHERE id IN (?,?)').run(company,foreign);
  }
}
