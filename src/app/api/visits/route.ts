import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {uid} from '@/lib/utils';
import {publicOrigin} from '@/lib/http';
import {validDate,weeklyDates} from '@/lib/calendar';

const schema=z.object({intent:z.enum(['create','update','cancel']),id:z.string().optional(),unit_id:z.string().min(1).optional(),visit_date:z.string().refine(validDate).optional(),start_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),end_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),notes:z.string().trim().max(2000).default(''),repeat_until:z.string().refine(validDate).optional()});
type Existing={id:string;company_id:string;unit_id:string;status:string};
export async function POST(req:Request){
  const actor=await currentUser();
  if(!actor)return NextResponse.json({error:'Entre novamente para continuar.'},{status:401});
  if(actor.role==='INSPECTOR')return NextResponse.json({error:'Somente o coordenador pode alterar o calendário.'},{status:403});
  const origin=req.headers.get('origin');if(origin&&origin!==publicOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
  let body:unknown;try{body=await req.json();}catch{return NextResponse.json({error:'Dados inválidos.'},{status:400});}
  const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Revise a unidade, data, horários e observações.'},{status:400});
  const data=parsed.data;
  const old=data.intent==='create'?undefined:db.prepare('SELECT v.*,u.company_id FROM visits v JOIN units u ON u.id=v.unit_id WHERE v.id=?').get(data.id||'') as Existing|undefined;
  if(data.intent!=='create'&&(!old||actor.role!=='SUPER_ADMIN'&&old.company_id!==actor.company_id))return NextResponse.json({error:'Visita não encontrada.'},{status:404});
  if(old?.status==='CANCELLED')return NextResponse.json({error:'Esta visita já foi cancelada.'},{status:409});
  if(data.intent==='cancel'){
    db.exec('BEGIN IMMEDIATE');try{
      db.prepare("UPDATE visits SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(old!.id);
      audit(actor.id,old!.company_id,'VISIT_CANCELLED','visit',old!.id,undefined,old,{status:'CANCELLED'});db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    return NextResponse.json({ok:true});
  }
  if(!data.unit_id||!data.visit_date||!data.start_time||!data.end_time||data.end_time<=data.start_time)return NextResponse.json({error:'Informe a unidade, data e um horário final posterior ao início.'},{status:400});
  const unit=db.prepare('SELECT u.id,u.company_id FROM units u JOIN companies c ON c.id=u.company_id WHERE u.id=? AND u.active=1 AND c.active=1').get(data.unit_id) as {id:string;company_id:string}|undefined;
  if(!unit||actor.role!=='SUPER_ADMIN'&&unit.company_id!==actor.company_id)return NextResponse.json({error:'Unidade inválida.'},{status:403});
  if(old&&unit.company_id!==old.company_id)return NextResponse.json({error:'A visita deve permanecer na mesma empresa.'},{status:400});
  if(data.intent==='update'&&data.repeat_until)return NextResponse.json({error:'A edição altera apenas esta ocorrência.'},{status:400});
  let dates=[data.visit_date];try{if(data.repeat_until)dates=weeklyDates(data.visit_date,data.repeat_until);}catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
  const seriesId=dates.length>1?uid('series'):null;
  const ids:string[]=[];
  db.exec('BEGIN IMMEDIATE');try{
    for(const visitDate of dates){
      const id=old?.id||uid('visit');ids.push(id);
      if(old)db.prepare('UPDATE visits SET unit_id=?,visit_date=?,start_time=?,end_time=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(unit.id,visitDate,data.start_time,data.end_time,data.notes,id);
      else db.prepare('INSERT INTO visits(id,unit_id,visit_date,start_time,end_time,notes,series_id,created_by) VALUES(?,?,?,?,?,?,?,?)').run(id,unit.id,visitDate,data.start_time,data.end_time,data.notes,seriesId,actor.id);
      audit(actor.id,unit.company_id,old?'VISIT_UPDATED':'VISIT_CREATED','visit',id,undefined,old,{unit_id:unit.id,visit_date:visitDate,start_time:data.start_time,end_time:data.end_time,notes:data.notes});
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return NextResponse.json({ok:true,count:ids.length,ids});
}
