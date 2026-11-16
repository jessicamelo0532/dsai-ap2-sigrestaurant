# Transferir comanda de mesa e juntar contas (API)

**Data:** 2026-11-16  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #19 (backlog 2.2)  
**Derroga:** em parte `SPEC/2026-10-01-restaurante.md`, no ponto em que uma comanda pertence à mesa em que foi aberta: passa a poder mudar de mesa. A comanda ganha a situação `MERGED` (juntada), que não entra em nenhum relatório de receita.

---

## Contexto e problema

Fato comprovado em 2026-11-16: a comanda fica presa à mesa em que foi aberta. Se o cliente muda de mesa, ou se dois grupos querem uma conta só, é preciso refazer o pedido à mão, o que perde o preço do momento do pedido e abre espaço para cobrança em dobro. A issue #19 pede transferência com motivo e junção que preserve os itens e não duplique pagamento.

### Perguntas em aberto (para o cliente)

- **P-1:** ao juntar contas com garçons diferentes, de quem fica a conta? Provisório: do garçom da comanda de destino (a que recebe os itens).
- **P-2:** dá para transferir para uma mesa ocupada? Provisório: não; nesse caso o caminho é juntar as contas.

## Objetivo

Mudar a comanda de mesa e juntar duas comandas abertas numa só, mantendo os itens com os preços guardados, o total e um histórico com o motivo de cada mudança.

## Escopo

- Situação `MERGED` em `OrderStatus`, campo `mergedIntoId` na comanda e tabela `OrderEvent` (histórico).
- Módulo NestJS `order-moves` com as rotas `POST /api/orders/:id/transfer`, `POST /api/orders/:id/merge` e `GET /api/orders/:id/history`.

## Fora do escopo

- Telas no frontend.
- Dividir a conta (issue #20) e transferir só alguns itens.

## Requisitos funcionais

- **RF-01:** `POST /api/orders/:id/transfer` com `{ tableId, reason }` move a comanda aberta para outra mesa livre.
- **RF-02:** `POST /api/orders/:id/merge` com `{ sourceOrderId, reason }` move todos os itens da comanda de origem para a comanda `:id` (destino); a origem fica `MERGED`, apontando para o destino, e sua mesa fica livre.
- **RF-03:** `GET /api/orders/:id/history` lista as transferências e junções da comanda, da mais antiga para a mais recente.

## Requisitos não funcionais

- **RNF-01:** transferir e juntar travam as comandas e mesas envolvidas, sempre na mesma ordem, para duas ações simultâneas não se cruzarem.
- **RNF-02:** os itens não são recriados: mudam de comanda com o mesmo nome e preço guardados.

## Regras de negócio

- **RN-01:** só comandas abertas podem ser transferidas ou juntadas. Mensagens: "Só comandas abertas podem mudar de mesa." e "Só comandas abertas podem ser juntadas."
- **RN-02:** a mesa de destino precisa existir, ser outra mesa e estar livre (P-2). Mensagens: "A comanda já está nessa mesa." e "A mesa N já tem uma comanda aberta. Junte as contas em vez de transferir."
- **RN-03:** a junção exige duas comandas diferentes. Mensagem: "Escolha duas comandas diferentes."
- **RN-04:** depois da junção, o total do destino é a soma dos dois totais de antes; a origem fica sem itens, com a situação `MERGED`, e não pode ser paga, cancelada nem receber itens.
- **RN-05:** o garçom do destino é mantido (P-1).
- **RN-06:** motivo obrigatório, de 3 a 200 caracteres. Mensagem: "Informe o motivo, de 3 a 200 caracteres."
- **RN-07:** cada transferência registra mesa de origem e de destino; cada junção registra, nas duas comandas, as mesas e a comanda de origem.

## Critérios de aceitação verificáveis

- **CA-01:** dada uma comanda aberta, quando transferir para mesa livre, então ela mantém todos os itens e o total, a mesa antiga fica livre e a nova ocupada (critério da issue).
- **CA-02:** dadas duas comandas abertas, quando juntar, então o destino tem os itens das duas com os preços guardados, o total é a soma, a origem fica `MERGED` sem itens e só o destino pode ser pago; o relatório financeiro conta uma conta só (critério da issue).
- **CA-03:** o histórico mostra as mudanças com motivo, nas duas comandas da junção.
- **CA-04:** transferir para a mesma mesa, para mesa ocupada ou inexistente, transferir ou juntar comanda paga, juntar comanda com ela mesma e motivo curto são recusados, sem mudar nada.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Comanda aberta e mesa livre | Transferir | CA-01 |
| T-02 | Duas comandas abertas | Juntar, pagar, relatório | CA-02 |
| T-03 | Comandas movidas | Histórico | CA-03 |
| T-04 | Casos inválidos | Transferir e juntar | CA-04 |

- **Camada de teste:** API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/order-moves/` (novo), `app.module.ts`, `apps/api/test/`.
- **Frontend:** não muda (a rota `/tables` já mostra só comandas abertas).
- **Relatórios:** só contam `PAID`; `MERGED` fica fora sem nenhuma mudança neles.

## Dependências e riscos

- **Riscos:** juntar a conta errada; cliente pagar a origem por engano.
- **Mitigações:** motivo obrigatório e histórico; origem `MERGED` não aceita pagamento.

## Plano de implementação

1. Schema e migração.
2. Serviço e rotas.
3. Testes de integração.
4. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 e P-2 | aprovada |
