# Testes de componente no frontend (issue 1.3)

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** opencode/minimax-m3.1-flash-free  
**SPEC derivada de:** issue #14 (backlog 1.3)  
**Derroga:** `AGENTS.md` §12 apenas no ponto de "não alterar dependências sem aprovação": a aprovação humana de 2026-11-17 autoriza (a) as duas dependências de desenvolvimento abaixo e (b) a correção da árvore de dependências descrita em "Achado durante a implementação".

---

## Contexto e problema

Fato comprovado em 2026-11-17: `npm run metricas` mede **56,17% de cobertura de linhas** em `apps/web/lib` e `apps/web/app` (limite da Aula 09: 70%). A queda veio dos painéis novos: `page.tsx`, `salao-panel.tsx` e `cozinha-panel.tsx` não têm teste. Toda a lógica testável já está em `lib/` (100% coberta em `cozinha.ts` e `salao.ts`), mas as linhas de JSX contam na métrica e nunca são executadas.

O E2E de celular (`apps/web/e2e/celular.mjs`, Playwright) já existe e roda no CI — a parte "E2E (Playwright)" da issue está atendida. Falta a parte "Testing Library".

### Achado durante a implementação

Fato comprovado: o workspace tinha **duas cópias de React**. `npm ls react` mostrava `react@18.3.1` na raiz do monorepo (herança do AP1, reinstalada como peer de `next`, `lucide-react` e `@testing-library/react` hoisted) e `react@19.3.1` em `apps/web`. O `@testing-library/react` carregava o `react-dom` 18 por `require`, fora do Vite, e todo `render()` falhava com "Objects are not valid as a React child". `resolve.dedupe`, `resolve.alias` e `server.deps.inline` não resolvem, porque o caminho CJS do Testing Library não passa pelo pipeline do Vite.

Decisão do humano (2026-11-17): corrigir a árvore com `overrides` de `react`/`react-dom` em `^19.2.0` e `react`/`react-dom` `^19.2.0` como devDependencies da raiz (o npm 11 não re-resolve peers só com `overrides`; a devDependency da raiz força a versão única). Resultado: uma única cópia, `react@19.3.1`, para app, Next e testes.

### Perguntas em aberto (para o cliente)

- Nenhuma. As dependências e a correção da árvore de React foram aprovadas pelo humano em 2026-11-17.

## Objetivo

Cobrir os três componentes com testes de componente, de modo que a métrica de cobertura volte a ficar acima de 70% e uma regressão de interface (botão que não chama a rota, filtro que não filtra, aviso que não aparece) seja detectada sem abrir o navegador.

## Escopo

- Duas dependências **de desenvolvimento** em `apps/web`: `@testing-library/react` e `jsdom`.
- `react` e `react-dom` `^19.2.0` como devDependencies da raiz, com `overrides` equivalentes (ver "Achado durante a implementação").
- Alias `@/` no `apps/web/vitest.config.ts` (o mesmo do `tsconfig`), para os componentes resolverem fora do Next.
- Ambiente `jsdom` por arquivo de teste (`// @vitest-environment jsdom`), sem mudar o ambiente `node` dos testes de `lib/`.
- `apps/web/app/cozinha-panel.test.tsx`, `apps/web/app/salao-panel.test.tsx` e `apps/web/app/page.test.tsx`.
- `fetch` simulado por teste (`vi.stubGlobal`), sem rede.

## Fora do escopo

- Testar cada detalhe visual: tamanho de fonte e alvo de toque continuam no E2E de celular.
- Testar a API (já tem 698 testes de integração).
- Mudar comportamento, texto ou layout dos componentes.

## Requisitos funcionais

