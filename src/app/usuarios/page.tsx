import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, UserRound } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/utils';
import { AppShell } from '@/components/app-shell';

type UserRow={id:string;name:string;email:string;role:string;active:number;trade_name:string|null};

export default async function Users() {
  const user=await currentUser();
  if(!user) redirect('/login');
  if(user.role==='INSPECTOR') redirect('/dashboard');
  const rows=db.prepare(`SELECT u.id,u.name,u.email,u.role,u.active,c.trade_name FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE ${user.role==='SUPER_ADMIN'?'1=1':'u.company_id=?'} ORDER BY u.active DESC,u.name`).all(...(user.role==='SUPER_ADMIN'?[]:[user.company_id])) as UserRow[];
  return <AppShell user={user} active="users">
    <header className="topbar"><div><div className="eyebrow">Acessos</div><h1 className="title">Usuários</h1></div><Link className="btn btn-primary" href="/usuarios/novo"><Plus size={16}/>Novo usuário</Link></header>
    <div className="card inspection-list">{rows.map(row=><Link className="inspection-row" href={`/usuarios/${row.id}`} key={row.id}>
      <div><div className="inspection-name">{row.name}</div><div className="muted">{row.email}</div></div>
      <span className="badge"><UserRound size={12}/>{roleLabel(row.role)}</span>
      <div className="muted">{row.trade_name||'Plataforma Gaya'}</div>
      <span className={'badge '+(row.active?'success':'warn')}>{row.active?'Ativo':'Inativo'}</span>
    </Link>)}</div>
  </AppShell>;
}
