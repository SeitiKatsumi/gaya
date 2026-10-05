import {db} from './db.ts';
import catalog from './gaya-report-catalog.json' with {type:'json'};
import {addDays,validDate} from './calendar.ts';
import {inspectionTemplateItems,type InspectionTemplateItem} from './inspection-template.ts';

export const visitTemplateId='tpl-gaya-visitas-v1';
export const documentSection='Verificação Documental',storageSection='Área de Armazenamento',actionSection='Plano de Ação',pastSection='Verificação de Planos de Ação Passados';
export const visitSections=[documentSection,storageSection,actionSection,pastSection];
export const documentLocations=['Impresso em Pasta Física','Segundo qualidade, disponível para impressão em formato digital'];
export type ResponseDetails={location?:string;expiry?:string;nonconformities?:string;immediate?:string;corrective?:string;preventive?:string;responsible?:string;checks?:{id:string;answer:'Sim'|'Não';comment:string}[]};
export type AnswerRow={id:string;item_id:string;answer:string;comment:string;details_json:string|null;revision:number};
export type FilledItem=InspectionTemplateItem&Omit<AnswerRow,'id'>&{response_id:string;details:ResponseDetails};
export type PriorPlan={id:string;date:string;unit_id:string;department:string;details:ResponseDetails};

export function parseDetails(value:string|null|undefined):ResponseDetails{try{return JSON.parse(value||'{}') as ResponseDetails;}catch{return {};}}
export function sectionOf(item:InspectionTemplateItem){return item.response_type==='DOCUMENT'?documentSection:item.response_type==='ACTION_PLAN'?actionSection:item.response_type==='PLAN_REVIEW'?pastSection:item.area;}
export function isVisitReport(inspection:{template_id:string}){return inspection.template_id===visitTemplateId;}
export function saoPauloDate(timestamp:string){const value=timestamp.includes('T')?timestamp:timestamp.replace(' ','T')+'Z';return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function sendDeadline(day:string){if(!validDate(day))throw new Error('Data inválida');let result=day,count=0;while(count<2){result=addDays(result,1);const weekday=new Date(result+'T12:00:00Z').getUTCDay();if(weekday!==0&&weekday!==6)count++;}return result;}
export function applicableItems(items:InspectionTemplateItem[],answers:AnswerRow[]){const byId=new Map(answers.map(answer=>[answer.item_id,answer.answer]));return items.filter(item=>{if(!item.condition_json)return true;try{const rule=JSON.parse(item.condition_json) as {item_id:string;answer:string};return byId.get(rule.item_id)===rule.answer;}catch{return false;}});}
export function filledItems(inspection:{id:string;template_id:string;template_snapshot:string|null}){const answers=db.prepare('SELECT id,item_id,answer,comment,details_json,revision FROM responses WHERE inspection_id=? AND is_current=1').all(inspection.id) as AnswerRow[];const items=applicableItems(inspectionTemplateItems(inspection.template_snapshot,inspection.template_id),answers),byId=new Map(answers.map(answer=>[answer.item_id,answer]));return items.flatMap(item=>{const answer=byId.get(item.id);return answer?[{...item,...answer,id:item.id,response_id:answer.id,details:parseDetails(answer.details_json)}]:[];});}
export function priorPlans(inspection:{id:string;unit_id:string;planned_start:string|null}){const rows=db.prepare("SELECT r.id,r.details_json,i.planned_start date,i.unit_id,i.template_id,i.template_snapshot,r.item_id FROM responses r JOIN inspections i ON i.id=r.inspection_id WHERE i.unit_id=? AND i.id<>? AND i.status='APPROVED' AND r.is_current=1 AND i.planned_start<=? ORDER BY i.planned_start DESC").all(inspection.unit_id,inspection.id,inspection.planned_start||'2200-12-31') as {id:string;details_json:string;date:string;unit_id:string;template_id:string;template_snapshot:string;item_id:string}[];return rows.flatMap(row=>{const item=inspectionTemplateItems(row.template_snapshot,row.template_id).find(item=>item.id===row.item_id);return item?.response_type==='ACTION_PLAN'?[{id:row.id,date:row.date,unit_id:row.unit_id,department:item.section||storageSection,details:parseDetails(row.details_json)}]:[];});}

export function ensureVisitTemplate(){
  // ponytail: a versioned, shared checklist; each inspection keeps its own immutable snapshot.
  const departments=[...new Set([storageSection,...catalog.questions.map(question=>('area' in question&&question.area)||storageSection),catalog.questions[0].department])];
  const expected=catalog.documents.length+catalog.questions.length+departments.length+1;
  if(Number(db.prepare('SELECT count(*) n FROM template_items WHERE template_id=?').get(visitTemplateId)?.n)===expected)return;
  db.exec('BEGIN IMMEDIATE');try{
    db.prepare("INSERT OR IGNORE INTO templates(id,name,category,description,version,status,is_global) VALUES(?,?,?, ?,2,'PUBLISHED',1)").run(visitTemplateId,'Relatório Técnico de Visita — Gaya','Visitas','Roteiro completo de documentação, departamentos e planos de ação conforme escopo Gaya.');
    const insert=db.prepare('INSERT OR IGNORE INTO template_items(id,template_id,area,section,code,title,response_type,expected_answer,sort_order,condition_json,document_periodicity,document_copies) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    let order=0;
    for(const doc of catalog.documents)insert.run(`gaya-v1-${doc.code}`,visitTemplateId,documentSection,doc.group,doc.code,doc.title,'DOCUMENT','Sim',++order,null,doc.periodicity,doc.copies);
    for(const question of catalog.questions){const condition='condition' in question?question.condition:undefined;insert.run(`gaya-v1-${question.code}`,visitTemplateId,('area' in question&&question.area)||storageSection,question.department,question.code,question.title,'YES_NO',question.expected_answer,++order,condition?JSON.stringify({item_id:`gaya-v1-${condition.code}`,answer:condition.answer}):null,null,null);db.prepare('UPDATE template_items SET guidance=? WHERE id=?').run([('guidance' in question&&question.guidance)||'','Bibliografia: —'].filter(Boolean).join('\n'),`gaya-v1-${question.code}`);}
    departments.forEach((department,index)=>insert.run(index===0?'gaya-v1-ACTION':`gaya-v1-ACTION-${index+1}`,visitTemplateId,actionSection,department,`PA-${String(index+1).padStart(2,'0')}`,`Plano de Ação — ${department}`,'ACTION_PLAN','Sim',++order,null,null,null));
    insert.run('gaya-v1-PAST',visitTemplateId,pastSection,null,'PA-ANT','Verificação de planos de ação anteriores','PLAN_REVIEW','Sim',++order,null,null,null);
    db.prepare('UPDATE templates SET version=2 WHERE id=?').run(visitTemplateId);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
