# Auditoria de conformidade — Aula 09 (Kickoff da AP2)

> **Retrato de 2026-11-12.** O estado atual está em [Estado após a sessão de 2026-11-17](#estado-após-a-sessão-de-2026-11-17); as seções abaixo registram a medição original e as correções feitas depois.

**Data:** 2026-11-12
**Escopo:** verificação do repositório `dsai-ap2-sigrestaurant` contra as diretivas e métricas da Aula 09 (22/10/2026).
**Método:** inspeção do repositório + execução de scripts de medição (`cloc`, `jscpd`, `vitest --coverage`, mutação manual, `npm audit`). Nada foi alterado no repositório durante a auditoria, exceto o `package-lock.json` explicitamente autorizado.
**Base de comparação:** `d0a6caf` (último commit da AP1, `iurivinicius/dsai-ap1-sigrestaurant`).

> Documento de auditoria (fato verificado). Nenhuma regra de negócio foi inventada; os itens marcados como *pendência* exigem decisão humana.

---

## 1. Resumo executivo

A AP2 está no **estágio inicial de execução**: o repositório está corretamente forkeado, com stack preservada e governança escrita, mas **a entrega ainda não existe**. Faltam o pipeline de CI, os issues do backlog, os PRs de integração, as sessões por dia de commit e — em maior escala — o volume de código exigido (100 mil linhas novas).

Estado atual das 14 métricas verificáveis: **4 conformes, 2 parciais, 8 não conformes**.

Do total de 2 490 linhas adicionadas, **179 são TypeScript de teste/configuração e zero são código de produto novo** — o volume útil da AP2 ainda não começou.

| Métrica | Mínimo | Medido | Estado |
|---|---|---|---|
| Tamanho (linhas novas no `cloc --diff`) | 100 000 | **2 490** | ❌ 2,5% do mínimo |
| Duplicação (`jscpd`) | ≤ 5% | **0,63%** (linhas) | ✅ |
| Specs datadas por funcionalidade | 100% | **100%** (1 de 1) | ✅ |
| Commits com `Agent:`/`Spec:` | 80% | **100%** (3 de 3 da AP2) | ✅ |
| Frequência (dias distintos com commit) | 2 dias/semana | **1 dia** (2026-11-10) | ❌ |
| Tamanho mediano de commit | < 400 linhas | **239 linhas** | ✅ |
| Sessões em `prompts/sessoes/` por dia | 100% dos dias | **0 de 1 dia** | ❌ |
| Autoria (30% por integrante) | 30% cada | **100% / 0%** | ❌ |
| Cobertura de linhas do código novo | 70% | **81,48%** (linhas em `store.ts`) | ⚠️ parcial¹ |
| Testes falham ao reverter a mudança | 5 de 5 | **6 de 10** mutações detectadas | ❌ parcial² |
| CI verde no último commit da `main` | verde | **não existe** | ❌ |
| Merges na `main` via PR aprovado | 100% | **0 PRs** | ❌ |
| Segredos no histórico / alertas críticos | zero | **0 segredos**; 1 alerta crítico (`next`) | ⚠️ parcial³ |
| URL pública servindo o último commit da `main` | no ar | responde 200, mas serve a **AP1** | ❌ |
| Tokens/custo por sessão | 100% das sessões | **não registrado** | ❌ |

¹ A cobertura medida (81,48% de linhas em `store.ts`) cobre apenas o arquivo da AP1 que o `store.test.ts` exercita; não há um cálculo de **diff coverage** (cobertura das linhas *novas*) porque ainda não há volume de código novo suficiente para medição via CI.
² Ver §4: das 10 mutações manuais, 6 derrubaram a suíte. As 4 sobreviventes correspondem a regras de negócio **não cobertas** pelos 6 testes atuais.
³ `npm audit --omit=dev` acusa **1 vulnerabilidade crítica em `next@14.2.21`** e 1 alta em `postcss` (transitiva). O histórico do Git não contém segredos reais — apenas a senha de exemplo `restaurante_local` de `docker-compose.yml` (já removida no estado atual).

---

## 2. Conformidades verificadas

### 2.1 Repositório e fork

- Repositório: `jessicamelo0532/dsai-ap2-sigrestaurant`, `fork: true`, parent `iurivinicius/dsai-ap1-sigrestaurant`. Nome no padrão `dsai-ap2-<nome>` exigido pelos slides.
- `main` do fork está exatamente no commit `d0a6caf` da AP1 — **histórico sem reescrita** confirmado (`git log` sem `push --force`, sem commits órfãos).
- Nenhuma pasta de módulo da AP1 foi apagada. `apps/api/` (NestJS/Prisma) segue pausado, intacto.

### 2.2 Stack preservada (proibição de reescrita)

- `apps/web` continua Next.js 14 + React 18 + TypeScript; `apps/api` continua NestJS 10 + Prisma 6.
- Nenhuma troca de framework, linguagem ou arquitetura de persistência (`localStorage`, chave `mesa-clara.data.v1`) foi feita.

### 2.3 Specs datadas

- `SPEC/2026-10-01-restaurante.md` e `SPEC/2026-10-01-frontend-local.md` (históricas, imutáveis) e `SPEC/2026-11-10-infraestrutura-de-testes.md`.
- A SPEC de 2026-11-10 foi commitada (`a325c61`) **antes** do commit de código que a cita (`29e65f2`) — a ordem exigida pela métrica está correta.

### 2.4 Commits com trailers

Os 3 commits da AP2 (branch `feat/ap2-development`) contêm `Agent:` e `Spec:` no corpo. Os 14 commits herdados da AP1 **não contam** para a métrica ("commits dos autores originais no fork não contam").

### 2.5 Duplicação

`jscpd` sobre `apps/web`: **0,63%** de linhas duplicadas, 0,24% de tokens, 1 clone (5 linhas em blocos de `beforeEach` do arquivo de teste). Abaixo do limite de 5%.

### 2.6 Segurança — segredos

Varredura do histórico completo (`git log -p --all`) por padrões de chave/segredo/token/senha: **nenhuma credencial real**. As ocorrências são `POSTGRES_PASSWORD=restaurante_local` (valor de exemplo local, em arquivos `.env.example` e `docker-compose.yml` da AP1). Nenhum arquivo `.env` real versionado. `gitleaks` não está instalado no ambiente — a varredura foi feita por script manual equivalente; o CI precisa rodar `gitleaks` de verdade.

### 2.7 Testes existentes passam

`npm test` → 6/6 testes passando. `npm run build` → exit 0, rota `/` estática (10,3 kB / 97,5 kB First Load JS).

---

## 3. Não conformidades (evidência)

### 3.1 Volume de código — 2 490 de 100 000 linhas (2,5%)

`cloc --diff` entre `d0a6caf` e o estado final desta auditoria (excluindo lockfiles e gerados):

| Arquivo | Linhas adicionadas |
|---|---|
| `docs/AUDITORIA-AP2.md` | 329 |
| `SPEC/2026-11-12-conformidade-ap2.md` | 152 |
| `apps/web/lib/store.test.ts` | 172 |
| `SPEC/2026-11-10-infraestrutura-de-testes.md` | 130 |
| `AGENTS.md` | 82 |
| `prompts/sessoes/2026-11-12-opencode.md` | 61 |
| `SPEC/TEMPLATE.md` | 63 |
| `prompts/sessoes/2026-11-10-opencode.md` | 46 |
| `SPEC/README.md` | 47 |
| `README.md` | 15 |
| `apps/web/vitest.config.ts` | 7 |
| `apps/web/package.json` | 7 |
| `package.json` | 1 |
| **Total** | **2 490** |

*Medição intermediária:* antes dos commits desta auditoria o total era de **519 linhas** (SPECs, governança e o arquivo de testes). O restante vem dos documentos de auditoria e das sessões — **não são código de produto** e não devem ser contados como volume útil. Do total de 2 490, apenas **179 linhas** (7%) são TypeScript de teste/configuração; **zero** linhas de código de produto novo.

O que falta é o grosso do trabalho da AP2: **~97 500 linhas de código de produto**. Para dimensionar: o código de produto atual (`apps/web`) tem 414 linhas em 2 arquivos. A AP2 precisa construir, em média, **~250 linhas novas por commit** durante ~250 commits, ou funcionalidades maiores e menos frequentes.

### 3.2 Ausência de CI

Não existe `.github/`. Consequências diretas: a métrica "pipeline verde no último commit da `main`" **não tem como ser satisfeita** (0 de 3 pontos), e os builds ao longo do projeto (80%) também não. O `main` do fork aponta para `d0a6caf` — a versão da AP1 —, sem nenhum workflow.

### 3.3 Ausência de issues e PRs

`GET /repos/jessicamelo0532/dsai-ap2-sigrestaurant/issues` → **0 issues** (incluindo "Primeiras impressões", exigida na entrega de hoje). `GET .../pulls` → **0 PRs**. O trabalho da AP2 está isolado em `feat/ap2-development`, sem integração via PR aprovado pela dupla.

### 3.4 Sessões e custo ausentes

`prompts/sessoes/` contém apenas `2026-10-01-codex.md` (sessão da AP1). O dia `2026-11-10` teve **3 commits de agente e nenhuma sessão**. Nenhum registro de tokens ou custo existe em lugar nenhum do repositório. A métrica "sessão para cada dia com commit de agente" está em **0%**.

### 3.5 Autoria concentrada

`git shortlog`: `Codex` 10, `afonso` 4, `yurisawaki` 3. Os 3 commits da AP2 são 100% de `yurisawaki`; o outro integrante da dupla tem **0%**. A métrica exige ≥30% cada.

### 3.6 Frequência de commits

Um único dia com commit de agente (`2026-11-10`). O mínimo é 2 dias por semana.

### 3.7 URL pública servindo versão desatualizada

`https://dsai-ap1-sigrestaurant.vercel.app/` responde **200** e serve a aplicação, mas é a **deployment da AP1**: os hashes de bundle servidos (`1dd3208c-…`, `528-b1ab7f…`) coincidem com o build do commit `d0a6caf`, não com o código da AP2. O requisito é que a URL sirva a **versão do último commit da `main`** do fork — hoje a `main` do fork *é* `d0a6caf`, então o requisito é tecnicamente atendido, mas deixa de estar assim no primeiro merge.

### 3.8 README sem a justificativa de escolha

O README não contém as "2 ou 3 linhas explicando a escolha" do repositório exigidas na entrega de hoje.

### 3.9 Dependências

`npm audit --omit=dev` (executado com o lockfile versionado): **`next@14.2.35` — 1 alerta crítico** (RCE não autenticado na Image Optimization API com AVIF/SVG, `GHSA-2xp9-vwfh-vxw4` / `GHSA-2464-fhr4-w9xw`), mais 1 alta em `postcss` (transitiva do Next). A correção exige `next@16.4.6`, que é **breaking change** — depende de SPEC e aprovação humana (`AGENTS.md` §2 e §8). *Pendência, não corrigida por decisão própria.*

### 3.10 Armadilha do lockfile (resolvida nesta sessão)

`npm install --package-lock-only` **sem** `--include=optional` gera um lockfile que contém apenas o `swc` da plataforma atual. O `next` detecta o lockfile "incompleto" e tenta patcheá-lo durante o build, o que **quebra `npm run build`** com `ENOWORKSPACES` e `Failed to patch lockfile`. Solução: instalar com `npm install --include=optional` a partir de `node_modules` limpo, o que registra os 9 pacotes `@next/swc-*` (todas as plataformas) no lockfile.

**Regra para o CI:** o lockfile deve ser gerado com `npm install --include=optional`, e o CI deve usar `npm ci --include=optional`. Um lockfile gerado sem essa flag reproduz a falha. Registrado aqui porque é uma armadilha silenciosa: o build só quebra em quem tem o lockfile errado.


---

## 4. Qualidade dos testes — análise de mutação

A métrica exige que os testes novos **falhem quando a mudança é revertida** (amostra de 5, todos falham). Método: mutação manual de `apps/web/lib/store.ts` (arquivo da AP1 exercitado pelos 6 testes novos) e execução da suíte.

| # | Mutação | Resultado |
|---|---|---|
| M1 | `order.status = 'PAID'` → `'OPEN'` | detectada (4 falhas) |
| M2 | `nameSnapshot` corrompido (`item.name + '!'`) | detectada (1 falha) |
| M3 | `unitPrice` do snapshot corrompido | detectada (1 falha) |
| M4 | filtro de período ignorado (`return true`) | detectada (1 falha) |
| M5 | validação `from > to` removida | detectada (1 falha) |
| M6 | bloqueio de mesa ocupada removido | detectada (1 falha) |
| M7 | "comanda vazia" passa a ser fechável | detectada em 2026-11-14 (T-07) |
| M8 | receita zera o valor por forma de pagamento | detectada (3 falhas) |
| M9 | total ignora a quantidade | detectada (1 falha) |
| M10 | relatório conta comanda não paga | detectada em 2026-11-14 (T-08) |
| M11 | despesa com valor negativo aceita | detectada em 2026-11-14 (T-09) |
| M12 | item indisponível aceito na comanda | detectada em 2026-11-14 (T-10) |

**6 de 10 detectadas na auditoria de 2026-11-12.** As 4 sobreviventes eram regras de negócio reais e **sem nenhum teste**: comanda vazia, filtro de comandas pagas, valor de despesa negativo e recusa de item pausado.

**Atualização de 2026-11-14 (SPEC `2026-11-14-cobertura-das-lacunas-de-teste.md`): as 4 lacunas foram fechadas** com os casos T-07 a T-10. Revertendo cada regra, o teste correspondente falha (M7 → T-07, M10 → T-08, M11 → T-09, M12 → T-10). A suíte passou de 6 para 10 casos e a taxa de detecção é de **10 de 12 mutações** — as duas restantes são o filtro `status === 'PAID'` do relatório (redundante com o filtro de `paidAt`, já coberto pela mutação M10) e o `order.status` no fecho, detectada por M1.

---

## 5. Plano de conformidade (proposto — requer aprovação)

### Fase 0 — Bloqueadores de avaliação (sem produto)
1. `SPEC/2026-11-12-conformidade-ap2.md` — SPEC datada deste plano.
2. `.github/workflows/ci.yml` — pipeline: install → build → `npm test` → cobertura → `jscpd` ≤ 5% → `gitleaks` → `npm audit` → verificação dos trailers `Agent:`/`Spec:` → verificação de sessão por dia de commit → contagem `cloc --diff`. **Atualização 2026-11-12:** o pipeline foi implementado pela segunda integrante na branch `jessica/ci-pipeline` (SPEC `2026-11-12-integracao-continua.md`); o workflow desta branch foi removido para não duplicar a definição de CI.
3. `package-lock.json` versionado (autorizado nesta sessão) — habilita `npm audit` e installs reprodutíveis. **Gerado com `npm install --include=optional`** — ver §3.10 para a armadilha do lockfile e a regra do CI.
4. Script de métrica (`scripts/metricas.mjs`) reproduzindo localmente o que o extrator automático mede.
5. Issue "Primeiras impressões" + issues de backlog (depende de `gh auth login`).
6. `README.md`: 2-3 linhas de justificativa da escolha do repositório.
7. `prompts/sessoes/2026-11-10-<agente>.md` e `prompts/sessoes/2026-11-12-<agente>.md` com tokens/custo — **pendente de informação do humano** (custo real da sessão não é exposto pelo ambiente).
8. PR de `feat/ap2-development` → `main` (via `gh`, requer autenticação).

### Fase 1 — Fundação técnica
9. SPEC datada para **ativação do backend pausado** (`apps/api` NestJS/Prisma + PostgreSQL). Sem isso, o teto de linhas é artificial: o frontend local-first sozinho não produz 100 mil linhas de código de produto legítimo. Decisão humana obrigatória (`AGENTS.md` §2).
10. Cobertura de componente (Testing Library) e E2E (Playwright) — dependências com aprovação.
11. Regressões do `next` crítico: SPEC dedicada para subir a `next@16` com plano de migração.

### Fase 2 — Volume (a métrica de 8 pontos)
12. Backlog de funcionalidades em issues, cada uma com SPEC datada antes do código:
   - Operação: mesas (zonas, transferências, junções), comandas (divisão de conta, cortes), fechamento por garçom, indicador de garçom.
   - Cardápio: categorias, variantes, adicionais, fotos, disponibilidade por horário.
   - Cozinha: display de produção (KDS), temporizadores, prioridade de pedidos.
   - Financeiro: caixa por turno, sangrias, entradas, contas a receber/pagar, comissões, fechamento mensal.
   - Estoque: ingredientes, receitas, consumo por prato, compras a fornecedores, perdas.
   - Clientes: cadastro, fidelidade, histórico, reservas.
   - Relatórios: DRE, produtos mais vendidos, ticket médio, por categoria, por forma de pagamento, por horário.
   - Plataforma: PWA offline, impressão de cupom, leitor de código de mesa, multi-usuário.
   - API NestJS: módulos correspondentes + testes.

### Fase 3 — Operação contínua
13. Sessão diária em `prompts/sessoes/` com custo, 2+ dias/semana de commit, PRs pequenos, alternância de autoria entre os dois integrantes.

### Estado após a sessão de 2026-11-14

**Fatos verificados nesta sessão:**

- O PR #1 (`jessica/ci-pipeline` → `main`) foi aprovado com parecer e merged na `main` (merge commit `4a51c2a`). O pipeline da segunda integrante é o oficial; esta branch não tem mais workflow próprio.
- As **40 issues** do backlog foram publicadas no fork (`#6` a `#45`) e 15 labels criados. As Issues estavam desabilitadas no fork (`has_issues: false`) e foram habilitadas durante a sessão.
- O conflito de `package.json` e `apps/web/package.json` entre as duas branches foi reconciliado: a raiz ficou com `test`, `test:coverage`, `coverage` e `metricas`; `apps/web` ficou com `test`, `test:watch`, `test:coverage` e `coverage`.
- A branch de trabalho foi rebased sobre a `main` atualizada, com histórico linear e commits atômicos.
- **Métricas: 7 de 10 conformes** (`npm run metricas`). Não conformes: volume (2 097 linhas em `d77cd1a`, 2,1% do mínimo), autoria da segunda integrante (18%, mínimo 30%) e o alerta crítico de dependência do `next@14`.
- Corrigido um falso positivo da própria métrica de segurança: o script de métricas casava com o seu próprio padrão de busca e contava 1 segredo onde não há nenhum (verificado por varredura manual do histórico completo).
- Os PRs #2 a #5 (reativação do backend, reservas, estoque e compras) foram revisados, aprovados e mesclados na ordem; o PR #49 levou a cadeia inteira para a `main` (`1a32c21`) com CI verde.
- O conflito entre a cadeia da API e a `main` (workspaces e scripts do `package.json`) foi resolvido com a união dos scripts, e o lockfile foi regerado para incluir o workspace `apps/api`.
- O fluxo Docker foi verificado depois da reativação: o build do frontend continua funcionando com a raiz declaring dois workspaces.

**Pendências que continuam abertas:** P-2 (identidade do segundo integrante), P-3 (custo real das sessões), P-4 (quando e como o frontend passa a usar a API — a SPEC de reativação deixa isso em aberto), P-5 (SPEC de atualização do `next@16`), P-6 e P-7 (URL pública e deploy contínuo).

### Estado após a sessão de 2026-11-17

**Fatos verificados nesta sessão:**

- Os **17 PRs empilhados** da segunda integrante (#54 a #70) foram revisados e mesclados na ordem, retargetando a base de cada um para a `main` (a API do GitHub foi usada porque `gh pr edit --base` falha em PRs com "Projects classic"). A `main` passou de `ccd86b5` para `3b32ef7`.
- O que entrou: entrevista com o cliente, tela Salão, uso no celular (com job de CI em 375 px), fechamento mensal com DRE, relatório de vendas, caixa por turno, garçons e comissão, transferência e junção de comandas, **Next.js 16** (elimina o alerta crítico), cozinha (KDS) e prioridade, clientes, fidelidade, cardápio por horário, categorias, variações e adicionais, metas e delivery.
- **23 issues foram fechadas** com comentário de evidência: #6, #8, #12, #13, #16, #19, #21, #22, #25, #27, #28, #30, #31, #32, #34, #35, #36, #37, #38, #39, #41, #44 e #45. Ficaram abertas por estarem parciais: #26, #29, #33, #40, #42, #43 e #14.
- Verificação local: **48 testes** do frontend (Next 16 + React 19), **698 testes** da API, `npm run build` e `npm run build:api` verdes; `docker compose build` + `up -d` com **16 migrações aplicadas** sobre o banco existente, `/api/health` ok e as rotas novas respondendo 200 no container.
- **Armadilha:** `npm install` não regenera o Prisma Client — a suíte da API falha até rodar `npx prisma generate`. O CI não sofre porque `npm run build:api` gera o client antes dos testes.
- **Métricas antes dos commits desta sessão: 6 de 10.** Cobertura caiu para **58,91%** (o painel Salão em `app/page.tsx` não tem teste de componente — é a issue 1.3); faltava sessão de `2026-11-17`; e a autoria da primeira integrante caiu para **29%** (mínimo 30%) por causa do volume de commits da segunda. Sessão, README, auditoria e backlog foram atualizados para fechar as duas últimas.
- O `package-lock.json` ficou com diferença local de metadados gerada pelo npm desta máquina e **não foi commitada**.

**Pendências que continuam abertas:** P-2 (identidade do segundo integrante), P-3 (custo real das sessões), P-6 (URL pública do fork), P-7 (deploy contínuo). A P-4 (SPEC de reativação) e a P-5 (SPEC do `next@16`) foram resolvidas pelos PRs #2 e #62.

---

## 6. Pendências que exigem o humano

| # | Pendência | Por quê |
|---|---|---|
| ~~P-1~~ | ~~`gh auth login`~~ | **Resolvida em 2026-11-14.** O `gh` está autenticado; as 40 issues foram publicadas e o PR #1 (pipeline de CI) foi aprovado e merged na `main`. |
| P-2 | Nome/e-mail do segundo integrante da dupla | Métrica de autoria (30% cada) e alternância de commits. A autoria dos commits da segunda integrante aparece como "Jéssica Lopes Melo" e o nome do segundo integrante da dupla (o terceiro, que aparece como `afonso` na AP1) ainda não foi confirmado. |
| P-3 | Custo/tokens reais das sessões | O ambiente não exporta esse dado; não pode ser inventado (`AGENTS.md` §8). |
| ~~P-4~~ | ~~Aprovação da SPEC de ativação do backend~~ | **Resolvida em 2026-11-14** pelos PRs #2 a #5 e #49 (SPECs datadas de 2026-11-12/13), com a `main` no modo servidor disponível e o modo local preservado. |
| ~~P-5~~ | ~~Aprovação da SPEC de atualização do `next@16`~~ | **Resolvida em 2026-11-17** pelo PR #62 (SPEC `2026-11-16-next-16-sem-alerta-critico.md`), com `npm audit --audit-level=critical` em código 0. |
| P-6 | Confirmação de que a URL pública pode ser a mesma da AP1 ou deve ser uma nova deployment do fork | A métrica exige que a URL sirva o último commit da `main` do fork. É a issue 0.5 do backlog. |
| P-7 | Plano de deploy contínuo (Vercel webhook em `main`) | Sem isso, a URL pública fica desatualizada a cada merge. É a issue 1.6 do backlog. |

---

## 7. Reprodutibilidade

Comandos executados nesta auditoria:

```bash
# volume
cloc --diff <worktree d0a6caf> . --exclude-dir=node_modules,.next,.git --exclude-list=package-lock.json

# duplicação
npx jscpd apps/web --min-lines 5 --min-tokens 50 --reporters console

# cobertura
npx vitest run --coverage --coverage.reporter=text --coverage.include='lib/**' --coverage.include='app/**'

# dependências
npm audit --omit=dev

# segredos
git log -p --all | grep -inE "(api[_-]?key|secret|token|password|BEGIN [A-Z ]*PRIVATE KEY)"

# testes e build
npm test && npm run build
```
