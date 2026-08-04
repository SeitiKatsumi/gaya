import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';

const schema=z.object({name:z.string().trim().min(3).max(160),category:z.string().trim().min(2).max(80),description:z.string().trim().max(1000).optional(),status:z.enum(['DRAFT','PUBLISHED'])});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await currentUser();if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);
  if(actor.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão'},{status:403});
  const {id}=await params;
  const old=db.prepare('SELECT * FROM templates WHERE id=?').get(id) as {company_id:string|null;is_global:number;[key:string]:unknown}|undefined;
  if(!old||old.is_global||actor.role!=='SUPER_ADMIN'&&old.company_id!==actor.company_id)return NextResponse.json({error:'Sem permissão'},{status:403});
  const form=await req.formData();const intent=String(form.get('intent')||'update');
  if(intent==='archive'){
    db.prepare("UPDATE templates SET status='ARCHIVED',version=version+1 WHERE id=?").run(id);
    audit(actor.id,old.company_id,'TEMPLATE_ARCHIVED','template',id,undefined,old,{status:'ARCHIVED'});
    return NextResponse.redirect(appUrl(req,`/modelos/${id}?ok=modelo-arquivado`),303);
  }
  const parsed=schema.safeParse(Object.fromEntries(form));
  if(!parsed.success)return NextResponse.redirect(appUrl(req,`/modelos/${id}?erro=campos`),303);
  const activeItems=(db.prepare('SELECT count(*) n FROM template_items WHERE template_id=? AND active=1').get(id) as {n:number}).n;
  if(parsed.data.status==='PUBLISHED'&&!activeItems)return NextResponse.redirect(appUrl(req,`/modelos/${id}?erro=itens`),303);
  db.prepare('UPDATE templates SET name=?,category=?,description=?,status=?,version=version+1 WHERE id=?').run(parsed.data.name,parsed.data.category,parsed.data.description||null,parsed.data.status,id);
  audit(actor.id,old.company_id,'TEMPLATE_UPDATED','template',id,undefined,old,parsed.data);
  return NextResponse.redirect(appUrl(req,`/modelos/${id}?ok=modelo`),303);
}
