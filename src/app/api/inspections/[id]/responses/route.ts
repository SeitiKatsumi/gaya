import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {db,audit} from '@/lib/db';
import {uid} from '@/lib/utils';

const responseSchema=z.object({item_id:z.string().min(1),answer:z.enum(['Sim','Não','Não se aplica']),comment:z.string().max(2000)});
const mediaConfig={
  photo:{kind:'PHOTO',prefix:'image/',folder:'photos',maxMb:Number(process.env.MAX_IMAGE_SIZE_MB||15)},
  audio:{kind:'AUDIO',prefix:'audio/',folder:'audio',maxMb:Number(process.env.MAX_AUDIO_SIZE_MB||50)},
  video:{kind:'VIDEO',prefix:'video/',folder:'videos',maxMb:Number(process.env.MAX_VIDEO_SIZE_MB||300)},
} as const;
type Prepared={id:string;kind:string;originalName:string;fullPath:string;mime:string;size:number;hash:string};

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user)return NextResponse.redirect(new URL('/login',req.url),303);
  const {id}=await params;
  const inspection=db.prepare('SELECT * FROM inspections WHERE id=?').get(id) as any;
  if(!inspection||user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id||user.role==='INSPECTOR'&&inspection.inspector_id!==user.id)return NextResponse.json({error:'Sem permissão'},{status:403});
  if(!['SCHEDULED','IN_PROGRESS','CHANGES_REQUESTED'].includes(inspection.status))return NextResponse.json({error:'Inspeção bloqueada'},{status:409});
  const form=await req.formData();
  const parsed=responseSchema.safeParse({item_id:String(form.get('item_id')||''),answer:String(form.get('answer')||''),comment:String(form.get('comment')||'')});
  if(!parsed.success)return NextResponse.redirect(new URL(`/inspecoes/${id}?erro=resposta`,req.url),303);
  const item=db.prepare('SELECT * FROM template_items WHERE id=? AND template_id=?').get(parsed.data.item_id,inspection.template_id) as any;
  if(!item)return NextResponse.json({error:'Item inválido'},{status:400});
  const selected=Object.entries(mediaConfig).flatMap(([field,config])=>{const file=form.get(field);return file instanceof File&&file.size>0?[{file,config}]:[]});
  for(const {file,config} of selected){
    if(!file.type.startsWith(config.prefix))return NextResponse.redirect(new URL(`/inspecoes/${id}?erro=tipo`,req.url),303);
    if(file.size>config.maxMb*1024*1024)return NextResponse.redirect(new URL(`/inspecoes/${id}?erro=tamanho`,req.url),303);
  }
  const responseId=uid('rsp');
  const storageRoot=path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_PATH||path.join(/*turbopackIgnore: true*/ process.cwd(),'storage'));
  const prepared:Prepared[]=[];
  try{
    for(const {file,config} of selected){
      const dir=path.join(storageRoot,config.folder);fs.mkdirSync(dir,{recursive:true});
      const originalExt=path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g,'').slice(0,10);
      const fullPath=path.join(dir,`${uid('ev')}${originalExt||'.bin'}`);
      const buffer=Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(fullPath,buffer,{flag:'wx'});
      prepared.push({id:uid('evidence'),kind:config.kind,originalName:file.name.slice(0,255),fullPath,mime:file.type,size:file.size,hash:crypto.createHash('sha256').update(buffer).digest('hex')});
    }
    const compliance=parsed.data.answer==='Não se aplica'?'NOT_APPLICABLE':parsed.data.answer===item.expected_answer?'COMPLIANT':'NON_COMPLIANT';
    const old=db.prepare('SELECT * FROM responses WHERE inspection_id=? AND item_id=? AND is_current=1').get(id,parsed.data.item_id) as any;
    const revision=(old?.revision||0)+1;
    db.exec('BEGIN IMMEDIATE');
    try{
      if(old)db.prepare('UPDATE responses SET is_current=0 WHERE id=?').run(old.id);
      db.prepare('INSERT INTO responses(id,inspection_id,item_id,user_id,answer,compliance,comment,revision) VALUES(?,?,?,?,?,?,?,?)').run(responseId,id,parsed.data.item_id,user.id,parsed.data.answer,compliance,parsed.data.comment,revision);
      for(const evidence of prepared)db.prepare('INSERT INTO evidences(id,inspection_id,item_id,response_id,user_id,kind,original_name,path,mime_type,size,hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(evidence.id,id,parsed.data.item_id,responseId,user.id,evidence.kind,evidence.originalName,evidence.fullPath,evidence.mime,evidence.size,evidence.hash);
      if(compliance==='NON_COMPLIANT')db.prepare("INSERT INTO nonconformities(id,inspection_id,item_id,title,severity,status) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM nonconformities WHERE inspection_id=? AND item_id=? AND status NOT IN ('CLOSED','REJECTED'))").run(uid('nc'),id,parsed.data.item_id,item.title,item.criticality,'OPEN',id,parsed.data.item_id);
      const total=(db.prepare('SELECT count(*) n FROM template_items WHERE template_id=?').get(inspection.template_id) as {n:number}).n;
      const done=(db.prepare(`SELECT count(*) n FROM template_items ti WHERE ti.template_id=? AND EXISTS(SELECT 1 FROM responses r WHERE r.inspection_id=? AND r.item_id=ti.id AND r.is_current=1) AND (ti.photo_required=0 OR EXISTS(SELECT 1 FROM evidences e WHERE e.inspection_id=? AND e.item_id=ti.id AND e.kind='PHOTO')) AND (ti.audio_required=0 OR EXISTS(SELECT 1 FROM evidences e WHERE e.inspection_id=? AND e.item_id=ti.id AND e.kind='AUDIO'))`).get(inspection.template_id,id,id,id) as {n:number}).n;
      db.prepare("UPDATE inspections SET progress=?,status=CASE WHEN status IN ('SCHEDULED','CHANGES_REQUESTED') THEN 'IN_PROGRESS' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(total?Math.round(done/total*100):0,id);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error}
    audit(user.id,inspection.company_id,'RESPONSE_SAVED','response',responseId,id,old,{answer:parsed.data.answer,compliance,revision,evidences:prepared.map(x=>x.kind)});
    return NextResponse.redirect(new URL(`/inspecoes/${id}?salvo=${parsed.data.item_id}`,req.url),303);
  }catch(error){for(const evidence of prepared){try{fs.unlinkSync(evidence.fullPath)}catch{}}throw error}
}
