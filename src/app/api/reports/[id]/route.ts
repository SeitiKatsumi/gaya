import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {audit,db} from '@/lib/db';
import {appUrl} from '@/lib/http';
import {createInspectionReport,type ReportInspection,type ReportItem} from '@/lib/report';
import {inspectionTemplateItems} from '@/lib/inspection-template';

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
  const frozenItems=inspectionTemplateItems((inspection as ReportInspection&{template_snapshot?:string|null}).template_snapshot,inspection.template_id);
  const responses=db.prepare('SELECT item_id,answer,compliance,comment FROM responses WHERE inspection_id=? AND is_current=1').all(id) as {item_id:string;answer:string|null;compliance:string|null;comment:string|null}[];
  const evidenceCounts=db.prepare('SELECT item_id,count(*) evidence_count FROM evidences WHERE inspection_id=? GROUP BY item_id').all(id) as {item_id:string;evidence_count:number}[];
  const responseByItem=new Map(responses.map(response=>[response.item_id,response]));
  const evidenceByItem=new Map(evidenceCounts.map(row=>[row.item_id,row.evidence_count]));
  const items=frozenItems.map(item=>{const response=responseByItem.get(item.id);return {code:item.code,area:item.area,title:item.title,answer:response?.answer||null,compliance:response?.compliance||null,comment:response?.comment||null,evidence_count:evidenceByItem.get(item.id)||0}}) satisfies ReportItem[];
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
