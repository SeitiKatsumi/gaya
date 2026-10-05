import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import {db} from '../src/lib/db.ts';
import type {SessionUser} from '../src/lib/auth.ts';
import {monthlyExecutive,saveMonthlyReview} from '../src/lib/monthly-executive.ts';
import {trackedPlans} from '../src/lib/report-statistics.ts';

// ponytail: one end-to-end check; every written record belongs to these temporary companies.
const tag=`executive-${Date.now()}`,company=tag+'-company',foreign=tag+'-foreign',template=tag+'-template';
const coordinatorId=tag+'-coordinator',technicianId=tag+'-technician',otherTechnicianId=tag+'-other-technician';
const unit=tag+'-unit',secondUnit=tag+'-second-unit',emptyUnit=tag+'-empty-unit',foreignUnit=tag+'-foreign-unit';
const month='2026-10',password='ExecutiveTest123!',base=process.env.TEST_APP_URL||'http://localhost:3000';
const coordinator:SessionUser={id:coordinatorId,company_id:company,name:'Coordenação executiva de teste',email:coordinatorId+'@test.local',role:'SUPERVISOR'};
const technician:SessionUser={id:technicianId,company_id:company,name:'Responsável técnico de teste',email:technicianId+'@test.local',role:'INSPECTOR'};
const reports:string[]=[];
const filters={month,unit:''};
let success=false;
function near(actual:number|null,expected:number,label:string){assert.ok(actual!==null&&Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);}
function report(suffix:string,date:string,status:string,target=unit,owner=technicianId,targetCompany=company){
  const id=tag+'-'+suffix;reports.push(id);
  db.prepare('INSERT INTO inspections(id,company_id,unit_id,template_id,control_code,title,status,inspector_id,planned_start,received_at,template_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,targetCompany,target,template,id,'Visita executiva de teste',status,owner,date,['IN_REVIEW','APPROVED','CHANGES_REQUESTED'].includes(status)?date+'T18:00:00Z':null,JSON.stringify({items:db.prepare('SELECT * FROM template_items WHERE template_id=? ORDER BY sort_order').all(template)}));
  return id;
}
function answer(inspectionId:string,item:string,value:string,details:unknown={},current=1){
  const id=tag+'-response-'+crypto.randomUUID();
  // Deliberately misleading stored compliance proves the executive follows its frozen answer key.
  db.prepare('INSERT INTO responses(id,inspection_id,item_id,user_id,answer,compliance,comment,details_json,is_current) VALUES(?,?,?,?,?,?,?,?,?)').run(id,inspectionId,tag+'-'+item,technicianId,value,'COMPLIANT','',JSON.stringify(details),current);
  return id;
}
async function request(route:string,cookie='',options:RequestInit={}){return fetch(base+route,{...options,redirect:'manual',headers:{...(cookie?{cookie}:{}),...options.headers}});}
async function login(user:SessionUser){const response=await request('/api/auth/login','',{method:'POST',body:new URLSearchParams({email:user.email,password})});assert.equal(response.status,303);assert.ok(response.headers.get('set-cookie'));return response.headers.get('set-cookie')!.split(';')[0];}
async function review(cookie:string,values:Record<string,string>={},origin=base){return request('/api/monthly-reports/review',cookie,{method:'POST',headers:{origin},body:new URLSearchParams({mes:month,unidade:'',text:'Parecer técnico revisado: priorizar os planos e completar a documentação.',source_hash:monthlyExecutive(coordinator,filters).sourceHash,...values})});}

try{
  for(const [id,label] of [[company,'Gaya — teste executivo'],[foreign,'Outra empresa — teste executivo']])db.prepare('INSERT INTO companies(id,legal_name,trade_name) VALUES(?,?,?)').run(id,label,label);
  for(const user of [coordinator,technician,{...technician,id:otherTechnicianId,name:'Outro responsável de teste',email:otherTechnicianId+'@test.local'}])db.prepare('INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)').run(user.id,user.company_id,user.name,user.email,bcrypt.hashSync(password,4),user.role);
  for(const [id,companyId,code,name,owner] of [[unit,company,'SP02','Cajamar — teste executivo',technicianId],[secondUnit,company,'RC01','Perus — teste executivo',otherTechnicianId],[emptyUnit,company,'MG03','Sem vistoria aprovada — teste executivo',technicianId],[foreignUnit,foreign,'XX01','Unidade de outra empresa',technicianId]])db.prepare('INSERT INTO units(id,company_id,code,name,responsible_id) VALUES(?,?,?,?,?)').run(id,companyId,code,name,owner);
  db.prepare("INSERT INTO templates(id,company_id,name,status) VALUES(?,?,?,'PUBLISHED')").run(template,company,'Checklist executivo de teste');
  const items:{code:string;title:string;type:string;sector:string;expected:string|null;weight:number;condition?:string}[]=[
    {code:'D1',title:'Licença operacional',type:'DOCUMENT',sector:'Licenças',expected:'Sim',weight:2},
    {code:'D2',title:'Registro de higienização',type:'DOCUMENT',sector:'Registros',expected:'Sim',weight:1},
    {code:'D3',title:'Documento ainda não verificado',type:'DOCUMENT',sector:'Registros',expected:'Sim',weight:1},
    {code:'POS',title:'Os produtos estão armazenados corretamente?',type:'YES_NO',sector:'Armazenamento',expected:'Sim',weight:3},
    {code:'NEG',title:'Foram encontrados indícios de pragas?',type:'YES_NO',sector:'Armazenamento',expected:'Não',weight:2},
    {code:'PARENT',title:'O acesso está controlado?',type:'YES_NO',sector:'Acesso',expected:'Sim',weight:1},
    {code:'CHILD',title:'Detalhamento aplicável somente sem controle',type:'YES_NO',sector:'Acesso',expected:'Sim',weight:100,condition:JSON.stringify({item_id:tag+'-PARENT',answer:'Não'})},
    {code:'NA',title:'Verificação não aplicável',type:'YES_NO_NA',sector:'Armazenamento',expected:'Sim',weight:5},
    {code:'UNKNOWN',title:'Pergunta sem chave oficial',type:'YES_NO',sector:'Armazenamento',expected:null,weight:4},
    {code:'UNANSWERED',title:'Verificação ainda não realizada',type:'YES_NO',sector:'Docas',expected:'Sim',weight:1},
    ...Array.from({length:10},(_,index)=>({code:'CAUSE'+(index+1),title:`Motivo observado ${String(index+1).padStart(2,'0')}: controle operacional inadequado`,type:'YES_NO',sector:['Armazenamento','Higienização','Quarentena','Expedição'][index%4],expected:'Sim',weight:1})),
    {code:'PLAN',title:'Plano de Armazenamento',type:'ACTION_PLAN',sector:'Armazenamento',expected:'Sim',weight:1},
    {code:'PLAN2',title:'Plano de Higienização',type:'ACTION_PLAN',sector:'Higienização',expected:'Sim',weight:1},
    {code:'PAST',title:'Verificação de planos anteriores',type:'PLAN_REVIEW',sector:'Planos anteriores',expected:'Sim',weight:1},
  ];
  for(const [index,item] of items.entries())db.prepare('INSERT INTO template_items(id,template_id,code,title,area,section,response_type,expected_answer,weight,condition_json,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(tag+'-'+item.code,template,item.code,item.title,item.type==='DOCUMENT'?'Verificação Documental':item.type==='ACTION_PLAN'?'Plano de Ação':item.type==='PLAN_REVIEW'?'Verificação de Planos de Ação Passados':'Operação',item.sector,item.type,item.expected,item.weight,item.condition||null,index);
  const previous=report('previous','2026-09-03','APPROVED');for(const [item,value] of [['D1','Sim'],['POS','Sim'],['NEG','Não'],['PARENT','Sim']])answer(previous,item,value);
  const previousSecond=report('previous-second','2026-09-03','APPROVED',secondUnit,otherTechnicianId);answer(previousSecond,'POS','Não');
  const first=report('first','2026-10-03','APPROVED');
  answer(first,'D1','Sim',{},0); // Historical revisions cannot override the current answer.
  for(const [item,value] of [['D1','Não'],['D2','Sim'],['POS','Não'],['NEG','Não'],['PARENT','Sim'],['CHILD','Não'],['NA','Não se aplica'],['UNKNOWN','Sim']])answer(first,item,value);
  for(let index=1;index<=10;index++)answer(first,'CAUSE'+index,'Não');
  const details={nonconformities:'Pendências do controle de armazenamento',immediate:'Isolar a área',corrective:'Reorganizar os produtos',preventive:'Verificar semanalmente',responsible:'Equipe operacional'};
  const plan=answer(first,'PLAN','Sim',details),secondPlan=answer(first,'PLAN2','Sim',{...details,nonconformities:'Pendências de higienização e registros'});
  const second=report('second','2026-10-10','APPROVED');for(const [item,value] of [['D1','Sim'],['D2','Não'],['POS','Sim'],['NEG','Sim'],['PARENT','Sim'],['CAUSE1','Não']])answer(second,item,value);
  const check=report('check','2026-10-20','APPROVED');answer(check,'PAST','Não',{checks:[{id:plan,answer:'Sim',comment:'Correção confirmada em outubro'},{id:secondPlan,answer:'Não',comment:'Ainda pendente em outubro'}]});
  const pendingCheck=report('pending-check','2026-10-25','IN_REVIEW');answer(pendingCheck,'PAST','Sim',{checks:[{id:secondPlan,answer:'Sim',comment:'Verificação ainda não aprovada'}]});
  const future=report('future-check','2026-11-02','APPROVED');answer(future,'PAST','Sim',{checks:[{id:secondPlan,answer:'Sim',comment:'Resolvido somente em novembro'}]});
  const other=report('other-unit','2026-10-05','APPROVED',secondUnit,otherTechnicianId);for(const [item,value] of [['D1','Sim'],['D2','Sim'],['POS','Sim'],['NEG','Não'],['PARENT','Sim']])answer(other,item,value);
  const empty=report('empty-unit','2026-10-06','IN_REVIEW',emptyUnit);answer(empty,'D1','Não');
  const unapproved=report('pending','2026-10-28','IN_REVIEW');answer(unapproved,'D1','Não');answer(unapproved,'POS','Não');
  const anotherOwner=report('another-owner','2026-10-29','IN_REVIEW',unit,otherTechnicianId);answer(anotherOwner,'D2','Sim');
  for(const status of ['IN_PROGRESS','SCHEDULED','CANCELLED']){const id=report(status.toLowerCase(),'2026-10-29',status);answer(id,'D1','Não');answer(id,'POS','Não');}
  const foreignReport=report('foreign','2026-10-03','APPROVED',foreignUnit,technicianId,foreign);answer(foreignReport,'D1','Não');answer(foreignReport,'POS','Não');

  const data=monthlyExecutive(coordinator,filters),firstUnit=data.units.find(row=>row.id===unit)!,otherUnit=data.units.find(row=>row.id===secondUnit)!;
  assert.equal(data.reportCount,4);assert.equal(data.pendingReportCount,4);
  near(firstUnit.metrics.igc,10/29*100,'weighted binary IGC including documents and expected Não');
  assert.equal(firstUnit.metrics.weightedEvaluated,29);assert.equal(firstUnit.metrics.weightedCompliant,10);
  assert.equal(firstUnit.metrics.answered,17);assert.equal(firstUnit.metrics.applicable,19);
  assert.equal(firstUnit.metrics.nonconformities,15);assert.equal(data.paretoTotal,13);
  assert.equal(firstUnit.metrics.documentsEvaluated,2);assert.equal(firstUnit.metrics.documentsPending,1);near(firstUnit.metrics.documentPercent,50,'latest documentary answers');
  assert.equal(firstUnit.metrics.sectorsPending,4);assert.equal(firstUnit.metrics.sectorsTotal,6);near(firstUnit.metrics.sectorPercent,4/6*100,'unique sectors');
  near(otherUnit.metrics.igc,100,'second unit IGC');near(data.metrics.igc,50,'global weighted result, not mean unit percentages');
  near(firstUnit.previousIgc,100,'previous month');near(firstUnit.delta,10/29*100-100,'month variation in percentage points');near(otherUnit.delta,100,'second unit monthly variation');
  assert.equal(data.units.find(row=>row.id===emptyUnit)!.metrics.igc,null);assert.equal(data.units.find(row=>row.id===emptyUnit)!.delta,null);
  assert.equal(data.pareto.length,8);assert.equal(data.pareto[0].count,2);near(data.pareto[0].share,2/13*100,'Pareto share against all observed NCs');near(data.pareto[7].cumulativePercent,9/13*100,'top eight cumulative denominator includes omitted causes');
  assert.equal(firstUnit.metrics.plans,2);assert.equal(firstUnit.metrics.resolutions,1);near(firstUnit.metrics.reincidence,50,'literal resolutions/plans as of October');
  assert.equal(trackedPlans(coordinator,{month,unit}).filter(row=>row.completed).length,2,'The present plan view includes November resolution, October indicator must not.');
  near(monthlyExecutive(technician,{month,unit}).metrics.igc,10/29*100,'RT own reports');assert.equal(monthlyExecutive(technician,filters).units.some(row=>row.id===secondUnit),false);assert.equal(monthlyExecutive(technician,filters).pendingReportCount,3);
  assert.throws(()=>monthlyExecutive(technician,{month,unit:secondUnit}));assert.throws(()=>monthlyExecutive(coordinator,{month,unit:foreignUnit}));assert.throws(()=>monthlyExecutive(coordinator,{month:'2026-13',unit:''}));
  assert.equal(monthlyExecutive(coordinator,{month:'2026-08',unit}).metrics.igc,null);
  assert.throws(()=>saveMonthlyReview(technician,filters,'Parecer de teste longo o suficiente.',data.sourceHash),/Sem permissão/);
  assert.throws(()=>saveMonthlyReview(coordinator,filters,'',data.sourceHash),/Parecer inválido/);
  assert.throws(()=>saveMonthlyReview(coordinator,filters,'x'.repeat(1801),data.sourceHash),/Parecer inválido/);
  assert.throws(()=>saveMonthlyReview(coordinator,filters,'Parecer de teste longo o suficiente.','0'.repeat(64)),/dados mudaram/);
  saveMonthlyReview(coordinator,filters,'Parecer coordenado: concluir os planos e completar a documentação.',data.sourceHash);
  assert.equal(monthlyExecutive(coordinator,filters).review!.current,true);
  assert.equal(monthlyExecutive(technician,filters).review,null,'Company-wide text cannot leak other units to an RT.');
  db.prepare("UPDATE responses SET comment='Atualização de evidência de teste' WHERE inspection_id=? AND item_id=? AND is_current=1").run(first,tag+'-POS');
  const stale=monthlyExecutive(coordinator,filters);assert.notEqual(stale.sourceHash,data.sourceHash);assert.equal(stale.review!.current,false);
  assert.throws(()=>saveMonthlyReview(coordinator,filters,'Parecer de teste longo o suficiente.',data.sourceHash),/dados mudaram/);

  console.log('Executivo: cálculos e revisão em banco validados. Iniciando autenticação, formulários e PDF HTTP.');
  assert.equal((await request('/api/monthly-reports?mes='+month)).status,401);
  assert.equal((await review('')).status,401);
  const coordinatorCookie=await login(coordinator),technicianCookie=await login(technician);
  const rtFilters={month,unit:'',responsible:otherTechnicianId},rtData=monthlyExecutive(coordinator,rtFilters);
  assert.equal(rtData.reportCount,1);assert.deepEqual(rtData.units.map(row=>row.id),[secondUnit]);assert.equal(rtData.responsibleName,'Outro responsável de teste');
  assert.throws(()=>monthlyExecutive(technician,rtFilters));
  assert.equal((await request(`/api/monthly-reports?mes=${month}&responsavel=${coordinatorId}`,coordinatorCookie)).status,404);
  assert.equal((await request(`/api/monthly-reports?mes=${month}&responsavel=${otherTechnicianId}`,technicianCookie)).status,404);
  const rtPdf=await request(`/api/monthly-reports?mes=${month}&responsavel=${otherTechnicianId}`,coordinatorCookie);assert.equal(rtPdf.status,200);
  fs.writeFileSync('tmp/executive-rt-test.pdf',Buffer.from(await rtPdf.arrayBuffer()));
  assert.equal((await review(technicianCookie)).status,403);
  assert.equal((await review(coordinatorCookie,{},'https://outro-site.test')).status,403);
  assert.equal((await review(coordinatorCookie,{unidade:foreignUnit})).status,404);
  assert.equal((await review(coordinatorCookie,{text:'Curto'})).status,400);
  assert.equal((await review(coordinatorCookie,{text:'x'.repeat(1801)})).status,400);
  assert.equal((await review(coordinatorCookie,{source_hash:'invalid'})).status,400);
  const staleResponse=await review(coordinatorCookie,{source_hash:data.sourceHash});assert.equal(staleResponse.status,303);assert.ok(staleResponse.headers.get('location')!.includes('erro=stale'));
  const maximumText='a\n'.repeat(899)+'ab';assert.equal(maximumText.length,1800);
  assert.equal((await review(coordinatorCookie,{text:maximumText.replace(/\n/g,'\r\n')})).status,303,'Native form line endings must not exceed the visible character limit.');
  assert.equal(monthlyExecutive(coordinator,filters).review!.text,maximumText);
  const reviewedText=monthlyExecutive(coordinator,filters).automaticConclusion;
  assert.ok(reviewedText.length>1000&&reviewedText.length<=1800,'Exercise pagination with a full realistic coordinator opinion.');
  const saved=await review(coordinatorCookie,{text:reviewedText});assert.equal(saved.status,303);assert.ok(saved.headers.get('location')!.includes('ok=1'));
  const savedData=monthlyExecutive(coordinator,filters);assert.equal(savedData.review!.text,reviewedText);assert.equal(savedData.review!.current,true);
  assert.equal(monthlyExecutive(coordinator,rtFilters).review,null);
  const rtReview=await review(coordinatorCookie,{responsavel:otherTechnicianId,source_hash:monthlyExecutive(coordinator,rtFilters).sourceHash,text:'Parecer exclusivo das unidades deste responsável técnico.'});
  assert.equal(rtReview.status,303);assert.ok(rtReview.headers.get('location')!.includes('responsavel='+otherTechnicianId));
  assert.equal(monthlyExecutive(coordinator,rtFilters).review!.current,true);assert.equal(monthlyExecutive(coordinator,filters).review!.text,reviewedText);
  const legacyReturn=await review(coordinatorCookie,{text:reviewedText,return_to:'dashboard'});assert.equal(legacyReturn.status,303);assert.ok(legacyReturn.headers.get('location')!.includes('/relatorios-mensais?'));
  assert.equal((await request(`/api/monthly-reports?mes=${month}&unidade=${foreignUnit}`,coordinatorCookie)).status,404);
  assert.equal((await request(`/api/monthly-reports?mes=${month}&unidade=${secondUnit}`,technicianCookie)).status,404);
  const pdfResponse=await request(`/api/monthly-reports?mes=${month}`,coordinatorCookie);assert.equal(pdfResponse.status,200);assert.equal(pdfResponse.headers.get('content-type'),'application/pdf');
  const pdf=Buffer.from(await pdfResponse.arrayBuffer());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.equal([...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length,2,'Executive synthesis should stay on two pages for the three-unit fixture.');
  fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/executive-monthly-test.pdf',pdf);
  const html=await (await request(`/relatorios-mensais?mes=${month}`,coordinatorCookie)).text();assert.ok(html.includes(reviewedText));assert.ok(html.includes('SP02'));assert.ok(html.includes('RC01'));assert.ok(!html.includes('XX01'));
  assert.ok(html.includes('<span>Menor variação do IGC</span><b>SP02</b><small>-65,5 p.p.</small>'),'The lowest comparable monthly variation must be highlighted, excluding units without a previous base.');
  const positiveVariationHtml=await (await request(`/relatorios-mensais?mes=${month}&unidade=${secondUnit}`,coordinatorCookie)).text();
  assert.ok(positiveVariationHtml.includes('<span>Menor variação do IGC</span><b>RC01</b><small>+100 p.p.</small>'),'A positive variation is still the minimum in a single-unit scope; it must not be called a decline.');
  const noVariationHtml=await (await request(`/relatorios-mensais?mes=${month}&unidade=${emptyUnit}`,coordinatorCookie)).text();
  assert.ok(noVariationHtml.includes('<span>Menor variação do IGC</span><b>Sem dados</b>'),'An unavailable monthly comparison cannot be treated as a zero variation.');
  const technicianHtml=await (await request(`/relatorios-mensais?mes=${month}`,technicianCookie)).text();assert.ok(!technicianHtml.includes(reviewedText));assert.ok(!technicianHtml.includes('Perus — teste executivo'));
  success=true;
  if(process.env.TEST_UI_FIXTURE==='1')fs.writeFileSync('tmp/executive-ui-fixture.json',JSON.stringify({tag,company,foreign,template,unit,secondUnit,emptyUnit,foreignUnit,month,password,coordinator,technician,otherTechnicianId,reports,plan,secondPlan,sourceHash:savedData.sourceHash},null,2));
  console.log('Executivo mensal: IGC ponderado, documento único, mês anterior, escopo, setores, Pareto, resolução no período, parecer persistido/desatualizado, HTTP e PDF de duas páginas validados.');
}finally{
  if(!(success&&process.env.TEST_UI_FIXTURE==='1')){
    db.prepare('DELETE FROM monthly_reviews WHERE company_id IN (?,?)').run(company,foreign);
    db.prepare('DELETE FROM audit_logs WHERE company_id IN (?,?)').run(company,foreign);
    for(const id of reports){for(const table of ['reports','report_section_reviews','evidences','responses','nonconformities','inspection_sessions'])db.prepare(`DELETE FROM ${table} WHERE inspection_id=?`).run(id);db.prepare('DELETE FROM inspections WHERE id=?').run(id);}
    db.prepare('DELETE FROM template_items WHERE template_id=?').run(template);db.prepare('DELETE FROM templates WHERE id=?').run(template);
    db.prepare('DELETE FROM units WHERE company_id IN (?,?)').run(company,foreign);db.prepare('DELETE FROM users WHERE company_id IN (?,?)').run(company,foreign);db.prepare('DELETE FROM companies WHERE id IN (?,?)').run(company,foreign);
  }
}
