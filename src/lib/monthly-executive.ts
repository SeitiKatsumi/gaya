import {createHash} from 'node:crypto';
import type {SessionUser} from './auth.ts';
import {db} from './db.ts';
import {inspectionTemplateItems} from './inspection-template.ts';
import {applicableItems} from './received-reports.ts';
import {availableStatisticsUnit,reportRows,statisticsUnits,statisticsResponsibles,trackedPlans,validMonth,type ReportFilters,type StatisticsUnit} from './report-statistics.ts';

export type ExecutiveMetrics={igc:number|null;weightedCompliant:number;weightedEvaluated:number;answered:number;applicable:number;nonconformities:number;sectorsPending:number;sectorsTotal:number;sectorPercent:number|null;documentsPending:number;documentsEvaluated:number;documentPercent:number|null;plans:number;resolutions:number;reincidence:number|null};
export type ExecutiveUnit=StatisticsUnit&{metrics:ExecutiveMetrics;previousIgc:number|null;delta:number|null;reportCount:number};
export type ParetoCause={label:string;count:number;share:number;cumulativePercent:number};
export type MonthlyReview={text:string;reviewed_by:string;reviewed_at:string;current:boolean};
export type ExecutiveMonthly={filters:ReportFilters;responsibleName?:string;previousMonth:string;reportCount:number;pendingReportCount:number;units:ExecutiveUnit[];metrics:ExecutiveMetrics;pareto:ParetoCause[];paretoTotal:number;automaticConclusion:string;review:MonthlyReview|null;sourceHash:string};

