import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';

const schema=z.object({
  legal_name:z.string().trim().min(3).max(180),
  trade_name:z.string().trim().min(2).max(120),
  document:z.string().trim().min(5).max(30),
  active:z.enum(['0','1']),
});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await currentUser();
  if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);
  if(actor.role!=='SUPER_ADMIN')return NextResponse.json({error:'Apenas o Super Admin pode editar empresas.'},{status:403});
  const {id}=await params;
  const old=db.prepare('SELECT * FROM companies WHERE id=?').get(id) as Record<string,unknown>|undefined;
  if(!old)return NextResponse.json({error:'Empresa não encontrada.'},{status:404});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData()));
  if(!parsed.success)return NextResponse.redirect(appUrl(req,`/empresas/${id}?erro=campos`),303);
  if(db.prepare('SELECT id FROM companies WHERE lower(document)=lower(?) AND id<>?').get(parsed.data.document,id))return NextResponse.redirect(appUrl(req,`/empresas/${id}?erro=documento`),303);
  db.prepare('UPDATE companies SET legal_name=?,trade_name=?,document=?,active=? WHERE id=?').run(parsed.data.legal_name,parsed.data.trade_name,parsed.data.document,Number(parsed.data.active),id);
  audit(actor.id,id,'COMPANY_UPDATED','company',id,undefined,old,parsed.data);
  return NextResponse.redirect(appUrl(req,`/empresas/${id}?ok=empresa`),303);
}
