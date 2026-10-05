import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import {statusLabel} from './utils.ts';
import type {FilledItem,PriorPlan} from './received-reports.ts';

export type ReportInspection = {
  control_code: string;
  title: string;
  company_name: string;
  unit_name: string;
  address: string | null;
  template_name: string;
  planned_start: string | null;
  planned_end: string | null;
  objective: string | null;
  scope: string | null;
  status: string;
  progress: number;
  inspector_name: string | null;
  supervisor_name: string | null;
};

export type ReportItem = {
  code: string;
  area: string;
  title: string;
  answer: string | null;
  compliance: string | null;
  comment: string | null;
  evidence_count: number;
};

const COLORS={ink:'#243B3A',muted:'#617473',green:'#397A67',line:'#D9E8E3',soft:'#EFF7F4',warn:'#A56B1E',danger:'#A54343'};
const PAGE={width:595.28,height:841.89,left:52,right:543,bottom:720};

export function safePdfText(value: unknown) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u2010-\u2015]/g,'-')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'')
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/g,'?');
}

const dateLabel=(value:string|null)=>value?new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR'):'Não informado';
const resultLabel=(value:string|null)=>({COMPLIANT:'Conforme',NON_COMPLIANT:'Não conforme',NOT_APPLICABLE:'Não se aplica',PENDING:'Pendente'}[value||'PENDING']||value||'Pendente');

function ensureSpace(doc:PDFKit.PDFDocument,height:number){if(doc.y+height>PAGE.bottom)doc.addPage()}
function sectionTitle(doc:PDFKit.PDFDocument,title:string,subtitle?:string){ensureSpace(doc,64);doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(9).text(safePdfText(title).toUpperCase());if(subtitle)doc.moveDown(.35).fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(safePdfText(subtitle));doc.moveDown(.8)}
function infoRow(doc:PDFKit.PDFDocument,label:string,value:unknown){ensureSpace(doc,42);doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8).text(safePdfText(label).toUpperCase());doc.moveDown(.25).fillColor(COLORS.ink).font('Helvetica').fontSize(10).text(safePdfText(value)||'-');doc.moveDown(.75)}

export async function createInspectionReport(inspection:ReportInspection,items:ReportItem[],nonconformities:number){
  const doc=new PDFDocument({size:'A4',margin:52,bufferPages:true,info:{Title:safePdfText(`Relatório ${inspection.control_code}`),Author:'Gaya - Inspeções Inteligentes',Subject:'Relatório de inspeção técnica'}});
  const chunks:Buffer[]=[];
  const finished=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(chunk:Buffer)=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});

  doc.rect(0,0,PAGE.width,PAGE.height).fill('#F8FBFA');
  doc.roundedRect(52,58,491,70,12).fill(COLORS.green);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(28).text('Gaya',72,77);
  doc.font('Helvetica').fontSize(9).text('INSPEÇÕES INTELIGENTES',72,108,{characterSpacing:1.2});
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(9).text('RELATÓRIO DE INSPEÇÃO TÉCNICA',52,180,{characterSpacing:1});
  doc.fillColor(COLORS.ink).fontSize(25).text(safePdfText(inspection.title),52,205,{width:491});
  doc.moveDown(.8).fillColor(COLORS.muted).font('Helvetica').fontSize(11).text(safePdfText(`${inspection.control_code}  •  ${inspection.company_name}`));
  doc.roundedRect(52,330,491,116,12).fill('#FFFFFF').stroke(COLORS.line);
  const summary=[['STATUS',statusLabel(inspection.status)],['PROGRESSO',`${inspection.progress}%`],['NÃO CONFORMIDADES',String(nonconformities)],['UNIDADE',inspection.unit_name]];
  summary.forEach(([label,value],index)=>{const x=70+(index%2)*235;const y=350+Math.floor(index/2)*52;doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8).text(label,x,y);doc.fillColor(COLORS.ink).fontSize(index===1||index===2?18:11).text(safePdfText(value),x,y+16,{width:205});});
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(`Gerado em ${new Date().toLocaleString('pt-BR')}  •  Versão 1`,52,690);

  doc.addPage();
  sectionTitle(doc,'Identificação','Dados do planejamento e responsáveis pela inspeção.');
  infoRow(doc,'Empresa',inspection.company_name);infoRow(doc,'Unidade',inspection.unit_name);infoRow(doc,'Endereço',inspection.address||'Não informado');infoRow(doc,'Modelo aplicado',inspection.template_name);infoRow(doc,'Período planejado',`${dateLabel(inspection.planned_start)} a ${dateLabel(inspection.planned_end)}`);infoRow(doc,'Responsável técnico responsável',inspection.inspector_name||'Não informado');infoRow(doc,'Coordenador',inspection.supervisor_name||'Não informado');infoRow(doc,'Objetivo',inspection.objective||'Não informado');infoRow(doc,'Escopo',inspection.scope||'Não informado');

  doc.addPage();
  sectionTitle(doc,'Resultados da inspeção',`${items.length} itens de verificação, com respostas e evidências preservadas.`);
  items.forEach((item,index)=>{
    const commentHeight=item.comment?Math.min(80,doc.heightOfString(safePdfText(item.comment),{width:455}))+20:0;
    ensureSpace(doc,105+commentHeight);
    const top=doc.y;
    doc.roundedRect(52,top,491,90+commentHeight,10).fillAndStroke('#FFFFFF',COLORS.line);
    doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(8).text(safePdfText(`${String(index+1).padStart(2,'0')}  •  ${item.area}  •  ${item.code}`),68,top+15,{width:455});
    doc.fillColor(COLORS.ink).fontSize(11).text(safePdfText(item.title),68,top+34,{width:455});
    const result=resultLabel(item.compliance);const resultColor=item.compliance==='NON_COMPLIANT'?COLORS.danger:item.compliance==='COMPLIANT'?COLORS.green:COLORS.muted;
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text('RESPOSTA',68,top+62);doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9).text(safePdfText(item.answer||'Pendente'),128,top+62);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text('RESULTADO',240,top+62);doc.fillColor(resultColor).font('Helvetica-Bold').fontSize(9).text(safePdfText(result),306,top+62);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(`EVIDÊNCIAS: ${item.evidence_count}`,420,top+62);
    if(item.comment){doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text('COMENTÁRIO TÉCNICO',68,top+86);doc.fillColor(COLORS.ink).fontSize(9).text(safePdfText(item.comment),68,top+100,{width:455,height:Math.max(20,commentHeight-10),ellipsis:true})}
    doc.y=top+105+commentHeight;
  });

  const range=doc.bufferedPageRange();
  for(let page=range.start;page<range.start+range.count;page++){
    doc.switchToPage(page);
    doc.moveTo(PAGE.left,740).lineTo(PAGE.right,740).strokeColor(COLORS.line).stroke();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(safePdfText(inspection.control_code),PAGE.left,749,{width:220,lineBreak:false});
    doc.text(`Página ${page+1} de ${range.count}`,PAGE.right-120,749,{width:120,align:'right',lineBreak:false});
  }

  doc.end();
  return finished;
}

