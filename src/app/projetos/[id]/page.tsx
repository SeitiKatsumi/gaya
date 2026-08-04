import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {statusLabel} from '@/lib/utils';
import {AppShell} from '@/components/app-shell';
import {ConfirmSubmit} from '@/components/confirm-submit';

type Project={id:string;company_id:string;code:string;name:string;description:string|null;status:string;unit_id:string|null;manager_id:string|null;start_date:string|null;end_date:string|null;company_name:string};
type Option={id:string;name:string};type Inspection={id:string;title:string;control_code:string;status:string;progress:number};

export default async function ProjectDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{ok?:string;erro?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');if(user.role==='INSPECTOR')redirect('/dashboard');
  const {id}=await params;
  const project=db.prepare('SELECT p.*,c.trade_name company_name FROM projects p JOIN companies c ON c.id=p.company_id WHERE p.id=?').get(id) as Project|undefined;
  if(!project||(user.role!=='SUPER_ADMIN'&&project.company_id!==user.company_id))notFound();
  const units=db.prepare('SELECT id,name FROM units WHERE company_id=? AND active=1 ORDER BY name').all(project.company_id) as Option[];
  const managers=db.prepare("SELECT id,name FROM users WHERE company_id=? AND role='SUPERVISOR' AND active=1 ORDER BY name").all(project.company_id) as Option[];
  const inspections=db.prepare('SELECT id,title,control_code,status,progress FROM inspections WHERE project_id=? ORDER BY created_at DESC').all(id) as Inspection[];
  const query=await searchParams;
  return <AppShell user={user} active="projects"><header className="topbar"><div><div className="eyebrow">{project.code} · {project.company_name}</div><h1 className="title">{project.name}</h1></div>{project.status!=='ARCHIVED'&&<Link className="btn btn-primary" href={`/inspecoes/nova?projeto=${project.id}`}>Nova inspeção</Link>}</header>
    <form className="card form-card" action={`/api/projects/${project.id}`} method="post">{query.ok&&<div className="notice success-notice">{query.ok==='arquivado'?'Projeto arquivado. O histórico foi preservado.':'Projeto atualizado com sucesso.'}</div>}{query.erro&&<div className="error">Revise os campos informados.</div>}<div className="grid form-grid"><div className="field"><label>CÓDIGO</label><input value={project.code} disabled/></div><div className="field"><label>STATUS</label><select name="status" defaultValue={project.status}><option value="PLANNING">Planejamento</option><option value="ACTIVE">Ativo</option><option value="PAUSED">Pausado</option><option value="COMPLETED">Concluído</option><option value="ARCHIVED">Arquivado</option></select></div><div className="field field-wide"><label>NOME</label><input name="name" required minLength={3} defaultValue={project.name}/></div><div className="field"><label>UNIDADE PRINCIPAL</label><select name="unit_id" defaultValue={project.unit_id||''}><option value="">Todas as unidades</option>{units.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></div><div className="field"><label>GESTOR</label><select name="manager_id" defaultValue={project.manager_id||''}><option value="">A definir</option>{managers.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></div><div className="field"><label>INÍCIO</label><input name="start_date" type="date" defaultValue={project.start_date||''}/></div><div className="field"><label>TÉRMINO</label><input name="end_date" type="date" defaultValue={project.end_date||''}/></div><div className="field field-wide"><label>DESCRIÇÃO</label><textarea name="description" rows={4} defaultValue={project.description||''}/></div></div><div className="form-actions"><Link className="btn btn-ghost" href="/projetos">Voltar</Link><button className="btn btn-primary">Salvar alterações</button></div></form>
    {project.status!=='ARCHIVED'&&<form className="danger-zone" action={`/api/projects/${project.id}`} method="post"><input type="hidden" name="intent" value="archive"/><div><b>Arquivar projeto</b><p>O projeto não aceitará novas inspeções, mas todo o histórico continuará disponível.</p></div><ConfirmSubmit label="Arquivar projeto" message={`Arquivar o projeto ${project.name}?`}/></form>}
    <div className="section-head"><div><h2>Inspeções vinculadas</h2><p>Atividades pertencentes a este projeto.</p></div></div><div className="card inspection-list">{inspections.length?inspections.map(inspection=><Link href={`/inspecoes/${inspection.id}`} className="inspection-row" key={inspection.id}><div><div className="inspection-name">{inspection.title}</div><div className="muted">{inspection.control_code}</div></div><span className="badge">{statusLabel(inspection.status)}</span><div><div className="muted">Progresso {inspection.progress}%</div><div className="progress"><span style={{width:`${inspection.progress}%`}}/></div></div><span className="btn btn-soft">Abrir</span></Link>):<div className="muted">Nenhuma inspeção vinculada.</div>}</div>
  </AppShell>;
}
