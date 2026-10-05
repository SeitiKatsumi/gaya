import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';
import {ConfirmSubmit} from '@/components/confirm-submit';

type Unit={id:string;company_id:string;name:string;code:string;address:string|null;city:string|null;state:string|null;active:number;responsible_id:string|null;company_name:string;maps_url:string|null;contact_name:string|null;contact_email:string|null;contact_phones:string|null;form_url:string|null};

export default async function UnitDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{ok?:string;erro?:string}>}){
  const user=await currentUser();
  if(!user)redirect('/login');
  const {id}=await params;
  const unit=db.prepare('SELECT u.*,c.trade_name company_name FROM units u JOIN companies c ON c.id=u.company_id WHERE u.id=?').get(id) as Unit|undefined;
  if(!unit||user.role!=='SUPER_ADMIN'&&unit.company_id!==user.company_id||user.role==='INSPECTOR'&&unit.responsible_id!==user.id)notFound();
  const readOnly=user.role==='INSPECTOR';
  const responsible=db.prepare(`SELECT id,name FROM users WHERE company_id=? AND role='INSPECTOR' ${readOnly?'AND id=?':''} ORDER BY name`).all(unit.company_id,...(readOnly?[user.id]:[])) as {id:string;name:string}[];
  const query=await searchParams;
  return <AppShell user={user} active="units">
    <header className="topbar"><div><div className="eyebrow">{unit.code} · {unit.company_name}</div><h1 className="title">{unit.name}</h1></div></header>
    <form className="card form-card" action={`/api/units/${id}`} method="post">
      {query.ok&&<div className="notice success-notice">Unidade atualizada com sucesso.</div>}
      {query.erro&&<div className="error">Não foi possível salvar. Revise os campos e o código informado.</div>}
      {readOnly&&<p className="notice">Consulta da unidade atribuída. Somente o coordenador pode alterar estes dados.</p>}
      <fieldset disabled={readOnly}><div className="grid form-grid">
        <input type="hidden" name="name" value={unit.name}/>
        <div className="field"><label htmlFor="code">CÓDIGO DA UNIDADE</label><input id="code" name="code" required minLength={2} maxLength={20} defaultValue={unit.code}/></div>
        <div className="field"><label htmlFor="responsible_id">RESPONSÁVEL TÉCNICO(A)</label><select id="responsible_id" name="responsible_id" defaultValue={unit.responsible_id||''}><option value="">Sem responsável</option>{responsible.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
        <div className="field field-wide"><label htmlFor="address">ENDEREÇO</label><input id="address" name="address" maxLength={240} defaultValue={unit.address||''}/></div>
        <input type="hidden" name="city" value={unit.city||''}/>
        <input type="hidden" name="state" value={unit.state||''}/>
        <div className="field"><label>STATUS</label><select name="active" defaultValue={String(unit.active)}><option value="1">Ativa</option><option value="0">Inativa</option></select></div>

        <div className="field"><label htmlFor="maps_url">GOOGLE MAPS</label><input id="maps_url" name="maps_url" maxLength={1000} defaultValue={unit.maps_url||''}/></div>
        <div className="field"><label htmlFor="contact_name">PONTO DE CONTATO</label><input id="contact_name" name="contact_name" maxLength={160} defaultValue={unit.contact_name||''}/></div>
        <div className="field"><label htmlFor="contact_email">E-MAIL (PONTO DE CONTATO)</label><input id="contact_email" name="contact_email" maxLength={320} defaultValue={unit.contact_email||''}/></div>
        <div className="field"><label htmlFor="contact_phones">TELEFONE(S) (PONTO DE CONTATO)</label><input id="contact_phones" name="contact_phones" maxLength={160} defaultValue={unit.contact_phones||''}/></div>
        <div className="field"><label htmlFor="form_url">FORMULÁRIO VIRTUAL (FORMS)</label><input id="form_url" name="form_url" maxLength={1000} defaultValue={unit.form_url||''}/></div>
      </div></fieldset>
      <div className="form-actions"><Link className="btn btn-ghost" href="/unidades">Voltar</Link>{!readOnly&&<button className="btn btn-primary">Salvar alterações</button>}</div>
    </form>{!readOnly&&unit.active===1&&<form className="danger-zone" action={`/api/units/${id}`} method="post"><input type="hidden" name="intent" value="deactivate"/><div><b>Desativar unidade</b><p>Ela deixará de aparecer em novos projetos e inspeções. O histórico será preservado.</p></div><ConfirmSubmit label="Desativar unidade" message={`Desativar a unidade ${unit.name}?`}/></form>}
  </AppShell>;
}
