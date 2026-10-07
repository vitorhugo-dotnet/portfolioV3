# Live Activity and Cloudflare Deployments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Entregar a seção 06 “O que estou fazendo agora?” com quatro provedores e deploys Cloudflare com preview de PR e seleção manual de ambiente.

**Architecture:** Next.js permanece estático. Um Worker agrega dados sanitizados, com cache e falhas isoladas; frontend usa apenas o endpoint público. Produção e preview têm Workers distintos, com um Worker compartilhado pelos previews.

**Tech Stack:** TypeScript, Next.js/React existentes, Node 24, node:test, Biome, Cloudflare Workers/Cache API, Wrangler, GitHub Actions.

**Spec:** [2026-10-07-live-activity-design.md](../specs/2026-10-07-live-activity-design.md)

## Global Constraints

- Preservar `output: "export"`; não adicionar banco, KV, WebSocket ou servidor Next.js.
- Secrets exclusivamente no Worker; somente URL pública pode usar NEXT_PUBLIC_*.
- Cache de 60 segundos; browser atualiza a cada 60 segundos quando aba e seção estão visíveis.
- Coding ativo: heartbeat com até cinco minutos; dados antigos: mais de dois minutos sem atualização.
- Quatro cards: WakaTime, Spotify, Simkl e Steam; seção própria 06, ID agora.
- Preservar GitHub 05; renumerar Além do código para 07 e contato para 08.
- Steam somente API oficial; sem SteamDB/scraping e sem inventar ordem cronológica.
- Preview manual padrão; forks sem secrets/deploy automático; nunca executar PR via pull_request_target.
- Sem merge ou disparo de deploy de produção durante implementação.

## Review Focus

- JSON válido com estrutura inesperada: tratar como falha isolada, sem lançar no agregador (tarefas 1–2).
- Origem com sufixo malicioso: rejeitar CORS e manter headers específicos fora do cache compartilhado (tarefa 3).
- Strict Mode, aba oculta ou request lento: não duplicar polling nem atualizar após desmontagem (tarefa 4).
- Preview manual do ref main: manter destino preview e branch Pages diferente de main (tarefa 5).
- Worker preview compartilhado: duas execuções não intercalam deploy de Worker/site; documentar incompatibilidade possível com previews antigos (tarefa 5).

## Estrutura de arquivos

- `lib/live-activity.ts`: DTO público e validação de payload no browser, sem dependências privadas.
- `worker/src/types.ts`: Env e dependências injetáveis.
- `worker/src/provider-http.ts`: fetch com timeout, validação de texto/URLs.
- `worker/src/providers/{wakatime,spotify,simkl,steam}.ts`: adaptadores independentes.
- `worker/src/activity.ts`: agregação paralela e generatedAt.
- `worker/src/index.ts`: roteamento, CORS, cache.
- `worker/wrangler.jsonc`, `worker/tsconfig.json`: ambientes e typecheck Worker.
- `lib/activity-refresh.ts`: controlador de polling testável.
- `components/live-activity.tsx`: renderização dos quatro cards e integração de visibilidade.
- `scripts/deployment-target.ts`: política pura de ambiente e branch.
- `scripts/deploy-cloudflare.ts`: validação de configuração, execução Wrangler sem shell e resumo.
- `tests/live-activity*.test.ts`, `tests/deployment-target.test.ts`: node:test, fetch/cache/clock simulados.
- Modificar `app/page.tsx`, `app/style.css`, `components/scroll-motion.tsx` somente se o observer precisar reconhecer agora.
- Modificar `package.json`, lockfile, tsconfig raiz, .gitignore, workflow e README para tooling/configuração.
- Não refatorar timeline GitHub ou outras páginas.

### Task 1: Contrato e transporte seguros

**Files:** lib/live-activity.ts; worker/src/types.ts; worker/src/provider-http.ts; tests/live-activity-contract.test.ts; package.json; package-lock.json; worker/tsconfig.json; tsconfig.json; .gitignore.

