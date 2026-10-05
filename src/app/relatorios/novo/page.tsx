import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';
import {saoPauloToday,validDate} from '@/lib/calendar';

export default async function NewReport({searchParams}:{searchParams:Promise<{unidade?:string;data?:string;erro?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');const query=await searchParams;
  const scope=user.role==='SUPER_ADMIN'?'1=1':user.role==='INSPECTOR'?'u.company_id=? AND u.responsible_id=?':'u.company_id=?';
  const values=user.role==='SUPER_ADMIN'?[]:user.role==='INSPECTOR'?[user.company_id,user.id]:[user.company_id];
  const units=db.prepare(`SELECT u.id,u.code,r.name responsible FROM units u JOIN users r ON r.id=u.responsible_id JOIN companies c ON c.id=u.company_id WHERE u.active=1 AND r.active=1 AND r.role='INSPECTOR' AND r.company_id=u.company_id AND c.active=1 AND ${scope} ORDER BY u.code`).all(...values) as {id:string;code:string;responsible:string}[];
  return <AppShell user={user} active="reports"><header className="topbar"><div><div className="eyebrow">Visita técnica</div><h1 className="title">Novo relatório</h1><p className="muted">Preencha somente as partes verificadas nesta visita.</p></div></header><form className="card form-card" action="/api/received-reports" method="post">{query.erro&&<p className="error">Revise a unidade e a data.</p>}{!units.length&&<p className="notice">É necessário vincular um responsável técnico ativo à unidade antes de preencher um relatório.</p>}<div className="grid form-grid"><div className="field field-wide"><label htmlFor="new-report-unit">UNIDADE E RESPONSÁVEL TÉCNICO</label><select id="new-report-unit" name="unit_id" required defaultValue={units.some(unit=>unit.id===query.unidade)?query.unidade:''}><option value="">Selecione</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.code} · {unit.responsible}</option>)}</select></div><div className="field field-wide"><label htmlFor="new-report-date">DATA DA VISITA</label><input id="new-report-date" name="visit_date" type="date" required defaultValue={query.data&&validDate(query.data)?query.data:saoPauloToday()}/></div></div><div className="form-actions"><Link className="btn btn-ghost" href="/relatorios">Voltar</Link><button className="btn btn-primary" disabled={!units.length}>Preencher relatório</button></div></form></AppShell>;
}
