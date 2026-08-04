import Link from 'next/link';
import {MapPin,Plus} from 'lucide-react';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';

type UnitRow={id:string;name:string;code:string;city:string|null;state:string|null;active:number;company_name:string;projects:number;inspections:number};

export default async function Units(){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.role==='INSPECTOR')redirect('/dashboard');
  const rows=db.prepare(`SELECT u.id,u.name,u.code,u.city,u.state,u.active,c.trade_name company_name,
    (SELECT count(*) FROM projects WHERE unit_id=u.id) projects,
    (SELECT count(*) FROM inspections WHERE unit_id=u.id) inspections
    FROM units u JOIN companies c ON c.id=u.company_id
    WHERE ${user.role==='SUPER_ADMIN'?'1=1':'u.company_id=?'}
    ORDER BY u.active DESC,c.trade_name,u.name`).all(...(user.role==='SUPER_ADMIN'?[]:[user.company_id])) as UnitRow[];
  return <AppShell user={user} active="units">
    <header className="topbar"><div><div className="eyebrow">Estrutura operacional</div><h1 className="title">Unidades</h1></div><Link href="/unidades/nova" className="btn btn-primary"><Plus size={16}/>Nova unidade</Link></header>
    <div className="grid cards-grid">{rows.map(unit=><Link className="card entity-card" href={`/unidades/${unit.id}`} key={unit.id}>
      <div className="entity-card-head"><span className="icon-chip"><MapPin size={18}/></span><span className={`badge ${unit.active?'success':'warn'}`}>{unit.active?'Ativa':'Inativa'}</span></div>
      <div><h2>{unit.name}</h2><p className="muted">{unit.code} · {unit.company_name}</p><p className="muted">{[unit.city,unit.state].filter(Boolean).join(' · ')||'Localidade não informada'}</p></div>
      <div className="entity-meta"><span>{unit.projects} projetos</span><span>{unit.inspections} inspeções</span></div>
    </Link>)}</div>
  </AppShell>;
}
