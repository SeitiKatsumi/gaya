import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {Camera,CheckCircle2,FileDown,FileText,History,Mic,Play,Send,TriangleAlert,Video} from 'lucide-react';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {statusLabel} from '@/lib/utils';
import {AppShell} from '@/components/app-shell';
import {EvidenceInputs} from '@/components/evidence-inputs';
import {ConfirmSubmit} from '@/components/confirm-submit';
import {inspectionTemplateItems} from '@/lib/inspection-template';

type Evidence={id:string;item_id:string;kind:'PHOTO'|'AUDIO'|'VIDEO';original_name:string;size:number;created_at:string};
const evidenceIcon={PHOTO:<Camera size={14}/>,AUDIO:<Mic size={14}/>,VIDEO:<Video size={14}/>};

export default async function Inspection({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{erro?:string;salvo?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  const {id}=await params;const query=await searchParams;
  const inspection=db.prepare('SELECT i.*,un.name unit_name,un.address,us.name inspector_name,t.name template_name,p.name project_name FROM inspections i JOIN units un ON un.id=i.unit_id JOIN templates t ON t.id=i.template_id LEFT JOIN users us ON us.id=i.inspector_id LEFT JOIN projects p ON p.id=i.project_id WHERE i.id=?').get(id) as any;
  if(!inspection)notFound();if(user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id)notFound();if(user.role==='INSPECTOR'&&inspection.inspector_id!==user.id)notFound();
  const frozenItems=inspectionTemplateItems(inspection.template_snapshot,inspection.template_id);
  const responses=db.prepare('SELECT item_id,answer,compliance,comment,id response_id,revision FROM responses WHERE inspection_id=? AND is_current=1').all(id) as any[];
  const responseByItem=new Map(responses.map(response=>[response.item_id,response]));
  const items=frozenItems.map(item=>({...item,...responseByItem.get(item.id)}));
  const evidences=db.prepare('SELECT id,item_id,kind,original_name,size,created_at FROM evidences WHERE inspection_id=? ORDER BY created_at DESC').all(id) as Evidence[];
  const nonconformities=db.prepare('SELECT * FROM nonconformities WHERE inspection_id=?').all(id) as any[];
  const editable=['SCHEDULED','IN_PROGRESS','CHANGES_REQUESTED'].includes(inspection.status);
  return <AppShell user={user} active="inspections">
    <header className="topbar"><div><div className="eyebrow">{inspection.control_code} · {inspection.unit_name}{inspection.project_name?` · ${inspection.project_name}`:''}</div><h1 className="title">{inspection.title}</h1></div><div className="header-actions"><Link className="btn btn-ghost" href={`/api/reports/${id}`}><FileDown size={15}/>Relatório PDF</Link>{inspection.status==='SCHEDULED'&&<StatusButton id={id} status="IN_PROGRESS" label="Iniciar" icon={<Play size={15}/>}/>} {inspection.status==='CHANGES_REQUESTED'&&<StatusButton id={id} status="IN_PROGRESS" label="Retomar" icon={<Play size={15}/>}/>} {inspection.status==='IN_PROGRESS'&&inspection.progress===100&&<StatusButton id={id} status="IN_REVIEW" label="Enviar para revisão" icon={<Send size={15}/>}/>} {inspection.status==='IN_REVIEW'&&user.role!=='INSPECTOR'&&<><StatusButton id={id} status="CHANGES_REQUESTED" label="Solicitar ajustes" icon={<TriangleAlert size={15}/>} soft/><StatusButton id={id} status="APPROVED" label="Aprovar" icon={<CheckCircle2 size={15}/>}/></>}{user.role!=='INSPECTOR'&&['SCHEDULED','IN_PROGRESS','CHANGES_REQUESTED','IN_REVIEW'].includes(inspection.status)&&<form action={`/api/inspections/${id}/status`} method="post"><input type="hidden" name="status" value="CANCELLED"/><ConfirmSubmit label="Cancelar" message="Cancelar esta inspeção? Respostas e evidências existentes serão preservadas."/></form>}</div></header>
    {query.erro&&<div className="error">{query.erro==='tamanho'?'O arquivo excede o limite permitido (foto 15 MB, áudio 50 MB, vídeo 300 MB).':query.erro==='tipo'?'O tipo do arquivo selecionado não é compatível.':'Revise a resposta e tente novamente.'}</div>}
    {query.salvo&&<div className="notice success-notice">Item salvo e evidências processadas com sucesso.</div>}
    <section className="grid stats"><div className="card"><div className="stat-head">Status</div><div style={{marginTop:16}}><span className="badge success">{statusLabel(inspection.status)}</span></div></div><div className="card"><div className="stat-head">Progresso válido</div><div className="stat-value">{inspection.progress}%</div><div className="progress"><span style={{width:`${inspection.progress}%`}}/></div></div><div className="card"><div className="stat-head">Responsável</div><div className="inspection-name" style={{marginTop:16}}>{inspection.inspector_name}</div><div className="muted">{inspection.planned_start} — {inspection.planned_end}</div></div><div className="card"><div className="stat-head">Não conformidades</div><div className="stat-value">{String(nonconformities.length).padStart(2,'0')}</div><div className="stat-note">{nonconformities.filter(x=>x.status==='OPEN').length} em aberto</div></div></section>
    <div className="section-head"><div><h2>Roteiro de verificação</h2><p>{inspection.template_name} · respostas e evidências com histórico por revisão</p></div></div>
    {!editable&&<div className="notice"><FileText size={16}/>O roteiro está bloqueado no status “{statusLabel(inspection.status)}”.</div>}
    <div className="grid" style={{gap:12}}>{items.map((item,index)=>{
      const itemEvidence=evidences.filter(e=>e.item_id===item.id);const hasPhoto=itemEvidence.some(e=>e.kind==='PHOTO');const hasAudio=itemEvidence.some(e=>e.kind==='AUDIO');
      return <form id={item.id} key={item.id} className="card response-card" action={`/api/inspections/${id}/responses`} method="post" encType="multipart/form-data">
        <fieldset disabled={!editable}><input type="hidden" name="item_id" value={item.id}/><div className="response-head"><div><div className="eyebrow">{item.area} · {item.code}</div><h3>{index+1}. {item.title}</h3><div className="muted">{item.guidance}</div></div>{item.compliance&&<span className={'badge '+(item.compliance==='COMPLIANT'?'success':item.compliance==='NON_COMPLIANT'?'warn':'')}>{item.compliance==='COMPLIANT'?'Conforme':item.compliance==='NON_COMPLIANT'?'Não conforme':'Não se aplica'}</span>}</div><div className="grid response-fields"><div className="field"><label>RESPOSTA</label><select name="answer" defaultValue={item.answer||''} required><option value="">Selecione</option><option>Sim</option><option>Não</option><option>Não se aplica</option></select></div><div className="field"><label>COMENTÁRIO TÉCNICO</label><input name="comment" maxLength={2000} defaultValue={item.comment||''} placeholder="Registre a constatação"/></div></div><div className="response-actions"><EvidenceInputs/><Link className="revision" href={`/inspecoes/${id}/itens/${item.id}`}><History size={14}/>Histórico · {item.revision||0}</Link><button className="btn btn-primary">Salvar item</button></div></fieldset>
        {itemEvidence.length>0&&<div className="evidence-list">{itemEvidence.map(e=><Link href={`/api/evidences/${e.id}`} target="_blank" className="evidence-file" key={e.id}>{evidenceIcon[e.kind]}<span>{e.original_name}</span><small>{formatBytes(e.size)}</small></Link>)}</div>}
        <div className="requirements">{item.photo_required===1&&<span className={'requirement '+(hasPhoto?'done':'pending')}><Camera size={13}/>{hasPhoto?'Foto anexada':'Foto obrigatória'}</span>}{item.audio_required===1&&<span className={'requirement '+(hasAudio?'done':'pending')}><Mic size={13}/>{hasAudio?'Áudio anexado':'Áudio obrigatório'}</span>}</div>
      </form>})}</div>
  </AppShell>;
}
function StatusButton({id,status,label,icon,soft=false}:{id:string;status:string;label:string;icon:React.ReactNode;soft?:boolean}){return <form action={`/api/inspections/${id}/status`} method="post"><input type="hidden" name="status" value={status}/><button className={`btn ${soft?'btn-ghost':'btn-primary'}`}>{icon}{label}</button></form>}
function formatBytes(bytes:number){if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1024/1024).toFixed(1)} MB`}
