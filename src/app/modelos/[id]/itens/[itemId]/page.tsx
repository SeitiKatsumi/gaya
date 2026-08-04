import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {AppShell} from '@/components/app-shell';
import {ConfirmSubmit} from '@/components/confirm-submit';

type Item={id:string;template_id:string;area:string;section:string|null;code:string;title:string;guidance:string|null;criticality:string;expected_answer:string|null;photo_required:number;audio_required:number;active:number;template_name:string;company_id:string|null;is_global:number};

export default async function EditTemplateItem({params,searchParams}:{params:Promise<{id:string;itemId:string}>;searchParams:Promise<{ok?:string;erro?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');if(user.role==='INSPECTOR')redirect('/modelos');
  const {id,itemId}=await params;
  const item=db.prepare('SELECT ti.*,t.name template_name,t.company_id,t.is_global FROM template_items ti JOIN templates t ON t.id=ti.template_id WHERE ti.id=? AND ti.template_id=? AND ti.active=1').get(itemId,id) as Item|undefined;
  if(!item||item.is_global||user.role!=='SUPER_ADMIN'&&item.company_id!==user.company_id)notFound();
  const query=await searchParams;
  return <AppShell user={user} active="templates"><header className="topbar"><div><div className="eyebrow">{item.template_name} · {item.code}</div><h1 className="title">Editar item</h1></div><Link className="btn btn-ghost" href={`/modelos/${id}`}>Voltar ao modelo</Link></header>
    <form className="card form-card" action={`/api/templates/${id}/items/${itemId}`} method="post">
      <input type="hidden" name="intent" value="update"/>{query.ok&&<div className="notice success-notice">Item atualizado. Inspeções já criadas continuam usando a versão anterior.</div>}{query.erro&&<div className="error">Revise os campos. O código deve ser único entre os itens ativos.</div>}
      <div className="grid form-grid"><div className="field"><label>ÁREA</label><input name="area" required defaultValue={item.area}/></div><div className="field"><label>SEÇÃO</label><input name="section" defaultValue={item.section||''}/></div><div className="field"><label>CÓDIGO</label><input name="code" required defaultValue={item.code}/></div><div className="field"><label>CRITICIDADE</label><select name="criticality" defaultValue={item.criticality}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></div><div className="field field-wide"><label>PERGUNTA / VERIFICAÇÃO</label><input name="title" required minLength={5} defaultValue={item.title}/></div><div className="field field-wide"><label>ORIENTAÇÃO AO INSPETOR</label><textarea name="guidance" rows={3} defaultValue={item.guidance||''}/></div><div className="field"><label>RESPOSTA ESPERADA</label><select name="expected_answer" defaultValue={item.expected_answer||'Sim'}><option>Sim</option><option>Não</option><option>Não se aplica</option></select></div><div className="field"><label>EVIDÊNCIAS OBRIGATÓRIAS</label><label className="check-option"><input type="checkbox" name="photo_required" value="1" defaultChecked={item.photo_required===1}/> Foto</label><label className="check-option"><input type="checkbox" name="audio_required" value="1" defaultChecked={item.audio_required===1}/> Áudio</label></div></div>
      <div className="form-actions"><Link className="btn btn-ghost" href={`/modelos/${id}`}>Cancelar</Link><button className="btn btn-primary">Salvar alterações</button></div>
    </form>
    <form className="danger-zone" action={`/api/templates/${id}/items/${itemId}`} method="post"><input type="hidden" name="intent" value="delete"/><div><b>Excluir item do roteiro</b><p>Ele deixará de aparecer em novas inspeções. Inspeções e relatórios anteriores serão preservados.</p></div><ConfirmSubmit label="Excluir item" message="Excluir este item das próximas inspeções? O histórico existente será preservado."/></form>
  </AppShell>;
}
