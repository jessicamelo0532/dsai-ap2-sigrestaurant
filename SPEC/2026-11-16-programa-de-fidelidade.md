# Programa de fidelidade com pontos e resgate como desconto (API)

**Data:** 2026-11-16  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #39 (backlog 2.22)  
**Derroga:** em parte `SPEC/2026-10-01-restaurante.md` e as SPECs de 2026-11-16 de fechamento mensal, relatórios de vendas, caixa por turno e garçons, no ponto em que o total da comanda é a soma dos itens. O total passa a ser a soma dos itens menos o desconto de fidelidade. Quem não usa a fidelidade não vê diferença, porque o desconto é zero.

---

## Contexto e problema

Fato comprovado em 2026-11-16: com o cadastro de clientes (SPEC `2026-11-16-clientes-e-historico.md`) já dá para saber quem consumiu, mas não há nenhum benefício para quem volta. A issue #39 pede regra de pontuação por valor consumido, saldo de pontos e resgate como desconto na comanda, com dois critérios: os pontos batem com a regra configurada e o resgate não deixa o total negativo.

Hoje o total da comanda é calculado em sete lugares (relatório financeiro, detalhe da comanda, caixa, garçons, fechamento mensal, relatório de vendas e histórico do cliente). Para o desconto valer em todos do mesmo jeito, a conta passa a ficar num lugar só.

### Perguntas em aberto (para o cliente)

- **P-1:** qual a regra padrão? Provisório: 1 ponto por real pago, cada ponto vale R$ 0,05 no resgate (100 pontos = R$ 5,00) e o resgate mínimo é de 100 pontos. Tudo configurável.
- **P-2:** a comissão do garçom é sobre o valor com ou sem desconto? Provisório: com desconto, o que o restaurante recebeu.
- **P-3:** os pontos vencem? Provisório: não.

## Objetivo

Creditar pontos ao cliente quando a comanda é paga, mostrar o saldo e o extrato, e deixar o cliente trocar pontos por desconto numa comanda aberta, sem que o total fique negativo e com o desconto refletido em todos os relatórios.

## Escopo

- Tabelas `LoyaltySettings` (regra, uma linha só) e `LoyaltyEntry` (extrato), enum `LoyaltyEntryType`, campos `Order.discount` e `Order.loyaltyPoints`.
- Conta única do total da comanda em `apps/api/src/common/order-total.ts`, usada pelos sete pontos citados.
- Módulo NestJS `loyalty` com as rotas:
  - `GET /api/loyalty/settings` e `PUT /api/loyalty/settings`;
  - `GET /api/customers/:id/loyalty` saldo e extrato;
  - `POST /api/orders/:id/loyalty` com `{ points }` resgata;
  - `DELETE /api/orders/:id/loyalty` desfaz o resgate.
- Travas e créditos em `app.service.ts` (pagar, cancelar, alterar e remover item), `customers.service.ts` (trocar cliente) e `order-moves.service.ts` (juntar).

## Fora do escopo

- Telas no frontend.
- Ajuste manual de saldo, vencimento de pontos (P-3) e níveis de cliente.
- Desconto que não seja de fidelidade.

## Requisitos funcionais

- **RF-01:** `GET /api/loyalty/settings` devolve a regra atual (P-1 se nunca foi mudada); `PUT` muda `pointsPerReal`, `centsPerPoint` e `minRedeemPoints`.
- **RF-02:** ao pagar uma comanda com cliente, o cliente ganha pontos pelo total pago, pela regra daquele momento, e o extrato registra o crédito com a comanda.
- **RF-03:** `GET /api/customers/:id/loyalty` devolve o saldo, o valor em reais que o saldo vale hoje e o extrato do mais recente para o mais antigo.
- **RF-04:** `POST /api/orders/:id/loyalty` troca pontos do cliente da comanda por desconto; `DELETE` devolve os pontos e tira o desconto.
- **RF-05:** o detalhe da comanda (`GET /api/orders/:id`) mostra subtotal, desconto, pontos usados e total.
- **RF-06:** o relatório financeiro, o caixa, o relatório de garçons, o fechamento mensal e o histórico do cliente usam o total com desconto. O relatório de vendas continua mostrando os itens pelo preço cheio e ganha os campos `discounts` (soma dos descontos) e `netRevenue` (receita menos descontos).

## Requisitos não funcionais

