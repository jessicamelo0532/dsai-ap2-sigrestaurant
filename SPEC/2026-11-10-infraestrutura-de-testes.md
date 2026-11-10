# Infraestrutura mínima de testes automatizados (Vitest) em apps/web

**Data:** 2026-11-10  
**Status:** implementada (2026-11-10 — testes executados; aprovação humana anterior)  
**Agent:** opencode/mimo-v2.6-flash-free  
**SPEC derivada de:** nova  
**Derroga:** n/a — esta SPEC não altera comportamento especificado; nenhuma SPEC histórica é afetada.

> Preencher todos os campos antes de sair de `rascunho`.  
> Dúvidas de regra de negócio ficam em "Perguntas em aberto" até decisão humana — não inventar regras.

---

## Contexto e problema

O produto ativo (`apps/web`) possui funcionalidades operacionais implementadas (mesas, comandas, cardápio, despesas, relatório), mas **não existe nenhum runner ou arquivo de teste automatizado**: `apps/web/package.json` declara apenas os scripts `dev`/`build/start`, a busca por arquivos `*.test.*`/`*.spec.*` no repositório não retorna resultados e não há configuração de ESLint/CI.

A governança vigente proíbe entregar funcionalidade sem testes executados e com evidência do resultado (`AGENTS.md` §6; `SPEC/README.md` §7), e a auditoria de governança registrou a ausência de runner como pendência bloqueante. O backlog da AP2 (Tarefa 003) tem todas as funcionalidades dependentes dessa infraestrutura.

A decisão de framework está pendente: a auditoria de governança comparou Vitest, Jest, `node:test`, Playwright e Cypress e **recomendou Vitest como base**; esta SPEC materializa a fase mínima — **apenas Vitest para testes da camada `store`**, sem Playwright e sem Testing Library nesta etapa (estes só entram quando houver teste de componente que os exija, em SPEC própria).

Consultado em 2026-11-10 (leitura do registro npm, sem instalação): `vitest` versão estável mais recente **5.1.0**, engines `node ^22.12.0 || ^24.0.0 || >=26.0.0` — compatível com o Node local `v24.12.0`.

### Perguntas em aberto

- [D-1] Aprovação do framework **Vitest** e da versão/resolução a instalar (referência: `^5.1.0` consultado em 2026-11-10 — instalação não realizada).
- [D-2] Aceitar **uma única devDependency** nesta etapa (`vitest`), sem `jsdom`/Testing Library (recomendado: sem; ver Fora do escopo).
- [D-3] Aceitar que `npm run build` passará a **type-checkar** os arquivos `*.test.*` (sem alterar `tsconfig.json`), em vez de excluí-los da compilação (recomendado: aceitar; exclusão seria mudança de configuração futura).
- [D-4] Convenção de localização dos arquivos de teste (recomendada: colados ao módulo testado, ex.: `lib/store.test.ts`).
- [D-5] Adicionar script `test` também no `package.json` da raiz, no mesmo padrão delegado de `dev`/`build`/`start` (recomendado: sim).
- [D-6] Se um teste inicial revelar **bug preexistente** no `store.ts`: comportamento será **reportar sem corrigir** (divergência SPEC × código deve ser reportada, `AGENTS.md` §3) — confirmar que essa é a conduta esperada na entrega.
- [D-7] Limiar de cobertura (coverage): recomendado **não** instalar/configurar nesta etapa.

## Objetivo

Dispor de infraestrutura mínima e suficiente para executar testes automatizados das regras de negócio de `apps/web/lib/store.ts` por um único comando, offline, sem alterar o comportamento da aplicação nem a arquitetura, desbloqueando a escrita de testes nas próximas funcionalidades da AP2.

## Escopo

- **Dependência:** adicionar `vitest` como **devDependency** única em `apps/web` (nenhuma dependência de produção alterada).
- **Scripts de execução:**
  - `apps/web/package.json`: `"test": "vitest run"` e `"test:watch": "vitest"`.
  - `package.json` (raiz): `"test": "npm --workspace apps/web run test"` (mesmo padrão delegado de `dev`/`build`/`start`).
