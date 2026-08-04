import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';

const schema=z.object({name:z.string().trim().min(3).max(160),description:z.string().max(1000).optional(),status:z.enum(['PLANNING','ACTIVE','PAUSED','COMPLETED','ARCHIVED']),unit_id:z.string().optional(),manager_id:z.string().optional(),start_date:z.string().optional(),end_date:z.string().optional()});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return NextResponse.redirect(appUrl(req,'/login'),303);if(user.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão'},{status:403});
  const {id}=await params;const project=db.prepare('SELECT * FROM projects WHERE id=?').get(id) as {company_id:string;[key:string]:unknown}|undefined;
  if(!project||(user.role!=='SUPER_ADMIN'&&project.company_id!==user.company_id))return NextResponse.json({error:'Sem permissão'},{status:403});
  const form=await req.formData();const intent=String(form.get('intent')||'update');
  if(intent==='archive'){
    db.prepare("UPDATE projects SET status='ARCHIVED',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);audit(user.id,project.company_id,'PROJECT_ARCHIVED','project',id,undefined,project,{status:'ARCHIVED'});
    return NextResponse.redirect(appUrl(req,`/projetos/${id}?ok=arquivado`),303);
  }
  const parsed=schema.safeParse(Object.fromEntries(form));if(!parsed.success)return NextResponse.redirect(appUrl(req,`/projetos/${id}?erro=campos`),303);
  if(parsed.data.unit_id&&!db.prepare('SELECT id FROM units WHERE id=? AND company_id=?').get(parsed.data.unit_id,project.company_id))return NextResponse.json({error:'Unidade inválida'},{status:400});
  if(parsed.data.manager_id&&!db.prepare("SELECT id FROM users WHERE id=? AND (company_id=? OR role='SUPER_ADMIN')").get(parsed.data.manager_id,project.company_id))return NextResponse.json({error:'Gestor inválido'},{status:400});
  db.prepare('UPDATE projects SET name=?,description=?,status=?,unit_id=?,manager_id=?,start_date=?,end_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(parsed.data.name,parsed.data.description||null,parsed.data.status,parsed.data.unit_id||null,parsed.data.manager_id||null,parsed.data.start_date||null,parsed.data.end_date||null,id);
  audit(user.id,project.company_id,'PROJECT_UPDATED','project',id,undefined,project,parsed.data);return NextResponse.redirect(appUrl(req,`/projetos/${id}?ok=1`),303);
}
