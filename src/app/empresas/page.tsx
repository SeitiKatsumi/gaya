import Link from 'next/link';
import {Building2,MapPin,Plus} from 'lucide-react';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';

type CompanyRow={id:string;legal_name:string;trade_name:string;document:string|null;active:number;units:number;users:number;inspections:number};

export default async function Companies(){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.role!=='SUPER_ADMIN')redirect('/dashboard');
  const rows=db.prepare(`SELECT c.*,
    (SELECT count(*) FROM units WHERE company_id=c.id) units,
    (SELECT count(*) FROM users WHERE company_id=c.id) users,
    (SELECT count(*) FROM inspections WHERE company_id=c.id) inspections
    FROM companies c ORDER BY c.active DESC,c.trade_name`).all() as CompanyRow[];
  return <AppShell user={user} active="companies">
    <header className="topbar"><div><div className="eyebrow">Administração global</div><h1 className="title">Empresas</h1></div><Link href="/empresas/nova" className="btn btn-primary"><Plus size={16}/>Nova empresa</Link></header>
    <div className="grid cards-grid">{rows.map(company=><Link className="card entity-card" href={`/empresas/${company.id}`} key={company.id}>
      <div className="entity-card-head"><span className="icon-chip"><Building2 size={18}/></span><span className={`badge ${company.active?'success':'warn'}`}>{company.active?'Ativa':'Inativa'}</span></div>
      <div><h2>{company.trade_name}</h2><p className="muted">{company.legal_name}</p><p className="muted">{company.document||'Documento não informado'}</p></div>
      <div className="entity-meta"><span><MapPin size={12}/>{company.units} unidades</span><span>{company.users} usuários</span><span>{company.inspections} inspeções</span></div>
    </Link>)}</div>
  </AppShell>;
}
