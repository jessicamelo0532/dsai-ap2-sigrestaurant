# Desempenho por Garçom nos Relatórios de Vendas

**Data:** 2026-11-28  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** SPEC/2026-11-25-tela-de-relatorios-de-vendas.md  
**Derroga:** n/a

---

## Contexto e problema

As comandas pagas já guardam o garçom responsável (`waiterName`), mas o relatório de vendas só mostrava o agregado da casa. O gestor não conseguia comparar a produtividade da equipe, o ticket médio por profissional ou a participação de cada garçom na receita do período.

## Objetivo

Exibir, na aba **Vendas** do Financeiro, o desempenho por garçom com pódio, tabela, participação na receita, ticket médio e ordenação por receita, contas ou ticket.

## Escopo

- Agregar `byWaiter` nas regras compartilhadas do relatório.
- Preservar o `waiterName` da comanda paga na conversão para `PaidSale`.
- Propagar `byWaiter` na API e no adaptador local.
- Criar o componente `RelatorioGarcons`.
- Adicionar a aba **Garçons** ao painel de relatórios.
- Ordenar por receita (padrão), contas ou ticket médio.
- Exibir comandas sem garçom como “Sem garçom”.

## Fora do escopo

- Calcular comissão ou folha de pagamento.
- Alterar cadastro de garçons ou autenticação.
- Criar novo endpoint; a rota `GET /reports/sales` é reutilizada.
- Alterar persistência do `localStorage`.

## Requisitos funcionais

- **RF-01:** O relatório deve conter `byWaiter[]` com `waiterName`, `orders`, `revenue`, `averageTicket` e `share`.
- **RF-02:** Cada comanda paga entra no garçom informado em `waiterName`.
- **RF-03:** Comandas sem garçom entram no grupo “Sem garçom”.
- **RF-04:** A aba **Garçons** deve exibir pódio com os três primeiros, resumo e tabela completa.
- **RF-05:** A tabela deve permitir ordenar por receita, contas ou ticket médio.
- **RF-06:** Períodos sem comandas pagas exibem estado vazio.

## Regras de negócio

- **RN-01:** `revenue` é a soma do preço de venda das linhas das comandas do garçom.
- **RN-02:** `averageTicket` é `receita ÷ contas`, arredondado ao centavo.
- **RN-03:** `share` é a participação do garçom na receita total, com uma casa decimal.
- **RN-04:** A ordenação padrão é receita decrescente; empate decide pelo nome.
- **RN-05:** A soma das contas de `byWaiter` é igual a `paidOrders`.

## Critérios de aceitação verificáveis

| CA | Descrição | Como verificar |
|---|---|---|
| **CA-01** | Ana com 2 contas e R$ 69,00 aparece antes de Bruno com 1 conta e R$ 30,00. | `relatorio-garcons.test.tsx` e testes de regras. |
| **CA-02** | Ticket médio e participação são calculados por garçom. | Teste puro verifica `averageTicket` e `share`. |
| **CA-03** | Alternância entre receita, contas e ticket troca a ordenação. | Teste clica nos três botões e verifica o `aria-label` da tabela. |
| **CA-04** | Comandas sem garçom ficam em “Sem garçom”. | Teste puro com venda sem `waiterName`. |
| **CA-05** | Período vazio mostra “Nenhum garçom no período”. | Teste de componente. |
| **CA-06** | Soma das contas por garçom igual ao total do relatório. | Teste puro. |

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Ana com 2 contas e Bruno com 1 | Abrir aba Garçons | Pódio e tabela com Ana primeiro |
| T-02 | Venda sem garçom | Abrir aba Garçons | Grupo “Sem garçom” aparece |
| T-03 | Alternar métrica | Clicar em Contas/Ticket | Tabela reordena e anuncia a métrica |
| T-04 | Período vazio | Abrir aba Garçons | Estado vazio |

- **Camada de teste:** regras puras (web e API) e componente.
- **Framework:** Vitest + Testing Library.
- **Automação prevista:** T-01 a T-04.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/sales-report.ts`, `apps/web/lib/local-store.ts`, `apps/web/app/relatorio-garcons.tsx`, `apps/web/app/relatorios-vendas.tsx`, `apps/api/src/sales-reports/*`.
- **Persistência:** nenhuma alteração de formato.
- **Backend pausado:** paridade de contrato apenas; não participa do build/deploy ativo.
- **Stack:** sem novas dependências.
- **Deploy:** sem impacto além do bundle do frontend.

## Dependências e riscos

- **Dependências:** `waiterName` em `Order` e `PaidSale`; rota existente `GET /reports/sales`.
- **Riscos:** comandas antigas sem garçom concentrarem o grupo “Sem garçom”.
- **Mitigações:** rótulo explícito e teste de conversão.

## Plano de implementação

1. Adicionar `waiterName` à conversão de comandas.
2. Agregar `byWaiter` nas regras web e da API.
3. Propagar no serviço e no adaptador local.
4. Criar `RelatorioGarcons` e a aba Garçons.
5. Adicionar estilos e testes.
6. Executar testes, build e commit.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-28 | Criação e implementação da visão por garçom | implementada |