- **Configuração do Vitest:** novo arquivo `apps/web/vitest.config.ts`, mínimo:
  - `test.environment: 'node'` (testes de lógica pura, sem DOM);
  - `test.include: ['**/*.test.{ts,tsx}']` (cobre `lib/` e prepara testes futuros de componente sem mudar config);
  - `test.exclude` explícito: `**/node_modules/**`, `**/.next/**`;
  - **sem `globals: true`** — os arquivos importam `describe`/`it`/`expect`/`vi` de `'vitest'` (não exige mudanças de `tsconfig`).
- **Localização dos testes:** convenção `*.test.ts` / `*.test.tsx` **colados ao módulo testado**; nesta etapa, apenas `apps/web/lib/store.test.ts`.
- **Arranjo de teste (sem tocar no código do produto):**
  - `beforeEach`: limpar/criar `window.localStorage` em memória (via `vi.stubGlobal('window', { localStorage: fake })` ou equivalente) e, quando necessário, semear a chave `mesa-clara.data.v1` com estrutura `{ tables, menu, orders, expenses }` vazia — evitando o seed de demonstração automático (`store.ts` preenche dados demo quando a chave não existe);
  - `afterEach`: `vi.unstubAllGlobals()` — isolamento total entre testes, sem ordem dependente.
- **Testes iniciais** (`apps/web/lib/store.test.ts`), camada `store`, usando a API pública `storeRequest` + helpers exportados (`orderTotal`, `money`, `localDate`):

| # | Cenário | Regra coberta (origem) |
|---|---|---|
| T-01 | Total da comanda com preços fracionários (ex.: 3 × R$ 0,29) resulta em valor exato em centavos (R$ 0,87), sem erro de ponto flutuante; após fechar, a receita do relatório é `'0.87'` | Soma em centavos (`orderTotalCents`); exibição em reais (spec restaurante, “Valores … exibidos em reais”) |
| T-02 | Fechar comanda duas vezes: 1ª grava `PAID` com método; 2ª rejeita com mensagem “Esta comanda já foi fechada.”; receita do relatório **não** duplica (`paidOrders = 1`) | “Fechar uma comanda duas vezes não duplica receita” (spec restaurante) |
| T-03 | Adicionar item; editar nome/preço no cardápio e depois **remover** o item do cardápio; a linha da comanda preserva `nameSnapshot` e `unitPrice` originais | “Alterar/remover o item do cardápio não altera linhas de comandas antigas” (spec restaurante) |
| T-04 | Mesa com comanda aberta: `DELETE /tables/:id` rejeita (“Feche a comanda antes de remover esta mesa.”) e a mesa permanece; ao liberar (comanda fechada/removida), a remoção passa a funcionar | “Mesa ocupada não pode ser excluída” (spec restaurante) |
| T-05 | Filtro de relatório por período: despesas em dias distintos (ontem/hoje/amanhã — `incurredAt` é aceito arbitrariamente pelo store) e comanda paga no dia corrente; relatório de “hoje” soma apenas o dia; relatório amplo soma tudo, com início/fim inclusivos | “O relatório considera apenas comandas pagas e despesas dentro do período selecionado” (spec restaurante) |
| T-06 | `GET /reports/financial` com `from` posterior a `to` rejeita com “A data inicial deve ser anterior ou igual à data final.” | “início posterior ao fim é inválido” (spec restaurante) |

> Nota de implementação (técnica, não é regra de negócio): `paidAt` é gerado com `new Date()` dentro do `closeOrder`; se for necessário fechar comandas em dias artificiais, usar o controle de relógio do Vitest (`vi.useFakeTimers` + `vi.setSystemTime`). O filtro de despesas já aceita data arbitrária, o que basta para T-05.

## Fora do escopo

- **Playwright / testes end-to-end** (adiado por diretriz desta etapa).
- **Testing Library e `jsdom`**: não instalados — nenhum teste desta etapa envolve componentes; entrarão apenas se/ quando uma SPEC de componente (ex.: edição de quantidade na comanda) os exigir, com nova aprovação.
- Cobertura (coverage), thresholds, ESLint, CI/CD, lockfile.
- Alteração de dependências de produção (Next, React, lucide-react) ou de suas versões.
- Alteração de arquitetura, de `apps/web/lib/store.ts`, de `apps/web/app/**`, de `tsconfig.json`, do Dockerfile ou de `apps/api`.
- Testes da API pausada.
- Correção de bugs eventualmente revelados pelos testes (serão **reportados**, não corrigidos nesta SPEC).

