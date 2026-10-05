import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl,publicOrigin} from '@/lib/http';

const schema=z.object({maps_url:z.string().trim().max(1000).optional(),contact_name:z.string().trim().max(160).optional(),contact_email:z.string().trim().max(320).optional(),contact_phones:z.string().trim().max(160).optional(),form_url:z.string().trim().max(1000).optional(),responsible_id:z.string().optional(),name:z.string().trim().min(2).max(140),code:z.string().trim().min(2).max(20).transform(value=>value.toUpperCase()),address:z.string().trim().max(240).optional(),city:z.string().trim().max(100).optional(),state:z.string().trim().length(2).transform(value=>value.toUpperCase()).optional().or(z.literal('')),active:z.enum(['0','1'])});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await currentUser();if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);if(actor.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão.'},{status:403});
  const origin=req.headers.get('origin');if(origin&&origin!==publicOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
  const {id}=await params;const old=db.prepare('SELECT * FROM units WHERE id=?').get(id) as {company_id:string;responsible_id:string|null;maps_url:string|null;contact_name:string|null;contact_email:string|null;contact_phones:string|null;form_url:string|null;[key:string]:unknown}|undefined;
  if(!old||actor.role!=='SUPER_ADMIN'&&old.company_id!==actor.company_id)return NextResponse.json({error:'Unidade não encontrada.'},{status:404});
  const form=await req.formData();const intent=String(form.get('intent')||'update');
  if(intent==='deactivate'){
    db.prepare('UPDATE units SET active=0 WHERE id=?').run(id);audit(actor.id,old.company_id,'UNIT_DEACTIVATED','unit',id,undefined,old,{active:0});
    return NextResponse.redirect(appUrl(req,`/unidades/${id}?ok=desativada`),303);
  }
  const parsed=schema.safeParse(Object.fromEntries(form));if(!parsed.success)return NextResponse.redirect(appUrl(req,`/unidades/${id}?erro=campos`),303);
  if(parsed.data.responsible_id&&!db.prepare("SELECT id FROM users WHERE id=? AND company_id=? AND role='INSPECTOR'").get(parsed.data.responsible_id,old.company_id))return NextResponse.json({error:'Responsável inválido.'},{status:400});
  if(db.prepare('SELECT id FROM units WHERE company_id=? AND code=? AND id<>?').get(old.company_id,parsed.data.code,id))return NextResponse.redirect(appUrl(req,`/unidades/${id}?erro=codigo`),303);
  db.prepare('UPDATE units SET name=?,code=?,address=?,city=?,state=?,active=?,responsible_id=?,maps_url=?,contact_name=?,contact_email=?,contact_phones=?,form_url=? WHERE id=?').run(parsed.data.name,parsed.data.code,parsed.data.address||null,parsed.data.city||null,parsed.data.state||null,Number(parsed.data.active),parsed.data.responsible_id||null,parsed.data.maps_url??old.maps_url??null,parsed.data.contact_name??old.contact_name??null,parsed.data.contact_email??old.contact_email??null,parsed.data.contact_phones??old.contact_phones??null,parsed.data.form_url??old.form_url??null,id);
  audit(actor.id,old.company_id,'UNIT_UPDATED','unit',id,undefined,old,parsed.data);return NextResponse.redirect(appUrl(req,'/unidades?ok=atualizada'),303);
}