- **RF-01:** o painel da cozinha, no modo servidor, desenha o resumo, os filtros e um cartão por pedido a partir da fila simulada, e cada ação chama a rota certa (`/kitchen/tickets/:id/start|ready|deliver`).
- **RF-02:** o painel da cozinha bloqueia "quem mudou" inválido com a mensagem da RN-03 e, com nome válido, envia `PUT .../priority` com a prioridade alternada.
- **RF-03:** o painel da cozinha no modo navegador mostra o aviso do RF-08 da SPEC da tela e **não** chama `fetch`.
- **RF-04:** o painel do salão desenha o resumo e as mesas, filtra por ocupadas/livres e avisa a tela quando uma mesa é aberta.
- **RF-05:** a tela principal carrega mesas, cardápio, relatório e despesas, mostra a faixa de modo, alterna entre as seções e, no modo servidor, mostra o envio para a cozinha na comanda aberta.
- **RF-06:** as rotas chamadas pelos componentes são as mesmas que a API expõe (sem caminho inventado).

## Requisitos não funcionais

- **RNF-01:** os testes não dependem de rede, banco, relógio real ou ordem de execução.
- **RNF-02:** a suíte continua rodando em um comando (`npm test`) e em menos de 30 s.
- **RNF-03:** nenhum teste depende de dado deixado por outro.

## Regras de negócio

Nenhuma regra nova. Os testes verificam as regras já especificadas: ações por situação (RF-02 da tela da cozinha), validação de "quem mudou" (RN-03), aviso no modo navegador (RF-08) e faixa de modo (`SPEC/2026-11-14-frontend-em-modo-api.md`).

## Critérios de aceitação verificáveis

- **CA-01:** `npm test` passa com os três arquivos novos e a suíte existente.
- **CA-02:** `npm run metricas` mostra cobertura **≥ 70%** (issue 1.3).
- **CA-03:** remover uma ação do painel da cozinha ou o filtro do salão faz o teste correspondente falhar (verificado por mutação manual).
- **CA-04:** `npm run build` e `npm run e2e:celular` continuam verdes; nenhum texto visível muda.
- **CA-05:** o CI fica verde com as duas dependências novas no `package-lock.json`.

## Cenários de teste

- Cozinha: fila vazia, fila com pedido, clique em cada ação, prioridade inválida e válida, modo navegador sem requisição, filtro "Atrasados".
- Salão: resumo com mesas ocupadas e livres, filtro, abertura de mesa.
- Tela principal: carregamento inicial, seções, faixa de modo online/offline, envio para a cozinha, fechamento de conta.

## Histórico de verificação

Verificação em 2026-11-17, no branch `feat/testes-de-componente`:

| Critério | Como foi verificado | Resultado |
|---|---|---|
| CA-01 | `npm test` | **102 testes em 9 arquivos, 102 passando** (74 anteriores + 28 novos: 10 em `cozinha-panel.test.tsx`, 7 em `salao-panel.test.tsx`, 11 em `page.test.tsx`), 6,9 s |
| CA-02 | `npm --workspace apps/web run coverage` e `npm run metricas` | **86,43% de linhas** (497/575), 77,3% statements, 73,27% branches, 67,25% funções. `npm run metricas`: **9/10 conformes** (só volume segue não conforme) |
| CA-03 | Mutação manual: removidos os botões de filtro do `cozinha-panel.tsx` | **2 testes falharam** (`/^Todas/` e `/^Atrasados/`); arquivo restaurado com `git diff` vazio |
| CA-04 | `npm run build` e `npm run e2e:celular` (servidor local na porta 3001, Chrome em 375 px) | Build verde (TypeScript ok); **10 telas** dentro dos limites no celular |
| CA-05 | `npm ls react react-dom` e CI | Árvore com **uma única** cópia (`react@19.3.1`, sem `invalid`); CI roda `npm ci` + `npm test` e fica verde no PR |

Cobertura por arquivo (linhas): `cozinha-panel.tsx` 90,9%, `salao-panel.tsx` 100%, `page.tsx` 65,87%, `layout.tsx` 0% (sem teste), `cozinha.ts` 100%, `salao.ts` 100%, `api-client.ts` 92,59%, `import-local.ts` 90,47%, `local-store.ts` 86,79%.

Pendências declaradas: `layout.tsx` e as partes de `page.tsx` não exercitadas (formulários de mesa/cardápio/despesa e o botão "Importar meus dados") não entram nos critérios desta SPEC; a issue #14 pode ser fechada com a evidência acima.