export const percentLabel=(value:number|null)=>value===null?'Sem dados':`${value.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const percentage=(numerator:number,denominator:number)=>denominator?numerator/denominator*100:null;
function adjacentMonth(month:string,offset:number){const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);return date.toISOString().slice(0,7);}
function emptyMetrics():ExecutiveMetrics{return {igc:null,weightedCompliant:0,weightedEvaluated:0,answered:0,applicable:0,nonconformities:0,sectorsPending:0,sectorsTotal:0,sectorPercent:null,documentsPending:0,documentsEvaluated:0,documentPercent:null,plans:0,resolutions:0,reincidence:null};}
function ratios(metrics:ExecutiveMetrics){metrics.igc=percentage(metrics.weightedCompliant,metrics.weightedEvaluated);metrics.sectorPercent=percentage(metrics.sectorsPending,metrics.sectorsTotal);metrics.documentPercent=percentage(metrics.documentsPending,metrics.documentsEvaluated);metrics.reincidence=percentage(metrics.resolutions,metrics.plans);return metrics;}

function executivePeriod(user:SessionUser,filters:ReportFilters){
  const raw=reportRows(user,filters),approved=raw.reports.filter(report=>report.status==='APPROVED');
  const units=statisticsUnits(user,filters.responsible).filter(unit=>!filters.unit||unit.id===filters.unit).map(unit=>({...unit,metrics:emptyMetrics(),reportCount:0}));
  const sets=new Map(units.map(unit=>[unit.id,{applicable:new Set<string>(),answered:new Set<string>(),sectors:new Set<string>(),pending:new Set<string>(),documents:new Map<string,string>()}]));
  const byUnit=new Map(units.map(unit=>[unit.id,unit])),causes=new Map<string,number>();
  for(const report of approved){
    const unit=byUnit.get(report.unit_id);if(!unit)continue;unit.reportCount++;
    const answers=raw.responses.filter(response=>response.inspection_id===report.id),byItem=new Map(answers.map(answer=>[answer.item_id,answer]));
    const bucket=sets.get(unit.id)!;
    for(const item of applicableItems(inspectionTemplateItems(report.template_snapshot,report.template_id),answers)){
      if(['ACTION_PLAN','PLAN_REVIEW'].includes(item.response_type))continue;
      const key=JSON.stringify([report.template_id,item.id]),sector=item.section||item.area;
      bucket.applicable.add(key);if(item.response_type!=='DOCUMENT')bucket.sectors.add(sector);
      const answer=byItem.get(item.id)?.answer?.trim();if(!answer)continue;bucket.answered.add(key);
      if(!['Sim','Não'].includes(answer))continue;
      const expected=item.response_type==='DOCUMENT'?'Sim':item.expected_answer;
      if(!expected||!['Sim','Não'].includes(expected))continue;
      const weight=Number(item.weight)>0?Number(item.weight):1;
      unit.metrics.weightedEvaluated+=weight;
      if(answer===expected)unit.metrics.weightedCompliant+=weight;
      else {unit.metrics.nonconformities++;if(item.response_type!=='DOCUMENT'){bucket.pending.add(sector);const label=`${sector} · ${item.title} (resposta: ${answer})`;causes.set(label,(causes.get(label)||0)+1);}}
      if(item.response_type==='DOCUMENT')bucket.documents.set(key,answer);
    }
  }
  // ponytail: the selected month is measured at its end; later checks cannot rewrite its plan indicator.
  const end=adjacentMonth(filters.month,1)+'-01';
  const plans=trackedPlans(user,filters,end).filter(plan=>plan.report_status==='APPROVED'&&Object.values(plan.details).some(value=>typeof value==='string'&&value.trim()));
  for(const plan of plans){const unit=byUnit.get(plan.unit_id);if(!unit)continue;unit.metrics.plans++;if(plan.completed)unit.metrics.resolutions++;sets.get(unit.id)!.pending.add(plan.department);sets.get(unit.id)!.sectors.add(plan.department);}
  const metrics=emptyMetrics();
  for(const unit of units){
    const bucket=sets.get(unit.id)!,value=unit.metrics;
    value.answered=bucket.answered.size;value.applicable=bucket.applicable.size;value.sectorsPending=bucket.pending.size;value.sectorsTotal=bucket.sectors.size;
    value.documentsEvaluated=bucket.documents.size;value.documentsPending=[...bucket.documents.values()].filter(answer=>answer==='Não').length;
    ratios(value);
    for(const key of ['weightedCompliant','weightedEvaluated','answered','applicable','nonconformities','sectorsPending','sectorsTotal','documentsPending','documentsEvaluated','plans','resolutions'] as const)metrics[key]+=value[key];
  }
  const total=[...causes.values()].reduce((sum,count)=>sum+count,0);let cumulative=0;
  const pareto=[...causes].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,8).map(([label,count])=>{cumulative+=count;return {label,count,share:count/total*100,cumulativePercent:cumulative/total*100};});
  return {units,metrics:ratios(metrics),pareto,paretoTotal:total,reportCount:approved.length,pendingReportCount:raw.reports.length-approved.length,raw,plans};
}
function scopeKey(user:SessionUser,filters:ReportFilters){return JSON.stringify([user.role==='SUPER_ADMIN'?null:user.company_id,filters.unit,...(filters.responsible?[filters.responsible]:[])]);}
function automaticConclusion(data:Pick<ExecutiveMonthly,'metrics'|'units'|'pareto'|'reportCount'|'pendingReportCount'>){
  if(!data.reportCount)return 'Não há relatórios aprovados para as visitas deste mês. Não é possível emitir um parecer de conformidade com a base disponível. A coordenação deve revisar os relatórios recebidos e completar as visitas previstas.';
  const {metrics:m}=data;
  const best=[...data.units].filter(unit=>unit.metrics.igc!==null).sort((a,b)=>b.metrics.igc!-a.metrics.igc!)[0];
  const worst=[...data.units].filter(unit=>unit.metrics.documentPercent!==null).sort((a,b)=>b.metrics.documentPercent!-a.metrics.documentPercent!)[0];
  const parts=[`Foram consolidados ${data.reportCount} relatórios aprovados. O IGC ponderado é ${percentLabel(m.igc)}, com cobertura mensal de ${m.answered}/${m.applicable} itens aplicáveis. Foram registrados problemas em ${m.sectorsPending}/${m.sectorsTotal} setores e ${m.documentsPending}/${m.documentsEvaluated} documentos avaliados estão pendentes.`];
  if(best)parts.push(`A unidade ${best.code} apresenta o maior IGC (${percentLabel(best.metrics.igc)}).`);
  if(worst&&worst.metrics.documentsPending)parts.push(`Priorizar a documentação da unidade ${worst.code} (${percentLabel(worst.metrics.documentPercent)} pendente).`);
  if(data.pareto.length)parts.push(`Priorizar os motivos mais frequentes do Pareto: ${data.pareto.slice(0,3).map(cause=>`${cause.label.length>100?cause.label.slice(0,97)+'…':cause.label} (${cause.count})`).join('; ')}.`);
  if(m.plans)parts.push(`Dos ${m.plans} planos originados no mês, ${m.resolutions} ${m.resolutions===1?'tem':'têm'} resolução confirmada por verificação aprovada até o encerramento do período. Priorizar os planos restantes e confirmar as correções em visita posterior.`);
  if(data.pendingReportCount)parts.push(`${data.pendingReportCount} relatórios recebidos ainda não aprovados foram excluídos dos indicadores.`);
  parts.push('Os percentuais refletem somente os itens avaliados; itens não respondidos não comprovam conformidade. Revisar as prioridades e o parecer antes de compartilhar com o cliente.');
  return parts.join('\n\n');
}
export function monthlyExecutive(user:SessionUser,filters:ReportFilters):ExecutiveMonthly{
  if(!validMonth(filters.month)||!availableStatisticsUnit(user,filters.unit))throw new Error('Filtro inválido.');
  const period=executivePeriod(user,filters),previousMonth=adjacentMonth(filters.month,-1),previous=executivePeriod(user,{...filters,month:previousMonth});
  const units:ExecutiveUnit[]=period.units.map(unit=>{const previousIgc=previous.units.find(old=>old.id===unit.id)?.metrics.igc??null;return {...unit,previousIgc,delta:unit.metrics.igc===null||previousIgc===null?null:unit.metrics.igc-previousIgc};});
  const sourceHash=createHash('sha256').update(JSON.stringify({version:1,filters,units,metrics:period.metrics,pareto:period.pareto,reports:period.raw.reports,responses:period.raw.responses,plans:period.plans,previousReports:previous.raw.reports,previousResponses:previous.raw.responses})).digest('hex');
  const stored=db.prepare('SELECT mr.text,mr.source_hash,mr.reviewed_at,u.name reviewed_by FROM monthly_reviews mr JOIN users u ON u.id=mr.reviewed_by WHERE mr.scope_key=? AND mr.month=?').get(scopeKey(user,filters),filters.month) as {text:string;source_hash:string;reviewed_at:string;reviewed_by:string}|undefined;
  // A company-wide opinion can mention other units. RTs see it only when their complete authorized data matches.
  const review=stored&&(user.role!=='INSPECTOR'||stored.source_hash===sourceHash)?{text:stored.text,reviewed_by:stored.reviewed_by,reviewed_at:stored.reviewed_at,current:stored.source_hash===sourceHash}:null;
  const data={filters,previousMonth,units,metrics:period.metrics,pareto:period.pareto,paretoTotal:period.paretoTotal,reportCount:period.reportCount,pendingReportCount:period.pendingReportCount,sourceHash,review};
  return {...data,responsibleName:filters.responsible?statisticsResponsibles(user).find(row=>row.id===filters.responsible)?.name:undefined,automaticConclusion:automaticConclusion(data)};
}
export function saveMonthlyReview(user:SessionUser,filters:ReportFilters,text:string,sourceHash:string){
  if(user.role==='INSPECTOR')throw new Error('Sem permissão.');
  text=text.replace(/\r\n?/g,'\n').trim();
  if(text.length<20||text.length>1800)throw new Error('Parecer inválido.');
  const data=monthlyExecutive(user,filters);if(data.sourceHash!==sourceHash)throw new Error('Os dados mudaram. Atualize e revise novamente.');
  db.prepare('INSERT INTO monthly_reviews(scope_key,month,company_id,text,source_hash,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(scope_key,month) DO UPDATE SET text=excluded.text,source_hash=excluded.source_hash,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at').run(scopeKey(user,filters),filters.month,user.company_id,text,sourceHash,user.id,new Date().toISOString());
}
