# Garçons, garçom da comanda e comissão (API)

**Data:** 2026-11-16  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #25 (backlog 2.8); completa a pergunta P-3 de `SPEC/2026-11-16-relatorios-de-vendas.md` (ticket médio por garçom)  
**Derroga:** n/a (a comanda ganha um campo opcional; nenhuma regra existente muda)

---

## Contexto e problema

Fato comprovado em 2026-11-16: a comanda não tem responsável. Não dá para saber quem atendeu cada mesa, quanto cada garçom vendeu nem calcular comissão. A issue #25 pede garçom atribuído à comanda e relatório por garçom com comissão sobre o total pago.

### Perguntas em aberto (para o cliente)

- **P-1:** a issue pede que **toda** comanda tenha garçom. Tornar obrigatório agora quebraria o lançamento de pedidos do frontend, que ainda não envia garçom. Provisório: garçom opcional; comandas sem garçom aparecem no relatório como "Sem garçom". Fica obrigatório quando a tela de lançamento passar a pedir o garçom.
- **P-2:** qual a comissão padrão? Provisório: 10% (a "taxa de serviço" comum), ajustável por garçom de 0 a 30%.
- **P-3:** a comissão incide sobre o total da conta? Provisório: sim, sobre o total pago da comanda.

## Objetivo

Cadastrar garçons, atribuir o garçom à comanda e saber, por período, quantas contas cada garçom fechou, quanto vendeu, o ticket médio e a comissão.

## Escopo

- Tabela `Waiter` e campos na comanda: garçom, nome e taxa de comissão guardados no momento da atribuição.
- Módulo NestJS `waiters` com rotas em `/api/waiters`, `/api/orders/:id/waiter` e `/api/reports/waiters`.
- Regras puras em `waiter-rules.ts`.

## Fora do escopo

- Tornar o garçom obrigatório (P-1) e telas no frontend.
- Login de garçom, gorjeta separada (gorjeta é fora de escopo permanente na spec original).

## Requisitos funcionais

- **RF-01:** cadastrar, listar (ativos por padrão, todos se pedido), consultar, editar (nome, comissão, ativo) e remover garçons.
- **RF-02:** `PUT /api/orders/:id/waiter` com `{ waiterId }` atribui ou troca o garçom de uma comanda aberta, guardando nome e comissão daquele momento.
- **RF-03:** `GET /api/reports/waiters?from&to` lista, por garçom, contas pagas, receita, ticket médio, taxa e comissão, com a linha "Sem garçom" e os totais do período.

## Requisitos não funcionais

- **RNF-01:** dinheiro em centavos inteiros.
- **RNF-02:** o relatório usa o nome e a taxa guardados na comanda, então mudar a comissão do garçom depois não altera o que já foi vendido.

## Regras de negócio

- **RN-01:** nome do garçom único (sem diferenciar maiúsculas), de 2 a 80 caracteres. Mensagem: "Já existe um garçom chamado NOME."
- **RN-02:** comissão de 0 a 30%, com até 2 casas; padrão 10% (P-2).
- **RN-03:** só comanda aberta recebe ou troca de garçom; garçom inativo não pode ser atribuído. Mensagens: "Só comandas abertas podem trocar de garçom." e "O garçom NOME está inativo."
- **RN-04:** garçom com comandas não pode ser removido; deve ser desativado. Mensagem: "O garçom tem comandas registradas. Desative em vez de excluir."
- **RN-05:** comissão = receita da comanda × taxa guardada, arredondada ao centavo, somada por garçom (P-3).
- **RN-06:** no relatório entram só comandas pagas no período (mesma regra do relatório financeiro); a soma da receita por garçom, com "Sem garçom", é igual à receita do período.
- **RN-07:** ticket médio por garçom = receita ÷ contas pagas, arredondado ao centavo.

## Critérios de aceitação verificáveis

- **CA-01:** dado um garçom ativo e uma comanda aberta, quando atribuir, então a comanda guarda garçom, nome e taxa; trocar de garçom funciona enquanto a comanda está aberta.
- **CA-02:** quando pedir o relatório, então a receita de cada garçom soma exatamente as comandas pagas dele, e a soma geral é a receita do período (critério da issue #25).
- **CA-03:** mudar a comissão do garçom depois da venda não muda a comissão das comandas já atribuídas.
- **CA-04:** atribuir a comanda paga ou garçom inativo, nome repetido, comissão fora de 0 a 30% e remover garçom com comandas são recusados.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | Comissão, taxa, relatório | RN-02, RN-05 a RN-07 |
| T-02 | Garçons e comandas | Atribuir, trocar, pagar, relatório | CA-01, CA-02 |
| T-03 | Comissão alterada | Relatório | CA-03 |
| T-04 | Casos inválidos | Atribuir, cadastrar, remover | CA-04 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração (tabela nova e três colunas opcionais em `Order`), `apps/api/src/waiters/` (novo), `app.module.ts`, `apps/api/test/`.
- **Frontend:** não muda; as colunas novas são opcionais.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Riscos:** comandas sem garçom distorcerem a comissão; comissão diferente da prática do restaurante.
- **Mitigações:** linha "Sem garçom" sempre visível; P-1 a P-3 para o cliente.

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
