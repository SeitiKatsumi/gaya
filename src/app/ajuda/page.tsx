import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Info,ShieldCheck} from 'lucide-react';
import {currentUser} from '@/lib/auth';
import {AppShell} from '@/components/app-shell';
import {roleLabel} from '@/lib/utils';

export default async function Help(){
  const user=await currentUser();if(!user)redirect('/login');
  const coordinates=user.role!=='INSPECTOR';
  const sections=[['inicio','Primeiros passos'],['unidades','Unidades e acessos'],['calendario','Calendário de Visitas'],['preenchimento','Preencher uma visita'],['evidencias','Fotos e áudio'],['revisao','Revisão e correções'],...(coordinates?[['enviados','Relatórios Enviados'],['mensais','Relatórios Mensais'],['planos','Planos de Ação']]:[]),['seguranca','Segurança e suporte']];
  return <AppShell user={user} active="help">
    <header className="topbar"><div><div className="eyebrow">Manual operacional</div><h1 className="title">Central de ajuda</h1></div><span className="badge success"><ShieldCheck size={13}/>{roleLabel(user.role)}</span></header>
    <div className="notice"><Info size={17}/><span>Você está conectado como <b>{roleLabel(user.role)}</b>. A coordenação organiza e revisa; o Responsável Técnico registra as visitas das suas unidades.</span></div>
    <div className="help-layout"><aside className="card help-nav">{sections.map(([id,label])=><a href={`#${id}`} key={id}>{label}</a>)}</aside><div className="help-content">
      <HelpSection id="inicio" title="Primeiros passos" intro="O trabalho acompanha o ciclo da visita: planejamento, preenchimento, revisão e envio ao cliente.">
        <Steps items={coordinates?[
          ['Confira as unidades','Abra Unidades e revise o responsável técnico, endereço, contato e links. O responsável deve estar vinculado a um usuário.'],
          ['Monte a agenda','No Calendário de Visitas, programe as visitas de cada unidade.'],
          ['Revise o que chegou','Em Relatórios Recebidos, use Examinar para conferir e aprovar as partes preenchidas pelo RT.'],
          ['Envie e acompanhe','Baixe o PDF aprovado, envie pelo canal combinado e registre o envio. Relatórios Mensais consolida indicadores e parecer; Planos de Ação acompanha as medidas e verificações.'],
        ]:[
          ['Consulte sua agenda','Confira as visitas das suas unidades no Calendário de Visitas.'],
          ['Abra o relatório','Em Meus relatórios, clique em Novo relatório e escolha a unidade e a data da visita.'],
          ['Preencha as partes visitadas','Escolha um departamento, responda uma pergunta por vez e salve. Uma visita pode preencher somente a fração do checklist realizada naquele dia.'],
          ['Envie para revisão','Ao terminar a visita, envie as partes preenchidas ao coordenador e acompanhe eventuais solicitações de correção.'],
        ]}/>
      </HelpSection>
      <HelpSection id="unidades" title="Unidades e acessos" intro="Cada unidade tem código, responsável técnico, endereço, Google Maps, ponto de contato, e-mail, telefone e formulário virtual.">
        <Steps items={[
          ['Consulta do RT','O Responsável Técnico consulta somente as unidades vinculadas ao seu usuário, sem editar cadastros ou a agenda.'],
          ['Edição da coordenação','O Coordenador pode adicionar e editar unidades da sua empresa. Escolha o responsável na lista de usuários; não é um campo de texto livre.'],
          ['Ative os acessos reais','Em Usuários, a coordenação completa o e-mail definitivo e a senha dos responsáveis importados antes de ativar as contas. Uma conta inativa não entra no aplicativo.'],
          ['Preserve o histórico','Desativar uma unidade ou um usuário impede novos usos, preservando relatórios, vínculos e autoria.'],
        ]}/>
      </HelpSection>
      <HelpSection id="calendario" title="Calendário de Visitas" intro="A coordenação monta a programação. O RT visualiza somente as visitas das suas unidades. Todos os horários seguem Brasília.">
        <Steps items={[
          ['Escolha a visualização','Use Mês ou Semana, Hoje, setas e filtros de unidade.'],
          ['Programe uma visita','Como coordenador, clique em Criar visita ou em um dia. Informe unidade, data, início, término e observações. O responsável vem do cadastro da unidade.'],
          ['Repita semanalmente','Marque a recorrência e escolha uma data final, por até um ano.'],
          ['Ajuste uma ocorrência','Clique em uma visita para editar ou cancelar. A alteração vale para aquela ocorrência e preserva o histórico. O RT abre os detalhes somente para consulta.'],
          ['Inicie o relatório','No detalhe da visita, o atalho para o relatório já seleciona unidade e data.'],
        ]}/>
      </HelpSection>
      <HelpSection id="preenchimento" title="Preencher uma visita" intro="O checklist é compartilhado entre as unidades. As visitas semanais verificam partes do roteiro; a cobertura mensal reúne os itens verificados ao longo do mês.">
        <Steps items={[
          ['Documentação','Registre se o documento está presente e vigente. Quando Sim, informe a disponibilização física ou digital e o vencimento. Periodicidade e quantidade de exemplares seguem o roteiro.'],
          ['Verificação técnica','Escolha o departamento e responda uma pergunta por vez. Salvar e continuar avança; anterior e próximo permitem conferir as respostas. Perguntas condicionais aparecem conforme a resposta anterior.'],
          ['Plano de ação','Para o setor visitado, registre não conformidades, medidas imediatas, ações corretivas, ações preventivas e responsáveis.'],
          ['Verifique planos anteriores','Confira os planos aprovados em visitas anteriores da mesma unidade e registre conclusão Sim/Não e observação.'],
          ['Envie as partes realizadas','Não é necessário preencher todo o checklist em uma única visita. O relatório enviado apresenta somente as seções preenchidas.'],
        ]}/>
      </HelpSection>
      <HelpSection id="evidencias" title="Fotos e áudio" intro="Fotos, áudio e observações são opcionais nos relatórios de visita. Confira o texto transcrito antes de salvar a resposta.">
        <Steps items={[
          ['Adicione uma foto','Escolha a câmera ou um arquivo. JPEG e PNG entram no PDF; outras fotos compatíveis são convertidas para JPEG. Limite por foto: 15 MB.'],
          ['Grave ou envie áudio','Use Gravar áudio e permita o microfone quando solicitado, ou envie um arquivo existente. Pare a gravação e ouça a prévia. Limite por áudio: 50 MB.'],
          ['Revise a transcrição','Aguarde a transcrição automática nas observações e corrija o que precisar. Se falhar, mantenha o áudio e digite o texto.'],
          ['Salve a resposta','Os anexos são enviados com o salvamento do item. Confira a confirmação e a visualização dos arquivos antes de sair.'],
        ]}/>
      </HelpSection>
      <HelpSection id="revisao" title="Revisão e correções" intro="O Coordenador examina somente as partes preenchidas da visita e aprova ou reprova cada seção.">
        <Steps items={[
          ['Recebimento e prazo','O envio pelo RT registra o recebimento e a data limite de dois dias úteis, de segunda a sexta-feira. Uma devolução não reinicia esse prazo.'],
          ['Examine as seções','Em Relatórios Recebidos, clique em Examinar. Durante a revisão, a coordenação pode editar as respostas e conferir fotos e observações.'],
          ['Aprove ou solicite correção','Aprove cada seção conferida ou reprove com um motivo. A devolução fica visível ao RT.'],
          ['Corrija e reenvie','O RT pode corrigir as seções devolvidas; as seções aprovadas permanecem bloqueadas. O histórico conserva os salvamentos e revisões.'],
        ]}/>
      </HelpSection>
      {coordinates&&<>
        <HelpSection id="enviados" title="Relatórios Enviados" intro="Depois de aprovar todas as seções, baixe o PDF e envie ao cliente pelo canal combinado.">
          <Steps items={[
            ['Confira o PDF','O arquivo contém os campos preenchidos, planos e fotos da visita.'],
            ['Registre o envio realizado','Informe data e destinatário somente depois de enviar. Esse registro não dispara e-mail.'],
            ['Consulte e filtre','Relatórios Enviados apresenta código da unidade, data, autor RT e arquivo para download. O PDF do envio fica preservado.'],
          ]}/>
        </HelpSection>
        <HelpSection id="mensais" title="Relatórios Mensais" intro="A coordenação entra nesta tela após o login. Selecione o mês da visita e todas as unidades ou uma unidade específica.">
          <Steps items={[
            ['Confira os quatro blocos','Indicadores consolidados, matriz comparativa das unidades, Pareto dos principais motivos de não conformidade e conclusão técnica.'],
            ['Leia a base de cálculo','Os indicadores executivos usam relatórios aprovados. Sem avaliações, a tela mostra Sem dados. A cobertura informa quanto do checklist foi verificado.'],
            ['Compare as unidades','Ordene a matriz e confira IGC, variação em pontos percentuais, documentação pendente e resolução de planos. Os destaques indicam os extremos do mês.'],
            ['Revise o parecer','Confira a síntese automática e salve sua revisão. Mudanças nos dados exigem nova revisão do texto.'],
            ['Baixe o PDF mensal','O PDF reúne os quatro blocos executivos. O acompanhamento operacional expansível permite abrir os relatórios que compõem o período.'],
          ]}/>
        </HelpSection>
        <HelpSection id="planos" title="Planos de Ação" intro="Acompanhe os planos aprovados das visitas por mês, unidade e situação.">
          <Steps items={[
            ['Consulte o plano','Confira os cinco campos e abra o relatório de origem.'],
            ['Acompanhe a verificação','A conclusão considera a última verificação aprovada de uma visita posterior da mesma unidade.'],
          ]}/>
        </HelpSection>
      </>}
      <HelpSection id="seguranca" title="Segurança e suporte" intro="Os acessos e arquivos respeitam a empresa, unidade e autoria de cada relatório.">
        <Steps items={[
          ['Acesso negado','Confira o perfil, a empresa e o responsável vinculado à unidade.'],
          ['Arquivo recusado','Verifique formato e tamanho. Renomear a extensão não converte o arquivo.'],
          ['Sessão expirada','Entre novamente; sessões expiram após 12 horas.'],
          ['Solicite suporte','Anote a tela, unidade, horário e mensagem de erro. Não compartilhe sua senha.'],
        ]}/>
        <p className="help-tip">Consulte <Link href="/privacidade">Privacidade</Link> e <Link href="/termos">Termos de Uso</Link>.</p>
        {user.role==='SUPER_ADMIN'&&<p className="help-tip">A administração também mantém Empresas, Modelos, Projetos e os registros de inspeções anteriores.</p>}
      </HelpSection>
    </div></div>
  </AppShell>;
}
function HelpSection({id,title,intro,children}:{id:string;title:string;intro:string;children:React.ReactNode}){return <section id={id} className="card help-section"><h2>{title}</h2><p>{intro}</p>{children}</section>;}
function Steps({items}:{items:[string,string][]}){return <div className="step-list">{items.map(([title,text])=><div className="step" key={title}><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>;}
