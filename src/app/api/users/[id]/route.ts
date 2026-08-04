import bcrypt from 'bcryptjs';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';

const schema=z.object({name:z.string().trim().min(3).max(120),password:z.string().max(128).optional(),role:z.enum(['SUPER_ADMIN','SUPERVISOR','INSPECTOR']),active:z.enum(['0','1'])});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await currentUser();if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);if(actor.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão'},{status:403});
  const {id}=await params;
  const target=db.prepare('SELECT id,company_id,name,role,active FROM users WHERE id=?').get(id) as {id:string;company_id:string|null;name:string;role:string;active:number}|undefined;
  if(!target||(actor.role!=='SUPER_ADMIN'&&target.company_id!==actor.company_id)||actor.role==='SUPERVISOR'&&target.role==='SUPER_ADMIN')return NextResponse.json({error:'Sem permissão'},{status:403});
  const form=await req.formData();const intent=String(form.get('intent')||'update');
  if(intent==='deactivate'){
    if(id===actor.id)return NextResponse.redirect(appUrl(req,`/usuarios/${id}?erro=propria-conta`),303);
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(id);audit(actor.id,target.company_id,'USER_DEACTIVATED','user',id,undefined,target,{active:0});
    return NextResponse.redirect(appUrl(req,`/usuarios/${id}?ok=desativado`),303);
  }
  const parsed=schema.safeParse(Object.fromEntries(form));
  if(!parsed.success||parsed.data.password&&(parsed.data.password.length<8||!/[A-Za-z]/.test(parsed.data.password)||!/[0-9]/.test(parsed.data.password)))return NextResponse.redirect(appUrl(req,`/usuarios/${id}?erro=campos`),303);
  if(actor.role==='SUPERVISOR'&&parsed.data.role==='SUPER_ADMIN')return NextResponse.json({error:'Sem permissão'},{status:403});
  const active=id===actor.id?1:Number(parsed.data.active);
  if(parsed.data.password)db.prepare('UPDATE users SET name=?,role=?,active=?,password_hash=? WHERE id=?').run(parsed.data.name,parsed.data.role,active,bcrypt.hashSync(parsed.data.password,10),id);
  else db.prepare('UPDATE users SET name=?,role=?,active=? WHERE id=?').run(parsed.data.name,parsed.data.role,active,id);
  audit(actor.id,target.company_id,'USER_UPDATED','user',id,undefined,target,{name:parsed.data.name,role:parsed.data.role,active});
  return NextResponse.redirect(appUrl(req,`/usuarios/${id}?ok=1`),303);
}
