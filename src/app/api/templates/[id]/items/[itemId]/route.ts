import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';

const schema=z.object({area:z.string().trim().min(2).max(80),section:z.string().trim().max(80).optional(),code:z.string().trim().min(2).max(30).transform(value=>value.toUpperCase()),title:z.string().trim().min(5).max(300),guidance:z.string().trim().max(1000).optional(),criticality:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),expected_answer:z.enum(['Sim','Não','Não se aplica']),photo_required:z.string().optional(),audio_required:z.string().optional()});

export async function POST(req:Request,{params}:{params:Promise<{id:string;itemId:string}>}){
  const actor=await currentUser();if(!actor)return NextResponse.redirect(appUrl(req,'/login'),303);
  if(actor.role==='INSPECTOR')return NextResponse.json({error:'Sem permissão'},{status:403});
  const {id,itemId}=await params;
  const old=db.prepare('SELECT ti.*,t.company_id,t.is_global FROM template_items ti JOIN templates t ON t.id=ti.template_id WHERE ti.id=? AND ti.template_id=?').get(itemId,id) as {company_id:string|null;is_global:number;active:number;[key:string]:unknown}|undefined;
  if(!old||old.is_global||actor.role!=='SUPER_ADMIN'&&old.company_id!==actor.company_id)return NextResponse.json({error:'Sem permissão'},{status:403});
  const form=await req.formData();const intent=String(form.get('intent')||'update');
  if(intent==='delete'){
    db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE template_items SET active=0 WHERE id=?').run(itemId);db.prepare('UPDATE templates SET version=version+1 WHERE id=?').run(id);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
    audit(actor.id,old.company_id,'TEMPLATE_ITEM_ARCHIVED','template_item',itemId,undefined,old,{active:0});
    return NextResponse.redirect(appUrl(req,`/modelos/${id}?ok=item-excluido`),303);
  }
  const parsed=schema.safeParse(Object.fromEntries(form));
  if(!parsed.success)return NextResponse.redirect(appUrl(req,`/modelos/${id}/itens/${itemId}?erro=campos`),303);
  if(db.prepare('SELECT id FROM template_items WHERE template_id=? AND code=? AND active=1 AND id<>?').get(id,parsed.data.code,itemId))return NextResponse.redirect(appUrl(req,`/modelos/${id}/itens/${itemId}?erro=codigo`),303);
  db.exec('BEGIN IMMEDIATE');try{
    db.prepare('UPDATE template_items SET area=?,section=?,code=?,title=?,guidance=?,criticality=?,expected_answer=?,photo_required=?,audio_required=? WHERE id=?').run(parsed.data.area,parsed.data.section||null,parsed.data.code,parsed.data.title,parsed.data.guidance||null,parsed.data.criticality,parsed.data.expected_answer,parsed.data.photo_required==='1'?1:0,parsed.data.audio_required==='1'?1:0,itemId);
    db.prepare('UPDATE templates SET version=version+1 WHERE id=?').run(id);db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error}
  audit(actor.id,old.company_id,'TEMPLATE_ITEM_UPDATED','template_item',itemId,undefined,old,parsed.data);
  return NextResponse.redirect(appUrl(req,`/modelos/${id}/itens/${itemId}?ok=1`),303);
}
