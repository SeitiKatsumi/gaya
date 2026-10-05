import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl,publicOrigin} from '@/lib/http';
import {reportRecipients} from '@/lib/report-recipients';

export async function POST(req:Request){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Faça login.'},{status:401});
  if(user.role==='INSPECTOR')return NextResponse.json({error:'Somente a coordenação pode editar os destinatários.'},{status:403});
  const origin=req.headers.get('origin');if(origin&&origin!==publicOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
  const form=await req.formData(),companyId=String(form.get('company_id')||''),recipients=reportRecipients.safeParse(form.get('recipients'));
  const company=db.prepare('SELECT id,report_recipients FROM companies WHERE id=? AND active=1').get(companyId) as {id:string;report_recipients:string}|undefined;
  if(!company||user.role!=='SUPER_ADMIN'&&companyId!==user.company_id)return NextResponse.json({error:'Empresa não encontrada.'},{status:404});
  if(!recipients.success)return NextResponse.json({error:'Informe até dois emails válidos, separados por vírgula.'},{status:400});
  db.exec('BEGIN IMMEDIATE');try{
    db.prepare('UPDATE companies SET report_recipients=? WHERE id=?').run(recipients.data,companyId);
    audit(user.id,companyId,'REPORT_RECIPIENTS_UPDATED','company',companyId,undefined,{recipients:company.report_recipients},{recipients:recipients.data});db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return NextResponse.redirect(appUrl(req,'/relatorios-enviados?destinatarios=1'),303);
}
