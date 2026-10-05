import fs from 'node:fs';
import path from 'node:path';
import {db} from './db.ts';
import {createInspectionReport,createVisitReport,type ReportInspection} from './report.ts';
import {inspectionTemplateItems} from './inspection-template.ts';
import {filledItems,isVisitReport,priorPlans} from './received-reports.ts';
export type ExportInspection=ReportInspection&{id:string;company_id:string;inspector_id:string|null;template_id:string;template_snapshot:string|null;unit_id:string;unit_code:string;received_at:string|null;send_due_date:string|null};
export function reportInspection(id:string){return db.prepare(`SELECT i.*,un.name unit_name,un.code unit_code,un.address,c.trade_name company_name,t.name template_name,inspector.name inspector_name,supervisor.name supervisor_name FROM inspections i JOIN units un ON un.id=i.unit_id JOIN companies c ON c.id=i.company_id JOIN templates t ON t.id=i.template_id LEFT JOIN users inspector ON inspector.id=i.inspector_id LEFT JOIN users supervisor ON supervisor.id=i.supervisor_id WHERE i.id=?`).get(id) as ExportInspection|undefined;}
export function reportStorage(){return path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_PATH||path.join(/*turbopackIgnore: true*/ process.cwd(),'storage'));}
export async function buildReportPdf(inspection:ExportInspection){
  if(isVisitReport(inspection)){
    const root=reportStorage(),files=db.prepare("SELECT item_id,original_name name,path FROM evidences WHERE inspection_id=? AND kind='PHOTO' ORDER BY created_at").all(inspection.id) as {item_id:string;name:string;path:string}[];
    const photos=files.flatMap(file=>{const full=path.resolve(/*turbopackIgnore: true*/ file.path);return full.startsWith(root+path.sep)&&fs.existsSync(full)?[{item_id:file.item_id,name:file.name,data:fs.readFileSync(full)}]:[];});
    return createVisitReport(inspection,filledItems(inspection),priorPlans(inspection),photos);
  }
  const answers=db.prepare('SELECT item_id,answer,compliance,comment FROM responses WHERE inspection_id=? AND is_current=1').all(inspection.id) as {item_id:string;answer:string;compliance:string;comment:string}[];
  const counts=db.prepare('SELECT item_id,count(*) n FROM evidences WHERE inspection_id=? GROUP BY item_id').all(inspection.id) as {item_id:string;n:number}[];
  const items=inspectionTemplateItems(inspection.template_snapshot,inspection.template_id).map(item=>{const answer=answers.find(row=>row.item_id===item.id);return {code:item.code,area:item.area,title:item.title,answer:answer?.answer||null,compliance:answer?.compliance||null,comment:answer?.comment||null,evidence_count:counts.find(row=>row.item_id===item.id)?.n||0};}).filter(item=>!inspection.received_at||item.answer);
  const count=db.prepare("SELECT count(*) n FROM nonconformities WHERE inspection_id=? AND status NOT IN ('CLOSED','REJECTED')").get(inspection.id) as {n:number};return createInspectionReport(inspection,items,count.n);
}
