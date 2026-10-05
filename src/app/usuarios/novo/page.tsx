import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { AppShell } from '@/components/app-shell';

type Company={id:string;trade_name:string};
export default async function NewUser({searchParams}:{searchParams:Promise<{erro?:string}>}) {
  const user=await currentUser(); if(!user)redirect('/login'); if(user.role==='INSPECTOR')redirect('/dashboard');
  const companies=(user.role==='SUPER_ADMIN'?db.prepare('SELECT id,trade_name FROM companies WHERE active=1 ORDER BY trade_name').all():[]) as Company[];
  const {erro}=await searchParams;
  return <AppShell user={user} active="users"><header className="topbar"><div><div className="eyebrow">Acessos</div><h1 className="title">Novo usuário</h1></div></header>
    <form className="card form-card" action="/api/users" method="post">
      {erro&&<div className="error">{erro==='email'?'Este e-mail já está em uso.':'Revise os campos e tente novamente.'}</div>}
      <div className="grid form-grid">
        <div className="field field-wide"><label>NOME COMPLETO</label><input name="name" required minLength={3} autoComplete="name"/></div>
        <div className="field"><label>E-MAIL</label><input name="email" required type="email" autoComplete="email"/></div>
        <div className="field"><label>SENHA INICIAL</label><input name="password" required type="password" minLength={8} autoComplete="new-password"/><small className="muted">Mínimo de 8 caracteres, com letra e número.</small></div>
        {user.role==='SUPER_ADMIN'&&<div className="field"><label>EMPRESA</label><select name="company_id" required><option value="">Selecione</option>{companies.map(c=><option key={c.id} value={c.id}>{c.trade_name}</option>)}</select></div>}
        <div className="field"><label>NÍVEL DE ACESSO</label><select name="role" required><option value="INSPECTOR">Responsável técnico</option><option value="SUPERVISOR">Coordenador</option>{user.role==='SUPER_ADMIN'&&<option value="SUPER_ADMIN">Super Admin</option>}</select></div>
      </div>
      <div className="form-actions"><Link className="btn btn-ghost" href="/usuarios">Cancelar</Link><button className="btn btn-primary">Cadastrar usuário</button></div>
    </form></AppShell>;
}
