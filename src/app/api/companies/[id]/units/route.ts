import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {uid} from '@/lib/utils';

const schema=z.object({
  name:z.string().trim().min(2).max(140),
  code:z.string().trim().min(2).max(20).transform(value=>value.toUpperCase()),
  address:z.string().trim().max(240).optional(),
  city:z.string().trim().max(100).optional(),
  state:z.string().trim().length(2).transform(value=>value.toUpperCase()).optional().or(z.literal('')),
});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await currentUser();
  if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);
  if(actor.role!=='SUPER_ADMIN')return NextResponse.json({error:'Apenas o Super Admin pode cadastrar unidades de empresas.'},{status:403});
  const {id}=await params;
  if(!db.prepare('SELECT id FROM companies WHERE id=?').get(id))return NextResponse.json({error:'Empresa não encontrada.'},{status:404});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData()));
  if(!parsed.success)return NextResponse.redirect(appUrl(req,`/empresas/${id}?erro=unidade`),303);
  if(db.prepare('SELECT id FROM units WHERE company_id=? AND code=?').get(id,parsed.data.code))return NextResponse.redirect(appUrl(req,`/empresas/${id}?erro=codigo`),303);
  const unitId=uid('unt');
  db.prepare('INSERT INTO units(id,company_id,name,code,address,city,state) VALUES(?,?,?,?,?,?,?)').run(unitId,id,parsed.data.name,parsed.data.code,parsed.data.address||null,parsed.data.city||null,parsed.data.state||null);
  audit(actor.id,id,'UNIT_CREATED','unit',unitId,undefined,undefined,{name:parsed.data.name,code:parsed.data.code});
  return NextResponse.redirect(appUrl(req,`/empresas/${id}?ok=unidade`),303);
}
