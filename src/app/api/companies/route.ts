import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {uid} from '@/lib/utils';

const schema=z.object({
  legal_name:z.string().trim().min(3).max(180),
  trade_name:z.string().trim().min(2).max(120),
  document:z.string().trim().min(5).max(30),
  unit_name:z.string().trim().min(2).max(140),
  unit_code:z.string().trim().min(2).max(20).transform(value=>value.toUpperCase()),
  address:z.string().trim().max(240).optional(),
  city:z.string().trim().max(100).optional(),
  state:z.string().trim().length(2).transform(value=>value.toUpperCase()).optional().or(z.literal('')),
});

export async function POST(req:Request){
  const actor=await currentUser();
  if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);
  if(actor.role!=='SUPER_ADMIN')return NextResponse.json({error:'Apenas o Super Admin pode cadastrar empresas.'},{status:403});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData()));
  if(!parsed.success)return NextResponse.redirect(appUrl(req,'/empresas/nova?erro=campos'),303);
  if(db.prepare('SELECT id FROM companies WHERE lower(document)=lower(?)').get(parsed.data.document))return NextResponse.redirect(appUrl(req,'/empresas/nova?erro=documento'),303);
  const companyId=uid('cmp');
  const unitId=uid('unt');
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare('INSERT INTO companies(id,legal_name,trade_name,document) VALUES(?,?,?,?)').run(companyId,parsed.data.legal_name,parsed.data.trade_name,parsed.data.document);
    db.prepare('INSERT INTO units(id,company_id,name,code,address,city,state) VALUES(?,?,?,?,?,?,?)').run(unitId,companyId,parsed.data.unit_name,parsed.data.unit_code,parsed.data.address||null,parsed.data.city||null,parsed.data.state||null);
    audit(actor.id,companyId,'COMPANY_CREATED','company',companyId,undefined,undefined,{legal_name:parsed.data.legal_name,trade_name:parsed.data.trade_name,document:parsed.data.document,initial_unit:parsed.data.unit_code});
    db.exec('COMMIT');
  }catch(error){
    db.exec('ROLLBACK');
    throw error;
  }
  return NextResponse.redirect(appUrl(req,`/empresas/${companyId}?ok=empresa`),303);
}
