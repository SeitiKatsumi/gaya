import Link from 'next/link';
import {
  Building2,
  CircleHelp,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  LogOut,
  Plus,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Brand } from './brand';
import type { SessionUser } from '@/lib/auth';
import { roleLabel } from '@/lib/utils';

type NavLink = { id:string; href:string; icon:LucideIcon; label:string };

export function AppShell({user,children,active='dashboard'}:{user:SessionUser;children:React.ReactNode;active?:string}) {
  const links:NavLink[] = [
    {id:'dashboard',href:'/dashboard',icon:LayoutDashboard,label:'Visão geral'},
    {id:'inspections',href:'/inspecoes',icon:ClipboardCheck,label:'Inspeções'},
    {id:'templates',href:'/modelos',icon:Layers3,label:'Modelos'},
    {id:'nc',href:'/nao-conformidades',icon:TriangleAlert,label:'Não conformidades'},
    {id:'reports',href:'/relatorios',icon:FileText,label:'Relatórios'},
  ];
  if (user.role !== 'INSPECTOR') {
    links.splice(2,0,
      {id:'projects',href:'/projetos',icon:FolderKanban,label:'Projetos'},
      {id:'users',href:'/usuarios',icon:Users,label:'Usuários'},
    );
  }
  if (user.role === 'SUPER_ADMIN') {
    links.splice(links.length - 1,0,{id:'companies',href:'/empresas',icon:Building2,label:'Empresas'});
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
      <Link className={active==='dashboard'?'active':''} href="/dashboard"><LayoutDashboard size={19}/>Início</Link>
      <Link className={active==='inspections'?'active':''} href="/inspecoes"><ClipboardCheck size={19}/>Inspeções</Link>
      {user.role!=='INSPECTOR'?<Link href="/inspecoes/nova"><Plus size={19}/>Nova</Link>:<Link href="/modelos"><Layers3 size={19}/>Modelos</Link>}
      <Link className={active==='reports'?'active':''} href="/relatorios"><FileText size={19}/>Relatórios</Link>
    </nav>
  </div>;
}
