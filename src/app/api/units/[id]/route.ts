import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';

const schema=z.object({
  name:z.string().trim().min(2).max(140),
  code:z.string().trim().min(2).max(20).transform(value=>value.toUpperCase()),
  address:z.string().trim().max(240).optional(),
  city:z.string().trim().max(100).optional(),
  state:z.string().trim().length(2).transform(value=>value.toUpperCase()).optional().or(z.literal('')),
  active:z.enum(['0','1']),
});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await currentUser();
  if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);
  if(actor.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão.'},{status:403});
  const {id}=await params;
  const old=db.prepare('SELECT * FROM units WHERE id=?').get(id) as {company_id:string;[key:string]:unknown}|undefined;
  if(!old||actor.role!=='SUPER_ADMIN'&&old.company_id!==actor.company_id)return NextResponse.json({error:'Unidade não encontrada.'},{status:404});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData()));
  if(!parsed.success)return NextResponse.redirect(appUrl(req,`/unidades/${id}?erro=campos`),303);
  if(db.prepare('SELECT id FROM units WHERE company_id=? AND code=? AND id<>?').get(old.company_id,parsed.data.code,id))return NextResponse.redirect(appUrl(req,`/unidades/${id}?erro=codigo`),303);
  db.prepare('UPDATE units SET name=?,code=?,address=?,city=?,state=?,active=? WHERE id=?').run(parsed.data.name,parsed.data.code,parsed.data.address||null,parsed.data.city||null,parsed.data.state||null,Number(parsed.data.active),id);
  audit(actor.id,old.company_id,'UNIT_UPDATED','unit',id,undefined,old,parsed.data);
  return NextResponse.redirect(appUrl(req,`/unidades/${id}?ok=1`),303);
}
