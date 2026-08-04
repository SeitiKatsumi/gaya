import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { AppShell } from '@/components/app-shell';

type UserRow={id:string;company_id:string|null;name:string;email:string;role:string;active:number;trade_name:string|null};
export default async function UserDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{ok?:string;erro?:string}>}) {
  const current=await currentUser(); if(!current)redirect('/login'); if(current.role==='INSPECTOR')redirect('/dashboard');
  const {id}=await params;
  const row=db.prepare('SELECT u.id,u.company_id,u.name,u.email,u.role,u.active,c.trade_name FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.id=?').get(id) as UserRow|undefined;
  if(!row||(current.role!=='SUPER_ADMIN'&&row.company_id!==current.company_id))notFound();
  const query=await searchParams;
  return <AppShell user={current} active="users"><header className="topbar"><div><div className="eyebrow">{row.trade_name||'Plataforma Gaya'}</div><h1 className="title">Detalhes do usuário</h1></div></header>
    <form className="card form-card" action={`/api/users/${row.id}`} method="post">
      {query.ok&&<div className="notice success-notice">Usuário atualizado com sucesso.</div>}{query.erro&&<div className="error">Não foi possível atualizar. Revise os campos.</div>}
      <div className="grid form-grid">
        <div className="field field-wide"><label>NOME COMPLETO</label><input name="name" required minLength={3} defaultValue={row.name}/></div>
        <div className="field"><label>E-MAIL</label><input type="email" value={row.email} disabled/><small className="muted">O e-mail identifica a conta e não pode ser alterado.</small></div>
        <div className="field"><label>NOVA SENHA</label><input name="password" type="password" minLength={8} placeholder="Deixe em branco para manter" autoComplete="new-password"/></div>
        <div className="field"><label>NÍVEL DE ACESSO</label><select name="role" defaultValue={row.role}><option value="INSPECTOR">Inspetor</option><option value="SUPERVISOR">Supervisor</option>{current.role==='SUPER_ADMIN'&&<option value="SUPER_ADMIN">Super Admin</option>}</select></div>
        <div className="field"><label>STATUS</label><select name="active" defaultValue={String(row.active)} disabled={row.id===current.id}><option value="1">Ativo</option><option value="0">Inativo</option></select>{row.id===current.id&&<><input type="hidden" name="active" value="1"/><small className="muted">Sua própria conta não pode ser desativada.</small></>}</div>
      </div>
      <div className="form-actions"><Link className="btn btn-ghost" href="/usuarios">Voltar</Link><button className="btn btn-primary">Salvar alterações</button></div>
    </form></AppShell>;
}
