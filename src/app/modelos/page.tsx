import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Layers3,Plus} from 'lucide-react';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';

type Template={id:string;name:string;category:string|null;description:string|null;version:number;status:string;items:number};
const statusLabel=(status:string)=>status==='PUBLISHED'?'Publicado':status==='ARCHIVED'?'Arquivado':'Rascunho';

export default async function Templates(){
  const user=await currentUser();if(!user)redirect('/login');if(user.role==='INSPECTOR')redirect('/inspecoes');
  const rows=db.prepare(`SELECT t.id,t.name,t.category,t.description,t.version,t.status,(SELECT count(*) FROM template_items WHERE template_id=t.id AND active=1) items FROM templates t WHERE ${user.role==='SUPER_ADMIN'?'1=1':'t.is_global=1 OR t.company_id=?'} ORDER BY CASE t.status WHEN 'PUBLISHED' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,t.created_at DESC`).all(...(user.role==='SUPER_ADMIN'?[]:[user.company_id])) as Template[];
  return <AppShell user={user} active="templates"><header className="topbar"><div><div className="eyebrow">Biblioteca</div><h1 className="title">Modelos de inspeção</h1></div>{true&&<Link className="btn btn-primary" href="/modelos/novo"><Plus size={16}/>Novo modelo</Link>}</header><div className="grid cards-grid">{rows.map(template=><Link className="card entity-card" href={`/modelos/${template.id}`} key={template.id}><div className="entity-card-head"><span className="icon-chip"><Layers3 size={18}/></span><span className={'badge '+(template.status==='PUBLISHED'?'success':template.status==='ARCHIVED'?'warn':'')}>{statusLabel(template.status)}</span></div><div><h2>{template.name}</h2><p className="muted">{template.description||'Modelo sem descrição.'}</p></div><div className="entity-meta"><span>Versão {template.version}</span><span>{template.items} itens ativos</span><span>{template.category||'Sem categoria'}</span></div></Link>)}</div></AppShell>;
}
