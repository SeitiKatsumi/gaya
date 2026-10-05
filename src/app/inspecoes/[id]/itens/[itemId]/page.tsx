import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {Camera,Mic,Video} from 'lucide-react';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {inspectionTemplateItems} from '@/lib/inspection-template';
import {AppShell} from '@/components/app-shell';
import {isVisitReport,parseDetails,sectionOf} from '@/lib/received-reports';

type ResponseRow={id:string;answer:string|null;compliance:string;comment:string|null;details_json:string|null;revision:number;is_current:number;created_at:string;user_name:string};
type Evidence={id:string;response_id:string|null;kind:'PHOTO'|'AUDIO'|'VIDEO';original_name:string;size:number};
type InspectionContext={id:string;company_id:string;inspector_id:string|null;inspection_title:string;control_code:string;template_id:string;template_snapshot:string|null};
const icons={PHOTO:<Camera size={13}/>,AUDIO:<Mic size={13}/>,VIDEO:<Video size={13}/>};

export default async function ItemHistory({params}:{params:Promise<{id:string;itemId:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  const {id,itemId}=await params;
  const inspection=db.prepare('SELECT id,company_id,inspector_id,title inspection_title,control_code,template_id,template_snapshot FROM inspections WHERE id=?').get(id) as InspectionContext|undefined;
  const item=inspection?inspectionTemplateItems(inspection.template_snapshot,inspection.template_id).find(candidate=>candidate.id===itemId):undefined;
  const context=inspection&&item?{...inspection,item_title:item.title,item_code:item.code,guidance:item.guidance,item}:undefined;
  if(!context||user.role!=='SUPER_ADMIN'&&context.company_id!==user.company_id||user.role==='INSPECTOR'&&context.inspector_id!==user.id)notFound();
  const visit=isVisitReport(context),area=['DOCUMENT','ACTION_PLAN','PLAN_REVIEW'].includes(context.item.response_type)?sectionOf(context.item):context.item.section||context.item.area;
  const returnPath=visit?`/relatorios/${id}?${new URLSearchParams({area,item:itemId})}#${encodeURIComponent(itemId)}`:`/inspecoes/${id}#${encodeURIComponent(itemId)}`;
  const responses=db.prepare('SELECT r.id,r.answer,r.compliance,r.comment,r.details_json,r.revision,r.is_current,r.created_at,u.name user_name FROM responses r JOIN users u ON u.id=r.user_id WHERE r.inspection_id=? AND r.item_id=? ORDER BY r.revision DESC').all(id,itemId) as ResponseRow[];
  const evidences=db.prepare('SELECT id,response_id,kind,original_name,size FROM evidences WHERE inspection_id=? AND item_id=? ORDER BY created_at DESC').all(id,itemId) as Evidence[];
  return <AppShell user={user} active={visit?'reports':'inspections'}><header className="topbar"><div><div className="eyebrow">{context.control_code} · {context.item_code}</div><h1 className="title">Histórico do item</h1></div><Link className="btn btn-ghost" href={returnPath}>Voltar ao item</Link></header><section className="card"><h2 style={{fontSize:17,marginTop:0}}>{context.item_title}</h2><p className="muted">{context.guidance}</p></section><div className="section-head"><div><h2>Revisões preservadas</h2><p>Nenhuma resposta anterior é sobrescrita.</p></div></div><div className="grid">{responses.length?responses.map(row=>{const files=evidences.filter(e=>e.response_id===row.id);return <article className="card" key={row.id}><div className="entity-card-head"><div><div className="eyebrow">REVISÃO {row.revision} · {row.user_name}</div><div className="muted">{new Date(`${row.created_at}Z`).toLocaleString('pt-BR')}</div></div>{row.is_current===1&&<span className="badge success">Resposta vigente</span>}</div><div className="grid response-fields" style={{marginTop:16}}><div><div className="eyebrow">RESPOSTA</div><b>{row.answer||'—'}</b></div><div><div className="eyebrow">RESULTADO</div><b>{complianceLabel(row.compliance)}</b></div></div><RevisionDetails value={row.details_json}/>{row.comment&&<p style={{whiteSpace:'pre-wrap'}}>{row.comment}</p>}{files.length>0&&<div className="evidence-list">{files.map(file=><Link className="evidence-file" target="_blank" href={`/api/evidences/${file.id}`} key={file.id}>{icons[file.kind]}<span>{file.original_name}</span></Link>)}</div>}</article>}):<div className="card empty-state"><h2>Sem respostas registradas</h2><p>O histórico será criado ao salvar o item pela primeira vez.</p></div>}</div></AppShell>;
}

function complianceLabel(value:string){return ({COMPLIANT:'Conforme',NON_COMPLIANT:'Não conforme',NOT_APPLICABLE:'Não se aplica',PENDING:'Pendente'} as Record<string,string>)[value]||'Não informado';}

function RevisionDetails({value}:{value:string|null}){const details=parseDetails(value);const fields=[['location','Disponibilização'],['expiry','Vencimento'],['nonconformities','Não conformidades'],['immediate','Medidas imediatas'],['corrective','Ações corretivas'],['preventive','Ações preventivas'],['responsible','Responsáveis']] as const;return <div className="past-plan"><dl>{fields.map(([key,label])=>details[key]?<div key={key}><dt>{label}</dt><dd>{details[key]}</dd></div>:null)}{details.checks?.map((check,index)=><div key={check.id}><dt>Verificação de plano anterior {index+1}</dt><dd>{check.answer} · {check.comment}</dd></div>)}</dl></div>;}