**Interfaces:** Provider = "coding" | "spotify" | "simkl" | "steam". ProviderState = "available" | "empty" | "unavailable" | "unconfigured".
LiveActivityResponse contém generatedAt, providerStates e os quatro objetos opcionais da spec, cada um com observedAt opcional.
ProviderResult<K> contém state e data?: LiveActivityResponse[K].
ProviderDependencies contém fetch: typeof fetch, now: () => number.
Env contém os sete secrets da spec, STEAM_ID, ALLOWED_ORIGINS, PAGES_PROJECT e EXPOSE_CODING_PROJECT; DEVELOPMENT permite localhost somente localmente.
Produz parseLiveActivity(value: unknown): LiveActivityResponse | null; fetchProviderJson(url: URL, init: RequestInit, deps: ProviderDependencies): Promise<unknown>; safeText(value: unknown): string | undefined; safeHttpsUrl(value: unknown, allowedHosts: readonly string[]): string | undefined.

- [ ] Escrever testes: parseLiveActivity rejeita timestamps inválidos e estados inválidos; safeText limita a 200 caracteres; safeHttpsUrl rejeita javascript:, credentials e hostname com sufixo enganoso; fetchProviderJson aborta após 5.000 ms e rejeita HTTP não OK/JSON inválido. Use clock/fetch simulados.
- [ ] Executar `node --experimental-strip-types --test tests/live-activity-contract.test.ts`; confirmar falha por módulos ainda ausentes.
- [ ] Implementar DTO, helpers e interfaces. Nunca incluir mensagens de erro brutas no DTO.
- [ ] Instalar Wrangler e @cloudflare/workers-types como devDependencies, fixando versões resolvidas no lockfile. Separar typecheck Worker e frontend para evitar conflitos DOM/Workers. Ignorar .dev.vars*, .wrangler e bundles temporários.
- [ ] Executar testes e ambos typechecks; confirmar sucesso. Commit: `feat: define safe live activity contract`.

### Task 2: Integrações e agregação

**Files:** worker/src/providers/wakatime.ts; spotify.ts; simkl.ts; steam.ts; worker/src/activity.ts; tests/live-activity-providers.test.ts; README.md.

**Interfaces:** Cada adaptador exporta getCoding/getSpotify/getSimkl/getSteam(env: Env, deps: ProviderDependencies): Promise<ProviderResult<K>>, com K correspondente. collectActivity(env: Env, deps: ProviderDependencies): Promise<LiveActivityResponse> agrega todos via Promise.allSettled; nenhum adaptador lança para o consumidor.

- [ ] Conferir schemas e endpoints na documentação oficial dos provedores antes de fixar fixtures. Documentar permissões mínimas Spotify (user-read-currently-playing, user-read-recently-played), autorização Simkl e limitações de privacidade Steam. Não iniciar login interativo nem consultar contas reais sem configuração.
- [ ] Escrever testes WakaTime: heartbeat com 299 s ativo, 301 s idle, timestamp futuro não ativo, resumo converte segundos em minutos, ausência de heartbeat não inventa atividade atual, projeto omitido por padrão.
- [ ] Escrever testes Spotify: refresh concede token reutilizado até expiração; 204 chama recently-played; 401 renova uma vez; segundo 401 resulta unavailable; ausência de credenciais resulta unconfigured.
- [ ] Escrever testes Simkl: conteúdo recente sanitizado com mediaType/episódio, lista vazia resulta empty, resposta inesperada resulta unavailable; histórico nunca recebe indicação de reprodução atual.
- [ ] Escrever testes Steam: GetPlayerSummaries com gameid/gameextrainfo resulta isPlaying=true; sem jogo chama GetRecentlyPlayedGames com isPlaying=false; perfil privado/vazio retorna empty; resposta malformada/rate limit resulta unavailable. Seleção fallback determinística por maior playtime_2weeks, desempate appid, com rótulo “Jogado recentemente”, nunca “último jogo”.
- [ ] Escrever teste agregador: timeout em um provedor conserva os outros três; JSON.stringify(response) não contém secrets sentinela, Steam ID, paths ou headers privados.
- [ ] Executar `node --experimental-strip-types --test tests/live-activity-providers.test.ts`; confirmar falha inicial.
- [ ] Implementar endpoints fixos oficiais: WakaTime users/current heartbeats e summaries; Spotify accounts token e API me/player/currently-playing + me/player/recently-played; Simkl sync/all-items com informações de histórico conforme schema oficial; Steam endpoints da spec. Não inventar campos indisponíveis. Cada adaptador permite hosts HTTPS oficiais necessários.
- [ ] Implementar Spotify com cache em memória de token isolado por configuração e invalidação por 401; secrets nunca entram em logs ou respostas públicas.
- [ ] Implementar agregador e documentação de secrets; executar testes, lint e typechecks. Commit: `feat: aggregate coding music media and gaming activity`.