## Requisitos funcionais

- **RF-01:** Um único comando (`npm test` na raiz, ou `npm --workspace apps/web run test`) executa **todos** os testes do projeto.
- **RF-02:** A suíte roda **offline**, sem serviços externos, sem banco de dados e sem rede (o `store` não realiza chamadas de rede).
- **RF-03:** Uma falha real de asserção interrompe o comando com **exit code ≠ 0** e identifica o teste que falhou.
- **RF-04:** Qualquer novo arquivo `*.test.ts`/`*.test.tsx` em `apps/web` é executado automaticamente, **sem alterar configuração**.
- **RF-05:** O comportamento da aplicação em produção não muda: build e execução do app permanecem idênticos.

## Requisitos não funcionais

- **RNF-01:** Apenas **devDependencies** novas; zero alteração em `dependencies` de produção e zero atualização de versões existentes.
- **RNF-02:** Suíte completa executada em **menos de 10 segundos** em máquina local (Vitest, ambiente `node`).
- **RNF-03:** **Nenhuma alteração** em `tsconfig.json` (imports explícitos de `'vitest'`, `globals` desativado).
- **RNF-04:** Configuração em **no máximo 1 arquivo novo** de infra (`vitest.config.ts`); arquivos novos no total: `vitest.config.ts` + `store.test.ts` (+ 2 `package.json` editados apenas em `scripts`/`devDependencies`).
- **RNF-05:** O type-check do `next build` aceita os arquivos de teste sem erro (consequência de RNF-03).

## Regras de negócio

**Nenhuma regra de negócio nova é introduzida por esta SPEC.** Os testes iniciais cobrem regras **já existentes** (comportamento atual do `store.ts`), com origem na especificação histórica:

- **RN-T1 (coberta por T-01):** valores monetários são somados com exatidão de centavos (arredondamento por centavo × quantidade) e exibidos em reais — origem: `SPEC/2026-10-01-restaurante.md` (“Valores são armazenados como decimais … e exibidos em reais”).
- **RN-T2 (T-02):** fechar uma comanda duas vezes não duplica receita — origem: spec restaurante (regras de aceitação).
- **RN-T3 (T-03):** alterar/remover item do cardápio não altera linhas antigas de comandas — origem: spec restaurante (regras de aceitação).
- **RN-T4 (T-04):** mesa ocupada (comanda aberta) não pode ser excluída — origem: spec restaurante (requisito 1 / regras de aceitação).
- **RN-T5 (T-05):** o relatório considera apenas comandas pagas e despesas dentro do período, com início e fim inclusivos — origem: spec restaurante (requisito 5 / regras de aceitação).
- **RN-T6 (T-06):** período com início posterior ao fim é inválido — origem: spec restaurante (regras de aceitação).

Se algum teste demonstrar que o código **não** implementa a regra acima, isso é **divergência a reportar** (não correção silenciosa).

## Critérios de aceitação verificáveis

