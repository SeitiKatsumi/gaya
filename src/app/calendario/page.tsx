import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';
import {VisitCalendar} from '@/components/visit-calendar';
import {calendarDays,saoPauloToday,validDate,type Visit,type VisitUnit} from '@/lib/calendar';

export default async function Calendar({searchParams}:{searchParams:Promise<{date?:string;view?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  const query=await searchParams,today=saoPauloToday();
  const date=query.date&&validDate(query.date)?query.date:today,view=query.view==='week'?'week':'month';
  const days=calendarDays(date,view);
  const access=user.role==='SUPER_ADMIN'?'1=1':user.role==='INSPECTOR'?'u.company_id=? AND u.responsible_id=?':'u.company_id=?';
  const values=user.role==='SUPER_ADMIN'?[]:user.role==='INSPECTOR'?[user.company_id,user.id]:[user.company_id];
  const units=db.prepare(`SELECT u.id,u.code,u.name,u.active,c.trade_name company_name,r.name responsible_name FROM units u JOIN companies c ON c.id=u.company_id LEFT JOIN users r ON r.id=u.responsible_id WHERE ${access} ORDER BY c.trade_name,u.code`).all(...values) as VisitUnit[];
  const visits=db.prepare(`SELECT v.id,v.unit_id,v.visit_date,v.start_time,v.end_time,v.notes,v.series_id,u.code unit_code,r.name responsible_name,c.trade_name company_name FROM visits v JOIN units u ON u.id=v.unit_id JOIN companies c ON c.id=u.company_id LEFT JOIN users r ON r.id=u.responsible_id WHERE v.status='SCHEDULED' AND v.visit_date BETWEEN ? AND ? AND ${access} ORDER BY v.visit_date,v.start_time,u.code`).all(days[0],days.at(-1)!,...values) as Visit[];
  return <AppShell user={user} active="calendar"><VisitCalendar units={units.map(unit=>({...unit}))} visits={visits.map(visit=>({...visit}))} date={date} view={view} today={today} canEdit={user.role!=='INSPECTOR'} showCompany={user.role==='SUPER_ADMIN'}/></AppShell>;
}
