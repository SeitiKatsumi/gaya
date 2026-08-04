import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { audit, db } from '@/lib/db';
import { uid } from '@/lib/utils';

const schema=z.object({name:z.string().trim().min(3).max(120),email:z.email().transform(v=>v.trim().toLowerCase()),password:z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),company_id:z.string().optional(),role:z.enum(['SUPER_ADMIN','SUPERVISOR','INSPECTOR'])});
export async function POST(req:Request){
  const actor=await currentUser(); if(!actor)return NextResponse.redirect(new URL('/login',req.url),303); if(actor.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão'},{status:403});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData())); if(!parsed.success)return NextResponse.redirect(new URL('/usuarios/novo?erro=campos',req.url),303);
  if(actor.role==='SUPERVISOR'&&parsed.data.role==='SUPER_ADMIN')return NextResponse.json({error:'Sem permissão'},{status:403});
  const companyId=actor.role==='SUPER_ADMIN'?(parsed.data.role==='SUPER_ADMIN'?null:parsed.data.company_id||null):actor.company_id;
  if(parsed.data.role!=='SUPER_ADMIN'&&!companyId)return NextResponse.redirect(new URL('/usuarios/novo?erro=campos',req.url),303);
  if(companyId&&!db.prepare('SELECT id FROM companies WHERE id=? AND active=1').get(companyId))return NextResponse.json({error:'Empresa inválida'},{status:400});
  if(db.prepare('SELECT id FROM users WHERE lower(email)=?').get(parsed.data.email))return NextResponse.redirect(new URL('/usuarios/novo?erro=email',req.url),303);
  const id=uid('usr');
  db.prepare('INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)').run(id,companyId,parsed.data.name,parsed.data.email,bcrypt.hashSync(parsed.data.password,10),parsed.data.role);
  audit(actor.id,companyId,'USER_CREATED','user',id,undefined,undefined,{name:parsed.data.name,email:parsed.data.email,role:parsed.data.role});
  return NextResponse.redirect(new URL(`/usuarios/${id}?ok=1`,req.url),303);
}