- **RNF-01:** resgate, devolução e crédito travam a linha do cliente (`FOR UPDATE`), para dois resgates simultâneos não gastarem o mesmo saldo.
- **RNF-02:** o saldo é a soma do extrato; nada guarda saldo em outra coluna.
- **RNF-03:** contas em centavos e pontos inteiros.

## Regras de negócio

- **RN-01:** regra válida: `pointsPerReal` inteiro de 0 a 100 (0 desliga o ganho), `centsPerPoint` inteiro de 1 a 1000, `minRedeemPoints` inteiro de 1 a 100000. Mensagem: "Regra de fidelidade inválida: <campo>."
- **RN-02:** pontos ganhos = parte inteira de (total pago em centavos × `pointsPerReal` ÷ 100). Comanda sem cliente ou com 0 pontos não gera crédito (critério da issue).
- **RN-03:** resgate só em comanda aberta com cliente. Mensagens: "Só comandas abertas aceitam resgate de pontos." e "Ligue um cliente à comanda antes de resgatar pontos."
- **RN-04:** um resgate por comanda. Mensagem: "Esta comanda já tem um resgate. Desfaça antes de resgatar de novo."
- **RN-05:** pontos inteiros, no mínimo `minRedeemPoints` e no máximo o saldo. Mensagens: "Resgate pelo menos N pontos." e "Saldo insuficiente: o cliente tem N pontos."
- **RN-06:** desconto = pontos × `centsPerPoint`, e não pode passar do subtotal. Mensagem: "O desconto de R$ X passa do total da comanda (R$ Y)." (critério da issue).
- **RN-07:** com resgate, alterar ou remover item que deixe o subtotal menor que o desconto é recusado. Mensagem: "Desfaça o resgate de pontos antes: o desconto passaria do total da comanda."
- **RN-08:** cancelar a comanda devolve os pontos resgatados nela.
- **RN-09:** com resgate, trocar o cliente da comanda é recusado ("Desfaça o resgate de pontos antes de trocar o cliente.") e a comanda não pode ser juntada a outra como origem ("Desfaça o resgate de pontos da comanda de origem antes de juntar.").
- **RN-10:** o total nunca é negativo; pagar uma comanda com desconto maior que o subtotal é recusado com a mensagem de RN-07.

## Critérios de aceitação verificáveis

- **CA-01:** com a regra padrão, uma comanda de R$ 45,50 gera 45 pontos; com `pointsPerReal` 3, gera 136; com 0, não gera (critério da issue).
- **CA-02:** o resgate nunca deixa o total negativo: recusa desconto maior que o subtotal, recusa remover item depois do resgate se o desconto passar do total, e o total pago é subtotal menos desconto (critério da issue).
- **CA-03:** saldo e extrato batem com créditos, resgates e devoluções.
- **CA-04:** desfazer o resgate e cancelar a comanda devolvem os pontos.
- **CA-05:** dois resgates simultâneos do mesmo cliente não gastam mais do que o saldo.
- **CA-06:** relatório financeiro, caixa, garçons, fechamento mensal e histórico do cliente mostram o valor com desconto; o relatório de vendas mostra os descontos à parte.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Cliente e comandas | Pagar com regras diferentes | CA-01 |
| T-02 | Saldo de 200 pontos | Resgatar, remover item, pagar | CA-02 |
| T-03 | Movimentos variados | Consultar saldo e extrato | CA-03 |
| T-04 | Comanda com resgate | Desfazer; cancelar | CA-04 |
| T-05 | Saldo de 150 pontos | Dois resgates de 100 ao mesmo tempo | CA-05 |
| T-06 | Comanda paga com desconto | Consultar os relatórios | CA-06 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/common/order-total.ts` (novo), `apps/api/src/loyalty/` (novo), `app.service.ts`, `cash.service.ts`, `waiters.service.ts`, `closings.service.ts`, `sales-reports.service.ts`, `customers.service.ts`, `order-moves.service.ts`, `app.module.ts`, `apps/api/test/`.
- **Frontend:** não muda. O detalhe da comanda ganha campos novos, sem tirar nenhum.

## Dependências e riscos

- **Riscos:** algum relatório continuar somando o preço cheio; gastar o mesmo saldo duas vezes.
- **Mitigações:** conta única do total, com teste que paga uma comanda com desconto e confere todos os relatórios (T-06); trava do cliente (RNF-01).

## Plano de implementação

1. Regras puras e conta única do total, com testes.
2. Troca da conta nos relatórios existentes.
3. Schema e migração.
4. Serviço, rotas e travas.
5. Testes de integração.
6. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 a P-3 | aprovada |
