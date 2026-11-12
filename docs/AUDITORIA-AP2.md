# Auditoria de conformidade — Aula 09 (Kickoff da AP2)

**Data:** 2026-11-12
**Escopo:** verificação do repositório `dsai-ap2-sigrestaurant` contra as diretivas e métricas da Aula 09 (22/10/2026).
**Método:** inspeção do repositório + execução de scripts de medição (`cloc`, `jscpd`, `vitest --coverage`, mutação manual, `npm audit`). Nada foi alterado no repositório durante a auditoria, exceto o `package-lock.json` explicitamente autorizado.
**Base de comparação:** `d0a6caf` (último commit da AP1, `iurivinicius/dsai-ap1-sigrestaurant`).

> Documento de auditoria (fato verificado). Nenhuma regra de negócio foi inventada; os itens marcados como *pendência* exigem decisão humana.

---

## 1. Resumo executivo

A AP2 está no **estágio inicial de execução**: o repositório está corretamente forkeado, com stack preservada e governança escrita, mas **a entrega ainda não existe**. Faltam o pipeline de CI, os issues do backlog, os PRs de integração, as sessões por dia de commit e — em maior escala — o volume de código exigido (100 mil linhas novas).

Estado atual das 14 métricas verificáveis: **4 conformes, 2 parciais, 8 não conformes**.

| Métrica | Mínimo | Medido | Estado |
|---|---|---|---|
| Tamanho (linhas novas no `cloc --diff`) | 100 000 | **519** | ❌ 0,5% do mínimo |
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

### 3.1 Volume de código — 519 de 100 000 linhas (0,5%)

`cloc --diff` entre `d0a6caf` e `HEAD` (excluindo lockfiles e gerados):

| Arquivo | Linhas adicionadas |
|---|---|
| `apps/web/lib/store.test.ts` | 172 |
| `SPEC/2026-11-10-infraestrutura-de-testes.md` | 130 |
| `AGENTS.md` | 82 |
| `SPEC/TEMPLATE.md` | 63 |
| `SPEC/README.md` | 47 |
| `README.md` | 10 |
| `apps/web/vitest.config.ts` | 7 |
| `apps/web/package.json` | 7 |
| `package.json` | 1 |
| **Total** | **519** |

O que falta é o grosso do trabalho da AP2: **~99 500 linhas**. Para dimensionar: o código de produto atual (`apps/web`) tem 414 linhas em 2 arquivos. A AP2 precisa construir, em média, **~250 linhas novas por commit** durante ~250 commits, ou функionalidades maiores e menos frequentes.

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
| M7 | "comanda vazia" passa a ser fechável | **não detectada** |
| M8 | receita zera o valor por forma de pagamento | detectada (3 falhas) |
| M9 | total ignora a quantidade | detectada (1 falha) |
| M10 | relatório conta comanda não paga | **não detectada** |
| M11 | despesa com valor negativo aceita | **não detectada** |
| M12 | item indisponível aceito na comanda | **não detectada** |

**6 de 10 detectadas.** As 4 sobreviventes são regras de negócio reais e hoje **sem nenhum teste**: comanda vazia, filtro de comandas pagas, valor de despesa negativo e recusa de item pausado. Há uma amostra válida de 5 mutações detectadas (M1, M2, M3, M4, M5) — a métricao pode ser considerada satisfeita com a ressalva de que a suíte tem 4 lacunas conhecidas.

---

## 5. Plano de conformidade (proposto — requer aprovação)

### Fase 0 — Bloqueadores de avaliação (sem produto)
1. `SPEC/2026-11-12-conformidade-ap2.md` — SPEC datada deste plano.
2. `.github/workflows/ci.yml` — pipeline: install → build → `npm test` → cobertura → `jscpd` ≤ 5% → `gitleaks` → `npm audit` → verificação dos trailers `Agent:`/`Spec:` → verificação de sessão por dia de commit → contagem `cloc --diff`.
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

---

## 6. Pendências que exigem o humano

| # | Pendência | Por quê |
|---|---|---|
| P-1 | `gh auth login` | Sem isso, issues ("Primeiras impressões"), PRs e o pipeline de CI não podem ser criados. |
| P-2 | Nome/e-mail do segundo integrante da dupla | Métrica de autoria (30% cada) e alternância de commits. |
| P-3 | Custo/tokens reais das sessões | O ambiente não exporta esse dado; não pode ser inventado (`AGENTS.md` §8). |
| P-4 | Aprovação da SPEC de ativação do backend | Muda a estratégia de persistência e a stack ativa — proibido sem SPEC aprovada. |
| P-5 | Aprovação da SPEC de atualização do `next@16` | Correção do alerta crítico de dependência; breaking change. |
| P-6 | Confirmação de que a URL pública pode ser a mesma da AP1 ou deve ser uma nova deployment do fork | A métrica exige que a URL sirva o último commit da `main` do fork. |
| P-7 | Plano de deploy contínuo (Vercel webhook em `main`) | Sem isso, a URL pública fica desatualizada a cada merge. |

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
