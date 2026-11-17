# Contas a receber: venda a prazo, vencimento e baixa

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #33 (backlog 2.16), `SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md` (contas a pagar)  
**Derroga:** n/a. Acrescenta a situação `ON_ACCOUNT` (a prazo) à comanda; o fechamento à vista não muda.

---

## Contexto e problema

Fato comprovado em 2026-11-17: as contas a pagar ligadas a compras já existem (`/api/payables`), mas não há contas a receber. Uma comanda só termina paga à vista (`PAID`) ou cancelada. O cliente que "pendura" a conta não tem como ser registrado, e o dinheiro que entra depois não tem controle. Critérios da issue #33:
- uma venda a prazo entra no contas a receber e não na receita de caixa do turno;
- o saldo total do contas a receber bate com a soma dos títulos.

### Perguntas em aberto (decididas pela dupla, provisórias)

- **P-1:** prazo do vencimento? Provisório: do dia da venda até 365 dias depois; padrão na tela, 30 dias.
- **P-2:** venda a prazo dá pontos de fidelidade? Provisório: não nesta SPEC (os pontos continuam sendo creditados só no pagamento à vista).
- **P-3:** o recebimento (baixa) entra no caixa do turno e nos relatórios de vendas? Provisório: não; a baixa registra forma e data, e aparece no resumo das contas a receber. Os relatórios existentes não mudam.
- **P-4:** é preciso cliente? Sim: o título precisa de alguém para cobrar. Usa o cliente ligado à comanda ou o informado na venda.
- **P-5:** cancelar ou renegociar título? Fora desta SPEC.

## Objetivo

Permitir fechar uma comanda **a prazo**, gerando um título a receber com cliente e vencimento, acompanhar os títulos em aberto, vencidos e quitados, e dar baixa quando o cliente pagar.

## Escopo

- **API:** valor `ON_ACCOUNT` em `OrderStatus`; tabela `Receivable` (uma por comanda a prazo) e enum `ReceivableStatus` (`OPEN`, `PAID`), com migração; módulo `receivables`.
- **Rotas:** `POST /api/orders/:id/on-account` (vender a prazo), `GET /api/receivables` (resumo e lista), `POST /api/receivables/:id/receive` (baixa).
- **Tela (modo servidor):** botão **Vender a prazo** na comanda aberta e seção **A receber** no menu, com resumo, filtros e baixa.

## Fora do escopo

- Modo navegador: a seção avisa que precisa do servidor e o botão não aparece.
- Cancelar ou renegociar título, juros e multa (P-5).
- Mudar o caixa por turno, os relatórios de vendas e o fechamento mensal (P-3).

## Requisitos funcionais

- **RF-01:** `POST /orders/:id/on-account` com `{ customerId?, dueDate, notes? }` fecha a comanda aberta como `ON_ACCOUNT` (a mesa fica livre), baixa o estoque como numa venda e cria o título com o total da comanda (já com desconto e taxa de entrega), o cliente e o vencimento.
- **RF-02:** `GET /receivables?status=` lista os títulos (todos, `OPEN` ou `PAID`), do vencimento mais próximo ao mais distante, com cliente, comanda, mesa, valor, vencimento, situação (`OVERDUE`, `DUE_TODAY`, `UPCOMING` para os abertos) e, nos pagos, data e forma. Traz o resumo: quantidade e soma dos abertos, vencidos, a vencer nos próximos 7 dias e recebidos.
- **RF-03:** `POST /receivables/:id/receive` com `{ paymentMethod, receivedAt? }` dá baixa no título aberto (data padrão: hoje).
- **RF-04:** Na tela, **Vender a prazo** pede o cliente (já preenchido se a comanda tiver cliente; senão, busca), o vencimento (padrão: daqui a 30 dias) e uma observação opcional.
- **RF-05:** A seção **A receber** mostra o resumo, filtra por Em aberto, Vencidos, Quitados e Todos, e dá baixa com forma de pagamento e data.
- **RF-06:** Erros da API aparecem com a mensagem que ela devolve.

## Requisitos não funcionais

- **RNF-01:** Fechar a prazo é uma transação que trava a comanda, como o fechamento à vista.
- **RNF-02:** Dinheiro em centavos; o valor do título é o total da comanda no momento da venda.
- **RNF-03:** Datas de vencimento e de baixa são dias (sem hora), como nas contas a pagar.