- **CA-01 — Comando único:** Dado o repositório com dependências instaladas, quando `npm test` é executado na raiz, então **todos** os testes rodam em uma única execução e o comando termina com exit code 0 (quando não há falhas). *Verificação: executar e registrar output + exit code.*
- **CA-02 — Identificação de falhas reais:** Dado que uma asserção é temporariamente quebrada (verificação de mutação manual na entrega, por exemplo trocar o valor esperado em T-02) ou que uma regra do `store` é temporariamente violada, então o comando termina com **exit code ≠ 0** e aponta o teste específico; em seguida a mutação é revertida e a suíte volta a passar. *Verificação: executar as duas situações e registrar os outputs.*
- **CA-03 — Sem serviços externos:** Dado que nenhum teste utiliza rede, banco ou serviço externo (inspeção dos arquivos de teste: nenhum `fetch`, nenhum acesso a `DATABASE_URL`), quando a suíte é executada com a rede indisponível, então ela completa com exit code 0. *Verificação: inspeção + execução em ambiente sem rede.*
- **CA-04 — Comportamento da aplicação inalterado:** Dado que a implementação está concluída, quando `npm run build` é executado, então exit code 0 (build do Next idêntico ao antes da SPEC) e `git diff` mostra alterações **somente** em: `package.json`, `apps/web/package.json`, `apps/web/vitest.config.ts` (novo), `apps/web/lib/store.test.ts` (novo) e docs da entrega — **nenhum** arquivo de produto (`store.ts`, `page.tsx`, `tsconfig.json`, Dockerfile) modificado. *Verificação: `npm run build` + `git diff --stat` + `git status`.*
- **CA-05 — Extensível às próximas funcionalidades:** Dado o `include` cobrindo `**/*.test.{ts,tsx}`, quando um novo arquivo de teste é criado seguindo a convenção (colado ao módulo), então ele é executado **sem qualquer mudança de configuração**. *Verificação: na entrega, criar um arquivo de teste temporário mínimo, confirmar que é coletado pela execução e removê-lo; confirmação definitiva na primeira feature seguinte (edição de quantidade) sem tocar na config.*

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Storage isolado, seed com coleções vazias | Criar mesa; criar item com preço `0.29`; adicionar 3 un. à comanda; calcular total; fechar conta (PIX); consultar relatório do dia | Total da comanda = `0.87` (sem erro de ponto flutuante); `revenue` do relatório = `'0.87'` |
| T-02 | Mesa com comanda aberta contendo 1 item | Fechar conta (PIX); tentar fechar de novo; consultar relatório do dia | 1ª ok (`PAID`); 2ª rejeita “Esta comanda já foi fechada.”; `paidOrders = 1` e receita não duplicada |
| T-03 | Item do cardápio cadastrado e adicionado à comanda | `PATCH` do item (nome e preço novos); `DELETE` do item; consultar comanda | Linha mantém `nameSnapshot` e `unitPrice` originais |
| T-04 | Mesa com comanda aberta | Tentar remover a mesa; verificar existência; esvaiar/fechar comanda; remover de novo | 1ª tentativa: erro em pt-BR e mesa presente; 2ª: removida com sucesso |
| T-05 | Despesas de ontem/hoje/amanhã (datas arbitrárias) e comanda paga hoje | Relatório de hoje; relatório de ontem→amanhã | Hoje: só a despesa de hoje + receita de hoje; amplo: 3 despesas e receita inclusiva |
| T-06 | Sem restrição adicional | `GET /reports/financial` com `from` > `to` | Rejeição “A data inicial deve ser anterior ou igual à data final.” |

- **Camada de teste:** store (regras de negócio de `apps/web/lib/store.ts`).
- **Framework:** **Vitest** — único devDependency novo; ESM/TypeScript nativos, configuração mínima, ambiente `node`, sem transformadores adicionais; versão de referência `5.1.0` (consultada em 2026-11-10, **sujeita a aprovação humana** [D-1]). Testing Library **não** usada nesta etapa (diretriz: apenas quando houver teste de componente que a exija); Playwright **não** introduzido.
- **Automação prevista:** todos os cenários T-01 … T-06 viram testes automatizados em `apps/web/lib/store.test.ts` (nenhum cenário fica manual).

## Impactos na arquitetura

- **Camadas tocadas:** **nenhuma de produto**. Alterações de configuração: `package.json` (raiz: script `test`), `apps/web/package.json` (scripts `test`/`test:watch` + devDependency `vitest`). Arquivos novos: `apps/web/vitest.config.ts`, `apps/web/lib/store.test.ts`.
- **Persistência:** inalterada — os testes usam um `localStorage` **em memória** (stub), sem tocar no `mesa-clara.data.v1` real do navegador.
- **Backend pausado:** intocado; nenhum teste de `apps/api` nesta etapa.
- **Stack/tecnologias:** nenhuma troca; apenas devDependency nova, autorizada pela própria aprovação desta SPEC.
- **Deploy/Docker/Vercel:** fluxos existentes inalterados (`docker-compose`, build da Vercel). Efeito colateral aceito: `next build` passa a incluir os arquivos de teste no type-check (RNF-05) — devDependencies já são instaladas nos atuais `npm install` do `Dockerfile` e da Vercel.
- **`tsconfig.json`:** sem alteração (imports explícitos de `'vitest'` resolvidos pelo `moduleResolution: "bundler"` já configurado).

