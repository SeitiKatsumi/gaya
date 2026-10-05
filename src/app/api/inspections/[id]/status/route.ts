import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl,publicOrigin} from '@/lib/http';
import {uid} from '@/lib/utils';
import {applicableItems,filledItems,isVisitReport,saoPauloDate,sectionOf,sendDeadline,type AnswerRow} from '@/lib/received-reports';
import {inspectionTemplateItems} from '@/lib/inspection-template';

const transitions:Record<string,string[]>={SCHEDULED:['IN_PROGRESS','CANCELLED'],CHANGES_REQUESTED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['IN_REVIEW','CANCELLED'],IN_REVIEW:['CHANGES_REQUESTED','APPROVED','CANCELLED']};

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return NextResponse.redirect(appUrl(req,'/login'),303);
  const origin=req.headers.get('origin');if(origin&&origin!==publicOrigin(req))return NextResponse.json({error:'Origem inválida'},{status:403});
  const {id}=await params;const form=await req.formData(),status=String(form.get('status'));
  const inspection=db.prepare('SELECT * FROM inspections WHERE id=?').get(id) as any;
  if(!inspection||user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id||user.role==='INSPECTOR'&&inspection.inspector_id!==user.id)return NextResponse.json({error:'Sem permissão'},{status:403});
  if(!transitions[inspection.status]?.includes(status))return NextResponse.json({error:'Transição inválida'},{status:409});
  if(['APPROVED','CHANGES_REQUESTED','CANCELLED'].includes(status)&&user.role==='INSPECTOR')return NextResponse.json({error:'Apenas coordenadores podem revisar ou cancelar'},{status:403});
  const submitted=filledItems(inspection),sections=[...new Set(submitted.map(sectionOf))];
  if(status==='APPROVED'){
    const approved=new Set((db.prepare("SELECT section FROM report_section_reviews WHERE inspection_id=? AND status='APPROVED'").all(id) as {section:string}[]).map(row=>row.section));
    if(!sections.length||!sections.every(section=>approved.has(section)))return NextResponse.json({error:'Aprove cada seção na tela Examinar.'},{status:409});
  }
  if(status==='IN_REVIEW'){
    if(isVisitReport(inspection)){
      if(user.id!==inspection.inspector_id)return NextResponse.json({error:'O RT responsável deve enviar o relatório.'},{status:403});
      if(!submitted.length)return NextResponse.json({error:'Preencha ao menos uma seção antes de enviar.'},{status:409});
      const answers=db.prepare('SELECT item_id,answer FROM responses WHERE inspection_id=? AND is_current=1').all(id) as AnswerRow[];
      const applicable=applicableItems(inspectionTemplateItems(inspection.template_snapshot,inspection.template_id),answers);
      if(applicable.some(item=>item.condition_json&&!answers.some(answer=>answer.item_id===item.id)))return NextResponse.json({error:'Conclua as perguntas condicionais habilitadas.'},{status:409});
    }else if(inspection.progress<100)return NextResponse.json({error:'Conclua respostas e evidências obrigatórias'},{status:409});
  }
  db.exec('BEGIN IMMEDIATE');try{
    db.prepare('UPDATE inspections SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,id);
    if(status==='IN_REVIEW'){
      const now=new Date().toISOString(),received=inspection.received_at||now;
      db.prepare('UPDATE inspections SET received_at=?,send_due_date=? WHERE id=?').run(received,inspection.send_due_date||sendDeadline(saoPauloDate(received)),id);
      for(const section of sections)db.prepare("INSERT INTO report_section_reviews(inspection_id,section) VALUES(?,?) ON CONFLICT(inspection_id,section) DO UPDATE SET status=CASE WHEN status='APPROVED' THEN status ELSE 'PENDING' END").run(id,section);
    }
    if(status==='IN_PROGRESS')db.prepare('INSERT INTO inspection_sessions(id,inspection_id,inspector_id,started_at) VALUES(?,?,?,?)').run(uid('ses'),id,inspection.inspector_id||user.id,new Date().toISOString());
    if(['IN_REVIEW','CANCELLED'].includes(status))db.prepare("UPDATE inspection_sessions SET status='CLOSED',ended_at=? WHERE inspection_id=? AND status='OPEN'").run(new Date().toISOString(),id);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error}
  audit(user.id,inspection.company_id,'STATUS_CHANGED','inspection',id,id,{status:inspection.status},{status});return NextResponse.redirect(appUrl(req,isVisitReport(inspection)||form.get('report_view')==='1'?`/relatorios/${id}`:`/inspecoes/${id}`),303);
}