## Regras de negócio

- **RN-01:** só comanda aberta e com itens pode ser vendida a prazo. Mensagens: "Esta comanda já foi fechada." e "Adicione pelo menos um item antes de fechar a conta."
- **RN-02 (P-4):** é obrigatório ter cliente, ativo. Mensagens: "Informe o cliente para vender a prazo." e "Este cliente está desativado."
- **RN-03 (P-1):** vencimento no formato `AAAA-MM-DD`, de hoje até 365 dias. Mensagens: "Informe o vencimento no formato AAAA-MM-DD.", "O vencimento não pode ser antes de hoje." e "O vencimento pode ser de até 365 dias."
- **RN-04:** observação até 200 caracteres. Mensagem: "A observação pode ter até 200 caracteres."
- **RN-05:** a comanda a prazo não entra nas vendas, no caixa do turno, na comissão nem no histórico do cliente, porque todos contam só comandas pagas (critério da issue).
- **RN-06:** só título aberto recebe baixa. Mensagem: "Este título já foi recebido." A data da baixa vai do dia da venda até hoje. Mensagens: "A data do recebimento não pode ser futura." e "O recebimento não pode ser antes da venda."
- **RN-07:** situação do título aberto e resumo seguem as regras das contas a pagar (`payableSituation` e `summarizePayables`): vencido antes de hoje, vence hoje, a vencer; próximos 7 dias = hoje e os 6 seguintes. A soma em aberto é igual à soma dos títulos abertos (critério da issue).

## Critérios de aceitação verificáveis

- **CA-01:** Dada uma comanda aberta de R$ 60,00 com cliente, quando vendo a prazo com vencimento daqui a 30 dias, então a comanda fica `ON_ACCOUNT`, a mesa fica livre e existe um título aberto de R$ 60,00 para o cliente.
- **CA-02:** Depois disso, o relatório financeiro e o caixa do turno não contam essa venda (critério da issue).
- **CA-03:** Sem cliente, com cliente desativado, com vencimento ontem ou daqui a 366 dias, a venda é recusada com a mensagem da regra.
- **CA-04:** Com três títulos abertos (um vencido, um vencendo hoje, um daqui a 10 dias) e um recebido, o resumo mostra o total em aberto igual à soma dos três, o vencido, os próximos 7 dias e o recebido (critério da issue).
- **CA-05:** Quando dou baixa em PIX, o título fica pago com a forma e a data; dar baixa de novo é recusado.
- **CA-06:** Na tela, **Vender a prazo** com o cliente da comanda envia `{ customerId, dueDate }`; a seção **A receber** filtra e dá baixa.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Regras puras | vencimento, observação, baixa | RN-03, RN-04, RN-06 |
| T-02 | PostgreSQL de teste | vender a prazo e conferir relatório e caixa | CA-01, CA-02 |
| T-03 | PostgreSQL de teste | recusas | CA-03 |
| T-04 | PostgreSQL de teste | resumo e baixa | CA-04, CA-05 |
| T-05 | Componentes | venda a prazo e seção A receber | CA-06 |

- **Camadas de teste:** regras puras e integração da API (Vitest com PostgreSQL); lógica pura e componentes do frontend.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, migração, `apps/api/src/receivables/` (novo), `app.module.ts`, `apps/api/test/`; `apps/web/lib/types.ts`, `apps/web/lib/receber.ts`, `apps/web/app/receber-panel.tsx`, `apps/web/app/vender-a-prazo.tsx` (novos), `apps/web/app/page.tsx`, `globals.css`.
- **Persistência:** valor novo no enum da comanda e tabela nova; nada existente muda.
- **Deploy/Vercel:** não afeta o build; na Vercel a seção avisa que precisa do servidor.

## Dependências e riscos

- **Riscos:** algum relatório tratar "não pago" como "aberto" e mostrar a comanda a prazo como em atendimento.
- **Mitigações:** as consultas de mesa e de comanda aberta filtram `status = OPEN`; teste de integração confere a mesa livre e os relatórios.

## Plano de implementação

1. Commit desta SPEC.
2. Schema e migração.
3. Regras puras com testes.
4. Serviço e rotas com testes de integração.
5. Lógica e componentes do frontend com testes.
6. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia, com P-1 a P-5 decididas pela dupla | aprovada |
