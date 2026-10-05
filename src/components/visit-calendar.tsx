'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarDays,ChevronLeft,ChevronRight,Clock3,Plus,X} from 'lucide-react';
import {addDays,calendarDays,dayLabel,minutes,visitLanes,type Visit,type VisitUnit} from '@/lib/calendar';

type Props={units:VisitUnit[];visits:Visit[];date:string;view:'month'|'week';today:string;canEdit:boolean;showCompany:boolean};
type Selection={visit?:Visit;copy?:Visit;date:string;time:string};
const weekdays=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const months=Array.from({length:12},(_,i)=>dayLabel(`2026-${String(i+1).padStart(2,'0')}-01`,{month:'long'}));

export function VisitCalendar({units,visits,date,view,today,canEdit,showCompany}:Props){
  const router=useRouter();
  const [unitFilter,setUnitFilter]=useState(''),[selection,setSelection]=useState<Selection|null>(null),[notice,setNotice]=useState('');
  const weekScroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(view==='week'&&weekScroll.current)weekScroll.current.scrollTop=7*48;},[view,date]);
  const days=calendarDays(date,view),visible=visits.filter(visit=>!unitFilter||visit.unit_id===unitFilter);
  const perDay=new Map(days.map(day=>[day,visible.filter(visit=>visit.visit_date===day)]));
  const link=(day:string,mode=view)=>`/calendario?date=${day}&view=${mode}`;
  const changeMonth=(delta:number)=>{const d=new Date(date.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);return d.toISOString().slice(0,10);};
  const previous=view==='week'?addDays(date,-7):changeMonth(-1),next=view==='week'?addDays(date,7):changeMonth(1);
  const eventColor=(visit:Visit)=>`calendar-color-${Math.max(0,units.findIndex(unit=>unit.id===visit.unit_id))%5}`;
  const open=(day:string,time='08:00')=>{if(canEdit)setSelection({date:day,time});};
  function Event({visit}:{visit:Visit}){return <button type="button" className={`calendar-event ${eventColor(visit)}`} onClick={()=>setSelection({visit,date:visit.visit_date,time:visit.start_time})} aria-label={`Visita ${visit.unit_code}, ${dayLabel(visit.visit_date)}, ${visit.start_time} a ${visit.end_time}`}><span>{visit.start_time}–{visit.end_time}</span><b>{visit.unit_code}</b><small>{visit.responsible_name||'Sem responsável'}</small></button>;}
  return <>
    <header className="topbar calendar-topbar"><div><div className="eyebrow">Programação das unidades</div><h1 className="title">Calendário de Visitas</h1><p className="muted">{canEdit?'Monte a programação e acompanhe as visitas de cada unidade.':'Consulta das visitas das suas unidades. Edição disponível apenas ao coordenador.'}</p></div>{canEdit&&<button className="btn btn-primary" disabled={!units.some(unit=>unit.active)} onClick={()=>open(date)}><Plus size={16}/>Criar visita</button>}</header>
    {notice&&<div className="notice success-notice" role="status">{notice}</div>}
    <section className="card calendar-card">
      <div className="calendar-toolbar">
        <div className="calendar-navigation"><Link className="btn btn-ghost" href={link(today)}>Hoje</Link><Link className="calendar-arrow" href={link(previous)} aria-label={view==='month'?'Mês anterior':'Semana anterior'}><ChevronLeft size={19}/></Link><Link className="calendar-arrow" href={link(next)} aria-label={view==='month'?'Próximo mês':'Próxima semana'}><ChevronRight size={19}/></Link><h2>{view==='month'?dayLabel(date,{month:'long',year:'numeric'}):`${dayLabel(days[0],{day:'numeric',month:'short'})} – ${dayLabel(days[6],{day:'numeric',month:'short',year:'numeric'})}`}</h2></div>
        <div className="calendar-switch" aria-label="Visualização"><Link className={view==='month'?'selected':''} href={link(date,'month')}>Mês</Link><Link className={view==='week'?'selected':''} href={link(date,'week')}>Semana</Link></div>
      </div>
      <div className="calendar-filters">
        <label>Mês<select aria-label="Mês do calendário" value={date.slice(5,7)} onChange={event=>router.push(link(`${date.slice(0,4)}-${event.target.value}-01`))}>{months.map((month,i)=><option value={String(i+1).padStart(2,'0')} key={month}>{month}</option>)}</select></label>
        <label>Exercício<input type="number" aria-label="Ano do calendário" min={1900} max={2200} defaultValue={Number(date.slice(0,4))} key={date.slice(0,4)} onBlur={event=>{const year=Number(event.target.value);if(Number.isInteger(year)&&year>=1900&&year<=2200){if(year!==Number(date.slice(0,4)))router.push(link(`${year}-${date.slice(5,7)}-01`));}else event.target.value=date.slice(0,4);}}/></label>
        <label>Unidade<select aria-label="Filtrar unidade" value={unitFilter} onChange={event=>setUnitFilter(event.target.value)}><option value="">{canEdit?'Todas as unidades':'Todas as minhas unidades'}</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.code}{showCompany?` · ${unit.company_name}`:''}</option>)}</select></label>
        <span className="calendar-timezone"><Clock3 size={13}/>Horário de Brasília</span>
      </div>
      {view==='month'?<div className="calendar-month-scroll" tabIndex={0} role="region" aria-label="Calendário mensal">
        <div className="calendar-month"><div className="calendar-weekdays">{weekdays.map(day=><span key={day}>{day}</span>)}</div><div className="calendar-month-grid">{days.map(day=><div key={day} className={`calendar-day ${day.slice(0,7)!==date.slice(0,7)?'outside-month':''}`}>
          <div className="calendar-day-head">{canEdit?<button className={`calendar-date ${day===today?'today':''}`} aria-label={`Criar visita em ${dayLabel(day)}`} onClick={()=>open(day)}>{Number(day.slice(8))}</button>:<span className={`calendar-date ${day===today?'today':''}`}>{Number(day.slice(8))}</span>}</div>
          <div className="calendar-day-events">{perDay.get(day)!.map(visit=><Event key={visit.id} visit={visit}/>)}</div>
        </div>)}</div></div>
      </div>:<div className="calendar-week-scroll" ref={weekScroll} tabIndex={0} role="region" aria-label="Calendário semanal por horário"><div className="calendar-week">
        <div className="calendar-week-heading"><span className="calendar-week-zone">GMT−3</span>{days.map((day,i)=><div key={day}><span>{weekdays[i]}</span><b className={day===today?'today':''}>{Number(day.slice(8))}</b></div>)}</div>
        <div className="calendar-week-body"><div className="calendar-hours">{Array.from({length:24},(_,hour)=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>{days.map(day=>{
          const daily=perDay.get(day)!;
          return <div className="calendar-week-day" key={day}>{Array.from({length:24},(_,hour)=>canEdit?<button type="button" className="calendar-hour-slot" key={hour} onClick={()=>open(day,`${String(hour).padStart(2,'0')}:00`)} aria-label={`Criar visita em ${dayLabel(day)} às ${hour} horas`}/>:<div className="calendar-hour-slot" key={hour}/>)}{visitLanes(daily).map(({visit,lane,lanes})=><div key={visit.id} className="calendar-timed-event" style={{top:minutes(visit.start_time)*.8,height:Math.max(24,(minutes(visit.end_time)-minutes(visit.start_time))*.8),left:`${lane/lanes*100}%`,width:`${100/lanes}%`}}><Event visit={visit}/></div>)}</div>;
        })}</div>
      </div></div>}
      <div className="calendar-footer"><CalendarDays size={15}/>{visible.length} {visible.length===1?'visita':'visitas'} neste período{!units.length?' · Nenhuma unidade atribuída ao seu usuário.':''}{canEdit?' · Clique em um dia ou em uma visita para editar.':' · Clique em uma visita para consultar os detalhes.'}</div>
    </section>
    {selection&&<VisitDialog key={selection.visit?.id||`${selection.date}-${selection.time}`} selection={selection} units={units} canEdit={canEdit} showCompany={showCompany} duplicate={()=>setSelection({copy:selection.visit,date:addDays(selection.date,7),time:selection.time})} close={()=>setSelection(null)} saved={message=>{setNotice(message);setSelection(null);router.refresh();}}/>}
  </>;
}

function VisitDialog({selection,units,canEdit,showCompany,duplicate,close,saved}:{selection:Selection;units:VisitUnit[];canEdit:boolean;showCompany:boolean;duplicate:()=>void;close:()=>void;saved:(message:string)=>void}){
  const dialog=useRef<HTMLDialogElement>(null),form=useRef<HTMLFormElement>(null);
  const initial=selection.visit||selection.copy;
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[repeat,setRepeat]=useState(false),[cancel,setCancel]=useState(false),[chosenUnit,setChosenUnit]=useState(initial?.unit_id||units.find(unit=>unit.active)?.id||''),[additionalDates,setAdditionalDates]=useState<string[]>([]);
  useEffect(()=>{dialog.current?.showModal();},[]);
  const visit=selection.visit;
  async function send(intent:'create'|'update'|'cancel'){
    if(busy)return;
    if(intent!=='cancel'&&!form.current?.reportValidity())return;
    const formData=new FormData(form.current!),fields=Object.fromEntries(formData);
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({intent,...(visit?{id:visit.id}:{}),...(intent==='cancel'?{}:{...fields,additional_dates:formData.getAll('additional_dates'),...(repeat?{}:{repeat_until:undefined})})})});
      const result=await response.json();if(!response.ok){setError(result.error||'Não foi possível salvar.');return;}
      saved(intent==='cancel'?'Visita cancelada.':intent==='update'?'Visita atualizada.':`${result.count} ${result.count===1?'visita criada':'visitas criadas'}.`);
    }catch{setError('Não foi possível conectar. Seus dados permanecem no formulário.');}finally{setBusy(false);}
  }
  function submit(event:FormEvent){event.preventDefault();void send(visit?'update':'create');}
  const start=selection.time,endMinutes=Math.min(1439,minutes(start)+240),end=`${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`;
  return <dialog ref={dialog} className="visit-dialog" aria-labelledby="visit-title" onCancel={event=>{if(busy)event.preventDefault();else close();}}>
    <div className="visit-dialog-head"><h2 id="visit-title">{visit?(canEdit?'Editar visita':'Detalhes da visita'):selection.copy?'Duplicar visita':'Criar visita'}</h2><button type="button" className="calendar-arrow" aria-label="Fechar" onClick={close} disabled={busy}><X size={20}/></button></div>
    {error&&<div className="error" role="alert">{error}</div>}
    <form ref={form} onSubmit={submit}>
      <fieldset disabled={!canEdit||busy}><div className="grid form-grid">
        <div className="field field-wide"><label htmlFor="visit-unit">UNIDADE</label><select id="visit-unit" name="unit_id" required value={chosenUnit} onChange={event=>setChosenUnit(event.target.value)}>{units.filter(unit=>unit.active||unit.id===visit?.unit_id).map(unit=><option key={unit.id} value={unit.id}>{unit.code}{showCompany?` · ${unit.company_name}`:''}{!unit.active?' (inativa)':''}</option>)}</select><small className="muted">Responsável técnico: {units.find(unit=>unit.id===chosenUnit)?.responsible_name||'Sem responsável vinculado'}</small></div>
        <div className="field field-wide"><label htmlFor="visit-date">DATA</label><input type="date" id="visit-date" name="visit_date" required defaultValue={selection.date}/></div>
        <div className="field"><label htmlFor="visit-start">INÍCIO</label><input type="time" id="visit-start" name="start_time" required defaultValue={initial?.start_time||start}/></div>
        <div className="field"><label htmlFor="visit-end">TÉRMINO</label><input type="time" id="visit-end" name="end_time" required defaultValue={initial?.end_time||end}/></div>
        {!visit&&<div className="field field-wide"><label className="check-option"><input type="checkbox" checked={repeat} onChange={event=>setRepeat(event.target.checked)}/>Repetir semanalmente no mesmo dia e horário</label>{repeat&&<><label htmlFor="visit-until">REPETIR ATÉ</label><input type="date" name="repeat_until" id="visit-until" required min={selection.date} defaultValue={`${selection.date.slice(0,4)}-12-31`}/><small className="muted">Programa as visitas até a data escolhida, por até um ano.</small></>}</div>}
        {!visit&&<div className="field field-wide"><span>DATAS ADICIONAIS</span><small className="muted">Repita esta visita em outras datas, com a mesma unidade e horários.</small>{additionalDates.map((date,index)=><div className="header-actions" key={date}><input type="date" name="additional_dates" required aria-label={`Data adicional ${index+1}`}/><button type="button" className="btn btn-ghost" aria-label={`Remover data adicional ${index+1}`} onClick={()=>setAdditionalDates(dates=>dates.filter((_,i)=>i!==index))}>Remover</button></div>)}<button type="button" className="btn btn-soft" disabled={additionalDates.length>=52} onClick={()=>setAdditionalDates(dates=>[...dates,String(Number(dates.at(-1)??-1)+1)])}>Adicionar data</button></div>}
        <div className="field field-wide"><label htmlFor="visit-notes">OBSERVAÇÕES</label><textarea id="visit-notes" name="notes" rows={3} maxLength={2000} defaultValue={initial?.notes||''}/></div>
      </div></fieldset>
      {visit?.series_id&&<p className="muted">Esta visita faz parte de uma programação com várias datas. Alterações ou cancelamento se aplicam apenas a esta ocorrência.</p>}
      {!canEdit&&<p className="notice">Somente o coordenador pode alterar a programação.</p>}
      {visit&&<p><Link className="btn btn-soft" href={`/relatorios/novo?unidade=${visit.unit_id}&data=${visit.visit_date}`}>{canEdit?'Preparar relatório da visita':'Preencher relatório da visita'}</Link></p>}
      <div className="visit-dialog-actions"><button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>Fechar</button>{canEdit&&visit&&<button type="button" className="btn btn-soft" disabled={busy} onClick={duplicate}>Duplicar visita</button>}{canEdit&&<button className="btn btn-primary" disabled={busy}>{busy?'Salvando…':visit?'Salvar alterações':'Criar visitas'}</button>}</div>
    </form>
    {canEdit&&visit&&<div className="visit-cancel">{cancel?<><p>Cancelar esta visita? O histórico será preservado.</p><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setCancel(false)}>Manter visita</button><button type="button" className="btn btn-danger" disabled={busy} onClick={()=>void send('cancel')}>Confirmar cancelamento</button></>:<button type="button" className="btn btn-danger" disabled={busy} onClick={()=>setCancel(true)}>Cancelar visita</button>}</div>}
  </dialog>;
}
