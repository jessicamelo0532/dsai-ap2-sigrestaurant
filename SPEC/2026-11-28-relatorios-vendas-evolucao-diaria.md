# Evolução Diária dos Relatórios de Vendas

**Data:** 2026-11-28  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** SPEC/2026-11-25-tela-de-relatorios-de-vendas.md  
**Derroga:** n/a

---

## Contexto e problema

O relatório de vendas exibia totais do período, rankings e distribuições, mas não mostrava como a receita e o volume de contas evoluíram **dia a dia**. Sem essa visão, o usuário não identifica picos, dias fracos ou o efeito de uma ação ao longo do intervalo selecionado. A informação já existia no `paidAt` de cada comanda paga, mas não era agregada por data local.

## Objetivo

Exibir, na aba **Vendas** do Financeiro, uma visão de evolução diária com tabela, gráfico de área e resumo de melhor/pior dia, usando os mesmos dados do relatório e funcionando tanto no modo navegador quanto no modo servidor.

## Escopo

- Agregar `byDay` nas regras compartilhadas do relatório (`buildSalesReport`).
- Propagar `byDay` na API (`sales-rules` + `sales-reports.service`) e no adaptador local.
- Criar o componente `RelatorioEvolucaoDiaria` com tabela, gráfico SVG e alternância de métrica.
- Adicionar a aba **Evolução** ao painel de relatórios.
- Exibir melhor dia, dia mais fraco, participação de cada dia e desvio contra a média.
- Manter os campos existentes do relatório sem alteração de persistência.

## Fora do escopo

- Criar endpoint novo; a rota `GET /reports/sales` é reutilizada.
- Alterar a chave ou o formato do `localStorage`.
- Autenticação, gorjeta, integração com adquirente.
- Previsão/sazonalidade estatística além da série exibida.

## Requisitos funcionais

- **RF-01:** O relatório deve conter `byDay[]` com `date` (`AAAA-MM-DD`), `weekday`, `label`, `orders` e `revenue`.
- **RF-02:** A data deve ser a data local de Belém (UTC−3), inclusive para pagamentos entre 00:00 e 02:59 UTC.
- **RF-03:** A aba **Evolução** deve exibir uma tabela com data, dia da semana, contas, receita, participação e desvio contra a média.
- **RF-04:** O gráfico de área deve plotar a série diária em ordem cronológica, com alternância entre receita e contas.
- **RF-05:** O resumo deve destacar o melhor dia e o dia mais fraco por receita.
- **RF-06:** Períodos sem venda devem exibir estado vazio, sem gráfico ou linhas fantasmas.

## Regras de negócio

- **RN-01:** `byDay` inclui apenas dias com pelo menos uma comanda paga; não preenche dias vazios.
- **RN-02:** A soma das receitas de `byDay` deve ser igual à receita total do relatório.
- **RN-03:** O desvio contra a média é `receita do dia − (receita total ÷ dias com venda)`.
- **RN-04:** A participação usa uma casa decimal, via `share`/`formatShare`.
- **RN-05:** O gráfico usa a cor institucional `#6a5bc7`, com preenchimento de 18% de opacidade.

## Critérios de aceitação verificáveis

| CA | Descrição | Como verificar |
|---|---|---|
| **CA-01** | Duas vendas em dias locais distintos geram duas linhas na tabela. | `relatorio-evolucao-diaria.test.tsx` verifica 3 linhas (cabeçalho + 2 dias). |
| **CA-02** | O gráfico contém linha, área e um ponto por dia. | Teste verifica `.daily-line`, `.daily-area` e 2 `.daily-dot`. |
| **CA-03** | A alternância de métrica troca o rótulo acessível do gráfico. | Teste clica em “Contas” e verifica o `role="img"` atualizado. |
| **CA-04** | Período vazio mostra “Nenhuma venda no período”. | Teste renderiza relatório vazio. |
| **CA-05** | API e navegador calculam `byDay` equivalente. | Testes puros da API e do adaptador local. |

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Vendas em 25/11 e 26/11 | Abrir aba Evolução | Tabela com 2 linhas; gráfico com 2 pontos |
| T-02 | Venda às 02:30 UTC | Gerar relatório | Dia local anterior aparece em `byDay` |
| T-03 | Período sem vendas | Abrir aba Evolução | Estado vazio, sem gráfico |

- **Camada de teste:** regras puras (web e API) e componente.
- **Framework:** Vitest + Testing Library.
- **Automação prevista:** T-01, T-02 e T-03 automatizados.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/sales-report.ts`, `apps/web/lib/local-store.ts`, `apps/web/app/relatorios-vendas.tsx`, `apps/web/app/relatorio-evolucao-diaria.tsx`, `apps/api/src/sales-reports/sales-rules.ts`, `apps/api/src/sales-reports/sales-reports.service.ts`.
- **Persistência:** nenhuma alteração de formato.
- **Backend pausado:** apenas paridade de contrato; não participa do build/deploy ativo.
- **Stack:** sem novas dependências.
- **Deploy:** sem impacto além do bundle do frontend.

## Dependências e riscos

- **Dependências:** `localSlot`, `share`, `averageTicketCents` e `GET /reports/sales`.
- **Riscos:** divergência de fuso horário perto da meia-noite.
- **Mitigações:** teste explícito com `02:30Z` e soma de receita por dia.

## Plano de implementação

1. Adicionar `byDay` às regras web e da API.
2. Propagar `byDay` no serviço e no adaptador local.
3. Criar `RelatorioEvolucaoDiaria` e a aba Evolução.
4. Adicionar estilos responsivos e acessíveis.
5. Executar testes e build.
6. Registrar status implementada e commitar.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-28 | Criação do rascunho | rascunho |
| 2026-11-28 | Implementação de `byDay`, componente, aba e testes | implementada |