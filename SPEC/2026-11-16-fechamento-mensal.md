# Fechamento mensal com DRE simplificada (API)

**Data:** 2026-11-16  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #36 (backlog 2.19) e entrevista com o cliente (`docs/entrevistas/2026-11-13-cliente.md`, prioridade 3.2); usa dados de `SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md`  
**Derroga:** n/a. Acrescenta uma regra às despesas e ao pagamento de compras (RN-07): lançamentos com data num mês fechado são recusados.

---

## Contexto e problema

O cliente apontou como segunda maior falta:

> falta da contabilidade confiável para no final do mês ter os valores certos

Fato comprovado em 2026-11-16: o relatório financeiro (`GET /api/reports/financial`) calcula receita, despesas e saldo de qualquer período, mas sempre na hora. Nada impede que uma despesa de outubro seja criada, editada ou apagada em dezembro, e o "resultado de outubro" muda sem aviso. Também não existe comparação com o mês anterior nem separação entre o que foi gasto com insumos (compras de fornecedores) e as demais despesas.

### Perguntas em aberto (para o cliente)

- **P-1:** o mês pode ser reaberto depois de fechado? Provisório: sim, com motivo obrigatório; a reabertura fica registrada e o fechamento seguinte aumenta o número da revisão.
- **P-2:** o mês corrente pode ser fechado antes de terminar? Provisório: não; só meses já encerrados.
- **P-3:** o custo da DRE deve ser o que foi pago a fornecedores no mês ou o consumo de ingredientes vendidos (custo da mercadoria vendida)? Provisório: o que foi pago a fornecedores no mês, que é o dado que o sistema já tem com valor.
- **P-4:** o "mês" segue UTC, como o resto da API? Provisório: sim.

## Objetivo

Ver o resultado de qualquer mês numa DRE simplificada e fechar o mês, guardando os valores, de modo que lançamentos posteriores não mudem o resultado fechado sem uma reabertura explícita.

## Escopo

- Tabela `MonthlyClosing` com os valores do mês no momento do fechamento.
- Módulo NestJS `closings` com rotas em `/api/closings`.
- Regras puras em `closing-rules.ts`.
- Bloqueio de lançamentos em mês fechado nas despesas (`AppService`) e no pagamento de compras (`PurchasingService`).

## Fora do escopo

- Telas no frontend (o app publicado ainda roda no modo local).
- Custo da mercadoria vendida pelo consumo de ingredientes (P-3).
- Impostos, regime tributário, exportação para contador.

## Requisitos funcionais

- **RF-01:** `GET /api/closings/AAAA-MM` devolve a DRE do mês: receita total e por forma de pagamento, compras de insumos pagas, outras despesas, total de despesas, resultado, número de contas pagas, ticket médio, a mesma DRE do mês anterior e a variação de receita e de resultado. Se o mês estiver fechado, devolve também os valores guardados e as divergências entre o guardado e o recalculado.
- **RF-02:** `POST /api/closings` com `{ month, notes? }` fecha o mês, guardando os valores da DRE.
- **RF-03:** `POST /api/closings/AAAA-MM/reopen` com `{ reason }` reabre um mês fechado.
- **RF-04:** `GET /api/closings` lista os fechamentos, do mês mais recente para o mais antigo.
- **RF-05:** criar, editar ou apagar despesa com data num mês fechado é recusado, assim como pagar compra com data de pagamento num mês fechado.

## Requisitos não funcionais

- **RNF-01:** contas em centavos inteiros.
- **RNF-02:** o relógio é injetável, para testar "mês já terminou" sem depender da data real.
- **RNF-03:** mensagens em português; 400 para regra violada, 404 para fechamento inexistente.

## Regras de negócio

