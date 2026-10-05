import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {dayLabel} from '@/lib/calendar';

type SentRow={id:string;inspection_id:string;unit_code:string;company_name:string;sent_at:string;author:string|null;recipient:string|null};
export default async function SentReports({searchParams}:{searchParams:Promise<{codigo?:string;registrado?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');if(user.role==='INSPECTOR')redirect('/relatorios');
  const query=await searchParams,code=(query.codigo||'').trim().slice(0,100),params:(string|null)[]=user.role==='SUPER_ADMIN'?[]:[user.company_id];
  const scope=user.role==='SUPER_ADMIN'?'1=1':'i.company_id=?';if(code)params.push(`%${code}%`);
  const rows=db.prepare(`SELECT r.id,r.inspection_id,r.sent_at,r.recipient,un.code unit_code,c.trade_name company_name,author.name author FROM reports r JOIN inspections i ON i.id=r.inspection_id JOIN units un ON un.id=i.unit_id JOIN companies c ON c.id=i.company_id LEFT JOIN users author ON author.id=i.inspector_id WHERE r.status='SENT' AND ${scope}${code?' AND un.code LIKE ?':''} ORDER BY r.sent_at DESC,r.created_at DESC`).all(...params) as SentRow[];
  return <AppShell user={user} active="sent"><header className="topbar"><div><div className="eyebrow">Arquivos enviados ao cliente</div><h1 className="title">Relatórios Enviados</h1><p className="muted">Consulte os envios registrados pelo coordenador e baixe o arquivo preservado.</p></div><Link className="btn btn-soft" href="/relatorios?status=APPROVED">Ver relatórios aprovados</Link></header>
    {query.registrado==='1'&&<p className="notice success-notice">Envio realizado fora do aplicativo registrado. O PDF foi preservado para consulta.</p>}
    <section className="card"><form className="search-form" method="get"><div className="field"><label htmlFor="sent-unit-code">CÓDIGO DA UNIDADE</label><input id="sent-unit-code" name="codigo" defaultValue={code} placeholder="Filtrar pelo código da unidade"/></div><button className="btn btn-soft">Filtrar</button>{code&&<Link className="btn btn-ghost" href="/relatorios-enviados">Limpar</Link>}</form>
      <div className="report-table-scroll" tabIndex={0} role="region" aria-label="Relatórios enviados"><table className="report-table"><thead><tr><th>Código da Unidade</th><th>Data de Envio</th><th>Autor<br/>(Responsável Técnico)</th><th>Arquivo</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.unit_code}</b>{user.role==='SUPER_ADMIN'&&<small>{row.company_name}</small>}</td><td>{dayLabel(row.sent_at,{day:'2-digit',month:'2-digit',year:'numeric'})}{row.recipient&&<small>{row.recipient}</small>}<small>Envio externo registrado</small></td><td>{row.author||'Não informado'}</td><td><a className="btn btn-soft" href={`/api/sent-reports/${row.id}`}>Download</a><Link className="report-history" href={`/relatorios/${row.inspection_id}`}>Examinar relatório</Link></td></tr>)}</tbody></table></div>
      {!rows.length&&<div className="empty-state"><h2>Nenhum relatório enviado encontrado</h2><p>Após a aprovação, baixe o PDF, envie ao cliente e registre o envio realizado.</p></div>}
    </section>
  </AppShell>;
}
