import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl,publicOrigin} from '@/lib/http';
import {uid} from '@/lib/utils';
import {validDate} from '@/lib/calendar';
import {ensureVisitTemplate,visitTemplateId} from '@/lib/received-reports';

export async function POST(req:Request){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Entre novamente.'},{status:401});
  const origin=req.headers.get('origin');if(origin&&origin!==publicOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
  const form=Object.fromEntries(await req.formData());
  const parsed=z.object({unit_id:z.string().min(1),visit_date:z.string().refine(validDate)}).safeParse(form);
  if(!parsed.success)return NextResponse.redirect(appUrl(req,'/relatorios/novo?erro=campos'),303);
  const unit=db.prepare("SELECT u.id,u.company_id,u.code,u.responsible_id FROM units u JOIN companies c ON c.id=u.company_id JOIN users r ON r.id=u.responsible_id WHERE u.id=? AND u.active=1 AND c.active=1 AND r.active=1 AND r.role='INSPECTOR' AND r.company_id=u.company_id").get(parsed.data.unit_id) as {id:string;company_id:string;code:string;responsible_id:string}|undefined;
  if(!unit||user.role!=='SUPER_ADMIN'&&unit.company_id!==user.company_id||user.role==='INSPECTOR'&&unit.responsible_id!==user.id)return NextResponse.json({error:'Unidade ou responsável técnico indisponível.'},{status:403});
  ensureVisitTemplate();
  const items=db.prepare('SELECT * FROM template_items WHERE template_id=? ORDER BY sort_order').all(visitTemplateId);
  const id=uid('ins'),code=`RT-${unit.code}-${parsed.data.visit_date}-${id.slice(-8)}`;
  db.prepare("INSERT INTO inspections(id,company_id,unit_id,template_id,control_code,title,status,supervisor_id,inspector_id,planned_start,planned_end,template_snapshot) VALUES(?,?,?,?,?,?,'IN_PROGRESS',?,?,?,?,?)").run(id,unit.company_id,unit.id,visitTemplateId,code,`Relatório de ${unit.code}`,user.role==='INSPECTOR'?null:user.id,unit.responsible_id,parsed.data.visit_date,parsed.data.visit_date,JSON.stringify({templateId:visitTemplateId,version:1,items}));
  audit(user.id,unit.company_id,'VISIT_REPORT_CREATED','inspection',id,id,undefined,{code});
  return NextResponse.redirect(appUrl(req,`/relatorios/${id}`),303);
}
