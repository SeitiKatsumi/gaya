import Link from 'next/link';
import {Plus,Pencil} from 'lucide-react';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';

type UnitRow={id:string;code:string;address:string|null;active:number;company_name:string;responsible_name:string|null;maps_url:string|null;contact_name:string|null;contact_email:string|null;contact_phones:string|null;form_url:string|null};
function Reference({value,label}:{value:string|null;label:string}){
  // ponytail: only HTTP(S) values become links; pending information stays plain text.
  let url:URL|undefined;
  try{if(value){const parsed=new URL(value);if(['http:','https:'].includes(parsed.protocol))url=parsed;}}catch{}
  return url?<a className="unit-link" href={url.href} target="_blank" rel="noopener noreferrer">{label}</a>:<>{value||'—'}</>;
}
export default async function Units({searchParams}:{searchParams:Promise<{ok?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  const canEdit=user.role!=='INSPECTOR';
  const rows=db.prepare(`SELECT u.*,c.trade_name company_name,r.name responsible_name FROM units u JOIN companies c ON c.id=u.company_id LEFT JOIN users r ON r.id=u.responsible_id WHERE ${user.role==='SUPER_ADMIN'?'1=1':user.role==='INSPECTOR'?'u.company_id=? AND u.responsible_id=?':'u.company_id=?'} ORDER BY u.active DESC,c.trade_name,u.code`).all(...(user.role==='SUPER_ADMIN'?[]:user.role==='INSPECTOR'?[user.company_id,user.id]:[user.company_id])) as UnitRow[];
  const {ok}=await searchParams;
  return <AppShell user={user} active="units">
    <header className="topbar"><div><div className="eyebrow">Estrutura operacional</div><h1 className="title">Unidades</h1><p className="muted">{rows.length} unidades{canEdit?' · Adicione entradas ou edite os dados de cada linha.':' · Consulta das unidades atribuídas a você.'}</p></div>{canEdit&&<Link href="/unidades/nova" className="btn btn-primary"><Plus size={16}/>Adicionar entrada</Link>}</header>
    {ok&&<div className="notice success-notice">{ok==='criada'?'Unidade cadastrada.':'Dados da unidade atualizados.'}</div>}
    <section className="card units-card"><div className="units-scroll" tabIndex={0} role="region" aria-label="Tabela de unidades; role horizontalmente para consultar todas as colunas">
      <table className="units-table"><caption className="sr-only">Unidades e contatos operacionais</caption><thead><tr>
        <th scope="col">Código da unidade</th><th scope="col">Responsável Técnico(a)</th><th scope="col">Endereço</th><th scope="col">Google Maps</th><th scope="col">Ponto de contato</th><th scope="col">E-mail (Ponto de contato)</th><th scope="col">Telefone(s) (Ponto de contato)</th><th scope="col">Formulário virtual (Forms)</th>{canEdit&&<th scope="col">Ações</th>}
      </tr></thead><tbody>{rows.map(unit=><tr key={unit.id}>
        <th scope="row"><Link className="unit-link" href={`/unidades/${unit.id}`}>{unit.code}</Link>{user.role==='SUPER_ADMIN'&&<div className="muted">{unit.company_name}</div>}{!unit.active&&<div className="muted">Inativa</div>}</th>
        <td>{unit.responsible_name||'Sem responsável'}</td><td className="unit-address">{unit.address||'—'}</td><td><Reference value={unit.maps_url} label="Abrir Maps"/></td><td>{unit.contact_name||'—'}</td><td>{unit.contact_email||'—'}</td><td>{unit.contact_phones||'—'}</td><td><Reference value={unit.form_url} label="Abrir formulário"/></td>
        {canEdit&&<td><Link className="btn btn-soft" href={`/unidades/${unit.id}`} aria-label={`Editar dados da unidade ${unit.code}`}><Pencil size={14}/>Editar dados</Link></td>}
      </tr>)}</tbody></table>
      {!rows.length&&<div className="empty-state"><h2>Nenhuma unidade disponível</h2><p>{canEdit?'Adicione a primeira entrada.':'O coordenador precisa vincular uma unidade ao seu usuário.'}</p></div>}
    </div></section>
  </AppShell>;
}
