import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {audit} from '@/lib/db';
import {appUrl,publicOrigin} from '@/lib/http';
import {saveMonthlyReview} from '@/lib/monthly-executive';
import {availableStatisticsUnit,reportFilters} from '@/lib/report-statistics';

export const runtime='nodejs';
const schema=z.object({mes:z.string(),unidade:z.string().default(''),text:z.string().transform(value=>value.replace(/\r\n?/g,'\n').trim()).pipe(z.string().min(20).max(1800)),source_hash:z.string().regex(/^[a-f0-9]{64}$/),return_to:z.enum(['dashboard','monthly']).default('monthly')});
export async function POST(req:Request){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Faça login.'},{status:401});
  if(user.role==='INSPECTOR')return NextResponse.json({error:'A revisão é exclusiva da coordenação.'},{status:403});
  const origin=req.headers.get('origin');if(origin&&origin!==publicOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
  let parsed;try{parsed=schema.safeParse(Object.fromEntries(await req.formData()));}catch{return NextResponse.json({error:'Formulário inválido.'},{status:400});}
  if(!parsed.success)return NextResponse.json({error:'Preencha um parecer de 20 a 1.800 caracteres e atualize os dados.'},{status:400});
  const input=parsed.data;let filters;try{filters=reportFilters(input);}catch{return NextResponse.json({error:'Filtro inválido.'},{status:400});}
  if(!availableStatisticsUnit(user,filters.unit))return NextResponse.json({error:'Unidade não encontrada.'},{status:404});
  const params=new URLSearchParams({mes:filters.month,unidade:filters.unit}),path='/relatorios-mensais';
  try{saveMonthlyReview(user,filters,input.text,input.source_hash);audit(user.id,user.company_id,'MONTHLY_REVIEW_SAVED','monthly_review',JSON.stringify(filters),undefined,undefined,{month:filters.month,unit:filters.unit});params.set('ok','1');}
  catch(error){if(error instanceof Error&&error.message==='Os dados mudaram. Atualize e revise novamente.')params.set('erro','stale');else {console.error('monthly_review_failed',{message:error instanceof Error?error.message:'unknown'});return NextResponse.json({error:'Não foi possível salvar o parecer.'},{status:500});}}
  return NextResponse.redirect(appUrl(req,`${path}?${params}`),303);
}
