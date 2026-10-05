import fs from 'node:fs';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {reportStorage} from '@/lib/report-export';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Entre novamente.'},{status:401});
  const {id}=await params,row=db.prepare("SELECT r.path,i.company_id,i.inspector_id,i.control_code FROM reports r JOIN inspections i ON i.id=r.inspection_id WHERE r.id=? AND r.status='SENT'").get(id) as {path:string;company_id:string;inspector_id:string|null;control_code:string}|undefined;
  if(!row||user.role!=='SUPER_ADMIN'&&row.company_id!==user.company_id||user.role==='INSPECTOR'&&row.inspector_id!==user.id)return NextResponse.json({error:'Arquivo não encontrado.'},{status:404});
  const full=path.resolve(/*turbopackIgnore: true*/ row.path),root=reportStorage();if(!full.startsWith(root+path.sep))return NextResponse.json({error:'Arquivo indisponível.'},{status:404});
  try{const pdf=fs.readFileSync(full),filename=(row.control_code.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]/g,'-').slice(0,100)||'relatorio')+'.pdf';return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':String(pdf.length),'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});}catch{return NextResponse.json({error:'Arquivo indisponível.'},{status:404});}
}
