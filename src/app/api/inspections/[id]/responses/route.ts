import {appUrl,publicOrigin} from '@/lib/http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {db,audit} from '@/lib/db';
import {uid} from '@/lib/utils';
import {inspectionTemplateItems} from '@/lib/inspection-template';
import {applicableItems,documentLocations,isVisitReport,priorPlans,sectionOf,type AnswerRow,type ResponseDetails} from '@/lib/received-reports';
import {validDate} from '@/lib/calendar';

const responseSchema=z.object({item_id:z.string().min(1),answer:z.enum(['Sim','Não','Não se aplica']),comment:z.string().max(2000)});
const mediaConfig={
  photo:{kind:'PHOTO',prefix:'image/',folder:'photos',maxMb:Number(process.env.MAX_IMAGE_SIZE_MB||15)},
  audio:{kind:'AUDIO',prefix:'audio/',folder:'audio',maxMb:Number(process.env.MAX_AUDIO_SIZE_MB||50)},
  video:{kind:'VIDEO',prefix:'video/',folder:'videos',maxMb:Number(process.env.MAX_VIDEO_SIZE_MB||300)},
} as const;
type Prepared={id:string;kind:string;originalName:string;fullPath:string;mime:string;size:number;hash:string};

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user)return NextResponse.redirect(appUrl(req,'/login'),303);
  const origin=req.headers.get('origin');if(origin&&origin!==publicOrigin(req))return NextResponse.json({error:'Origem inválida'},{status:403});
  const {id}=await params;
  const inspection=db.prepare('SELECT * FROM inspections WHERE id=?').get(id) as any;
  if(!inspection||user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id||user.role==='INSPECTOR'&&inspection.inspector_id!==user.id)return NextResponse.json({error:'Sem permissão'},{status:403});
  if(!['SCHEDULED','IN_PROGRESS','CHANGES_REQUESTED'].includes(inspection.status)&&!(inspection.status==='IN_REVIEW'&&user.role!=='INSPECTOR'))return NextResponse.json({error:'Inspeção bloqueada'},{status:409});
  if(user.role!=='INSPECTOR'&&inspection.received_at&&inspection.status!=='IN_REVIEW')return NextResponse.json({error:'Aguarde a correção e o reenvio pelo RT.'},{status:403});
  const form=await req.formData();
  const target=isVisitReport(inspection)||form.get('report_view')==='1'?`/relatorios/${id}`:`/inspecoes/${id}`;
  const parsed=responseSchema.safeParse({item_id:String(form.get('item_id')||''),answer:String(form.get('answer')||''),comment:String(form.get('comment')||'')});
  if(!parsed.success)return NextResponse.redirect(appUrl(req,`${target}?erro=resposta`),303);
  const snapshotItems=inspectionTemplateItems(inspection.template_snapshot,inspection.template_id);
  const item=snapshotItems.find(candidate=>candidate.id===parsed.data.item_id);
  if(!item)return NextResponse.json({error:'Item inválido'},{status:400});
  const answers=db.prepare('SELECT item_id,answer FROM responses WHERE inspection_id=? AND is_current=1').all(id) as AnswerRow[];
  if(!applicableItems(snapshotItems,answers).some(value=>value.id===item.id))return NextResponse.json({error:'Esta pergunta não se aplica à resposta anterior.'},{status:400});
  const section=sectionOf(item);
  if(user.role==='INSPECTOR'&&db.prepare("SELECT section FROM report_section_reviews WHERE inspection_id=? AND section=? AND status='APPROVED'").get(id,section))return NextResponse.json({error:'Esta seção já foi aprovada.'},{status:409});
  if(inspection.status==='IN_REVIEW'&&!answers.some(answer=>answer.item_id===item.id))return NextResponse.json({error:'Revise somente os itens enviados pelo RT.'},{status:409});
  let details:ResponseDetails={};
  if(item.response_type==='DOCUMENT'){
    const location=String(form.get('location')||''),expiry=String(form.get('expiry')||'');
    if(!['Sim','Não'].includes(parsed.data.answer)||parsed.data.answer==='Sim'&&!documentLocations.includes(location)||expiry&&!validDate(expiry))return NextResponse.redirect(appUrl(req,`${target}?erro=documento`),303);
    details={location:parsed.data.answer==='Sim'?location:'',expiry};
  }else if(item.response_type==='ACTION_PLAN'){
    const plan=z.object({nonconformities:z.string().trim().min(1).max(2000),immediate:z.string().max(2000),corrective:z.string().max(2000),preventive:z.string().max(2000),responsible:z.string().max(2000)}).safeParse(Object.fromEntries(['nonconformities','immediate','corrective','preventive','responsible'].map(field=>[field,String(form.get(field)||'')])));
    if(!plan.success)return NextResponse.redirect(appUrl(req,`${target}?erro=plano`),303);
    details=plan.data;parsed.data.answer='Sim';
  }else if(item.response_type==='PLAN_REVIEW'){
    let value:unknown;try{value=JSON.parse(String(form.get('checks')||'[]'));}catch{return NextResponse.json({error:'Verificações inválidas.'},{status:400});}
    const checks=z.array(z.object({id:z.string().min(1),answer:z.enum(['Sim','Não']),comment:z.string().max(2000)})).min(1).max(100).safeParse(value);
    const allowed=new Set(priorPlans(inspection).map(plan=>plan.id));
    if(!checks.success||new Set(checks.data.map(check=>check.id)).size!==checks.data.length||checks.data.some(check=>!allowed.has(check.id)))return NextResponse.json({error:'Selecione planos aprovados da mesma unidade.'},{status:400});
    details={checks:checks.data};parsed.data.answer=checks.data.every(check=>check.answer==='Sim')?'Sim':'Não';
  }else if(isVisitReport(inspection)&&!['Sim','Não'].includes(parsed.data.answer))return NextResponse.json({error:'Escolha Sim ou Não.'},{status:400});
  const selected=Object.entries(mediaConfig).flatMap(([field,config])=>{const file=form.get(field);return file instanceof File&&file.size>0?[{file,config}]:[]});
  for(const {file,config} of selected){
    if(!file.type.startsWith(config.prefix))return NextResponse.redirect(appUrl(req,`${target}?erro=tipo`),303);
    if(file.size>config.maxMb*1024*1024)return NextResponse.redirect(appUrl(req,`${target}?erro=tamanho`),303);
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
      if(config.kind==='PHOTO'&&(!['image/png','image/jpeg'].includes(file.type)||!(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||buffer[0]===255&&buffer[1]===216&&buffer[2]===255)))return NextResponse.redirect(appUrl(req,`${target}?erro=tipo`),303);
      fs.writeFileSync(fullPath,buffer,{flag:'wx'});
      prepared.push({id:uid('evidence'),kind:config.kind,originalName:file.name.slice(0,255),fullPath,mime:file.type,size:file.size,hash:crypto.createHash('sha256').update(buffer).digest('hex')});
    }
    const compliance=parsed.data.answer==='Não se aplica'?'NOT_APPLICABLE':parsed.data.answer===item.expected_answer?'COMPLIANT':'NON_COMPLIANT';
    const old=db.prepare('SELECT * FROM responses WHERE inspection_id=? AND item_id=? AND is_current=1').get(id,parsed.data.item_id) as any;
    const revision=(old?.revision||0)+1;
    db.exec('BEGIN IMMEDIATE');
    try{
      const latest=db.prepare('SELECT status FROM inspections WHERE id=?').get(id) as {status:string};
      if(latest.status!==inspection.status||user.role==='INSPECTOR'&&db.prepare("SELECT section FROM report_section_reviews WHERE inspection_id=? AND section=? AND status='APPROVED'").get(id,section))throw new Error('REPORT_LOCKED');
      if(old)db.prepare('UPDATE responses SET is_current=0 WHERE id=?').run(old.id);
      db.prepare('INSERT INTO responses(id,inspection_id,item_id,user_id,answer,compliance,comment,details_json,revision) VALUES(?,?,?,?,?,?,?,?,?)').run(responseId,id,parsed.data.item_id,user.id,parsed.data.answer,compliance,parsed.data.comment,JSON.stringify(details),revision);
      for(const evidence of prepared)db.prepare('INSERT INTO evidences(id,inspection_id,item_id,response_id,user_id,kind,original_name,path,mime_type,size,hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(evidence.id,id,parsed.data.item_id,responseId,user.id,evidence.kind,evidence.originalName,evidence.fullPath,evidence.mime,evidence.size,evidence.hash);
      if(compliance==='NON_COMPLIANT'&&!['ACTION_PLAN','PLAN_REVIEW'].includes(item.response_type))db.prepare("INSERT INTO nonconformities(id,inspection_id,item_id,title,severity,status) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM nonconformities WHERE inspection_id=? AND item_id=? AND status NOT IN ('CLOSED','REJECTED'))").run(uid('nc'),id,parsed.data.item_id,item.title,item.criticality,'OPEN',id,parsed.data.item_id);
      if(compliance==='COMPLIANT'||compliance==='NOT_APPLICABLE')db.prepare("UPDATE nonconformities SET status='CLOSED' WHERE inspection_id=? AND item_id=? AND status='OPEN'").run(id,item.id);
      db.prepare("UPDATE report_section_reviews SET status='PENDING',reviewed_by=NULL,reviewed_at=NULL WHERE inspection_id=? AND section=?").run(id,section);
      const currentResponses=db.prepare('SELECT item_id FROM responses WHERE inspection_id=? AND is_current=1').all(id) as {item_id:string}[];
      const currentEvidences=db.prepare('SELECT item_id,kind FROM evidences WHERE inspection_id=?').all(id) as {item_id:string;kind:string}[];
      const answered=new Set(currentResponses.map(row=>row.item_id));
      const evidenceKeys=new Set(currentEvidences.map(row=>`${row.item_id}:${row.kind}`));
      const total=snapshotItems.length;
      const done=snapshotItems.filter(snapshotItem=>answered.has(snapshotItem.id)&&(!snapshotItem.photo_required||evidenceKeys.has(`${snapshotItem.id}:PHOTO`))&&(!snapshotItem.audio_required||evidenceKeys.has(`${snapshotItem.id}:AUDIO`))).length;
      db.prepare("UPDATE inspections SET progress=?,status=CASE WHEN status IN ('SCHEDULED','CHANGES_REQUESTED') THEN 'IN_PROGRESS' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(total?Math.round(done/total*100):0,id);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error}
    audit(user.id,inspection.company_id,'RESPONSE_SAVED','response',responseId,id,old,{answer:parsed.data.answer,compliance,details,revision,evidences:prepared.map(x=>x.kind)});
    if(form.get('report_wizard')==='1'&&user.role==='INSPECTOR'){
      const current=db.prepare('SELECT item_id,answer FROM responses WHERE inspection_id=? AND is_current=1').all(id) as AnswerRow[];
      const group=(value:typeof item)=>['DOCUMENT','ACTION_PLAN','PLAN_REVIEW'].includes(value.response_type)?sectionOf(value):value.section||value.area;
      const area=group(item),available=applicableItems(snapshotItems,current).filter(value=>group(value)===area);
      const next=available[Math.min(available.findIndex(value=>value.id===item.id)+1,available.length-1)]||item;
      return NextResponse.redirect(appUrl(req,`${target}?salvo=${encodeURIComponent(item.id)}&area=${encodeURIComponent(area)}&item=${encodeURIComponent(next.id)}`),303);
    }
    return NextResponse.redirect(appUrl(req,`${target}?salvo=${parsed.data.item_id}${inspection.status==='IN_REVIEW'&&user.role!=='INSPECTOR'?`&editar=${encodeURIComponent(section)}`:''}#${parsed.data.item_id}`),303);
  }catch(error){for(const evidence of prepared){try{fs.unlinkSync(evidence.fullPath)}catch{}}if(error instanceof Error&&error.message==='REPORT_LOCKED')return NextResponse.json({error:'O relatório foi atualizado por outra pessoa. Reabra a página antes de editar.'},{status:409});throw error}
}
