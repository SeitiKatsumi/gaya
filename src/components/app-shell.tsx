import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  CircleHelp,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  LogOut,
  MapPin,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Brand } from './brand';
import type { SessionUser } from '@/lib/auth';
import { roleLabel } from '@/lib/utils';

type NavLink = { id:string; href:string; icon:LucideIcon; label:string };

export function AppShell({user,children,active='reports'}:{user:SessionUser;children:React.ReactNode;active?:string}) {
  const links:NavLink[] = [
    {id:'units',href:'/unidades',icon:MapPin,label:'Unidades'},
    {id:'calendar',href:'/calendario',icon:CalendarDays,label:'Calendário de Visitas'},
    {id:'reports',href:'/relatorios',icon:FileText,label:user.role==='INSPECTOR'?'Meus relatórios':'Relatórios Recebidos'},
  ];
  if (user.role !== 'INSPECTOR') {
    links.push({id:'sent',href:'/relatorios-enviados',icon:FileText,label:'Relatórios Enviados'},{id:'monthly',href:'/relatorios-mensais',icon:LayoutDashboard,label:'Relatórios Mensais'},{id:'plans',href:'/planos-de-acao',icon:ClipboardCheck,label:'Planos de Ação'});
    links.push({id:'users',href:'/usuarios',icon:Users,label:'Usuários'});
  }
  if (user.role === 'SUPER_ADMIN') {
    links.push(
      {id:'companies',href:'/empresas',icon:Building2,label:'Empresas'},
      {id:'templates',href:'/modelos',icon:Layers3,label:'Modelos'},
      {id:'projects',href:'/projetos',icon:FolderKanban,label:'Projetos'},
      {id:'inspections',href:'/inspecoes',icon:ClipboardCheck,label:'Inspeções'},
      {id:'nc',href:'/nao-conformidades',icon:TriangleAlert,label:'Não conformidades'},
    );
  }

  return <div className="shell">
    <aside className="sidebar">
      <Brand/>
      <nav className="nav">{links.map(({id,href,icon:Icon,label})=><Link key={id} href={href} className={active===id?'active':''}><Icon size={17}/>{label}</Link>)}</nav>
      <nav className="nav" style={{marginTop:'auto'}}><Link className={active==='help'?'active':''} href="/ajuda"><CircleHelp size={17}/>Central de ajuda</Link></nav>
      <div className="side-user"><b>{user.name}</b><div className="muted">{roleLabel(user.role)}</div><form action="/api/auth/logout" method="post"><button className="btn btn-ghost" style={{width:'100%',marginTop:12}}><LogOut size={14}/>Sair</button></form></div>
    </aside>
    <main className="content">{children}</main>
      <nav className="mobile-nav">
      <Link className={active==='units'?'active':''} href="/unidades"><MapPin size={19}/>Unidades</Link>
      <Link className={active==='calendar'?'active':''} href="/calendario"><CalendarDays size={19}/>Calendário</Link>
      <Link className={active==='reports'?'active':''} href="/relatorios"><FileText size={19}/>Relatórios</Link>
      {user.role!=='INSPECTOR'&&<><Link className={active==='sent'?'active':''} href="/relatorios-enviados"><FileText size={19}/>Enviados</Link><Link className={active==='monthly'?'active':''} href="/relatorios-mensais"><LayoutDashboard size={19}/>Mensais</Link><Link className={active==='plans'?'active':''} href="/planos-de-acao"><ClipboardCheck size={19}/>Planos</Link></>}
    </nav>
  </div>;
}
