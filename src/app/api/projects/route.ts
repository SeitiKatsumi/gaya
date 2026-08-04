import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {uid} from '@/lib/utils';

const schema=z.object({company_id:z.string().optional(),code:z.string().trim().min(2).max(30).transform(value=>value.toUpperCase()),name:z.string().trim().min(3).max(160),description:z.string().max(1000).optional(),unit_id:z.string().optional(),manager_id:z.string().optional(),start_date:z.string().optional(),end_date:z.string().optional()});

export async function POST(req:Request){
  const user=await currentUser();if(!user)return NextResponse.redirect(appUrl(req,'/login'),303);if(user.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão'},{status:403});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData()));if(!parsed.success)return NextResponse.redirect(appUrl(req,'/projetos/novo?erro=campos'),303);
  const companyId=user.role==='SUPER_ADMIN'?parsed.data.company_id:user.company_id;
  if(!companyId||!db.prepare('SELECT id FROM companies WHERE id=? AND active=1').get(companyId))return NextResponse.redirect(appUrl(req,'/projetos/novo?erro=empresa'),303);
  if(parsed.data.unit_id&&!db.prepare('SELECT id FROM units WHERE id=? AND company_id=? AND active=1').get(parsed.data.unit_id,companyId))return NextResponse.json({error:'Unidade inválida'},{status:400});
  if(parsed.data.manager_id&&!db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND (company_id=? OR role='SUPER_ADMIN')").get(parsed.data.manager_id,companyId))return NextResponse.json({error:'Gestor inválido'},{status:400});
  if(db.prepare('SELECT id FROM projects WHERE company_id=? AND code=?').get(companyId,parsed.data.code))return NextResponse.redirect(appUrl(req,'/projetos/novo?erro=codigo'),303);
  const id=uid('prj');db.prepare('INSERT INTO projects(id,company_id,unit_id,code,name,description,status,manager_id,start_date,end_date,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,companyId,parsed.data.unit_id||null,parsed.data.code,parsed.data.name,parsed.data.description||null,'ACTIVE',parsed.data.manager_id||null,parsed.data.start_date||null,parsed.data.end_date||null,user.id);
  audit(user.id,companyId,'PROJECT_CREATED','project',id,undefined,undefined,{code:parsed.data.code,name:parsed.data.name});return NextResponse.redirect(appUrl(req,`/projetos/${id}?ok=1`),303);
}
