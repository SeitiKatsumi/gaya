import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {createInspectionReport,type ReportInspection,type ReportItem} from '@/lib/report';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user)return NextResponse.redirect(appUrl(req,'/login'));
  const {id}=await params;
  const inspection=db.prepare(`SELECT i.*,un.name unit_name,un.address,c.trade_name company_name,t.name template_name,
    inspector.name inspector_name,supervisor.name supervisor_name
    FROM inspections i JOIN units un ON un.id=i.unit_id JOIN companies c ON c.id=i.company_id
    JOIN templates t ON t.id=i.template_id LEFT JOIN users inspector ON inspector.id=i.inspector_id
    LEFT JOIN users supervisor ON supervisor.id=i.supervisor_id WHERE i.id=?`).get(id) as ReportInspection&{company_id:string;inspector_id:string|null;template_id:string}|undefined;
  if(!inspection||user.role!=='SUPER_ADMIN'&&inspection.company_id!==user.company_id||user.role==='INSPECTOR'&&inspection.inspector_id!==user.id)return NextResponse.json({error:'Sem permissão'},{status:403});
  const items=db.prepare(`SELECT ti.code,ti.area,ti.title,r.answer,r.compliance,r.comment,
    (SELECT count(*) FROM evidences e WHERE e.inspection_id=? AND e.item_id=ti.id) evidence_count
    FROM template_items ti LEFT JOIN responses r ON r.item_id=ti.id AND r.inspection_id=? AND r.is_current=1
    WHERE ti.template_id=? ORDER BY ti.sort_order`).all(id,id,inspection.template_id) as ReportItem[];
  const nonconformities=(db.prepare("SELECT count(*) n FROM nonconformities WHERE inspection_id=? AND status NOT IN ('CLOSED','REJECTED')").get(id) as {n:number}).n;
  try{
    const pdf=await createInspectionReport(inspection,items,nonconformities);
    audit(user.id,inspection.company_id,'REPORT_GENERATED','report',id,id,undefined,{pages:'dynamic',items:items.length});
    const filename=`${inspection.control_code.replaceAll('/','-')}.pdf`;
    return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':String(pdf.length),'Cache-Control':'private, no-store, max-age=0'}});
  }catch(error){
    console.error('report_generation_failed',{inspectionId:id,message:error instanceof Error?error.message:'unknown'});
    return NextResponse.json({error:'Não foi possível gerar o relatório. Tente novamente.'},{status:500});
  }
}
