import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {availableStatisticsResponsible,availableStatisticsUnit,reportFilters} from '@/lib/report-statistics';
import {monthlyExecutive} from '@/lib/monthly-executive';
import {createMonthlyReportPdf} from '@/lib/monthly-report-pdf';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Faça login para baixar o relatório mensal.'},{status:401});
  const query=new URL(req.url).searchParams;let filters;
  try{filters=reportFilters({mes:query.get('mes')??undefined,unidade:query.get('unidade')??undefined,responsavel:query.get('responsavel')??undefined});}catch{return NextResponse.json({error:'Filtro inválido.'},{status:400});}
  if(!availableStatisticsUnit(user,filters.unit)||!availableStatisticsResponsible(user,filters.responsible))return NextResponse.json({error:'Unidade não encontrada.'},{status:404});
  try{const pdf=await createMonthlyReportPdf(monthlyExecutive(user,filters));return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="gaya-mensal-${filters.month}.pdf"`,'Content-Length':String(pdf.length),'Cache-Control':'private, no-store, max-age=0'}});}catch(error){console.error('monthly_report_failed',{message:error instanceof Error?error.message:'unknown'});return NextResponse.json({error:'Não foi possível gerar o relatório mensal. Tente novamente.'},{status:500});}
}
