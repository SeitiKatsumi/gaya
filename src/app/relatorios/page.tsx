import {redirect} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';
import {saoPauloDate} from '@/lib/received-reports';
import {saoPauloToday,dayLabel} from '@/lib/calendar';
import {statusLabel} from '@/lib/utils';

type Row={id:string;unit_code:string;company_name:string;author:string|null;received_at:string|null;send_due_date:string|null;status:string;planned_start:string|null};
export default async function Reports({searchParams}:{searchParams:Promise<{q?:string;status?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  const query=await searchParams,q=(query.q||'').trim().slice(0,100),status=['IN_REVIEW','CHANGES_REQUESTED','APPROVED'].includes(query.status||'')?query.status:'';
  const scope=user.role==='SUPER_ADMIN'?'1=1':user.role==='INSPECTOR'?'i.company_id=? AND i.inspector_id=?':'i.company_id=?';
  const params:(string|null)[]=user.role==='SUPER_ADMIN'?[]:user.role==='INSPECTOR'?[user.company_id,user.id]:[user.company_id];
  let filter=user.role==='INSPECTOR'?'':" AND (i.received_at IS NOT NULL OR i.status IN ('IN_REVIEW','APPROVED','CHANGES_REQUESTED'))";
  if(q){filter+=' AND (un.code LIKE ? OR author.name LIKE ?)';params.push(`%${q}%`,`%${q}%`);}
  if(status){filter+=' AND i.status=?';params.push(status);}
  const rows=db.prepare(`SELECT i.id,i.status,i.received_at,i.send_due_date,i.planned_start,un.code unit_code,c.trade_name company_name,author.name author FROM inspections i JOIN units un ON un.id=i.unit_id JOIN companies c ON c.id=i.company_id LEFT JOIN users author ON author.id=i.inspector_id WHERE ${scope}${filter} ORDER BY COALESCE(i.received_at,i.created_at) DESC`).all(...params) as Row[];
  const today=saoPauloToday();
  return <AppShell user={user} active="reports"><header className="topbar"><div><div className="eyebrow">{user.role==='INSPECTOR'?'Visitas técnicas':'Recebimento e revisão'}</div><h1 className="title">{user.role==='INSPECTOR'?'Meus relatórios':'Relatórios Recebidos'}</h1><p className="muted">{user.role==='INSPECTOR'?'Preencha o relatório da visita e acompanhe a revisão do coordenador.':'Examine os relatórios enviados pelos responsáveis técnicos.'}</p></div><Link className="btn btn-primary" href="/relatorios/novo">{user.role==='INSPECTOR'?'Novo relatório':'Preparar relatório'}</Link></header>
    <section className="card"><form className="search-form" method="get"><div className="field"><label htmlFor="received-search">UNIDADE OU AUTOR</label><input id="received-search" name="q" defaultValue={q} placeholder="Buscar código da unidade ou responsável técnico"/></div><div className="field"><label htmlFor="received-status">SITUAÇÃO</label><select id="received-status" name="status" defaultValue={status}><option value="">Todas</option><option value="IN_REVIEW">Em revisão</option><option value="CHANGES_REQUESTED">Ajustes solicitados</option><option value="APPROVED">Aprovados</option></select></div><button className="btn btn-soft">Filtrar</button>{(q||status)&&<Link className="btn btn-ghost" href="/relatorios">Limpar</Link>}</form>
      <div className="report-table-scroll" tabIndex={0} role="region" aria-label="Relatórios recebidos"><table className="report-table"><thead><tr><th>Código da Unidade</th><th>Data</th><th>Autor<br/>(Responsável Técnico)</th><th>Data Limite de Envio</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.unit_code}</b>{user.role==='SUPER_ADMIN'&&<small>{row.company_name}</small>}<small>Visita: {row.planned_start?dayLabel(row.planned_start,{day:'2-digit',month:'2-digit',year:'numeric'}):'Não informada'}</small></td><td>{row.received_at?dayLabel(saoPauloDate(row.received_at),{day:'2-digit',month:'2-digit',year:'numeric'}):row.status==='IN_REVIEW'||row.status==='APPROVED'?'Recebimento não registrado':'Ainda não enviado'}<small className={`report-status ${row.status==='CHANGES_REQUESTED'?'text-danger':''}`}>{statusLabel(row.status)}</small></td><td>{row.author||'Não informado'}</td><td>{row.send_due_date?<><span className={row.send_due_date<today&&!['APPROVED','CANCELLED'].includes(row.status)?'text-danger':''}>{dayLabel(row.send_due_date,{day:'2-digit',month:'2-digit',year:'numeric'})}</span><small>2 dias úteis após recebimento</small></>:'—'}</td><td><Link className="btn btn-soft" href={`/relatorios/${row.id}`}>{row.received_at||['IN_REVIEW','APPROVED','CHANGES_REQUESTED'].includes(row.status)?'Examinar':'Preencher'}</Link></td></tr>)}</tbody></table></div>{!rows.length&&<div className="empty-state"><h2>{user.role==='INSPECTOR'?'Nenhum relatório encontrado':'Nenhum relatório recebido'}</h2><p>{user.role==='INSPECTOR'?'Crie um relatório para uma unidade vinculada ao seu usuário.':'Os relatórios aparecerão aqui quando o RT enviar para revisão.'}</p></div>}
    </section>
  </AppShell>;
}
