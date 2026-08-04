import Link from 'next/link';
import {Building2,MapPin} from 'lucide-react';
import {notFound,redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';

type Company={id:string;legal_name:string;trade_name:string;document:string|null;active:number};
type Unit={id:string;name:string;code:string;address:string|null;city:string|null;state:string|null;active:number};

export default async function CompanyDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{ok?:string;erro?:string}>}){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.role!=='SUPER_ADMIN')redirect('/dashboard');
  const {id}=await params;
  const company=db.prepare('SELECT * FROM companies WHERE id=?').get(id) as Company|undefined;
  if(!company)notFound();
  const units=db.prepare('SELECT * FROM units WHERE company_id=? ORDER BY active DESC,name').all(id) as Unit[];
  const query=await searchParams;
  return <AppShell user={user} active="companies">
    <header className="topbar"><div><div className="eyebrow">Empresa · Administração global</div><h1 className="title">{company.trade_name}</h1></div><Link href="/empresas" className="btn btn-ghost">Voltar</Link></header>
    <form className="card form-card" action={`/api/companies/${id}`} method="post">
      {query.ok==='empresa'&&<div className="notice success-notice">Empresa atualizada com sucesso.</div>}
      {query.erro&&<div className="error">Não foi possível salvar. Revise os campos e o documento informado.</div>}
      <div className="grid form-grid">
        <div className="field field-wide"><label>RAZÃO SOCIAL</label><input name="legal_name" required minLength={3} maxLength={180} defaultValue={company.legal_name}/></div>
        <div className="field"><label>NOME FANTASIA</label><input name="trade_name" required minLength={2} maxLength={120} defaultValue={company.trade_name}/></div>
        <div className="field"><label>CNPJ OU DOCUMENTO</label><input name="document" required minLength={5} maxLength={30} defaultValue={company.document||''}/></div>
        <div className="field"><label>STATUS</label><select name="active" defaultValue={String(company.active)}><option value="1">Ativa</option><option value="0">Inativa</option></select></div>
      </div>
      <div className="form-actions"><button className="btn btn-primary">Salvar empresa</button></div>
    </form>
    <div className="section-head"><div><h2>Unidades</h2><p>Locais operacionais disponíveis para projetos e inspeções.</p></div></div>
    <div className="grid cards-grid">{units.map(unit=><article className="card entity-card" key={unit.id}>
      <div className="entity-card-head"><span className="icon-chip"><MapPin size={18}/></span><span className={`badge ${unit.active?'success':'warn'}`}>{unit.active?'Ativa':'Inativa'}</span></div>
      <div><h2>{unit.name}</h2><p className="muted">{unit.code}</p><p className="muted">{[unit.address,unit.city,unit.state].filter(Boolean).join(' · ')||'Endereço não informado'}</p></div>
    </article>)}</div>
    <div className="section-head"><div><h2>Adicionar unidade</h2><p>Cadastre outras filiais, operações ou locais de inspeção.</p></div></div>
    <form className="card form-card" action={`/api/companies/${id}/units`} method="post">
      {query.ok==='unidade'&&<div className="notice success-notice">Unidade adicionada com sucesso.</div>}
      <div className="grid form-grid">
        <div className="field"><label>NOME DA UNIDADE</label><input name="name" required minLength={2} maxLength={140}/></div>
        <div className="field"><label>CÓDIGO</label><input name="code" required minLength={2} maxLength={20}/></div>
        <div className="field field-wide"><label>ENDEREÇO</label><input name="address" maxLength={240}/></div>
        <div className="field"><label>CIDADE</label><input name="city" maxLength={100}/></div>
        <div className="field"><label>UF</label><input name="state" minLength={2} maxLength={2}/></div>
      </div>
      <div className="form-actions"><button className="btn btn-primary"><Building2 size={15}/>Adicionar unidade</button></div>
    </form>
  </AppShell>;
}
