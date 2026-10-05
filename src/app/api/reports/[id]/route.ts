import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {audit} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {buildReportPdf,reportInspection} from '@/lib/report-export';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return NextResponse.redirect(appUrl(req,'/login'));
 const inspection=reportInspection((await params).id);
 if(!inspection||user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id||user.role==='INSPECTOR'&&inspection.inspector_id!==user.id)return NextResponse.json({error:'Sem permissão'},{status:403});
 try{const pdf=await buildReportPdf(inspection);audit(user.id,inspection.company_id,'REPORT_GENERATED','report',inspection.id,inspection.id);return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${inspection.control_code.replace(/[^a-zA-Z0-9_.-]/g,'-')}.pdf"`,'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({error:'Não foi possível gerar o relatório. Tente novamente.'},{status:500});}
}
