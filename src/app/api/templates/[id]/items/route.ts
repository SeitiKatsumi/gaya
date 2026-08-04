import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {uid} from '@/lib/utils';

const schema=z.object({area:z.string().trim().min(2).max(80),section:z.string().max(80).optional(),code:z.string().trim().min(2).max(30).transform(value=>value.toUpperCase()),title:z.string().trim().min(5).max(300),guidance:z.string().max(1000).optional(),criticality:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),expected_answer:z.enum(['Sim','Não','Não se aplica']),photo_required:z.string().optional(),audio_required:z.string().optional()});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return NextResponse.redirect(appUrl(req,'/login'),303);if(user.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão'},{status:403});
  const {id}=await params;
  const template=db.prepare('SELECT * FROM templates WHERE id=?').get(id) as {company_id:string|null;is_global:number}|undefined;
  if(!template||template.is_global||user.role!=='SUPER_ADMIN'&&template.company_id!==user.company_id)return NextResponse.json({error:'Sem permissão'},{status:403});
  const parsed=schema.safeParse(Object.fromEntries(await req.formData()));if(!parsed.success)return NextResponse.redirect(appUrl(req,`/modelos/${id}?erro=campos`),303);
  if(db.prepare('SELECT id FROM template_items WHERE template_id=? AND code=? AND active=1').get(id,parsed.data.code))return NextResponse.redirect(appUrl(req,`/modelos/${id}?erro=codigo`),303);
  const sort=((db.prepare('SELECT coalesce(max(sort_order),0) n FROM template_items WHERE template_id=?').get(id) as {n:number}).n)+1;
  const itemId=uid('itm');
  db.exec('BEGIN IMMEDIATE');try{
    db.prepare('INSERT INTO template_items(id,template_id,area,section,code,title,guidance,expected_answer,criticality,photo_required,audio_required,sort_order,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)').run(itemId,id,parsed.data.area,parsed.data.section||null,parsed.data.code,parsed.data.title,parsed.data.guidance||null,parsed.data.expected_answer,parsed.data.criticality,parsed.data.photo_required==='1'?1:0,parsed.data.audio_required==='1'?1:0,sort);
    db.prepare('UPDATE templates SET version=version+1 WHERE id=?').run(id);db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error}
  audit(user.id,template.company_id,'TEMPLATE_ITEM_CREATED','template_item',itemId,undefined,undefined,{template_id:id,code:parsed.data.code});
  return NextResponse.redirect(appUrl(req,`/modelos/${id}?ok=1`),303);
}
