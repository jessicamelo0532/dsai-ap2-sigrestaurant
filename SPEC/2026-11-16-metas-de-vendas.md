# Metas de vendas e comparativo com o período anterior (API)

**Data:** 2026-11-16  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #37 (backlog 2.20)  
**Derroga:** nenhuma. Funcionalidade nova, que só lê comandas pagas.

---

## Contexto e problema

Fato comprovado em 2026-11-16: o sistema mostra receita e ticket médio, mas não tem meta nem diz se o mês está melhor ou pior que o anterior no mesmo ponto. A issue #37 pede meta mensal de receita, comandas e ticket médio, percentual de atingimento e comparativo com o período anterior de mesmo tamanho.

### Perguntas em aberto (para o cliente)

- **P-1:** o mês em andamento se compara com o mês anterior inteiro? Provisório: não; com o mesmo número de dias do começo do mês anterior (dia 1 a 16 contra dia 1 a 16). Se o mês anterior for mais curto, a janela para no fim dele.
- **P-2:** o mês segue qual fuso? Provisório: UTC, como o fechamento mensal.

## Objetivo

Cadastrar metas por mês, acompanhar quanto já foi atingido e comparar qualquer período com o período anterior de mesmo tamanho.

## Escopo

- Tabela `SalesGoal`.
- Módulo NestJS `goals` com as rotas:
  - `GET /api/goals?year=` lista as metas do ano;
  - `PUT /api/goals/:month` com `{ revenue, orders, averageTicket }` cria ou troca a meta do mês;
  - `DELETE /api/goals/:month`;
  - `GET /api/goals/:month/progress` mostra realizado, atingimento e comparativo;
  - `GET /api/reports/compare?from=&to=` compara um período qualquer com o anterior de mesmo tamanho.

## Fora do escopo

- Telas no frontend.
- Meta por garçom, por item ou por dia.
- Projeção do fim do mês.

## Requisitos funcionais

- **RF-01:** a meta do mês tem receita, número de comandas e ticket médio; cada um é opcional, mas pelo menos um precisa existir.
- **RF-02:** o progresso do mês mostra a meta, o realizado até agora (receita com desconto, comandas pagas, ticket médio), o percentual de atingimento de cada meta e o comparativo com a mesma janela do mês anterior (P-1).
- **RF-03:** o comparativo de período devolve o período pedido, o período anterior de mesmo tamanho (que termina onde o pedido começa) e a variação percentual de receita, comandas e ticket médio.

## Requisitos não funcionais

- **RNF-01:** o "agora" do progresso vem de um relógio injetável.
- **RNF-02:** contas em centavos; percentuais com uma casa decimal.

## Regras de negócio

- **RN-01:** mês no formato `AAAA-MM` (mesma regra do fechamento mensal).
- **RN-02:** receita e ticket médio maiores que zero, com até 2 casas; comandas inteiro maior que zero; `null` tira aquela meta. Mensagens: "Informe uma meta de receita válida.", "Informe uma meta de comandas válida.", "Informe uma meta de ticket médio válida." e "Informe pelo menos uma meta: receita, comandas ou ticket médio."
- **RN-03:** atingimento = realizado ÷ meta × 100, com uma casa; sem meta, nulo. Pode passar de 100.
- **RN-04:** o progresso usa a meta do próprio mês consultado, e nunca a de outro mês (critério da issue).
- **RN-05:** janela do mês: do dia 1 até agora (ou até o fim do mês, se já acabou); mês futuro tem janela vazia.
- **RN-06:** janela anterior do progresso: começa no dia 1 do mês anterior e tem o mesmo tamanho da janela atual, sem passar do fim do mês anterior (P-1) (critério da issue).
- **RN-07:** janela anterior do comparativo: o mesmo número de dias, terminando no dia anterior a `from` (critério da issue).
- **RN-08:** variação percentual como no fechamento mensal: sem base, nula.

## Critérios de aceitação verificáveis

- **CA-01:** o percentual de atingimento usa a meta do período correto: duas metas em meses seguidos, cada progresso usa a sua (critério da issue).
- **CA-02:** o comparativo usa o mesmo tamanho de janela do período anterior: 7 dias contra os 7 dias antes; mês em andamento até o dia 16 contra o dia 1 a 16 do mês anterior (critério da issue).
- **CA-03:** cadastrar, trocar, tirar uma meta e apagar o mês funcionam; meta sem nenhum valor é recusada.
- **CA-04:** o realizado usa o total com desconto e só comandas pagas.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Metas de outubro e novembro, vendas nos dois | Progresso de cada mês | CA-01 |
| T-02 | Vendas em datas controladas | Comparativo de 7 dias e progresso no dia 16 | CA-02 |
| T-03 | Sem metas | Cadastrar, trocar, tirar, apagar | CA-03 |
| T-04 | Comanda paga com desconto, aberta e cancelada | Progresso | CA-04 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/goals/` (novo), `app.module.ts`, `apps/api/test/`.
- **Frontend:** não muda.

## Dependências e riscos

- **Riscos:** comparar janelas de tamanhos diferentes e tirar conclusão errada.
- **Mitigações:** as datas exatas de cada janela vêm na resposta.

## Plano de implementação

1. Regras puras com testes.
2. Schema e migração.
3. Serviço e rotas.
4. Testes de integração.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 e P-2 | aprovada |