export async function createVisitReport(inspection:ReportInspection&{unit_code:string;received_at:string|null;send_due_date:string|null},items:FilledItem[],plans:PriorPlan[],photos:{item_id:string;name:string;data:Buffer}[]){
  const doc=new PDFDocument({size:'A4',margins:{top:52,bottom:120,left:52,right:52},bufferPages:true,info:{Title:safePdfText(`Relatório ${inspection.unit_code}`),Author:'Gaya'}});
  const chunks:Buffer[]=[];const finished=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(chunk:Buffer)=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(25).text('Gaya');
  doc.moveDown(.6).fillColor(COLORS.ink).fontSize(18).text(safePdfText(`Relatório de ${inspection.unit_code}`));
  doc.moveDown(.5);infoRow(doc,'Data da visita',dateLabel(inspection.planned_start));infoRow(doc,'Responsável Técnico',inspection.inspector_name||'Não informado');infoRow(doc,'Situação',statusLabel(inspection.status));
  if(inspection.received_at)infoRow(doc,'Recebido em',new Date(inspection.received_at.includes('T')?inspection.received_at:inspection.received_at.replace(' ','T')+'Z').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}));
  if(inspection.send_due_date)infoRow(doc,'Data limite de envio',dateLabel(inspection.send_due_date));
  let section='';
  const planFields=[['nonconformities','Não Conformidade(s)'],['immediate','Medidas Imediatas'],['corrective','Ação(ões) Corretiva(s)'],['preventive','Ação(ões) Preventiva(s)'],['responsible','Responsáveis']] as const;
  for(const item of items){
    const current=item.response_type==='DOCUMENT'?'Verificação Documental':item.response_type==='ACTION_PLAN'?'Plano de Ação':item.response_type==='PLAN_REVIEW'?'Verificação de Planos de Ação Passados':item.area;
    if(current!==section){doc.moveDown();sectionTitle(doc,current);section=current;}
    ensureSpace(doc,110);doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text(safePdfText(item.title));doc.moveDown(.5);
    if(item.response_type==='DOCUMENT'){
      infoRow(doc,'Presente e vigente?',item.answer);infoRow(doc,'Se sim, vigente em pasta?',item.details.location||'—');infoRow(doc,'Vencimento',dateLabel(item.details.expiry||null));infoRow(doc,'Periodicidade',item.document_periodicity||'—');infoRow(doc,'Número de exemplares em pasta',item.document_copies||'—');
    }else if(item.response_type==='ACTION_PLAN'){
      infoRow(doc,'Área/Departamento',item.section||item.area);for(const [field,label] of planFields)infoRow(doc,label,item.details[field]||'—');
    }else if(item.response_type==='PLAN_REVIEW'){
      for(const check of item.details.checks||[]){const plan=plans.find(plan=>plan.id===check.id);infoRow(doc,'Plano anterior',plan?`${plan.department} - ${dateLabel(plan.date)} - ${plan.details.nonconformities||''}`:'Plano anterior');infoRow(doc,'Concluído?',check.answer);infoRow(doc,'Observações',check.comment||'—');}
    }else{
      infoRow(doc,'Área/Departamento',item.section||item.area);infoRow(doc,'Sim / Não',item.answer);infoRow(doc,'Transcrição do áudio / Observações',item.comment||'—');
      for(const photo of photos.filter(photo=>photo.item_id===item.id)){ensureSpace(doc,170);const top=doc.y;try{doc.image(`data:${photo.data[0]===0x89?'image/png':'image/jpeg'};base64,${photo.data.toString('base64')}`,PAGE.left,top,{fit:[240,130]});doc.y=top+138;infoRow(doc,'Foto associada',photo.name);}catch{doc.y=top;infoRow(doc,'Foto anexada ao relatório',photo.name);}}
    }
  }
  const range=doc.bufferedPageRange();
  for(let page=range.start;page<range.start+range.count;page++){doc.switchToPage(page);doc.page.margins.bottom=52;doc.moveTo(PAGE.left,740).lineTo(PAGE.right,740).strokeColor(COLORS.line).stroke();doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(safePdfText(inspection.control_code),PAGE.left,749,{width:350,lineBreak:false});doc.text(`Página ${page+1} de ${range.count}`,PAGE.right-110,749,{width:110,align:'right',lineBreak:false});}
  doc.end();return finished;
}