### Task 3: Endpoint Worker e cache

**Files:** worker/src/index.ts; worker/wrangler.jsonc; tests/live-activity-worker.test.ts; package.json; README.md.

**Interfaces:** createActivityHandler(deps: ProviderDependencies & { cache: Pick<Cache, "match" | "put">; collect: typeof collectActivity }): (request: Request, env: Env, ctx: Pick<ExecutionContext, "waitUntil">) => Promise<Response>. Default export disponibiliza fetch para runtime Cloudflare.

- [ ] Escrever testes: /other = 404; POST = 405 + Allow; OPTIONS origem autorizada = 204; GET = 200 com DTO; origem enganosa como project.pages.dev.attacker.test não recebe ACAO; localhost somente DEVELOPMENT.
- [ ] Escrever testes cache: duas requisições em 60 s consultam providers uma vez; após expirar consultam novamente; generatedAt do hit não muda; cache guarda apenas body/headers públicos e CORS é aplicado a cada resposta; falha parcial continua cacheável; falha de cache não impede resposta.
- [ ] Executar `node --experimental-strip-types --test tests/live-activity-worker.test.ts`; confirmar falha inicial.
- [ ] Implementar handler, chave fixa /api/activity por origem Worker/ambiente, TTL 60 e waitUntil com falha de escrita absorvida. Aplicar Vary: Origin e ACAO autorizado após leitura do cache, sem credenciais.
- [ ] Configurar Workers portfolio-activity-production e portfolio-activity-preview em env.production/env.preview; configurações não secretas explícitas, sem valores de conta inventados. Documentar como obter as URLs workers.dev e provisionar secrets por ambiente.
- [ ] Executar testes, typecheck Worker e `npx wrangler deploy --config worker/wrangler.jsonc --env preview --dry-run` e production equivalente. Commit: `feat: serve cached activity from Cloudflare Worker`.

### Task 4: Seção 06 e atualização visível

**Files:** lib/activity-refresh.ts; components/live-activity.tsx; app/page.tsx; app/style.css; components/scroll-motion.tsx se necessário; tests/live-activity-refresh.test.ts.

