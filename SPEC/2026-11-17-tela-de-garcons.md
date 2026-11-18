# Tela de garçons e relatório de comissão

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-garcons-e-comissao.md` (API), issue #34  
**Derroga:** n/a (só consome a API existente; nenhuma regra muda)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API de garçons e comissão existe e está testada (`/api/waiters`, `/api/reports/waiters`, SPEC de 2026-11-16, status `implementada`), mas não há tela. O dono não consegue cadastrar a equipe nem ver quanto cada garçom vendeu e quanto recebe de comissão sem chamar a API à mão.

### Perguntas em aberto

- nenhuma nova. As perguntas da SPEC da API continuam valendo; a tela segue as respostas provisórias (comissão padrão de 10%, de 0 a 30%).

## Objetivo

Dar ao dono uma seção **Garçons** para manter o cadastro da equipe e consultar, por período, as vendas e a comissão de cada garçom.

## Escopo

- Lógica pura em `apps/web/lib/garcons.ts`: leitura da taxa digitada, validações, ordenação da lista, período padrão, rótulos.
- Componente `apps/web/app/garcons-panel.tsx` com cadastro e relatório.
- Item **Garçons** no menu lateral e verificação da tela no E2E de celular.

## Fora do escopo

- Atribuir ou trocar o garçom de uma comanda (`PUT /orders/:id/waiter`). Isso muda o painel da comanda e terá SPEC própria.
- Garçons no modo navegador (`localStorage`): o cadastro da equipe existe só no modo servidor, como o caixa.
- Qualquer mudança na API.

## Requisitos funcionais

- **RF-01:** No modo navegador, a seção avisa que precisa do servidor e oferece **Conectar ao servidor** quando o build tem `NEXT_PUBLIC_API_URL`.
- **RF-02:** A lista mostra todos os garçons (`GET /waiters?all=true`), ativos primeiro e depois em ordem alfabética, com a comissão e a situação (ativo ou inativo).
- **RF-03:** **Novo garçom** cadastra com nome e comissão (`POST /waiters`). A comissão vazia usa o padrão da API (10%).
- **RF-04:** **Editar** muda nome e comissão (`PATCH /waiters/:id`). **Desativar/Ativar** muda a situação (`PATCH /waiters/:id` com `{ active }`).
- **RF-05:** **Excluir** pede confirmação e chama `DELETE /waiters/:id`. Se a API recusar porque o garçom tem comandas, a tela mostra a mensagem da API, que orienta a desativar.
- **RF-06:** O relatório mostra, para o período escolhido (padrão: do dia 1º do mês até hoje), uma linha por garçom com contas pagas, receita, ticket médio e comissão, a linha "Sem garçom" e os totais (`GET /reports/waiters?from&to`).
- **RF-07:** Erros da API aparecem na tela com a mensagem que a API devolve.

## Requisitos não funcionais

- **RNF-01:** Textos em português; valores em `R$ 1.234,56`; taxa em `10,5%`.
- **RNF-02:** A tela passa no E2E de celular em 375 px.
- **RNF-03:** Nenhuma dependência nova.

## Regras de negócio

As regras são as da SPEC da API, que continua sendo a fonte final. A tela repete apenas as que evitam um envio que a API recusaria:

- **RN-01 (RN-01 da API):** nome de 2 a 80 caracteres. A unicidade do nome é conferida pela API, e a mensagem dela aparece na tela.
- **RN-02 (RN-02 da API):** comissão de 0 a 30%, com até 2 casas; aceita vírgula ou ponto e o sinal `%`.
- **RN-03:** período do relatório com as duas datas preenchidas e a inicial menor ou igual à final.

## Critérios de aceitação verificáveis

- **CA-01:** Dado o modo navegador, quando abro **Garçons**, então vejo que precisa do servidor e nenhuma requisição é feita.
- **CA-02:** Dado garçons ativos e inativos, então a lista mostra os ativos primeiro, cada um com comissão e situação.
- **CA-03:** Quando cadastro "Rui" com comissão "12,5", então a API recebe `{ name: "Rui", commissionRate: 12.5 }`; sem comissão, recebe só `{ name }`.
- **CA-04:** Quando informo comissão 31 ou nome com 1 letra, então a tela recusa sem enviar.
- **CA-05:** Quando edito ou desativo um garçom, então a API recebe o `PATCH` com os campos alterados e a lista é recarregada.
- **CA-06:** Quando excluo um garçom com comandas, então a mensagem da API aparece.
- **CA-07:** Dado vendas no período, então o relatório mostra contas, receita, ticket médio e comissão por garçom, "Sem garçom" e totais.
- **CA-08:** Quando troco o período, então a API é chamada com as novas datas; com a data inicial depois da final, a tela recusa sem chamar.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | taxa, validações, ordenação, período | RN-01 a RN-03 |
| T-02 | Modo navegador | renderizar | CA-01 |
| T-03 | API com garçons | listar | CA-02 |
| T-04 | API | cadastrar com e sem comissão; inválidos | CA-03, CA-04 |
| T-05 | API | editar, desativar, excluir com recusa | CA-05, CA-06 |
| T-06 | API com relatório | ver e trocar período | CA-07, CA-08 |
| T-07 | Celular 375 px | navegar até Garçons | RNF-02 |

- **Camada de teste:** lógica pura (`lib/garcons.test.ts`) e componente com Testing Library (`app/garcons-panel.test.tsx`), com `fetch` simulado.
- **Framework:** Vitest.
- **Automação prevista:** T-01 a T-06 automáticos; T-07 no job "Uso no celular (375 px)" do CI.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/garcons.ts` (novo), `apps/web/app/garcons-panel.tsx` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`.
- **Persistência:** não muda.
- **Backend:** não muda.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build; na Vercel a seção mostra o aviso de RF-01.

## Dependências e riscos

- **Dependências:** API de garçons (`SPEC/2026-11-16-garcons-e-comissao.md`).
- **Riscos:** o período do relatório é interpretado pela API em UTC (`common/period.ts`); vendas perto da meia-noite podem cair no dia vizinho.
- **Mitigações:** o comportamento é o mesmo do relatório financeiro existente; fica registrado aqui e não é alterado nesta SPEC.

## Plano de implementação

1. Commit desta SPEC.
2. `lib/garcons.ts` com testes.
3. `garcons-panel.tsx` e testes de componente, em commits separados.
4. Item no menu, estilos e E2E de celular.
5. Rodar testes e build; verificar CA-01 a CA-08.
6. README e status desta SPEC.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
| 2026-11-17 | CA-01 a CA-08 verificados por 21 testes de `lib/garcons.test.ts` e 14 de `app/garcons-panel.test.tsx`; `tsc --noEmit` sem erros. O `next build` local não completa por falta de memória da máquina (3,7 GB); o build completo e o E2E de celular (T-07) ficam com o CI | implementada |
