import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';

export default async function NewTemplate({searchParams}:{searchParams:Promise<{erro?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');if(user.role==='INSPECTOR')redirect('/modelos');
  const companies=(user.role==='SUPER_ADMIN'?db.prepare('SELECT id,trade_name FROM companies WHERE active=1 ORDER BY trade_name').all():[]) as {id:string;trade_name:string}[];const {erro}=await searchParams;
  return <AppShell user={user} active="templates"><header className="topbar"><div><div className="eyebrow">Biblioteca</div><h1 className="title">Novo modelo</h1></div></header><form className="card form-card" action="/api/templates" method="post">{erro&&<div className="error">Revise os campos informados.</div>}<input type="hidden" name="status" value="DRAFT"/><div className="grid form-grid">{user.role==='SUPER_ADMIN'&&<div className="field"><label>EMPRESA</label><select name="company_id" required><option value="">Selecione</option>{companies.map(company=><option key={company.id} value={company.id}>{company.trade_name}</option>)}</select></div>}<div className="field field-wide"><label>NOME DO MODELO</label><input name="name" required minLength={3}/></div><div className="field"><label>CATEGORIA</label><input name="category" required placeholder="Ex.: Operações"/></div><div className="field"><label>STATUS INICIAL</label><input value="Rascunho" disabled/><small className="muted">Adicione ao menos um item antes de publicar.</small></div><div className="field field-wide"><label>DESCRIÇÃO</label><textarea name="description" rows={4}/></div></div><div className="form-actions"><Link className="btn btn-ghost" href="/modelos">Cancelar</Link><button className="btn btn-primary">Criar modelo</button></div></form></AppShell>;
}
