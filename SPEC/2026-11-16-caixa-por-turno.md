# Caixa por turno: abertura, sangria, reforço e fechamento com conferência (API)

**Data:** 2026-11-16  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #32 (backlog 2.15), lacuna apontada na issue #6 ("Primeiras impressões")  
**Derroga:** n/a (não muda o fechamento de contas nem o relatório financeiro)

---

## Contexto e problema

Fato comprovado em 2026-11-16: o sistema registra as contas pagas e a forma de pagamento, mas não existe turno de caixa. Não se sabe quem abriu o caixa, com quanto de troco, quanto foi retirado (sangria) ou colocado (reforço) durante o turno, nem se o dinheiro contado no fim bate com o que deveria haver. A issue #32 pede abertura, sangria e entrada com justificativa e fechamento com conferência por forma de pagamento, com a divergência aparecendo explicitamente.

### Perguntas em aberto (para o cliente)

- **P-1:** pode haver mais de um caixa aberto ao mesmo tempo (dois operadores)? Provisório: não; um turno aberto por vez.
- **P-2:** fechar conta deve exigir caixa aberto? Provisório: não; as contas pagas entram no turno pelo horário de pagamento, e contas pagas sem turno aberto ficam fora de qualquer turno.
- **P-3:** diferença de caixa precisa de justificativa? Provisório: sim; com qualquer diferença, o fechamento exige observação.

## Objetivo

Controlar cada turno de caixa do início ao fim e, no fechamento, comparar o esperado com o informado em cada forma de pagamento, deixando qualquer diferença registrada e justificada.

## Escopo

- Tabelas `CashSession` e `CashMovement`, com migração.
- Módulo NestJS `cash` com rotas em `/api/cash`.
- Regras puras em `cash-rules.ts`.

## Fora do escopo

- Telas no frontend.
- Vários caixas simultâneos (P-1), cofre, transferência entre caixas.
- Integração com maquininha ou banco para conferir cartão e Pix automaticamente.

## Requisitos funcionais

- **RF-01:** `POST /api/cash/open` com `{ operator, openingAmount }` abre um turno.
- **RF-02:** `POST /api/cash/withdrawals` (sangria) e `POST /api/cash/deposits` (reforço) com `{ amount, reason }` no turno aberto.
- **RF-03:** `GET /api/cash/current` mostra o turno aberto com vendas por forma de pagamento, movimentações e o esperado em cada forma; sem turno aberto, devolve nulo.
- **RF-04:** `POST /api/cash/close` com `{ operator, counted: { CASH, CREDIT, DEBIT, PIX }, notes? }` fecha o turno, guardando esperado, informado e diferença por forma.
- **RF-05:** `GET /api/cash/sessions?from&to` lista os turnos abertos no período, do mais recente para o mais antigo; `GET /api/cash/sessions/:id` mostra um turno.

## Requisitos não funcionais

- **RNF-01:** dinheiro em centavos inteiros nas contas.
- **RNF-02:** abrir, movimentar e fechar travam o turno, para duas ações simultâneas não passarem por cima uma da outra.
- **RNF-03:** relógio injetável para testes.

## Regras de negócio

- **RN-01:** só um turno aberto por vez (P-1). Mensagem: "Já existe um turno de caixa aberto."
- **RN-02:** operador de 2 a 80 caracteres; troco inicial zero ou mais, com até 2 casas; sangria e reforço maiores que zero, com até 2 casas e motivo de 3 a 200 caracteres.
- **RN-03:** vendas do turno = contas pagas com data de pagamento a partir da abertura e antes do fechamento (ou de agora, se aberto), por forma de pagamento (P-2).
- **RN-04:** esperado em dinheiro = troco inicial + vendas em dinheiro + reforços − sangrias; esperado em crédito, débito e Pix = vendas daquela forma.
- **RN-05:** sangria não pode passar do dinheiro esperado na gaveta. Mensagem: "Saldo insuficiente no caixa: há R$ X em dinheiro."
- **RN-06:** sem turno aberto, sangria, reforço e fechamento são recusados. Mensagem: "Não há turno de caixa aberto."
- **RN-07:** diferença = informado − esperado, por forma; positiva é sobra, negativa é falta. Com qualquer diferença, o fechamento exige observação de 5 a 500 caracteres (P-3). Mensagem: "Explique a diferença de caixa antes de fechar o turno."
- **RN-08:** valores informados no fechamento: zero ou mais, com até 2 casas, nas quatro formas.

## Critérios de aceitação verificáveis

- **CA-01:** dado um turno aberto com troco, vendas em várias formas, sangria e reforço, quando consultar o turno, então o esperado segue RN-03 e RN-04.
- **CA-02:** quando fechar informando exatamente o esperado, então o turno fecha sem diferença e sem exigir observação.
- **CA-03:** quando fechar informando valores diferentes, então a diferença aparece por forma de pagamento, e sem observação o fechamento é recusado (critérios da issue #32).
- **CA-04:** contas pagas antes da abertura ou depois do fechamento não entram no turno.
- **CA-05:** abrir com turno aberto, sangria acima do dinheiro e movimentar sem turno aberto são recusados.
- **CA-06:** os turnos fechados aparecem na lista com os valores guardados.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | Valores, esperado, sangria, diferenças, justificativa | RN-02, RN-04, RN-05, RN-07, RN-08 |
| T-02 | Turno com movimento | Consultar | CA-01, CA-04 |
| T-03 | Turno aberto | Fechar certo e com diferença | CA-02, CA-03 |
| T-04 | Situações inválidas | Abrir, sangrar, fechar | CA-05 |
| T-05 | Turnos fechados | Listar | CA-06 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/cash/` (novo), `app.module.ts`, `apps/api/test/`.
- **Persistência:** duas tabelas novas; nada existente muda.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Riscos:** conta paga sem turno aberto ficar fora da conferência; horário do servidor diferente do relógio do caixa.
- **Mitigações:** P-2 registrada; os horários de abertura e fechamento são os do servidor, os mesmos do pagamento.

## Plano de implementação

1. Schema e migração.
2. Regras puras com testes.
3. Serviço e rotas.
4. Testes de integração.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 a P-3 | aprovada |
| 2026-11-16 | CA-01 a CA-06 verificados na execução 43947517534 do GitHub Actions: 352 testes da API passando contra PostgreSQL 16 (caixa com 98,3% das linhas cobertas) e checagem de migrações sem diferença. Oito de nove mutações nas regras puras fizeram testes falharem; a nona é equivalente. P-1 a P-3 seguem abertas | implementada |
