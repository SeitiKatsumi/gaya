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
  const responsible=db.prepare(`SELECT u.id,u.name,c.trade_name company_name FROM users u JOIN companies c ON c.id=u.company_id WHERE u.role='INSPECTOR' ${user.role==='SUPER_ADMIN'?'':'AND u.company_id=?'} ORDER BY u.name`).all(...(user.role==='SUPER_ADMIN'?[]:[user.company_id])) as {id:string;name:string;company_name:string}[];
  const {erro}=await searchParams;
  return <AppShell user={user} active="units">
    <header className="topbar"><div><div className="eyebrow">Estrutura operacional</div><h1 className="title">Nova unidade</h1></div></header>
    <form className="card form-card" action="/api/units" method="post">
      {erro&&<div className="error">{erro==='codigo'?'Este código já está em uso na empresa.':'Revise os campos obrigatórios e tente novamente.'}</div>}
      <div className="grid form-grid">
        {user.role==='SUPER_ADMIN'&&<div className="field field-wide"><label>EMPRESA</label><select name="company_id" required><option value="">Selecione</option>{companies.map(company=><option key={company.id} value={company.id}>{company.trade_name}</option>)}</select></div>}

        <div className="field"><label htmlFor="code">CÓDIGO DA UNIDADE</label><input id="code" name="code" required minLength={2} maxLength={20} placeholder="Ex.: SP01"/></div>
        <div className="field"><label htmlFor="responsible_id">RESPONSÁVEL TÉCNICO(A)</label><select id="responsible_id" name="responsible_id"><option value="">Sem responsável</option>{responsible.map(person=><option key={person.id} value={person.id}>{person.name}{user.role==='SUPER_ADMIN'?` · ${person.company_name}`:''}</option>)}</select></div>
        <div className="field field-wide"><label htmlFor="address">ENDEREÇO</label><input id="address" name="address" maxLength={240}/></div>

        <div className="field"><label htmlFor="maps_url">GOOGLE MAPS</label><input id="maps_url" name="maps_url" maxLength={1000}/></div>
        <div className="field"><label htmlFor="contact_name">PONTO DE CONTATO</label><input id="contact_name" name="contact_name" maxLength={160}/></div>
        <div className="field"><label htmlFor="contact_email">E-MAIL (PONTO DE CONTATO)</label><input id="contact_email" name="contact_email" maxLength={320}/></div>
        <div className="field"><label htmlFor="contact_phones">TELEFONE(S) (PONTO DE CONTATO)</label><input id="contact_phones" name="contact_phones" maxLength={160}/></div>
        <div className="field"><label htmlFor="form_url">FORMULÁRIO VIRTUAL (FORMS)</label><input id="form_url" name="form_url" maxLength={1000}/></div>
      </div>
      <div className="form-actions"><Link className="btn btn-ghost" href="/unidades">Cancelar</Link><button className="btn btn-primary">Cadastrar unidade</button></div>
    </form>
  </AppShell>;
}