- **RN-01:** mês no formato AAAA-MM; o mês vai do primeiro dia às 00h00 até o primeiro dia do mês seguinte, em UTC (P-4). Mensagem: "Informe o mês no formato AAAA-MM."
- **RN-02:** receita = soma das comandas pagas (`PAID`) com data de pagamento no mês, por forma de pagamento; contas canceladas e abertas não entram (mesma regra do relatório financeiro).
- **RN-03:** compras de insumos = despesas do mês geradas pelo pagamento de compras; outras despesas = as demais despesas do mês; resultado = receita − compras de insumos − outras despesas (P-3).
- **RN-04:** ticket médio = receita ÷ contas pagas, arredondado ao centavo; sem contas pagas, zero.
- **RN-05:** variação = (atual − anterior) ÷ |anterior| × 100, com uma casa decimal; se o anterior for zero, não há variação (nulo).
- **RN-06:** só fecha mês já encerrado (P-2) e ainda não fechado. Mensagens: "Só é possível fechar um mês que já terminou." e "O mês MM/AAAA já está fechado."
- **RN-07:** com o mês fechado, lançamentos com data naquele mês são recusados (despesa criada, editada, movida para ou de lá, apagada; pagamento de compra). Mensagem: "O mês MM/AAAA está fechado. Reabra o fechamento para alterar lançamentos desse mês."
- **RN-08:** reabrir exige motivo de 5 a 300 caracteres e só vale para mês fechado. O registro guarda quando e por quê; fechar de novo atualiza os valores e soma 1 à revisão (P-1).
- **RN-09:** divergência = qualquer valor guardado diferente do recalculado (só possível se dados foram alterados por fora da API); a DRE as lista para conferência.

## Critérios de aceitação verificáveis

- **CA-01:** dado um mês com contas pagas em formas diferentes, despesas comuns e uma compra paga, quando consultar a DRE, então os totais seguem RN-02 a RN-04 e batem com `GET /api/reports/financial` do mesmo período.
- **CA-02:** quando consultar a DRE, então ela traz o mês anterior e a variação de RN-05.
- **CA-03:** dado um mês encerrado, quando fechar, então o fechamento guarda os valores; fechar de novo é recusado; fechar o mês corrente é recusado.
- **CA-04:** dado um mês fechado, quando criar, editar, mover ou apagar despesa daquele mês, ou pagar compra com data naquele mês, então recebe erro de RN-07 e nada muda.
- **CA-05:** quando reabrir com motivo, então os lançamentos voltam a ser aceitos; fechar de novo soma 1 à revisão.
- **CA-06:** dado um valor alterado direto no banco depois do fechamento, quando consultar a DRE, então a divergência aparece (RN-09).

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | Mês, mês anterior, variação, ticket médio, divergências | RN-01, RN-04, RN-05, RN-09 |
| T-02 | Mês com movimento | DRE | CA-01, CA-02 |
| T-03 | Mês encerrado | Fechar, fechar de novo, fechar mês corrente | CA-03 |
| T-04 | Mês fechado | Lançar despesa e pagar compra | CA-04 |
| T-05 | Mês fechado | Reabrir e fechar de novo | CA-05 |
| T-06 | Mês fechado | Alterar valor direto no banco | CA-06 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/closings/` (novo), `app.module.ts`, `app.service.ts` (despesas), `purchasing.service.ts` (pagamento), `apps/api/test/`.
- **Persistência:** uma tabela nova; nada existente muda.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Dependências:** compras e despesas existentes.
- **Riscos:** bloquear lançamento legítimo num mês fechado por engano; fuso UTC deslocar lançamentos de fim de mês.
- **Mitigações:** reabertura com motivo (P-1); P-4 registrada.

## Plano de implementação

1. Schema e migração.
2. Regras puras com testes.
3. Serviço, rotas e bloqueio de lançamentos.
4. Testes de integração.
5. Verificar CA-01 a CA-06; README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com regras provisórias P-1 a P-4 | aprovada |
| 2026-11-16 | CA-01 a CA-06 verificados na execução 43945882793 do GitHub Actions: 294 testes da API passando contra PostgreSQL 16 (módulo de fechamento com 97,7% das linhas cobertas; regras e bloqueio com 100%); DRE de outubro igual ao relatório financeiro do mesmo período; checagem de migrações sem diferença. Nove mutações nas regras puras fizeram testes falharem. O CI pegou a leitura do retorno `void` da trava, corrigida com `executeRaw`. P-1 a P-4 seguem abertas para o cliente | implementada |
