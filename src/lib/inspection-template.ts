import {db} from './db.ts';

export type InspectionTemplateItem={
  id:string;
  template_id:string;
  area:string;
  section:string|null;
  code:string;
  title:string;
  guidance:string|null;
  response_type:string;
  expected_answer:string|null;
  criticality:string;
  weight:number;
  photo_required:number;
  audio_required:number;
  condition_json:string|null;
  sort_order:number;
  active?:number;
  document_periodicity?:string|null;
  document_copies?:string|null;
};

function isSnapshotItem(value:unknown):value is InspectionTemplateItem{
  if(!value||typeof value!=='object')return false;
  const item=value as Record<string,unknown>;
  return typeof item.id==='string'&&typeof item.code==='string'&&typeof item.title==='string'&&typeof item.area==='string';
}

export function parseInspectionTemplateItems(snapshot:string|null|undefined){
  if(!snapshot)return [];
  try{
    const parsed=JSON.parse(snapshot) as {items?:unknown};
    return Array.isArray(parsed.items)?parsed.items.filter(isSnapshotItem).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)):[];
  }catch{return []}
}

export function inspectionTemplateItems(snapshot:string|null|undefined,templateId:string){
  const frozen=parseInspectionTemplateItems(snapshot);
  if(frozen.length)return frozen;
  return db.prepare('SELECT * FROM template_items WHERE template_id=? ORDER BY sort_order').all(templateId) as InspectionTemplateItem[];
}
