import type {SessionUser} from './auth.ts';
import {db} from './db.ts';
import {saoPauloToday,validDate} from './calendar.ts';
import {inspectionTemplateItems,type InspectionTemplateItem} from './inspection-template.ts';
import {applicableItems,parseDetails,type AnswerRow,type ResponseDetails} from './received-reports.ts';

export type StatisticsUnit={id:string;code:string;name:string;company_name:string};
export type ReportFilters={month:string;unit:string};
type ReportRow={id:string;unit_id:string;unit_code:string;unit_name:string;company_name:string;template_id:string;template_name:string;template_snapshot:string|null;planned_start:string|null;created_at:string;status:string;received_at:string|null;inspector_name:string|null};
type ResponseRow=AnswerRow&{inspection_id:string;compliance:string|null};
type Counts={answered:number;applicable:number;compliant:number;noncompliant:number;notApplicable:number;unclassified:number};
export type Coverage=Counts&{template_id:string;template_name:string;area:string;section:string;type:'documents'|'technical';uniqueAnswered:number;uniqueApplicable:number};
export type MonthlyUnit=StatisticsUnit&{scheduled:number;received:number;approved:number;uniqueAnswered:number;uniqueApplicable:number};
export type MonthlyReport=ReportRow&Counts;
export type MonthlyStatistics={filters:ReportFilters;scheduled:number;received:number;approved:number;counts:Counts;uniqueCoverage:{answered:number;applicable:number};units:MonthlyUnit[];coverage:Coverage[];reports:MonthlyReport[]};
type Verification={inspection_id:string;date:string;status:string;answer:'Sim'|'Não';comment:string};
export type TrackedPlan={id:string;inspection_id:string;unit_id:string;unit_code:string;company_name:string;date:string|null;department:string;report_status:string;details:ResponseDetails;completed:boolean;verification:Verification|null;approvedVerification:Verification|null};

