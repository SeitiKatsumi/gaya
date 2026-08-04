import bcrypt from 'bcryptjs';
import {NextResponse} from 'next/server';
import {audit,db} from '@/lib/db';
import {createToken,type SessionUser} from '@/lib/auth';
import {appUrl,publicOrigin} from '@/lib/http';

export async function POST(req:Request){
  const form=await req.formData();const email=String(form.get('email')||'').toLowerCase();const password=String(form.get('password')||'');
  const row=db.prepare("SELECT u.id,u.company_id,u.name,u.email,u.role,u.password_hash FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.email=? AND u.active=1 AND (u.role='SUPER_ADMIN' OR c.active=1)").get(email) as (SessionUser&{password_hash:string})|undefined;
  if(!row||!bcrypt.compareSync(password,row.password_hash))return NextResponse.redirect(appUrl(req,'/login?erro=1'),303);
  const user:SessionUser={id:row.id,company_id:row.company_id,name:row.name,email:row.email,role:row.role};const base=publicOrigin(req);const res=NextResponse.redirect(appUrl(req,'/dashboard'),303);
  res.cookies.set('gaya_session',await createToken(user),{httpOnly:true,sameSite:'lax',secure:base.startsWith('https://'),path:'/',maxAge:43200});audit(user.id,user.company_id,'LOGIN','session',user.id);return res;
}
