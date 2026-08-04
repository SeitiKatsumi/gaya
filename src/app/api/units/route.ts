import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {uid} from '@/lib/utils';

const schema=z.object({
  company_id:z.string().optional(),
  name:z.string().trim().min(2).max(140),
  code:z.string().trim().min(2).max(20).transform(value=>value.toUpperCase()),
  address:z.string().trim().max(240).optional(),
  city:z.string().trim().max(100).optional(),
  state:z.string().trim().length(2).transform(value=>value.toUpperCase()).optional().or(z.literal('')),
});

export async function POST(req:Request){
  const actor=await currentUser();
  if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);
  if(actor.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão.'},{status:403});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData()));
  if(!parsed.success)return NextResponse.redirect(appUrl(req,'/unidades/nova?erro=campos'),303);
  const companyId=actor.role==='SUPER_ADMIN'?parsed.data.company_id:actor.company_id;
  if(!companyId||!db.prepare('SELECT id FROM companies WHERE id=? AND active=1').get(companyId))return NextResponse.redirect(appUrl(req,'/unidades/nova?erro=empresa'),303);
  if(db.prepare('SELECT id FROM units WHERE company_id=? AND code=?').get(companyId,parsed.data.code))return NextResponse.redirect(appUrl(req,'/unidades/nova?erro=codigo'),303);
  const id=uid('unt');
  db.prepare('INSERT INTO units(id,company_id,name,code,address,city,state) VALUES(?,?,?,?,?,?,?)').run(id,companyId,parsed.data.name,parsed.data.code,parsed.data.address||null,parsed.data.city||null,parsed.data.state||null);
  audit(actor.id,companyId,'UNIT_CREATED','unit',id,undefined,undefined,{name:parsed.data.name,code:parsed.data.code});
  return NextResponse.redirect(appUrl(req,`/unidades/${id}?ok=1`),303);
}