**Interfaces:** createActivityRefresh({ load, onData, onError, now, schedule, cancel }): { setVisible(visible: boolean): void; dispose(): void }; load recebe AbortSignal e retorna Promise<LiveActivityResponse>. schedule/cancel substituem setTimeout/clearTimeout para testes. isActivityStale(generatedAt: string, now: number): boolean usa limite de 120.000 ms.
LiveActivitySection usa NEXT_PUBLIC_ACTIVITY_API_URL; componente não importa worker/*.

- [ ] Ler guias locais Next.js de static export/client components antes de escrever TSX.
- [ ] Escrever testes controlador: visível dispara carga imediata; 60.000 ms dispara próxima; oculto cancela timer/request; retomar dispara carga; request lento não se sobrepõe; dispose impede callbacks e timers; remount não duplica loops. isActivityStale retorna false em 120.000 e true em 120.001 ms.
- [ ] Executar `node --experimental-strip-types --test tests/live-activity-refresh.test.ts`; confirmar falha inicial.
- [ ] Implementar controlador, fetch com credentials omit, validação de DTO e AbortController; visibilidade é conjunção de document.visibilityState e IntersectionObserver.
- [ ] Implementar cards acessíveis com skeleton, empty/unavailable/unconfigured, erro global, timestamps, labels atuais/recentes e badge de dados antigos. Usar relógio de UI para envelhecer dados mesmo sem novas respostas.
- [ ] Inserir seção 06 “O que estou fazendo agora?” id agora entre GitHub e sobre; nav “Agora”; sobre 07 e contato 08. Observer existente usa seções com ID; alterar apenas se necessário. Reusar Reveal e preferência de movimento.
- [ ] Executar testes/typecheck/lint/build; inspeção visual em 375 px e 1440 px com fixtures locais de todos os estados, teclado e reduced motion. Confirmar ordem, nav/scroll e timeline preservada. Commit: `feat: add dedicated live activity section`.

### Task 5: Política de deploy e workflow

**Files:** scripts/deployment-target.ts; scripts/deploy-cloudflare.ts; tests/deployment-target.test.ts; .github/workflows/cloudflare-pages.yml; package.json; README.md.

**Interfaces:** resolveDeploymentTarget(input: { eventName: string; ref: string; requestedEnvironment?: string; prNumber?: number; isFork: boolean; runId: string }): { environment: "preview" | "production"; pagesBranch: string } | null. Eventos inválidos não publicam.
Executor usa spawn com shell:false e exit codes propagados, URLs públicas configuradas em vars ACTIVITY_API_URL_PREVIEW/PRODUCTION.

- [ ] Escrever matriz: PR interno main -> preview/pr-N; fork -> null; manual preview em main -> preview/manual-<runId>; manual production -> production/main; push main e schedule -> production/main; input inválido/ref inesperado -> erro ou null sem deploy.
- [ ] Executar `node --experimental-strip-types --test tests/deployment-target.test.ts`; confirmar falha inicial.
- [ ] Implementar política e runner, validando projeto Pages, URL HTTPS pública de atividade e ambiente antes de Wrangler; ref e nomes sempre como argumentos separados sem interpolação shell.
- [ ] Acrescentar workflow_dispatch environment choice preview/production padrão preview. Preservar checks/test/build e rotas estáticas; adicionar Worker typecheck/dry-run. Injetar somente URL pública correta no build, proveniente de vars conhecidas; não depende de deploy antecipado para descobrir URL.
- [ ] Deploy depois de validações/artifact: um job por ambiente com concurrency compartilhada por ambiente, cancel-in-progress:false; executar Worker e Pages em sequência no mesmo job. Worker falho bloqueia Pages. PR interno usa preview; fork pula todos os jobs de deploy.
- [ ] Baixar artefato do SHA da execução, publicar preview com branch calculada e produção com main. Registrar URLs no GITHUB_STEP_SUMMARY. Não usar pull_request_target ou adicionar secrets ao build.
- [ ] Validar YAML com actionlint disponível e testar fixtures da política; revisar guards, needs, permissões mínimas e grupos de concurrency. Documentar URLs/config/secrets, forks e BFF preview compartilhado. Commit: `ci: support manual environments and PR previews`.

### Task 6: Verificação integrada e entrega no PR

**Files:** README.md; plano; ajustes estritamente necessários encontrados nas verificações.

- [ ] Executar `npm run ci`, `npm run typecheck`, typecheck Worker e `npm test`; exigir exit code 0 de todos.
- [ ] Executar `npm run build` com URL preview configurada; verificar out/_next e rotas/index/hub/policies/404/sitemap/robots/favicon/preview existentes. Repetir build com URL de produção somente para comprovar seleção; nenhum deploy real.
- [ ] Executar dry-run Wrangler nos dois ambientes; bundles válidos, sem interação com contas.
- [ ] Buscar valores de secrets sentinela nos assets estáticos gerados; zero ocorrências. Verificar graph de imports do frontend sem worker/* e ausência de valores sensíveis no DTO.
- [ ] Validar comportamento de endpoint com fixtures locais e UI responsiva/acessível; registrar comandos/resultados e limitações de testes mock no README/PR. Não afirmar integração real autenticada sem execução real.
- [ ] Fazer revisão final do diff contra a spec, corrigir problemas e repetir apenas checks afetados. Atualizar PR #2 com implementação, título e descrição finais e evidências; manter issue aberta até merge e não executar merge/deploy produção.
- [ ] Commit de documentação final: `docs: document activity setup and verification`.

## Handoff

Plano revisado contra a spec: contratos, quatro provedores, cache/CORS, seção 06, polling, CI, secrets, forks e limites de preview têm tarefas e verificações. Escolher execução nativa ou por subagentes antes de implementação. Recomendo nativa: seis tarefas encadeadas por interfaces compartilhadas, com revisão independente da branch ao final.
