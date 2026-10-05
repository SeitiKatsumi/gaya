export type VisitUnit={id:string;code:string;name:string;company_name:string;responsible_name:string|null;active:number};
export type Visit={id:string;unit_id:string;visit_date:string;start_time:string;end_time:string;notes:string;series_id:string|null;unit_code:string;responsible_name:string|null;company_name:string};

export function validDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  if(value<'1900-01-01'||value>'2200-12-31')return false;
  const date=new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
// ponytail: dates are São Paulo calendar days; UTC arithmetic avoids host timezone shifts.
export function addDays(day:string,amount:number){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);}
export function weekStart(day:string){const weekday=new Date(day+'T12:00:00Z').getUTCDay();return addDays(day,-((weekday+6)%7));}
export function calendarDays(day:string,view:'month'|'week'){
  const first=view==='week'?weekStart(day):weekStart(day.slice(0,7)+'-01');
  return Array.from({length:view==='week'?7:42},(_,i)=>addDays(first,i));
}
export function weeklyDates(first:string,last:string){
  if(!validDate(first)||!validDate(last)||last<first||last>addDays(first,366))throw new Error('Escolha um período de até um ano a partir da primeira visita.');
  const days:string[]=[];for(let day=first;day<=last;day=addDays(day,7))days.push(day);return days;
}
export function saoPauloToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function dayLabel(day:string,options:Intl.DateTimeFormatOptions={day:'numeric',month:'long',year:'numeric'}){return new Intl.DateTimeFormat('pt-BR',{...options,timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));}
export function minutes(time:string){const [hour,minute]=time.split(':').map(Number);return hour*60+minute;}

export function visitLanes(visits:Visit[]){
  const result:{visit:Visit;lane:number;lanes:number}[]=[];
  let group:typeof result=[],ends:number[]=[],groupEnd=0;
  function finish(){for(const entry of group)entry.lanes=ends.length;result.push(...group);group=[];ends=[];groupEnd=0;}
  for(const visit of [...visits].sort((a,b)=>a.start_time.localeCompare(b.start_time))){
    const start=minutes(visit.start_time),end=minutes(visit.end_time);
    if(start>=groupEnd)finish();
    let lane=ends.findIndex(value=>value<=start);if(lane<0)lane=ends.length;
    ends[lane]=end;groupEnd=Math.max(groupEnd,end);group.push({visit,lane,lanes:0});
  }
  finish();return result;
}
