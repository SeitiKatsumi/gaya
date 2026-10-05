import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {dayLabel,saoPauloToday} from '@/lib/calendar';
import {reportInspection} from '@/lib/report-export';
import {statusLabel} from '@/lib/utils';

export default async function ReportDelivery({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)redirect('/login');if(user.role==='INSPECTOR')redirect('/relatorios');
  const {id}=await params,inspection=reportInspection(id);if(!inspection||user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id)notFound();
  const recipients=(db.prepare('SELECT report_recipients FROM companies WHERE id=?').get(inspection.company_id) as {report_recipients:string}).report_recipients;
  const sent=db.prepare("SELECT id,sent_at,recipient FROM reports WHERE inspection_id=? AND status='SENT'").get(id) as {id:string;sent_at:string;recipient:string|null}|undefined;
  return <AppShell user={user} active="sent"><header className="topbar"><div><div className="eyebrow">Envio ao cliente</div><h1 className="title">Relatório de {inspection.unit_code}</h1><p className="muted">{inspection.inspector_name||'Responsável Técnico não informado'} · {statusLabel(inspection.status)}</p></div><Link className="btn btn-ghost" href={`/relatorios/${id}`}>Voltar ao relatório</Link></header>
    {sent?<section className="card form-card"><h2>Envio registrado</h2><p>Data de envio: <b>{dayLabel(sent.sent_at)}</b></p>{sent.recipient&&<p>Destinatário: {sent.recipient}</p>}<p className="muted">O envio foi realizado fora do aplicativo. Este arquivo preserva o PDF registrado pelo coordenador.</p><a className="btn btn-primary" href={`/api/sent-reports/${sent.id}`}>Baixar arquivo enviado</a><Link className="btn btn-soft" href="/relatorios-enviados" style={{marginLeft:10}}>Ver Relatórios Enviados</Link></section>:inspection.status!=='APPROVED'?<section className="card"><h2>Aguardando aprovação</h2><p className="muted">O relatório deve ter todas as suas seções aprovadas pelo coordenador antes de registrar o envio ao cliente.</p></section>:<section className="card form-card"><h2>Baixar e enviar o relatório aprovado</h2><p>Baixe o PDF aprovado e envie ao cliente pelo canal utilizado pela equipe. Depois, registre abaixo o envio realizado.</p><a className="btn btn-primary" href={`/api/reports/${id}`}>Baixar PDF aprovado</a><p className="notice" style={{marginTop:18}}>Este formulário registra um envio feito fora do aplicativo. Ele não dispara emails. Os emails padrão podem ser editados em Relatórios Enviados.</p>
      <form action={`/api/received-reports/${id}/send`} method="post"><div className="field"><label htmlFor="delivery-date">DATA DO ENVIO REALIZADO</label><input id="delivery-date" name="sent_at" type="date" min="1900-01-01" max={saoPauloToday()} defaultValue={saoPauloToday()} required/></div><div className="field"><label htmlFor="delivery-recipient">EMAILS DA MATRIZ / DESTINATÁRIOS (OPCIONAL)</label><input id="delivery-recipient" name="recipient" type="email" multiple maxLength={510} defaultValue={recipients} placeholder="Até dois emails, separados por vírgula"/></div><label className="muted" style={{display:'flex',gap:10,alignItems:'flex-start',fontSize:13}}><input type="checkbox" name="confirmation" value="sent" required/>Já enviei o PDF aprovado ao cliente e confirmo a data informada.</label><div className="form-actions"><button className="btn btn-primary">Registrar envio realizado</button></div></form>
    </section>}
  </AppShell>;
}
