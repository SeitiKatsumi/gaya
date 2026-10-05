import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import type {ExecutiveMonthly} from './monthly-executive.ts';
import {dayLabel} from './calendar.ts';
import {safePdfText} from './report.ts';

const C={ink:'#173A35',muted:'#58716B',green:'#216E5A',line:'#DCE8E3',soft:'#F1F7F4',blue:'#2D6585',amber:'#A56916',red:'#A44236'};
const LEFT=44,WIDTH=507,BOTTOM=775;
const number=(value:number)=>value.toLocaleString('pt-BR',{maximumFractionDigits:1});
const percent=(value:number|null)=>value===null?'Sem dados':`${number(value)}%`;

export async function createMonthlyReportPdf(data:ExecutiveMonthly):Promise<Buffer>{
  const doc=new PDFDocument({size:'A4',margins:{top:44,bottom:0,left:LEFT,right:44},bufferPages:true,info:{Title:`Relatório Mensal - ${data.filters.month}`,Author:'Gaya',Subject:'Consolidação mensal dos relatórios técnicos aprovados'}});
  const chunks:Buffer[]=[];
  const done=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(chunk:Buffer)=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  const month=dayLabel(data.filters.month+'-01',{month:'long',year:'numeric'});
  const selected=data.filters.unit?data.units.find(unit=>unit.id===data.filters.unit):null;
  const unitScope=selected?`${selected.code} - ${selected.name}`:data.filters.unit?'Unidade selecionada':'Todas as unidades disponíveis';
  const scope=unitScope+(data.responsibleName?` | RT: ${data.responsibleName}`:'');
  function text(value:string,x:number,y:number,width=WIDTH,size=9,bold=false,color=C.ink,align:'left'|'right'|'center'='left'){
    doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor(color).text(safePdfText(value),x,y,{width,align,lineGap:2});
    return doc.y;
  }
  function height(value:string,width=WIDTH,size=9,bold=false){return doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).heightOfString(safePdfText(value),{width,lineGap:2});}
  function heading(block:string,title:string,y:number){text(block.toUpperCase(),LEFT,y,WIDTH,8,true,C.green);text(title,LEFT,y+17,WIDTH,16,true);return y+37;}
  function newPage(){doc.addPage();doc.rect(LEFT,42,28,3).fill(C.green);text('GAYA  /  RELATÓRIO MENSAL',LEFT,54,WIDTH,8,true,C.muted);text(month,LEFT,54,WIDTH,8,false,C.muted,'right');return 84;}
  const tileWidth=(WIDTH-30)/4;
  function tile(title:string,value:string,note:string,index:number,y:number,color:string,background:string){
    const x=LEFT+index*(tileWidth+10);
    doc.roundedRect(x,y,tileWidth,111,6).fill(background);doc.rect(x,y+12,3,85).fill(color);
    text(title,x+10,y+12,tileWidth-20,8,true,color);text(value,x+10,y+44,tileWidth-20,value==='Sem dados'?16:22,true,color);
    text(note,x+10,y+72,tileWidth-20,7.5,false,color);
  }

  doc.roundedRect(LEFT,43,47,28,5).fill(C.green);text('GAYA',LEFT+6,51,35,10,true,'#FFFFFF');
  text('RELATÓRIO MENSAL',LEFT+60,46,WIDTH-60,8,true,C.muted);text(month,LEFT+60,60,WIDTH-60,12,true);
  text('Visão executiva mensal',LEFT,89,WIDTH,23,true);
  let y=text(scope,LEFT,119,WIDTH,9,false,C.muted)+5;
  y=text(`${number(data.reportCount)} relatórios aprovados  |  ${number(data.units.length)} unidades  |  ${number(data.pendingReportCount)} recebidos ainda em revisão`,LEFT,y,WIDTH,8,false,C.muted)+13;
  y=heading('Bloco I','Dashboard executivo',y);
  const m=data.metrics;
  tile('Índice Global de Conformidade',percent(m.igc),`${number(m.weightedCompliant)} / ${number(m.weightedEvaluated)} peso conforme / avaliado`,0,y,C.green,'#E9F4ED');
  tile('Volume de Não Conformidades',percent(m.sectorPercent),`${number(m.sectorsPending)} / ${number(m.sectorsTotal)} setores com pendências; ${number(m.nonconformities)} falhas`,1,y,C.red,'#FBEEEA');
  tile('Documentação pendente',percent(m.documentPercent),`${number(m.documentsPending)} / ${number(m.documentsEvaluated)} documentos avaliados`,2,y,C.amber,'#FFF5DF');
  tile('Índice de Reincidência',percent(m.reincidence),`${number(m.resolutions)} resoluções / ${number(m.plans)} planos de ação`,3,y,C.blue,'#EAF3F8');
  y+=121;
  y=text(`Base: visitas do mês, somente relatórios aprovados. Preenchimento: ${number(m.answered)} / ${number(m.applicable)} itens aplicáveis. IGC ponderado por todas as respostas binárias avaliadas; itens sem resposta e “Não se aplica” ficam fora. Documentação: última resposta do mês por documento; não avaliados ficam sem dados.`,LEFT,y,WIDTH,7.5,false,C.muted)+7;
  y=text('Reincidência segue a fórmula informada: resoluções / planos. Portanto, mede a taxa de resolução; quanto maior, melhor.',LEFT,y,WIDTH,7.5,false,C.muted)+12;
  y=heading('Bloco II','Ranking e benchmark entre unidades',y);
  function highlight(field:'igc'|'documentPercent'|'reincidence'|'delta',maximum:boolean){
    const metric=(unit:ExecutiveMonthly['units'][number])=>field==='delta'?unit.delta:unit.metrics[field];
    const evaluated=data.units.filter(unit=>metric(unit)!==null);
    if(!evaluated.length)return 'Sem dados';
    const edge=(maximum?Math.max:Math.min)(...evaluated.map(unit=>metric(unit)!));
    const label=field==='delta'?`${edge>0?'+':''}${number(edge)} p.p.`:percent(edge);
    return evaluated.filter(unit=>metric(unit)===edge).map(unit=>unit.code).join(', ')+` (${label})`;
  }
  y=text(`Maior IGC: ${highlight('igc',true)}. Menor variação do IGC: ${highlight('delta',false)}. Documentação mais pendente: ${highlight('documentPercent',true)}. Menor resolução: ${highlight('reincidence',false)}.`,LEFT,y,WIDTH,7.5,false,C.muted)+8;
  const cols=[LEFT,LEFT+176,LEFT+238,LEFT+315,LEFT+410],widths=[170,56,71,89,97];
  function tableHeader(top:number){
    doc.roundedRect(LEFT,top,WIDTH,30,4).fill(C.green);
    ['Unidade','IGC do mês','Variação\nvs. mês anterior','Documentação\npendente','Reincidência\n(resolução)'].forEach((label,index)=>text(label,cols[index]+5,top+7,widths[index]-10,7.5,true,'#FFFFFF',index?'right':'left'));
    return top+30;
  }
  y=tableHeader(y);
  const units=[...data.units].sort((a,b)=>(b.metrics.igc??-1)-(a.metrics.igc??-1)||a.code.localeCompare(b.code));
  if(!units.length)y=text('Nenhuma unidade com relatórios aprovados neste período.',LEFT+10,y+15,WIDTH-20,9,false,C.muted)+13;
  for(const [index,unit] of units.entries()){
    const unitLabel=`${unit.code} - ${unit.name}`,rowHeight=Math.max(19,height(unitLabel,widths[0]-10,7.5,true)+8);
    if(y+rowHeight>BOTTOM){y=newPage();y=heading('Bloco II - continuação','Ranking e benchmark entre unidades',y);y=tableHeader(y);}
    doc.rect(LEFT,y,WIDTH,rowHeight).fill(index%2?'#FFFFFF':C.soft);
    text(unitLabel,cols[0]+5,y+5,widths[0]-10,7.5,true);
    text(percent(unit.metrics.igc),cols[1]+5,y+7,widths[1]-10,8,true,C.green,'right');
    const delta=unit.delta===null?'Sem base':`${unit.delta>0?'+':''}${number(unit.delta)} p.p.`;
    text(delta,cols[2]+5,y+7,widths[2]-10,8,false,unit.delta===null?C.muted:unit.delta>=0?C.green:C.red,'right');
    text(percent(unit.metrics.documentPercent),cols[3]+5,y+7,widths[3]-10,8,false,unit.metrics.documentPercent?C.amber:C.muted,'right');
    text(percent(unit.metrics.reincidence),cols[4]+5,y+7,widths[4]-10,8,false,C.blue,'right');
    doc.moveTo(LEFT,y+rowHeight).lineTo(LEFT+WIDTH,y+rowHeight).strokeColor(C.line).lineWidth(.4).stroke();y+=rowHeight;
  }

  y=newPage();
  y=heading('Bloco III','Planos de ação e principais causas',y);
  y=text('Pareto: até 8 motivos mais frequentes das respostas não conformes. Barras mostram ocorrências; a linha mostra o percentual acumulado sobre todas as falhas observadas.',LEFT,y,WIDTH,8.5,false,C.muted)+18;
  const chartX=LEFT+255,chartWidth=180,labelWidth=240,points:{x:number;y:number}[]=[];
  const max=Math.max(1,...data.pareto.map(cause=>cause.count));
  function paretoLine(){if(!points.length)return;doc.save().strokeColor(C.blue).lineWidth(1.4);points.forEach((point,index)=>{if(index)doc.lineTo(point.x,point.y);else doc.moveTo(point.x,point.y);});doc.stroke();points.forEach(point=>doc.circle(point.x,point.y,3).fill(C.blue));doc.restore();points.length=0;}
  function chartHeader(top:number){text('MOTIVO OBSERVADO',LEFT,top,labelWidth,7.5,true,C.muted);text('OCORRÊNCIAS',chartX,top,chartWidth,7.5,true,C.muted);text('ACUM.',LEFT+453,top,54,7.5,true,C.muted,'right');return top+22;}
  y=chartHeader(y);
  if(!data.pareto.length){doc.roundedRect(LEFT,y,WIDTH,62,6).fill(C.soft);text('Nenhuma não conformidade observada nos relatórios aprovados do mês.',LEFT+16,y+20,WIDTH-32,10,false,C.muted);y+=79;}
  for(const [index,cause] of data.pareto.slice(0,8).entries()){
    const label=`${index+1}. ${cause.label}`,rowHeight=Math.max(34,height(label,labelWidth-8,8)+12);
    if(y+rowHeight>BOTTOM-180){paretoLine();y=newPage();y=heading('Bloco III - continuação','Principais causas observadas',y);y=chartHeader(y);}
    const middle=y+rowHeight/2;
    if(index%2===0)doc.rect(LEFT,y,WIDTH,rowHeight).fill(C.soft);
    text(label,LEFT+4,y+7,labelWidth-8,8);
    doc.roundedRect(chartX,middle-7,chartWidth,14,3).fill('#E0EDE7');
    doc.roundedRect(chartX,middle-7,Math.max(3,cause.count/max*chartWidth),14,3).fill(C.green);
    text(number(cause.count),chartX+chartWidth+5,middle-5,30,8,true);
    text(percent(cause.cumulativePercent),LEFT+458,middle-5,49,8,false,C.blue,'right');
    points.push({x:chartX+cause.cumulativePercent/100*chartWidth,y:middle});y+=rowHeight;
  }
  paretoLine();
  y+=10;
  if(y+65>BOTTOM)y=newPage();
  y=text(`Falhas técnicas no Pareto: ${number(data.paretoTotal)}. Planos de ação do mês: ${number(m.plans)}. Resolvidos até o fim do mês: ${number(m.resolutions)}.`,LEFT,y,WIDTH,8.5,false,C.muted)+18;
  y=heading('Bloco IV','Conclusão técnica e parecer sintético',y);
  const reviewed=data.review?.current,reviewLabel=reviewed?`Revisado por ${data.review!.reviewed_by} em ${new Date(data.review!.reviewed_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}`:data.review?'Parecer automático - revisão anterior desatualizada':'Parecer automático - aguardando revisão do Coordenador de RTs';
  y=text(reviewLabel,LEFT,y,WIDTH,8,true,reviewed?C.green:C.amber)+12;
  // ponytail: use the approved factual summary; AI categorization can be added when a reviewed taxonomy exists.
  const conclusion=safePdfText(reviewed?data.review!.text:data.automaticConclusion);
  const paragraphs=conclusion.split(/\n+/);
  for(const paragraph of paragraphs){
    const words=paragraph.split(/\s+/).filter(Boolean);let piece='';
    for(const word of words){
      const candidate=piece?piece+' '+word:word;
      if(y+height(candidate,WIDTH,9)>BOTTOM&&piece){y=text(piece,LEFT,y,WIDTH,9)+6;y=newPage();y=heading('Bloco IV - continuação','Conclusão técnica e parecer sintético',y);piece=word;}else piece=candidate;
    }
    if(piece){if(y+height(piece,WIDTH,9)>BOTTOM){y=newPage();y=heading('Bloco IV - continuação','Conclusão técnica e parecer sintético',y);}y=text(piece,LEFT,y,WIDTH,9)+6;}
  }
  if(!reviewed){if(y+38>BOTTOM)y=newPage();text('Revisar o parecer antes do compartilhamento com o cliente. Os resultados refletem apenas os itens efetivamente avaliados e não certificam itens sem verificação.',LEFT,y+8,WIDTH,8,false,C.muted);}
  const pages=doc.bufferedPageRange();
  for(let index=pages.start;index<pages.start+pages.count;index++){
    doc.switchToPage(index);doc.page.margins.bottom=0;
    doc.moveTo(LEFT,797).lineTo(LEFT+WIDTH,797).strokeColor(C.line).lineWidth(.7).stroke();
    text(`Gaya | ${data.filters.month} | Relatórios aprovados`,LEFT,807,350,7.5,false,C.muted);
    text(`Página ${index+1} de ${pages.count}`,LEFT+WIDTH-115,807,115,7.5,false,C.muted,'right');
  }
  doc.end();return done;
}
