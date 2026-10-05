# Escopo Gaya — conferência das fontes

Conferência de 02/10/2026, atualizada com as duas reuniões e os componentes do relatório mensal. “Implementado” indica código e telas disponíveis nas fontes atuais; não significa homologação pela equipe Gaya. A complementação da segunda reunião foi implementada e validada localmente; as interpretações a homologar estão explicitadas abaixo.

## Fontes

- Reunião de 25/09/2026: `Gaya alterações escopo - Elevenmind .txt`, participantes João Victor C. Campos, Seiti Katsumi e Vicente Zippinotti. A transcrição foi tratada como evidência de requisitos.
- [Planilha de referência](https://docs.google.com/spreadsheets/d/1TJPJfzveH1usMXqZDD-ki5GBxh0r-VMrL9r4hogffV0/edit), cópia de consulta `tmp/gaya-reference-current.xlsx`. Sete abas, todas conferidas.
- Reunião de 30/09/2026: `C:/Users/Pichau/Downloads/Meeting Transcription (1).txt`, 14 minutos, participantes João Victor C. Campos e Vicente Zippinotti. Complementa o escopo com dashboard e PDF mensal; a transcrição foi tratada como evidência de requisitos.
- Documento da segunda reunião: `C:/Users/Pichau/Downloads/Relatório Mensal - Componentes.docx`. Define quatro blocos do relatório mensal, indicadores e matriz de comparação. Texto, tabela e duas referências visuais foram conferidos. As imagens ilustram quadrados e gráficos no estilo Windows 8; João permite outra representação visual na reunião de 30/09, 08:12.
- O arquivo XLSX não contém fórmulas. Os `#VALUE!` da referência são valores ilustrativos em fotos/arquivos, sem regra de negócio a reproduzir. A única imagem embutida mostra um exemplo de pergunta no celular, Sim/Não, câmera, microfone, texto digitado/gravado e botão “Analisar Transcrição”. A ação desse último botão não é detalhada.

## Conferência por tela

| Aba / tela | Conteúdo e comportamento da fonte | Estado observado / lacuna |
| --- | --- | --- |
| 1. Login e Senha | Login e senha individuais. Dois perfis operacionais: coordenador e responsável técnico (reunião 22:02–23:14). | Implementado: autenticação, dois perfis operacionais e isolamento por empresa. Há perfil administrativo da plataforma adicional. A tela Usuários permite completar o e-mail definitivo, definir senha e ativar os RTs importados; a API impede ativação com e-mail provisório ou sem senha. Os quatro cadastros reais seguem inativos porque esses dados não foram fornecidos. |
| 2. Unidades | B4:I17: código, RT, endereço, Maps, ponto de contato, e-mail, telefones e formulário. Adicionar/editar para coordenador. RT vê somente suas unidades, sem editar (03:04–04:30 e 22:02–22:53). | Implementado: tabela com oito campos, adicionar/editar, RT relacional a usuários, links/textos estáticos e escopo por responsável. Banco: 13 linhas importadas, além de duas demonstrações. `SP04 & SP14` foi mantida como uma linha, conforme B6. Pendências da própria fonte: contato/Maps de MG03 e e-mail de MG01 com espaço. Não substituir por informação inventada. |
| 3. Calendário de Visitas | Exercício/ano e meses; visualização mensal/semanal aceita, estilo agenda Google; coordenação monta/edita, RT consulta somente suas unidades. Visitas semanais recorrentes, quatro horas, calendário anual (04:30–09:31, 11:18). | Implementado: mês/semana, seletor de data, horários, repetição semanal até data final, edição/cancelamento pelo coordenador e consulta por RT. A fonte é um modelo demonstrativo, não uma agenda confirmada: João diz “não tá correto […] demonstrativo” em 06:01. Horários de cada visita não foram fornecidos; a agenda ilustrativa não foi importada como compromissos reais. |
| 4. Relatórios Recebidos (Revisão) | B2:F16: código, data de recebimento, autor RT, data limite de envio e Examinar. Prazo de dois dias úteis após recebimento (09:31–10:11). | Implementado: tabela, recebimento, autoria, prazo e Examinar; relatórios em rascunho não aparecem como recebidos. Prazo atual ignora fins de semana. Tratamento de feriados municipais/estaduais não foi definido na reunião. |
| 5. Relatórios Recebidos — Parte 2 | Examinar exibe somente seções preenchidas na visita (K2; 11:18–12:31). Documentos, armazenamento, plano de ação e verificação de planos anteriores. Editar, aprovar ou reprovar cada seção; reprovação devolve ao RT para corrigir (13:51–15:20 e 18:50–20:26). | Implementado: somente respostas enviadas, edição pelo coordenador durante revisão, aprovação por seção, reprovação com motivo, correção pelo RT, histórico e PDF. Os 55 documentos da fonte estão no catálogo, com periodicidades e exemplares fixos. Há planos de ação por setor e verificação de planos aprovados anteriores da mesma unidade. |
| 6. Em progresso | B9:H77 repete documentação. U8:AB102 contém o checklist completo de operação: departamento, pergunta, bibliografia e observação. A fonte contém 86 perguntas em nove departamentos, incluindo 14 condicionais. Fotografias e gravação/transcrição opcionais (16:23–18:47). | Implementado: 86 perguntas, 14 condicionais, nove departamentos, orientações auxiliares e formulário do RT por departamento com uma pergunta por vez. O coordenador mantém a tabela de revisão. Bibliografia não está preenchida na fonte: P9:P28 é `-` e AA não fornece referências; o app mostra informação não fornecida. Foto/áudio e texto são opcionais. Serviço local Whisper transcreve gravações e arquivos enviados, com revisão do texto pelo RT e alternativa de digitar em caso de erro; depende do runtime e modelo configurados no servidor. |
| 7. Relatórios Enviados | B3:E9: código, data de envio, autor RT e arquivo para download. Filtrar entradas (B11). Após todas as aprovações, mandar ao cliente; baixar/salvar arquivo e enviar externamente é alternativa expressamente aceita (19:33–20:26). | Implementado: tela própria com código, data de envio, autor, download e filtro por código. O coordenador baixa o relatório aprovado, realiza o envio fora do app e registra o envio efetuado; o PDF correspondente fica preservado. Aprovação/download não registram envio automaticamente. Integração automática de e-mail não configurada; reunião 20:27–21:07 indica destinatário da matriz e necessidade de cadastrar disparador. |

## Conteúdo do relatório

- Documentação: 55 títulos em 11 grupos, conferidos com B13:H78 da aba 5. Campos: presente e vigente Sim/Não, se Sim uma das duas disponibilizações literais, vencimento, periodicidade fixa, exemplares fixos.
- As duas disponibilizações são “Impresso em Pasta Física” e “Segundo qualidade, disponível para impressão em formato digital”.
- Plano de ação por setor visitado (aba 5, AG2:AJ19): Não Conformidade(s), Medidas Imediatas, Ação(ões) Corretiva(s), Ação(ões) Preventiva(s), Responsáveis.
- Verificação de planos anteriores: citada em F4, sem modelo de campos próprio. A implementação usa planos aprovados anteriores da mesma unidade, conclusão Sim/Não e observação; é uma interpretação operacional a homologar.
- Uma visita semanal verifica uma fração do checklist. A cobertura completa ocorre ao longo do mês (11:18–12:31). A fonte não fixa qual setor pertence a cada semana; permitir escolha das partes verificadas, sem exigir o checklist inteiro em cada visita.
- O formulário do RT permite escolher departamento, responder um item, salvar e continuar, navegar anterior/próximo e consultar quantidade salva. Condicionais aparecem conforme a resposta anterior. Seções já aprovadas ficam somente para consulta durante correções.

| Departamento da aba Em progresso | Perguntas | Condicionais | Fonte |
| --- | ---: | ---: | --- |
| Acesso as Premissas da Operação | 2 | 1 | W9:W10 |
| Docas de Entrada | 5 | 0 | W12:W16 |
| Recebimento (Stage) | 8 | 1 | W18:W25 |
| Área de Quarentena/Avarias | 18 | 3 | W27:W44 |
| Área de Descarte de Resíduos | 11 | 1 | W46:W56 |
| Docas de Saída | 4 | 0 | W58:W61 |
| Área de Despacho (Expedição) | 3 | 0 | W63:W65 |
| Higienização e Controle de Pragas | 18 | 4 | W67:W84 |
| Áreas de Armazenamento de Produtos de Interesse a Saúde | 17 | 4 | W86:W102 |
| Total | 86 | 14 | U8:AB102 |

## Requisitos citados sem detalhamento

- Na primeira reunião, João deixou as estatísticas mensais para a reunião seguinte (21:07–21:46). A reunião de 30/09 e o DOCX agora especificam os quatro blocos descritos abaixo; as sete abas permanecem a fonte dos dados das visitas.
- Não há protocolo de divisão fixa dos setores entre as quatro semanas, lista de feriados para prazo, conteúdo de e-mail, endereço da matriz ou configuração do remetente.
- Não há uma regra especificada para análise por IA da transcrição. A referência define armazenamento da observação transcrita e ilustra o botão, sem detalhar geração, classificação ou alteração automática de respostas.
- João informa em 30/09, 11:56 que ainda irá marcar quais respostas Sim/Não são corretas. Essa marcação oficial não está nos arquivos fornecidos. A chave do modelo atual é uma interpretação do texto das perguntas, registrada no snapshot de cada visita, e deve ser homologada pela Gaya.

## Telas complementares implementadas

- Visão geral: retirada da navegação em 05/10/2026 a pedido do usuário, por duplicar o conteúdo de Relatórios Mensais. Indicadores, parecer e acompanhamento operacional permanecem no módulo mensal. A coordenação entra em Relatórios Mensais e o RT em Meus relatórios; endereços antigos da Visão geral redirecionam conforme o perfil.
- Relatórios Mensais: filtros mês/unidade, cobertura única dos itens aplicáveis ao longo das visitas do mês e PDF consolidado já disponíveis. A segunda reunião acrescenta os indicadores, matriz comparativa, Pareto e parecer descritos abaixo. Um item repetido conta uma vez na cobertura de cada unidade/modelo; o IGC ponderado considera as respostas avaliadas de cada visita. Os indicadores não representam uma validação sanitária independente nem uma meta ainda não informada.
- Planos de Ação: filtros por mês/unidade/situação, cinco campos da ficha, relatório de origem e verificações posteriores. A conclusão considera a última verificação aprovada em visita posterior da mesma unidade. Essa regra é uma interpretação explícita, pois a fonte não detalha o controle de conclusão.

## Dashboard e PDF mensal — segunda reunião

João pede uma visão global mensal, visual e curta, em aproximadamente duas folhas de PDF para facilitar a circulação interna entre setores (30/09, 07:07–10:14). As inspeções e relatórios semanais continuam sendo o registro detalhado. Download do PDF é necessário nesta entrega; envio automático por e-mail depende de integração posterior (11:16–11:43).

| Bloco do DOCX | Conteúdo exigido | Implementação local |
| --- | --- | --- |
| I. Dashboard Executivo e KPIs Consolidados | IGC ponderado geral; volume de NCs por setor; percentual documental pendente/indisponível; índice de reincidência. Quadrados coloridos são uma sugestão visual. | Quatro indicadores calculados dos relatórios aprovados, com quantidade/base de cálculo e cobertura visíveis. Valores inexistentes aparecem sem dados, não como zero de desempenho. |
| II. Ranking e Benchmark Interativo entre Unidades | Matriz: Código da Unidade, IGC do Mês, Variação vs. Mês Anterior, Percentual da Documentação Pendente, Índice de Reincidência. Destacar automaticamente maior IGC e piores demais indicadores. | Matriz filtrada por mês/unidade, comparação com mês anterior, destaques de prioridade e acesso à unidade. Sem base anterior, a variação não é calculada. Os números SP02 98,5%, SP04 e 14 91,0%, RC01 85,4% e demais percentuais do DOCX são exemplos; não serão importados como resultados reais. |
| III. Gestão de Planos de Ação e Reincidências | Destaque automático dos oito principais motivos geradores de NCs, gráfico de Pareto. | Até oito motivos observados a partir das perguntas técnicas não conformes, com frequência e percentual acumulado. Sem inventar oito categorias quando houver menos motivos, nem atribuir causa-raiz não registrada. Planos e verificações fornecem os dados de resolução. |
| IV. Conclusão Técnica e Parecer Sintético | Texto automático dos pontos mais críticos, revisado pelo Coordenador, com prioridades para diretoria/qualidade. | Síntese factual gerada dos indicadores e motivos observados; parecer revisado e persistido por Coordenador no mês/escopo. Mudança dos dados invalida a revisão anterior. PDF usa o parecer correspondente à base atual. |

### Bases de cálculo adotadas

As fontes não detalham todos os denominadores. As decisões abaixo estão identificadas na tela e no PDF para homologação:

- Período: data da visita no mês selecionado. Indicadores executivos usam somente relatórios aprovados e respostas atuais aplicáveis do snapshot, respeitando empresa/unidade/RT. Rascunhos, revisão pendente e cancelamentos não entram nos resultados executivos.
- IGC: `100 × soma dos pesos das respostas conformes / soma dos pesos das respostas binárias avaliadas`. Inclui perguntas técnicas e documentais; os pesos são os do snapshot, com peso 1 como padrão. Respostas sem chave válida, desconhecidas ou “Não se aplica” ficam fora do denominador; cobertura é mostrada separadamente para não tratar item não verificado como falha nem como conformidade. O texto “totalidade das perguntas” não define pesos específicos ou exclusão documental. A escolha de incluir documentos e usar respostas avaliadas é uma interpretação explícita.
- Variação de IGC: diferença em pontos percentuais entre o mês selecionado e o anterior, usando o mesmo cálculo. Não se calcula variação sem respostas avaliadas em ambos os períodos.
- Documentação: último registro conhecido de cada documento por unidade/modelo/item no mês. `100 × documentos marcados “Não” / documentos com resposta conhecida`. Não respondidos permanecem desconhecidos e aparecem na cobertura; não são tratados como automaticamente vigentes. As respostas presentes/vigentes e a disponibilização física/digital continuam sendo registradas pelo RT.
- Setores com pendências: departamentos técnicos com pelo menos uma resposta não conforme ou plano de ação registrado, contados uma vez por unidade/departamento, divididos pelo total de departamentos técnicos aplicáveis nas visitas do mês. É a proporção por setor solicitada no DOCX, não o número bruto de perguntas com falhas.
- Fórmula literal do campo chamado “Índice de Reincidência” no DOCX: `100 × resoluções / planos de ação`. A descrição de problemas que voltam a ocorrer diverge dessa fórmula, que mede resolução. A implementação preserva a fórmula fornecida e explica que se trata de resolução de planos; a definição de um índice distinto de reincidência real fica pendente de alinhamento com a Gaya. O denominador reúne planos de relatórios aprovados das visitas do mês; resolução depende da última verificação aprovada até o último dia do mês, sem usar conclusão futura para melhorar resultado passado.
- Pareto: ocorrências de respostas técnicas não conformes agrupadas pelo departamento, título da pergunta e resposta observada, em ordem de frequência. Os exemplos “falha de infraestrutura”, “erro operacional de terceiros” e “ausência de registros de temperatura” não constituem uma taxonomia fornecida. Pergunta/motivo observado não comprova causalidade. Não existe campo estruturado de causa-raiz nas fontes atuais.
- Parecer: texto automático factual, baseado nos indicadores e motivos observados, com revisão do Coordenador. João sugere IA “se possível” (10:14); a geração automática não depende de um serviço externo nem altera respostas/planos. A revisão se vincula ao conjunto de dados usado para gerar o parecer.

O PDF executivo usa esses quatro blocos em aproximadamente duas páginas para as 15 unidades locais, preservando a legibilidade. O detalhamento de cada visita e os cinco campos completos dos planos continuam disponíveis nos módulos e PDFs próprios.

## Calendário demonstrativo

O exemplo repete segunda-feira `SP04 e SP14` + `MG01`; terça-feira `SP02 e SP15` + `RC03 e SP06` + `MG02 e MG02`; quarta-feira `RC02`; quinta-feira `SP25 e SP26`; sexta-feira `RC01 e SP10`. Não há horário de início/fim por unidade. A repetição `MG02 e MG02` não autoriza assumir que a segunda ocorrência seja MG03.

A consulta online de 05/10/2026 mantém o calendário demonstrativo com datas que não correspondem aos dias da semana de 2026: C15=4 em segunda-feira (04/10 é domingo), C46=1 em segunda-feira (01/11 é domingo) e C64/C70=20/27 em segunda-feira (20/11 e 27/11 são sextas). G33/I33 agora trazem 28/29, corrigindo a divergência específica anteriormente registrada. Sem horários confirmados, a referência não foi importada como compromisso real. A fonte também marca Nossa Senhora Aparecida, Finados, Consciência Negra, Natal e Réveillon; o último é indicação da agenda, não definição de feriado para cálculo de prazo.

## Verificações desta conferência

Leitura da transcrição, das sete abas, do único mockup embutido, das telas/APIs citadas e consultas SQLite em modo somente leitura. As planilhas e dados reais de acesso não foram alterados nesta conferência.

Verificações executadas para as alterações deste agente: ESLint dos componentes do formulário/wizard e da Visão geral; TypeScript sem emissão; renderização SSR em memória para pergunta única, associação de formulário/arquivos, bloqueio das seções aprovadas, campos documentais, seleção/progresso e atalhos/contagens por perfil. Todas passaram. Estas verificações não substituem testes HTTP, gravação real ou avaliação visual no navegador dos módulos integrados; esses resultados devem constar na entrega principal.

### Validação integrada anterior à complementação de 30/09

- Build Next.js, TypeScript e ESLint passaram. `scripts/test.ts` passou com 30 verificações; passaram também `test-permissions.ts`, `test-calendar.ts`, `test-received-reports.ts`, `test-sent-reports.ts`, `test-monthly-reports.ts` e `test-transcription.ts`.
- Os testes HTTP cobriram autenticação, isolamento de empresa/unidade/RT, ativação de usuários importados com e-mail e senha definitivos, bloqueio de origem indevida, recorrência, validação de horários e distribuição visual de visitas sobrepostas, revisão por seção, condicionais, devolução com motivo visível ao RT, correção, reenvio e preservação do prazo inicial.
- A cobertura mensal foi verificada com quatro visitas parciais que, juntas, cobrem quatro itens: 100% (4/4). Repetição não aumenta a cobertura; unidades distintas possuem denominadores próprios. Planos só são concluídos por verificação posterior aprovada da mesma unidade.
- No navegador, foram exercitados login, unidades por perfil, calendário consultivo do RT, criação de quatro visitas recorrentes pela coordenação, relatório por departamento, salvamento documental, foto WebP convertida para JPEG, áudio WAV transcrito automaticamente, salvamento nativo dos anexos, envio para revisão, aprovação e registro externo do envio em empresa isolada de teste. Não houve disparo de mensagem real.
- PDFs de visita, enviados e mensal foram renderizados e inspecionados. A foto convertida e a observação transcrita constam no PDF de visita; o arquivo registrado em Enviados é imutável. O PDF mensal mantém rodapé nas páginas de conteúdo.
- Visualização móvel conferida em 390 × 844: uma pergunta por vez, controles acessíveis e sem transbordamento horizontal do documento. Captura de câmera/microfone físico depende das permissões do navegador e não foi exercitada; o teste de transcrição utilizou fala sintética em português e Whisper local.
- As empresas, usuários, visitas, relatórios e anexos criados para esses testes foram removidos. Permanecem as 13 entradas importadas e duas unidades de demonstração. Estas duas foram vinculadas à RT demonstrativa Camila Nunes para permitir exercitar o ambiente local; as atribuições reais da planilha foram preservadas.

### Validação da segunda reunião concluída em 02/10/2026

- Build Next.js, TypeScript e ESLint dos arquivos alterados passaram. As seis verificações de domínio, permissões, calendário, recebidos, enviados e mensal/planos passaram novamente. `scripts/test-executive-monthly.ts` cobre a complementação em banco e HTTP.
- O teste executivo comprova IGC ponderado com pesos distintos e respostas esperadas Sim/Não, exclusão de condicionais inaplicáveis, itens desconhecidos e não aplicáveis, última resposta documental única, setores únicos, variação em pontos percentuais e Pareto limitado a oito com denominador de todas as ocorrências.
- A resolução de outubro considera as verificações aprovadas das visitas até outubro; uma resolução de novembro não melhora o indicador do mês anterior. Relatórios pendentes, rascunhos, cancelados e dados de outra empresa ficam fora. Ausência de avaliação aparece sem dados.
- Parecer salvo por Coordenador no escopo/mês; mudanças da base invalidam a revisão. RT e origens indevidas não podem salvar. Texto agregado de outras unidades não é exposto ao RT. Formulários nativos normalizam quebras de linha para respeitar o limite visível de 1.800 caracteres.
- No navegador, foram verificados filtros de mês/unidade, ordenação e busca da matriz, Pareto, salvamento e confirmação do parecer, reaproveitamento da revisão entre dashboard e mensal, consulta restrita do RT e download real do PDF. Layout móvel em 390 × 844 sem transbordamento horizontal do documento.
- O PDF baixado pelo app foi renderizado e inspecionado: duas páginas com três unidades, oito motivos e parecer revisado de mais de mil caracteres, sem cortes ou páginas vazias. QA adicional confirmou duas páginas com 15 unidades e período vazio. Conteúdo excepcionalmente longo continua em páginas adicionais, preservando o texto.
- Os registros temporários de QA foram removidos. Permanecem a empresa original, 15 unidades e os relatórios locais anteriores. Nenhum disparo de e-mail ou publicação externa foi realizado.

### Conferência para apresentação em 05/10/2026

- Referência lida novamente pelo Google Drive: todas as sete abas, incluindo Em progresso, oculta na planilha. A leitura online ficou registrada em tmp/reference-live-20261005.json. Os oito campos e 13 entradas de Unidades coincidem com a importação; os 55 documentos, periodicidades, exemplares, 86 perguntas, 14 condicionais e orientações coincidem com o catálogo. As duas transcrições e o DOCX mensal foram conferidos.
- Visão geral removida. Login e acesso inicial levam a coordenação para Mensais e o RT para Meus relatórios. O endereço antigo preserva filtros mensais para a coordenação. A navegação operacional reúne os módulos acordados; os links de Inspeções, Modelos, Não conformidades e Projetos anteriores permanecem na Administração.
- Ranking e PDF mensal agora destacam também a menor variação comparável do IGC, em pontos percentuais, com empates e ausência de base respeitados. Histórico do item apresenta resultados em português e volta à pergunta/departamento correto. Central de ajuda descreve o preenchimento parcial semanal e o ciclo atual de revisão/envio. As APIs de unidades passaram a aplicar a mesma verificação de origem das demais operações.
- ESLint completo de src/scripts, TypeScript e build de produção passaram. As seis suítes de domínio/permissões/calendário/recebidos/enviados/mensal passaram; permissions e received foram executadas novamente após as correções. O teste executivo mensal passou com os novos destaques, revisão, escopo e PDF. Whisper local transcreveu novamente o áudio sintético em português.
- PDF baixado pelo navegador, renderizado e inspecionado nas duas páginas: quatro blocos completos, destaque novo e parecer integral, sem cortes ou páginas vazias. O teste adicional mantém duas páginas com 15 unidades e período vazio, e preserva texto longo.
- Navegador confirmou entrada da coordenação em Mensais, entrada do RT em Meus relatórios e calendário consultivo restrito às suas unidades. A versão compilada roda localmente em http://localhost:3000, com saúde, banco, armazenamento, páginas, navegação, acesso por perfil e filtros antigos validados em HTTP.
- A empresa temporária de QA foi removida. Companies, users, units, inspections, responses, templates e template_items foram comparadas integralmente com o backup anterior à conferência: os registros originais permanecem iguais. Backup: tmp/gaya-before-presentation-20261005.sqlite.
- Pendências de homologação da fonte continuam explícitas: gabarito oficial Sim/Não, definição distinta de reincidência se desejada, e-mails/acessos definitivos dos RTs e horários reais da agenda. Envio externo manual é o fluxo aceito e implementado; integração automática de e-mail depende de configuração posterior. Não houve publicação externa nesta conferência.