const emptyCounts=():Counts=>({answered:0,applicable:0,compliant:0,noncompliant:0,notApplicable:0,unclassified:0});
const receivedFilter="i.status<>'CANCELLED' AND (i.received_at IS NOT NULL OR i.status IN ('IN_REVIEW','CHANGES_REQUESTED','APPROVED'))";
export function validMonth(month:string){return /^\d{4}-\d{2}$/.test(month)&&validDate(month+'-01');}
export function reportFilters(query:{mes?:string;unidade?:string},defaultMonth=true):ReportFilters{
  const month=query.mes??(defaultMonth?saoPauloToday().slice(0,7):''),unit=query.unidade||'';
  if((defaultMonth&&!month)||(month&&!validMonth(month))||unit.length>150)throw new Error('Escolha um mês válido e uma unidade disponível.');
  return {month,unit};
}
function monthEnd(month:string){const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);return date.toISOString().slice(0,10);}
function scope(user:SessionUser){return user.role==='SUPER_ADMIN'?{sql:'1=1',params:[] as (string|null)[]}:user.role==='INSPECTOR'?{sql:'i.company_id=? AND i.inspector_id=?',params:[user.company_id,user.id]}:{sql:'i.company_id=?',params:[user.company_id]};}
export function statisticsUnits(user:SessionUser){
  const where=user.role==='SUPER_ADMIN'?'1=1':user.role==='INSPECTOR'?"un.company_id=? AND (un.responsible_id=? OR EXISTS(SELECT 1 FROM inspections i WHERE i.unit_id=un.id AND i.inspector_id=? AND i.company_id=un.company_id))":'un.company_id=?';
  const params=user.role==='SUPER_ADMIN'?[]:user.role==='INSPECTOR'?[user.company_id,user.id,user.id]:[user.company_id];
  return db.prepare(`SELECT un.id,un.code,un.name,c.trade_name company_name FROM units un JOIN companies c ON c.id=un.company_id WHERE ${where} ORDER BY un.code,c.trade_name`).all(...params) as StatisticsUnit[];
}
export function availableStatisticsUnit(user:SessionUser,unit:string){return !unit||statisticsUnits(user).some(row=>row.id===unit);}
export function reportRows(user:SessionUser,filters:ReportFilters){
  const scoped=scope(user);let where=scoped.sql+` AND ${receivedFilter}`;
  if(filters.month){where+=' AND i.planned_start>=? AND i.planned_start<?';scoped.params.push(filters.month+'-01',monthEnd(filters.month));}
  if(filters.unit){where+=' AND i.unit_id=?';scoped.params.push(filters.unit);}
  const reports=db.prepare(`SELECT i.id,i.unit_id,i.template_id,i.template_snapshot,i.planned_start,i.created_at,i.status,i.received_at,un.code unit_code,un.name unit_name,c.trade_name company_name,t.name template_name,author.name inspector_name FROM inspections i JOIN units un ON un.id=i.unit_id JOIN companies c ON c.id=i.company_id JOIN templates t ON t.id=i.template_id LEFT JOIN users author ON author.id=i.inspector_id WHERE ${where} ORDER BY i.planned_start,i.created_at,i.id`).all(...scoped.params) as ReportRow[];
  const responses=db.prepare(`SELECT r.id,r.inspection_id,r.item_id,r.answer,r.compliance,r.comment,r.details_json,r.revision FROM responses r JOIN inspections i ON i.id=r.inspection_id WHERE ${where} AND r.is_current=1 ORDER BY r.inspection_id,r.item_id,r.revision,r.id`).all(...scoped.params) as ResponseRow[];
  return {reports,responses};
}
function addCounts(to:Counts,from:Counts){for(const field of ['answered','applicable','compliant','noncompliant','notApplicable','unclassified'] as const)to[field]+=from[field];}
// ponytail: weekly partial visits count each unit/template/item once for monthly coverage.
export function aggregateCoverage(reports:(ReportRow&{items:InspectionTemplateItem[]})[],responses:ResponseRow[]){
  const coverage=new Map<string,Coverage>(),unique=new Map<string,{answered:Set<string>;applicable:Set<string>}>(),byUnit=new Map<string,{answered:Set<string>;applicable:Set<string>}>(),allAnswered=new Set<string>(),allApplicable=new Set<string>(),all=emptyCounts(),result:MonthlyReport[]=[];
  for(const report of reports){
    const answers=responses.filter(row=>row.inspection_id===report.id),byItem=new Map(answers.map(row=>[row.item_id,row])),counts=emptyCounts();
    if(!byUnit.has(report.unit_id))byUnit.set(report.unit_id,{answered:new Set(),applicable:new Set()});const unit=byUnit.get(report.unit_id)!;
    for(const item of applicableItems(report.items,answers).filter(item=>!['ACTION_PLAN','PLAN_REVIEW'].includes(item.response_type))){
      const type=item.response_type==='DOCUMENT'?'documents':'technical',section=item.section||item.area,key=JSON.stringify([report.template_id,item.area,section,type]);
      let group=coverage.get(key);if(!group){group={...emptyCounts(),template_id:report.template_id,template_name:report.template_name,area:item.area,section,type,uniqueAnswered:0,uniqueApplicable:0};coverage.set(key,group);unique.set(key,{answered:new Set(),applicable:new Set()});}
      const sets=unique.get(key)!,itemKey=JSON.stringify([report.unit_id,report.template_id,item.id]);sets.applicable.add(itemKey);unit.applicable.add(itemKey);allApplicable.add(itemKey);
      const value=emptyCounts();value.applicable=1;const answer=byItem.get(item.id);
      if(answer?.answer?.trim()){sets.answered.add(itemKey);unit.answered.add(itemKey);allAnswered.add(itemKey);value.answered=1;if(answer.compliance==='COMPLIANT')value.compliant=1;else if(answer.compliance==='NON_COMPLIANT')value.noncompliant=1;else if(answer.compliance==='NOT_APPLICABLE')value.notApplicable=1;else value.unclassified=1;}
      addCounts(group,value);addCounts(counts,value);
    }
    addCounts(all,counts);const {items:_,...row}=report;void _;result.push({...row,...counts});
  }
  for(const [key,group] of coverage){group.uniqueAnswered=unique.get(key)!.answered.size;group.uniqueApplicable=unique.get(key)!.applicable.size;}
  return {counts:all,uniqueCoverage:{answered:allAnswered.size,applicable:allApplicable.size},unitCoverage:[...byUnit].map(([unit_id,sets])=>({unit_id,answered:sets.answered.size,applicable:sets.applicable.size})),coverage:[...coverage.values()],reports:result};
}
export function monthlyStatistics(user:SessionUser,filters:ReportFilters):MonthlyStatistics{
  if(!validMonth(filters.month)||!availableStatisticsUnit(user,filters.unit))throw new Error('Filtro inválido.');
  const raw=reportRows(user,filters),aggregated=aggregateCoverage(raw.reports.map(report=>({...report,items:inspectionTemplateItems(report.template_snapshot,report.template_id)})),raw.responses);
  const units=new Map(statisticsUnits(user).filter(unit=>!filters.unit||unit.id===filters.unit).map(unit=>[unit.id,{...unit,scheduled:0,received:0,approved:0,uniqueAnswered:0,uniqueApplicable:0}]));
  const visitScope=user.role==='SUPER_ADMIN'?'1=1':user.role==='INSPECTOR'?'un.company_id=? AND un.responsible_id=?':'un.company_id=?';
  const params:(string|null)[]=user.role==='SUPER_ADMIN'?[]:user.role==='INSPECTOR'?[user.company_id,user.id]:[user.company_id];params.push(filters.month+'-01',monthEnd(filters.month));if(filters.unit)params.push(filters.unit);
  const visits=db.prepare(`SELECT v.unit_id,count(*) scheduled FROM visits v JOIN units un ON un.id=v.unit_id WHERE ${visitScope} AND v.status='SCHEDULED' AND v.visit_date>=? AND v.visit_date<?${filters.unit?' AND v.unit_id=?':''} GROUP BY v.unit_id`).all(...params) as {unit_id:string;scheduled:number}[];
  for(const visit of visits){const unit=units.get(visit.unit_id);if(unit)unit.scheduled=visit.scheduled;}
  for(const report of aggregated.reports){const unit=units.get(report.unit_id);if(unit){unit.received++;if(report.status==='APPROVED')unit.approved++;}}
  for(const row of aggregated.unitCoverage){const unit=units.get(row.unit_id);if(unit){unit.uniqueAnswered=row.answered;unit.uniqueApplicable=row.applicable;}}
  return {filters,scheduled:visits.reduce((sum,row)=>sum+row.scheduled,0),received:aggregated.reports.length,approved:aggregated.reports.filter(row=>row.status==='APPROVED').length,...aggregated,units:[...units.values()].filter(row=>row.scheduled||row.received)};
}
export function trackedPlans(user:SessionUser,filters:ReportFilters,asOf?:string):TrackedPlan[]{
  if((filters.month&&!validMonth(filters.month))||!availableStatisticsUnit(user,filters.unit))throw new Error('Filtro inválido.');
  const {reports,responses}=reportRows(user,{month:'',unit:filters.unit}),plans:TrackedPlan[]=[],checks:{report:ReportRow;details:ResponseDetails}[]=[];
  for(const report of reports){
    if(asOf&&(!report.planned_start||report.planned_start>=asOf))continue;
    const answers=responses.filter(row=>row.inspection_id===report.id),byItem=new Map(answers.map(row=>[row.item_id,row]));
    for(const item of applicableItems(inspectionTemplateItems(report.template_snapshot,report.template_id),answers)){
      const response=byItem.get(item.id);if(!response)continue;const details=parseDetails(response.details_json);
      if(item.response_type==='ACTION_PLAN'&&(!filters.month||report.planned_start?.slice(0,7)===filters.month))plans.push({id:response.id,inspection_id:report.id,unit_id:report.unit_id,unit_code:report.unit_code,company_name:report.company_name,date:report.planned_start,department:item.section||item.area,report_status:report.status,details,completed:false,verification:null,approvedVerification:null});
      if(item.response_type==='PLAN_REVIEW')checks.push({report,details});
    }
  }
  for(const plan of plans){
    const source=reports.find(report=>report.id===plan.inspection_id)!;
    for(const {report,details} of checks){
      if(!report.planned_start||!source.planned_start)continue;
      const later=report.planned_start>source.planned_start||report.planned_start===source.planned_start&&report.created_at>source.created_at;
      if(report.id===plan.inspection_id||report.unit_id!==plan.unit_id||!later)continue;
      const check=details.checks?.find(check=>check.id===plan.id);if(!check||!['Sim','Não'].includes(check.answer))continue;
      const verification={inspection_id:report.id,date:report.planned_start,status:report.status,answer:check.answer,comment:check.comment};plan.verification=verification;
      if(report.status==='APPROVED')plan.approvedVerification=verification;
    }
    plan.completed=plan.approvedVerification?.answer==='Sim';
  }
  return plans.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.unit_code.localeCompare(b.unit_code));
}
export function coverageLabel(answered:number,applicable:number){return applicable?`${answered}/${applicable} (${(answered/applicable*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%)`:'Sem itens aplicáveis';}
export const planFields=[['nonconformities','Não Conformidade(s)'],['immediate','Medidas Imediatas'],['corrective','Ação(ões) Corretiva(s)'],['preventive','Ação(ões) Preventiva(s)'],['responsible','Responsáveis']] as const;
