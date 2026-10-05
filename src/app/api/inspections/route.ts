import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {uid} from '@/lib/utils';

const schema=z.object({project_id:z.string().optional(),unit_id:z.string().min(1),template_id:z.string().min(1),title:z.string().min(3),inspector_id:z.string().min(1),priority:z.enum(['NORMAL','HIGH','URGENT']),planned_start:z.string(),planned_end:z.string(),objective:z.string(),scope:z.string()});

export async function POST(req:Request){
  const user=await currentUser();if(!user)return NextResponse.redirect(appUrl(req,'/login'),303);if(user.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão'},{status:403});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData()));if(!parsed.success)return NextResponse.redirect(appUrl(req,'/inspecoes/nova?erro=1'),303);
  const unit=db.prepare('SELECT u.* FROM units u JOIN companies c ON c.id=u.company_id WHERE u.id=? AND u.active=1 AND c.active=1').get(parsed.data.unit_id) as any;
  if(!unit||(user.role!=='SUPER_ADMIN'&&unit.company_id!==user.company_id))return NextResponse.json({error:'Unidade inválida'},{status:403});
  const template=db.prepare("SELECT * FROM templates WHERE id=? AND status='PUBLISHED'").get(parsed.data.template_id) as any;
  if(!template||!template.is_global&&template.company_id!==unit.company_id)return NextResponse.json({error:'Modelo inválido'},{status:400});
  const items=db.prepare('SELECT * FROM template_items WHERE template_id=? AND active=1 ORDER BY sort_order').all(template.id);
  if(!items.length)return NextResponse.json({error:'O modelo não possui itens ativos'},{status:400});
  if(!db.prepare("SELECT id FROM users WHERE id=? AND company_id=? AND role='INSPECTOR' AND active=1").get(parsed.data.inspector_id,unit.company_id))return NextResponse.json({error:'Responsável técnico inválido'},{status:400});
  if(parsed.data.project_id&&!db.prepare("SELECT id FROM projects WHERE id=? AND company_id=? AND status IN ('PLANNING','ACTIVE')").get(parsed.data.project_id,unit.company_id))return NextResponse.json({error:'Projeto inválido'},{status:400});
  const id=uid('ins');const month=String(new Date().getMonth()+1).padStart(2,'0');const count=(db.prepare('SELECT count(*) n FROM inspections WHERE company_id=?').get(unit.company_id) as {n:number}).n+1;const code=`RQ-${unit.code}.${month}/${new Date().getFullYear()}-${String(count).padStart(2,'0')}`;
  const snapshot=JSON.stringify({templateId:template.id,version:template.version,items});
  db.prepare('INSERT INTO inspections(id,company_id,unit_id,project_id,template_id,control_code,title,objective,scope,status,priority,supervisor_id,inspector_id,planned_start,planned_end,template_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,unit.company_id,unit.id,parsed.data.project_id||null,template.id,code,parsed.data.title,parsed.data.objective,parsed.data.scope,'SCHEDULED',parsed.data.priority,user.id,parsed.data.inspector_id,parsed.data.planned_start,parsed.data.planned_end,snapshot);
  audit(user.id,unit.company_id,'INSPECTION_CREATED','inspection',id,id,undefined,{code,project_id:parsed.data.project_id||null});return NextResponse.redirect(appUrl(req,`/inspecoes/${id}`),303);
}
