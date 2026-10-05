# Gaya

Plataforma operacional, responsiva e mobile-first para planejar, executar, supervisionar e documentar inspeções e visitas técnicas. O produto inclui autenticação, três perfis, isolamento por empresa, usuários, projetos, modelos, inspeções, respostas versionadas, fotos, áudios, vídeos, não conformidades com plano de ação, auditoria, PDF e uma Central de Ajuda por perfil.

## Tecnologias

Next.js 16, React 19, TypeScript, SQLite nativo do Node (`node:sqlite`), autenticação JWT em cookie HttpOnly, Zod, bcrypt, PDFKit e Docker.

## Início local

Requisitos: Node 22 e pnpm.

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

Por padrão local, a aplicação cria `data/gaya.sqlite` e `storage/`. Em produção, defina um `SESSION_SECRET` aleatório de pelo menos 32 caracteres.

## Usuários demonstrativos

| Perfil | E-mail | Senha |
|---|---|---|
| Super Admin | `admin@gaya.app` | `Gaya@2026` |
| Supervisor | `supervisor@gaya.app` | `Gaya@2026` |
| Inspetor | `inspetor@gaya.app` | `Gaya@2026` |

Altere ou remova esses usuários antes de disponibilizar uma instância real.

## Validação

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Docker

```bash
docker compose up --build
```

A aplicação fica disponível em `http://localhost` (porta 80). O health check é `GET /api/health`. Os volumes nomeados preservam banco, mídias e backups entre recriações.

## CapRover

1. Crie um aplicativo com uma única instância.
2. Conecte o repositório GitHub e mantenha `captain-definition` na raiz.
3. Configure volumes persistentes: `/app/data`, `/app/storage` e `/app/backups`. No ambiente atual, os rótulos são `gaya-data`, `gaya-storage` e `gaya-backups`.
4. Configure as variáveis de `.env.example`, especialmente `SESSION_SECRET` e `APP_URL`.
5. Habilite HTTPS e direcione o domínio para o app. A porta interna é 80.
6. Não habilite múltiplas réplicas enquanto SQLite for usado.

As tabelas são criadas de forma idempotente na primeira inicialização. O SQLite usa WAL, chaves estrangeiras e `busy_timeout`.

## Backup e restauração

```bash
pnpm backup
```

O comando cria uma cópia consistente do SQLite com `VACUUM INTO`, inclui o armazenamento e gera `backups/gaya-DATA.tar.gz`. Para restaurar, pare o aplicativo, preserve uma cópia dos volumes atuais, extraia `gaya.sqlite` em `/app/data` e `storage/` em `/app/storage`, confira proprietário/permissões e reinicie. Nunca restaure sobre uma instância em escrita.

## Estrutura

- `src/app`: interface e rotas HTTP.
- `src/lib/db.ts`: schema, migrations idempotentes, seed e auditoria.
- `src/lib/auth.ts`: sessão e autorização.
- `scripts`: migração, seed, início e backup.
- `data` e `storage`: persistência local (ignorados pelo Git).

## Segurança e LGPD

As permissões são verificadas no servidor, inclusive para impedir que Inspetores acessem cadastros ou inspeções não atribuídas. Supervisores administram usuários, projetos, modelos e inspeções somente da própria empresa. Cookies de sessão são HttpOnly, evidências recebem hash SHA-256, o acesso a arquivos exige autorização e logs registram ações relevantes. Não armazene segredos no repositório. A política de privacidade está em `/privacidade` e os termos em `/termos`.

## Fluxos operacionais

- Supervisor: cadastra usuários e unidades da própria empresa, administra projetos e modelos; programa inspeções; revisa, solicita ajustes, aprova e administra planos de ação.
- Inspetor: acessa apenas inspeções atribuídas, responde itens, envia evidências e encaminha o trabalho concluído para revisão.
- Super Admin: possui visão global, cadastra empresas com unidade inicial e administra dados entre clientes.
- Evidências: fotos até 15 MB, áudios até 50 MB e vídeos até 300 MB por envio. Os bytes ficam em `/app/storage`; metadados e hashes ficam no SQLite.
- Captura móvel: áudio e vídeo podem ser gravados diretamente no navegador com prévia antes do envio; quando `MediaRecorder` não estiver disponível, a interface oferece seleção de arquivo como alternativa.
- Relatórios de visita: o áudio gravado ou selecionado é transcrito automaticamente nas observações. Confira o texto e salve a resposta para persistir os arquivos. Se a transcrição falhar, o áudio permanece selecionado e as observações podem ser digitadas.
- Fotos dos relatórios: JPEG e PNG entram no PDF; outros formatos decodificáveis pelo navegador são convertidos para JPEG antes de salvar, preservando a resolução. Se a conversão não estiver disponível, selecione JPEG ou PNG.
- Ajuda: `/ajuda` contém a matriz de permissões e o passo a passo de todos os fluxos disponíveis.
- Relatórios Mensais: filtros de mês/unidade, IGC ponderado, setores com pendências, documentos pendentes, comparação com o mês anterior e Pareto dos oito motivos mais frequentes. Os indicadores executivos usam relatórios aprovados; a cobertura mostra os itens efetivamente avaliados. A Visão geral foi retirada da navegação; a coordenação entra em Relatórios Mensais e o RT em Meus relatórios.
- PDF mensal: síntese visual em quatro blocos, com parecer automático revisável pelo Coordenador. A revisão fica vinculada aos dados; alterações pedem nova conferência. A fórmula informada para reincidência é resoluções/planos e representa taxa de resolução. Bases e interpretações estão em `docs/escopo-gaya.md`; verificação executável: `node --experimental-strip-types scripts/test-executive-monthly.ts` com o servidor local ativo.

Os redirecionamentos após formulários usam `APP_URL` e os cabeçalhos `X-Forwarded-Host`/`X-Forwarded-Proto`. Isso mantém a navegação no domínio público quando a aplicação roda atrás do proxy do CapRover, mesmo que o container escute em `0.0.0.0:80`.

## Limites e evolução

SQLite atende a implantação inicial em uma única instância. Para maior concorrência ou múltiplas réplicas, migre para PostgreSQL, substitua a camada de banco preservando os identificadores e mova mídias para storage compatível com S3. Fotos, áudios e vídeos são persistidos e servidos com autorização e suporte a `Range`. O modo offline completo requer uma fase adicional de sincronização e resolução de conflitos.

A transcrição usa `faster-whisper` local, em português, com modelo `base` no cache e processamento CPU. Configure `TRANSCRIPTION_PROVIDER=local`, `LOCAL_WHISPER_PYTHON` com o executável Python que possui essa biblioteca e `LOCAL_WHISPER_CACHE` com o cache do modelo já baixado. `LOCAL_WHISPER_MODEL` permite escolher outro modelo já disponível. O servidor não baixa modelos nem envia áudio a terceiros. Uma transcrição é processada por vez, com limite de dois minutos de processamento; em indisponibilidade, o arquivo continua disponível para salvar e o texto pode ser preenchido manualmente. O container Docker exige que esse runtime e cache sejam disponibilizados para habilitar a transcrição.
