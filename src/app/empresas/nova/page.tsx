import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {AppShell} from '@/components/app-shell';

export default async function NewCompany({searchParams}:{searchParams:Promise<{erro?:string}>}){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.role!=='SUPER_ADMIN')redirect('/dashboard');
  const {erro}=await searchParams;
  return <AppShell user={user} active="companies">
    <header className="topbar"><div><div className="eyebrow">Administração global</div><h1 className="title">Nova empresa</h1></div></header>
    <form className="card form-card" action="/api/companies" method="post">
      {erro&&<div className="error">{erro==='documento'?'Já existe uma empresa com este documento.':'Revise os campos obrigatórios e tente novamente.'}</div>}
      <div className="section-head" style={{marginTop:0}}><div><h2>Dados da empresa</h2><p>Identificação jurídica e nome exibido na plataforma.</p></div></div>
      <div className="grid form-grid">
        <div className="field field-wide"><label>RAZÃO SOCIAL</label><input name="legal_name" required minLength={3} maxLength={180}/></div>
        <div className="field"><label>NOME FANTASIA</label><input name="trade_name" required minLength={2} maxLength={120}/></div>
        <div className="field"><label>CNPJ OU DOCUMENTO</label><input name="document" required minLength={5} maxLength={30} inputMode="numeric"/></div>
      </div>
      <div className="section-head"><div><h2>Unidade inicial</h2><p>Necessária para criar projetos e inspeções nesta empresa.</p></div></div>
      <div className="grid form-grid">
        <div className="field"><label>NOME DA UNIDADE</label><input name="unit_name" required minLength={2} maxLength={140} placeholder="Ex.: Matriz São Paulo"/></div>
        <div className="field"><label>CÓDIGO DA UNIDADE</label><input name="unit_code" required minLength={2} maxLength={20} placeholder="Ex.: MATRIZ"/></div>
        <div className="field field-wide"><label>ENDEREÇO</label><input name="address" maxLength={240}/></div>
        <div className="field"><label>CIDADE</label><input name="city" maxLength={100}/></div>
        <div className="field"><label>UF</label><input name="state" maxLength={2} minLength={2} placeholder="SP"/></div>
      </div>
      <div className="form-actions"><Link className="btn btn-ghost" href="/empresas">Cancelar</Link><button className="btn btn-primary">Cadastrar empresa</button></div>
    </form>
  </AppShell>;
}
