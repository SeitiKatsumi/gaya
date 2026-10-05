import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {saoPauloToday,validDate} from '@/lib/calendar';
import {filledItems,sectionOf} from '@/lib/received-reports';
import {buildReportPdf,reportInspection,reportStorage,type ExportInspection} from '@/lib/report-export';
import {uid} from '@/lib/utils';
import {reportRecipients} from '@/lib/report-recipients';

export const runtime='nodejs';
function allSectionsApproved(inspection:ExportInspection){const sections=[...new Set(filledItems(inspection).map(sectionOf))],approved=new Set((db.prepare("SELECT section FROM report_section_reviews WHERE inspection_id=? AND status='APPROVED'").all(inspection.id) as {section:string}[]).map(row=>row.section));return !!sections.length&&sections.every(section=>approved.has(section));}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Entre novamente.'},{status:401});
  if(user.role==='INSPECTOR')return NextResponse.json({error:'Somente o coordenador pode registrar o envio.'},{status:403});
  const origin=req.headers.get('origin'),expectedOrigin=new URL(process.env.APP_URL||req.url).origin;if(origin&&origin!==expectedOrigin)return NextResponse.json({error:'Origem inválida.'},{status:403});
  const {id}=await params,inspection=reportInspection(id);if(!inspection||user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id)return NextResponse.json({error:'Relatório não encontrado.'},{status:404});
  if(inspection.status!=='APPROVED'||!allSectionsApproved(inspection))return NextResponse.json({error:'Aprove todas as seções do relatório antes de registrar o envio.'},{status:409});
  const parsed=z.object({sent_at:z.string().refine(date=>validDate(date)&&date<=saoPauloToday()),recipient:reportRecipients.default(''),confirmation:z.literal('sent')}).safeParse(Object.fromEntries(await req.formData()));
  if(!parsed.success)return NextResponse.json({error:'Informe uma data válida, um destinatário válido e confirme o envio já realizado.'},{status:400});
  const destination=()=>NextResponse.redirect(appUrl(req,'/relatorios-enviados?registrado=1'),303);
  if(db.prepare("SELECT id FROM reports WHERE inspection_id=? AND status='SENT'").get(id))return destination();
  const reportId=uid('rpt'),folder=path.join(reportStorage(),'reports'),file=path.join(folder,reportId+'.pdf');let written=false,saved=false,transaction=false;
  try{
    const pdf=await buildReportPdf(inspection);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(file,pdf,{flag:'wx'});written=true;
    db.exec('BEGIN IMMEDIATE');transaction=true;
    const fresh=reportInspection(id);if(!fresh||user.role!=='SUPER_ADMIN'&&fresh.company_id!==user.company_id||fresh.status!=='APPROVED'||!allSectionsApproved(fresh)){db.exec('ROLLBACK');transaction=false;return NextResponse.json({error:'O relatório mudou de situação. Reabra a página.'},{status:409});}
    if(db.prepare("SELECT id FROM reports WHERE inspection_id=? AND status='SENT'").get(id)){db.exec('ROLLBACK');transaction=false;return destination();}
    db.prepare("INSERT INTO reports(id,inspection_id,version,path,status,generated_by,sent_at,recipient,delivery_method) VALUES(?,?,1,?,'SENT',?,?,?,'MANUAL')").run(reportId,id,file,user.id,parsed.data.sent_at,parsed.data.recipient||null);
    audit(user.id,fresh.company_id,'REPORT_SENT_EXTERNALLY','report',reportId,id,undefined,{sent_at:parsed.data.sent_at,recipient:parsed.data.recipient||null,delivery_method:'MANUAL'});
    db.exec('COMMIT');transaction=false;saved=true;return destination();
  }catch(error){if(transaction)db.exec('ROLLBACK');console.error('report_send_registration_failed',{inspectionId:id,message:error instanceof Error?error.message:'unknown'});return NextResponse.json({error:'Não foi possível registrar o envio. Tente novamente.'},{status:500});}
  finally{if(written&&!saved)try{fs.unlinkSync(file);}catch(error){console.error('report_snapshot_cleanup_failed',{reportId,message:error instanceof Error?error.message:'unknown'});}}
}
