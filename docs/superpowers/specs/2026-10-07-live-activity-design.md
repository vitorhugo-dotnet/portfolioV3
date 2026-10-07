# Atividade ao vivo e deploys Cloudflare

## Objetivo e contexto

Implementar a issue #1 do portfolioV3 e a extensão solicitada para CI: preview automático de PRs e disparo manual com escolha entre produção e preview. Preservar Next.js com `output: "export"`, TypeScript, identidade visual japonesa e animações existentes. O desenho inicial foi aprovado em 07/10/2026.

Hoje o frontend consulta eventos públicos do GitHub e a CI valida, testa e exporta o site. O workflow `.github/workflows/cloudflare-pages.yml` publica somente a branch main. A nova seção complementa a atividade do GitHub.

## Arquitetura

Adicionar um Worker independente em `worker/`, com configuração Wrangler e ambientes production e preview. Não adicionar servidor Next.js, banco, KV, WebSockets ou OAuth interativo ao portfolio. Um contrato público compartilhado em `lib/live-activity.ts` não importa código nem configuração privados do Worker.

O browser consulta somente `GET /api/activity` do Worker. A URL pública é configurada por ambiente no build do site; somente essa URL pode usar `NEXT_PUBLIC_*`. O Worker é implantado antes do site para que o build use a URL correta. A configuração documenta as URLs dos dois Workers e os secrets necessários, sem valores reais no repositório.

## Contrato e provedores

O DTO conserva os campos de coding, spotify e simkl sugeridos na issue, com `generatedAt`, timestamp da observação quando disponível e estado por provedor: disponível, vazio, indisponível ou não configurado. Ausência de credenciais não causa falha global. Não anunciar atividade como atual usando apenas o horário da consulta.

WakaTime consulta atividade recente e resumo do dia; coding ativo depende de um heartbeat recente, com janela de cinco minutos. Informações ausentes permanecem ausentes. Não expor caminhos de arquivos, branches, identificadores privados ou payloads brutos. Nome de projeto só é publicado por configuração explícita; linguagem, editor e duração são permitidos.

Spotify obtém access token com client ID, client secret e refresh token armazenados em Cloudflare Secrets; reutiliza o access token em memória até perto de expirar. Consulta a faixa atual e, quando ausente, a mais recente. Uma resposta 401 permite uma renovação e uma tentativa adicional. Não persistir tokens em cache público nem devolver dados de conta.

Simkl utiliza client ID e access token para atividade disponível da conta. Usar histórico recente quando o provedor não oferecer evidência de reprodução atual, sem inventar status "assistindo agora". Publicar somente tipo, título, episódio e URLs públicas.

Cada integração possui timeout e normalização próprios; chamadas independentes executam em paralelo. Falhas, JSON inválido e rate limits afetam somente o card correspondente. Logs não contêm credenciais, headers de autenticação nem corpos privados.

## Endpoint, cache e segurança

Somente GET e OPTIONS em `/api/activity`; outras rotas retornam 404 e métodos não aceitos retornam 405. Nenhum parâmetro recebido escolhe URL de provedor. Validar e limitar strings e aceitar somente URLs HTTPS de mídia e links públicos apropriados.

Cachear somente o DTO normalizado no Cache API do Worker por 60 segundos, com chave fixa por origem/ambiente e escrita via `waitUntil`. Respostas parciais também podem ser cacheadas pelo mesmo intervalo. `generatedAt` é preservado no cache. Não haverá fallback persistente além desse cache nesta primeira versão.

CORS permite os dois domínios existentes e o domínio Pages do projeto, incluindo seus previews, validando hostname com limites de sufixo. localhost é permitido apenas em desenvolvimento. Não usar cookies ou credentials no fetch. CORS não torna o endpoint privado: todo campo retornado deve ser seguro para acesso público.

Secrets do Worker: `WAKATIME_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`, `SIMKL_CLIENT_ID`, `SIMKL_ACCESS_TOKEN`. Configuração não secreta inclui origens autorizadas e opção de exposição do nome de projeto. Secrets são provisionados separadamente nos dois ambientes usando Wrangler; CI não os injeta em assets do site.

## Frontend

Criar componente próprio com três cards integrado à seção de atividade existente, usando estilos responsivos e os componentes de reveal existentes. Respeitar movimento reduzido. Incluir skeleton, estado vazio, falha por provedor, indisponibilidade geral e endpoint não configurado. Não usar dados fictícios como atividade real.

Atualizar a cada 60 segundos somente quando a aba e a seção estiverem visíveis, usando Page Visibility e IntersectionObserver. Abortar requests ao desmontar, impedir sobreposição e retomar ao voltar à seção. Mostrar horário da atualização e distinguir atividade atual de recente; marcar dados antigos após dois minutos sem atualização bem-sucedida.

## CI e ambientes

Manter lint, typecheck, testes e verificação do export estático como pré-requisitos de deploy. Incluir validação e dry-run do bundle Worker.

`workflow_dispatch` recebe input obrigatório `environment`, tipo choice, opções `preview` e `production`, padrão preview. Disparo manual publica o ref selecionado no ambiente escolhido. Push e execução agendada de main continuam publicando produção. PRs destinados a main publicam sempre preview após os checks, com branch Pages estável `pr-<numero>`; nunca usar o nome main para um preview manual, mesmo que o ref selecionado seja main. Preview manual usa identificador próprio baseado no ref/run.

Pages continua utilizando o projeto existente em `CLOUDFLARE_PAGES_PROJECT`. O Worker preview é separado do Worker production; todos os previews compartilham o BFF preview nesta primeira versão. O workflow serializa publicação do Worker preview e a publicação correspondente do site para evitar corridas entre versões. Um preview não é ambiente isolado por PR para o Worker; essa limitação deve estar explícita no README.

Deploy de PRs do próprio repositório é automático. PRs de forks executam checks e build, mas não recebem secrets nem publicam automaticamente; GitHub não disponibiliza os secrets nesse evento. Não usar `pull_request_target` para executar código do PR. Preview de fork exige importar/revisar a branch no repositório ou disparar manualmente sobre um ref confiável.

Credenciais de deploy existentes permanecem no GitHub Secrets. Validar configuração antes de chamar Wrangler, tratar branch/ref como dados em variáveis de ambiente e argumentos com aspas, e registrar URLs dos deploys no resumo da execução. Definir concorrência de produção sem cancelamento de deploy em andamento. Falha de deploy do Worker impede publicação do site correspondente.

## Validação e entrega

Testar integrações com fetch simulado: normalização, dados vazios, erros, timeout, renovação Spotify e falhas independentes. Testar roteamento, CORS, cache e ausência dos valores de secrets no DTO. Testar política de ambiente para PR, manual preview em main, manual production, push e schedule; forks não devem acessar deploy.

Executar lint, typecheck, testes, build/export e dry-run do Worker. Verificar ausência de secrets de teste nos assets gerados e estados responsivos/acessíveis do componente. Documentar provisionamento de secrets, URLs públicas, escolha de ambiente, limitação dos forks e Worker preview compartilhado. Testes reais de provedores e deploy cloud dependem das credenciais provisionadas; não declarar essas integrações verificadas somente com mocks.

Critérios de aceitação: todos os itens da issue #1, mais escolha manual de ambiente e preview automático de PRs do repositório. Entregar alterações em branch e PR para revisão, sem merge ou deploy de produção executado durante a implementação.
