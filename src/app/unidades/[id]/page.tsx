import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';

type Unit={id:string;company_id:string;name:string;code:string;address:string|null;city:string|null;state:string|null;active:number;company_name:string};

export default async function UnitDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{ok?:string;erro?:string}>}){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.role==='INSPECTOR')redirect('/dashboard');
  const {id}=await params;
  const unit=db.prepare('SELECT u.*,c.trade_name company_name FROM units u JOIN companies c ON c.id=u.company_id WHERE u.id=?').get(id) as Unit|undefined;
  if(!unit||user.role!=='SUPER_ADMIN'&&unit.company_id!==user.company_id)notFound();
  const query=await searchParams;
  return <AppShell user={user} active="units">
    <header className="topbar"><div><div className="eyebrow">{unit.code} · {unit.company_name}</div><h1 className="title">{unit.name}</h1></div></header>
    <form className="card form-card" action={`/api/units/${id}`} method="post">
      {query.ok&&<div className="notice success-notice">Unidade atualizada com sucesso.</div>}
      {query.erro&&<div className="error">Não foi possível salvar. Revise os campos e o código informado.</div>}
      <div className="grid form-grid">
        <div className="field"><label>NOME DA UNIDADE</label><input name="name" required minLength={2} maxLength={140} defaultValue={unit.name}/></div>
        <div className="field"><label>CÓDIGO</label><input name="code" required minLength={2} maxLength={20} defaultValue={unit.code}/></div>
        <div className="field field-wide"><label>ENDEREÇO</label><input name="address" maxLength={240} defaultValue={unit.address||''}/></div>
        <div className="field"><label>CIDADE</label><input name="city" maxLength={100} defaultValue={unit.city||''}/></div>
        <div className="field"><label>UF</label><input name="state" minLength={2} maxLength={2} defaultValue={unit.state||''}/></div>
        <div className="field"><label>STATUS</label><select name="active" defaultValue={String(unit.active)}><option value="1">Ativa</option><option value="0">Inativa</option></select></div>
      </div>
      <div className="form-actions"><Link className="btn btn-ghost" href="/unidades">Voltar</Link><button className="btn btn-primary">Salvar alterações</button></div>
    </form>
  </AppShell>;
}
