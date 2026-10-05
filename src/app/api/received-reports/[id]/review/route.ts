import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl,publicOrigin} from '@/lib/http';
import {applicableItems,filledItems,sectionOf,type AnswerRow} from '@/lib/received-reports';
import {inspectionTemplateItems} from '@/lib/inspection-template';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Entre novamente.'},{status:401});
  if(user.role==='INSPECTOR')return NextResponse.json({error:'Somente o coordenador pode revisar.'},{status:403});
  const origin=req.headers.get('origin');if(origin&&origin!==publicOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
  const {id}=await params;
  const inspection=db.prepare('SELECT * FROM inspections WHERE id=?').get(id) as {id:string;company_id:string;inspector_id:string;status:string;template_id:string;template_snapshot:string|null}|undefined;
  if(!inspection||user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id)return NextResponse.json({error:'Relatório não encontrado.'},{status:404});
  if(inspection.status!=='IN_REVIEW')return NextResponse.json({error:'O relatório não está em revisão.'},{status:409});
  const parsed=z.object({section:z.string().min(1),decision:z.enum(['APPROVED','REJECTED']),note:z.string().trim().max(2000).default('')}).safeParse(Object.fromEntries(await req.formData()));
  if(!parsed.success)return NextResponse.json({error:'Revise os dados.'},{status:400});
  const sections=[...new Set(filledItems(inspection).map(sectionOf))];
  const {section,decision,note}=parsed.data;
  if(!sections.includes(section)||decision==='REJECTED'&&!note)return NextResponse.json({error:'Informe uma seção preenchida e o motivo da reprovação.'},{status:400});
  const old=db.prepare('SELECT * FROM report_section_reviews WHERE inspection_id=? AND section=?').get(id,section);
  db.exec('BEGIN IMMEDIATE');try{
    if((db.prepare('SELECT status FROM inspections WHERE id=?').get(id) as {status:string}).status!=='IN_REVIEW'){db.exec('ROLLBACK');return NextResponse.json({error:'O relatório mudou de situação. Reabra a página.'},{status:409});}
    const current=db.prepare('SELECT item_id,answer FROM responses WHERE inspection_id=? AND is_current=1').all(id) as AnswerRow[];
    const answered=new Set(current.map(answer=>answer.item_id));
    if(decision==='APPROVED'&&applicableItems(inspectionTemplateItems(inspection.template_snapshot,inspection.template_id),current).some(item=>item.condition_json&&sectionOf(item)===section&&!answered.has(item.id))){db.exec('ROLLBACK');return NextResponse.json({error:'Há uma pergunta condicional sem resposta nesta seção. Devolva ao RT para completar.'},{status:409});}
    db.prepare('INSERT INTO report_section_reviews(inspection_id,section,status,note,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(inspection_id,section) DO UPDATE SET status=excluded.status,note=excluded.note,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at').run(id,section,decision,note,user.id);
    const approved=new Set((db.prepare("SELECT section FROM report_section_reviews WHERE inspection_id=? AND status='APPROVED'").all(id) as {section:string}[]).map(row=>row.section));
    const status=decision==='REJECTED'?'CHANGES_REQUESTED':sections.every(value=>approved.has(value))?'APPROVED':'IN_REVIEW';
    db.prepare("UPDATE inspections SET status=?,progress=CASE WHEN ?='APPROVED' THEN 100 ELSE progress END,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status,status,id);
    audit(user.id,inspection.company_id,'REPORT_SECTION_REVIEWED','report_section',section,id,old,{decision,note,status});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return NextResponse.redirect(appUrl(req,`/relatorios/${id}?revisado=1#${encodeURIComponent(section)}`),303);
}