## Dependências e riscos

**Dependências**

- Aprovação humana desta SPEC (status `rascunho` → `aprovada`) e das decisões [D-1] … [D-7].
- Autorização para editar os dois `package.json` (scripts + devDependency) na tarefa de implementação.
- Instalação com `npm install --package-lock=false` (sem criar lockfile, conforme restrições vigentes; lockfile é decisão separada já registrada na auditoria de governança).

**Riscos e mitigações**

| Risco | Tipo | Mitigação |
|---|---|---|
| Engines do Vitest 5 (`node ^22.12 \|\| ^24 \|\| >=26`) não atendidas em algum ambiente | [F] engines / [H] ambiente | Dev local `v24.12.0` compatível [F]. Imagens Docker `node:22-alpine` podem ficar abaixo de 22.12 [H] — testes **não** rodam no fluxo Docker atual; se necessário, registrar limitação |
| Type-check do build passa a cobrir testes e falhar por erro de tipo em teste | [F] efeito esperado | Desejável (teste inválido quebra o build); alternativa (excluir do `tsconfig`) fica para decisão futura [D-3] |
| Teste revela bug preexistente no `store` | [F] possível | Reportar como pendência, **não corrigir** nesta SPEC [D-6] |
| Versão do Vitest flutua sem lockfile | [F] realidade atual | Range `^5.1.0` fixa linha 5; lockfile permanece pendência da auditoria de governança |
| APIs usadas no arranjo (`vi.stubGlobal`, `vi.useFakeTimers`) diferirem entre versões | [H] | Confirmar na primeira execução (etapa 3 do plano); alternativa trivial: atribuição direta de `globalThis.window` |

## Plano de implementação

1. Obter aprovação humana desta SPEC (incluindo [D-1] … [D-7]; registrar no Histórico).
2. Adicionar `vitest` (devDependency) e os scripts `test`/`test:watch` em `apps/web/package.json`; script `test` delegado no `package.json` da raiz — **somente** após autorização da tarefa; instalar com `--package-lock=false`.
3. Criar `apps/web/vitest.config.ts` (ambiente `node`, include/exclude, sem globals).
4. Criar `apps/web/lib/store.test.ts` com T-01 … T-06 e o arranjo de storage isolado (stub por teste).
5. Executar `npm test` (raiz) → exit 0; executar a **verificação de mutação** do CA-02 (quebrar temporariamente → exit ≠ 0 → restaurar) e registrar ambos os outputs.
6. Executar `npm run build` → exit 0; auditar `git diff --stat` conforme o CA-04. Se algum teste revelar divergência do comportamento: **reportar** (não corrigir).
7. Atualizar o status desta SPEC para `implementada`; acrescentar ao `README.md` a seção de execução dos testes (mudança documental da entrega).
8. Commit pequeno, ex.: `test(web): adiciona infraestrutura mínima de testes com Vitest`, corpo com `Agent:` e `Spec: SPEC/2026-11-10-infraestrutura-de-testes.md`.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-10 | Criação do rascunho (Tarefa 004 — sem implementação, sem instalação) | rascunho |
| 2026-11-10 | Aprovação humana do rascunho, incluindo as decisões [D-1] … [D-7], e autorização da tarefa de implementação (Tarefa 005 — sem alteração de regra de negócio) | aprovada |
| 2026-11-10 | Implementação concluída (Tarefa 005): `vitest@5.1.0` instalada como devDependency; scripts `test`/`test:watch`; `vitest.config.ts`; `lib/store.test.ts` com T-01…T-06; seção de testes no `README.md`. Validações: `npm test` 6/6 exit 0; verificação de mutação (exit 1 → restaurado → exit 0); `npm run build` exit 0; nenhum arquivo de produto alterado. Commit pendente (proibido nesta tarefa) | implementada |
