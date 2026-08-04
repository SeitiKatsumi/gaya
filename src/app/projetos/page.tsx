import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FolderKanban, Plus } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { projectStatusLabel } from '@/lib/utils';
import { AppShell } from '@/components/app-shell';

type Project={id:string;code:string;name:string;description:string|null;status:string;unit_name:string|null;manager_name:string|null;inspection_count:number};
export default async function Projects(){
  const user=await currentUser();if(!user)redirect('/login');if(user.role==='INSPECTOR')redirect('/dashboard');
  const rows=db.prepare(`SELECT p.id,p.code,p.name,p.description,p.status,u.name unit_name,m.name manager_name,(SELECT count(*) FROM inspections i WHERE i.project_id=p.id) inspection_count FROM projects p LEFT JOIN units u ON u.id=p.unit_id LEFT JOIN users m ON m.id=p.manager_id WHERE ${user.role==='SUPER_ADMIN'?'1=1':'p.company_id=?'} ORDER BY CASE p.status WHEN 'ACTIVE' THEN 0 WHEN 'PLANNING' THEN 1 ELSE 2 END,p.name`).all(...(user.role==='SUPER_ADMIN'?[]:[user.company_id])) as Project[];
  return <AppShell user={user} active="projects"><header className="topbar"><div><div className="eyebrow">Planejamento operacional</div><h1 className="title">Projetos</h1></div><Link className="btn btn-primary" href="/projetos/novo"><Plus size={16}/>Novo projeto</Link></header>
    <div className="grid cards-grid">{rows.map(row=><Link className="card entity-card" href={`/projetos/${row.id}`} key={row.id}><div className="entity-card-head"><span className="icon-chip"><FolderKanban size={18}/></span><span className={'badge '+(row.status==='ACTIVE'?'success':'')}>{projectStatusLabel(row.status)}</span></div><div><div className="eyebrow">{row.code}</div><h2>{row.name}</h2><p className="muted">{row.description||'Projeto operacional sem descrição.'}</p></div><div className="entity-meta"><span>{row.unit_name||'Todas as unidades'}</span><span>{row.inspection_count} inspeções</span><span>{row.manager_name||'Sem gestor'}</span></div></Link>)}</div>
    {!rows.length&&<div className="card empty-state"><FolderKanban size={30}/><h2>Nenhum projeto cadastrado</h2><p>Crie o primeiro projeto para agrupar unidades, responsáveis e inspeções.</p></div>}
  </AppShell>;
}
