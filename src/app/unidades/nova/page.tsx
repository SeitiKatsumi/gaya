import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';

type Company={id:string;trade_name:string};

export default async function NewUnit({searchParams}:{searchParams:Promise<{erro?:string}>}){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.role==='INSPECTOR')redirect('/dashboard');
  const companies=(user.role==='SUPER_ADMIN'?db.prepare('SELECT id,trade_name FROM companies WHERE active=1 ORDER BY trade_name').all():[]) as Company[];
  const {erro}=await searchParams;
  return <AppShell user={user} active="units">
    <header className="topbar"><div><div className="eyebrow">Estrutura operacional</div><h1 className="title">Nova unidade</h1></div></header>
    <form className="card form-card" action="/api/units" method="post">
      {erro&&<div className="error">{erro==='codigo'?'Este código já está em uso na empresa.':'Revise os campos obrigatórios e tente novamente.'}</div>}
      <div className="grid form-grid">
        {user.role==='SUPER_ADMIN'&&<div className="field field-wide"><label>EMPRESA</label><select name="company_id" required><option value="">Selecione</option>{companies.map(company=><option key={company.id} value={company.id}>{company.trade_name}</option>)}</select></div>}
        <div className="field"><label>NOME DA UNIDADE</label><input name="name" required minLength={2} maxLength={140}/></div>
        <div className="field"><label>CÓDIGO</label><input name="code" required minLength={2} maxLength={20} placeholder="Ex.: SP01"/></div>
        <div className="field field-wide"><label>ENDEREÇO</label><input name="address" maxLength={240}/></div>
        <div className="field"><label>CIDADE</label><input name="city" maxLength={100}/></div>
        <div className="field"><label>UF</label><input name="state" minLength={2} maxLength={2} placeholder="SP"/></div>
      </div>
      <div className="form-actions"><Link className="btn btn-ghost" href="/unidades">Cancelar</Link><button className="btn btn-primary">Cadastrar unidade</button></div>
    </form>
  </AppShell>;
}
