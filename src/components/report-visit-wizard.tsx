'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ReportItemForm} from './report-item-form';
import type {InspectionTemplateItem} from '@/lib/inspection-template';
import type {AnswerRow,PriorPlan,ResponseDetails} from '@/lib/received-reports';

type Props={inspectionId:string;items:InspectionTemplateItem[];responses:AnswerRow[];evidences:{id:string;item_id:string;kind:string;original_name:string}[];plans:PriorPlan[];selectedArea?:string;selectedItem?:string;lockedSections?:string[]};
function department(item:InspectionTemplateItem){return item.response_type==='DOCUMENT'?'Verificação Documental':item.response_type==='ACTION_PLAN'?'Plano de Ação':item.response_type==='PLAN_REVIEW'?'Verificação de Planos de Ação Passados':item.section||item.area;}
function reviewSection(item:InspectionTemplateItem){return ['DOCUMENT','ACTION_PLAN','PLAN_REVIEW'].includes(item.response_type)?department(item):item.area;}

export function ReportVisitWizard({inspectionId,items,responses,evidences,plans,selectedArea,selectedItem,lockedSections=[]}:Props){
  const router=useRouter(),areas=[...new Set(items.map(department))];
  const area=selectedArea&&areas.includes(selectedArea)?selectedArea:items.length?department(items.find(item=>item.id===selectedItem)||items[0]):'';
  const areaItems=items.filter(item=>department(item)===area),answers=new Map(responses.map(response=>[response.item_id,response]));
  const item=areaItems.find(item=>item.id===selectedItem)||areaItems.find(item=>!answers.has(item.id))||areaItems[0];
  const url=(group:string,id?:string)=>`/relatorios/${inspectionId}?${new URLSearchParams({area:group,...(id?{item:id}:{})})}`;
  if(!item)return <p className="card empty-state">Nenhum item disponível neste relatório.</p>;
  const index=areaItems.indexOf(item),saved=areaItems.filter(item=>answers.has(item.id)).length,response=answers.get(item.id),locked=lockedSections.includes(reviewSection(item));
  let details:ResponseDetails={};try{details=JSON.parse(response?.details_json||'{}') as ResponseDetails;}catch{}
  return <section className="report-wizard" aria-label="Preenchimento da visita por departamento"><div className="card report-wizard-controls"><div className="field"><label htmlFor="visit-department">Departamento ou seção</label><select id="visit-department" value={area} onChange={event=>router.push(url(event.target.value))}>{areas.map(group=><option key={group}>{group}</option>)}</select></div><p className="muted" role="status">{saved} de {areaItems.length} itens salvos neste departamento · Item {index+1} de {areaItems.length}</p><p className="muted">Preencha somente os itens verificados nesta visita. Você pode mudar de departamento a qualquer momento.</p></div>{locked&&<p className="notice success-notice">Esta seção já foi aprovada. As respostas ficam disponíveis para consulta.</p>}<ReportItemForm key={`${item.id}-${response?.revision||0}`} inspectionId={inspectionId} item={item} response={response} details={details} editable={!locked} evidences={evidences.filter(evidence=>evidence.item_id===item.id)} plans={plans} layout="card" reportArea={area}/><nav className="report-wizard-navigation" aria-label="Percorrer perguntas">{index>0?<Link className="btn btn-ghost" href={url(area,areaItems[index-1].id)}>Anterior</Link>:<span/>}{index<areaItems.length-1?<Link className="btn btn-soft" href={url(area,areaItems[index+1].id)}>Próximo</Link>:<span className="muted">Fim deste departamento</span>}</nav></section>;
}
