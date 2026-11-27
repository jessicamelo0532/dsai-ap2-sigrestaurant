# Expansão dos Relatórios de Vendas – CSV, Resumo e Filtros

**Data:** 2026-12-02  
**Status:** implementada  
**Agent:** opencode/omniroute/auto/best-coding
**SPEC derivada de:** SPEC/2026-11-25-tela-de-relatorios-de-vendas.md  
**Derroga:** n/a

---

## Contexto

O painel de relatórios de vendas (`RelatoriosVendasPanel`) já oferece visão geral, comparativo, impressão e exportação JSON. Para atender a operações com grande volume de dados e proporcionar uma experiência de gestão mais rica, são necessárias funcionalidades de exportação em CSV, resumo executivo e filtros de período rápidos.

## Objetivo

- Adicionar exportação CSV dos dados de vendas, permitindo análise externa em planilhas.
- Exibir cards de resumo executivo (faturamento total, total de comandas, ticket médio, topo de produto e topo de garçom) na cabeça do painel.
- Oferecer filtros de período predefinidos (Hoje, Ontem, Últimos 7 dias, Mês) que alteram rapidamente o intervalo de datas do relatório, sem necessidade de digitação manual.

## Alcance

- **Frontend only** – todos os cambios ocorrem em `apps/web`. O backend (`apps/api`) já fornece os dados necessários via `GET /reports/sales?from=...&to=...&limit=...`.
- **Reutilização** – os dados já estão disponíveis no `SalesReport` type (`byDay`, `byWaiter`, `byCategory`, `byHour`, `byPayment`). Não há necessidade de novos endpoints.
- **Responsividade** – os cards e a tabela de exportação devem se adaptar a mobile e desktop, seguindo o estilo já existente (`globals.css`).
- **Sem alteração de persistência** – não se altera o `localStorage` nem o formato do banco de dados.
- **Fora do escopo** – novo endpoint API, alteração de esquema de banco, reativação do backend pausado, migração de dados, mudança de stack.

## Requisitos funcionais

- **RF-01:** Deverá existir um botão “Exportar CSV” na cabeça do painel de relatórios, ao lado de “Imprimir” e “Exportar JSON”. Ao clicar, o navegador deve fazer o download de um arquivo `vendas-<periodo>.csv`.
- **RF-02:** O CSV deve conter as colunas: `Data`, `Dia da semana`, `Contas`, `Receita (R$)`, `Produto principal`, `Categoria`, `Garçom`. Cada linha representa um item do relatório (por dia/por garçom/por produto), conforme o modo de visualização ativo.
- **RF-03:** Na parte superior do painel, devem ser exibidos cards de resumo:
  - `Faturamento total: R$ X,XX`
  - `Total de comandas pagas: N`
  - `Ticket médio: R$ X,XX`
  - `Produto mais vendido: Nome (R$ X,XX)`
  - `Garçom mais produtivo: Nome (R$ X,XX)`
- **RF-04:** Deve haver um dropdown de período com opções “Hoje”, “Ontem”, “Últimos 7 dias”, “Mês”. A seleção deve atualizar automaticamente as variáveis `from` e `to` e disparar a recarga do relatório.
- **RF-05:** O dropdown deve usar datas em fuso de Belém (UTC−3). “Hoje” = data atual em Belém; “Ontem” = ontem em Belém; “Últimos 7 dias” = últimos 7 dias inclusivos; “Mês” = início do mês atual em Belém até hoje.

## Regras de negócio

- **RN-01:** O CSV deve usar ponto decimal para valores monetários (ex: `69.00`) e vírgula como separador de milhares não é usado (apenas o formato `R$ 69.00` na coluna de receita, ou apenas o número se preferir). O separador de campos deve ser ponto e vírgula (`;`) para compatibilidade com planilhas em português.
- **RN-02:** O card “Produto mais vendido” considera o produto com maior faturamento total no período. Empates são resolvidos pelo nome em ordem alfabética.
- **RN-03:** O card “Garçom mais produtivo” considera o garçom com maior receita total. Sem garçom associado, exibe “Sem garçom”.
- **RN-04:** Os filtros de período devem respeitar o limite máximo de 50 itens (`limit=50`) que já existe na rota `GET /reports/sales`. Se o período selecionado gerar mais de 50 linhas, o CSV deve ser truncado nas últimas linhas com aviso “(linhas truncadas)”.
- **RN-05:** Os cards de resumo devem ser recalculados sempre que o período ou o view mudar.

## Critérios de aceitação verificáveis

| ID | Descrição | Como verificar |
|---|---|---|
| **CA-01** | Clicar em “Exportar CSV” dispara download de arquivo `.csv`. | Teste de integração que simula o clique e verifica o `href` do `a` download. |
| **CA-02** | O CSV contém as colunas especificadas e usa `;` como delimitador. | Parse do arquivo gerado e checagem de cabeçalho e delimitador. |
| **CA-03** | Cards de resumo exibem valores corretos baseados no relatório carregado. | Testes unitários que montam um `SalesReport` mock e verificam o renderização dos cards. |
| **CA-04** | Selecionar “Hoje” no dropdown define `from`/`to` como data atual em Belém. | Testes que mockam `localDate` e verificam valores de `from`/`to`. |
| **CA-05** | Selecionar “Mês” define `from` como primeiro dia do mês atual e `to` como hoje. | Verificação dos objetos de data gerados. |
| **CA-06** | Cards são atualizados quando o período muda. | Integração: mudar dropdown, esperar reload, checar textos dos cards. |

## Cenários de teste

| Cenário | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Relatório carregado com vendas nos dias 25 e 26/11. | Clicar em “Exportar CSV”. | Download de `vendas-2026-11-25_a_2026-11-26.csv` com linhas esperadas. |
| T-02 | Relatório com duas vendas, cada uma com um produto diferente. | Verificar card “Produto mais vendido”. | Card mostra o produto com maior receita. |
| T-03 | Relatório sem garçons associados. | Ver card “Garçom mais produtivo”. | Exibe “Sem garçom”. |
| T-04 | Abrir dropdown e selecionar “Ontem”. | Verificar que `from`/`to` são datas de ontem em Belém. | Inputs de data corretos. |
| T-05 | Mudar de view de “report” para “compare” e voltar. | Cards e CSV devem refletir o novo período. | Dados consistentes. |

## Impactos na arquitetura

- **Arquivos tocados:**
  - `apps/web/app/relatorios-vendas.tsx` – adicionar dropdown, cards e botão CSV.
  - `apps/web/app/relatorio-export-csv.tsx` – novo componente de exportação CSV.
  - `apps/web/app/relatorios-vendas.test.tsx` – novos testes para dropdown e cards.
  - `apps/web/lib/sales-report.ts` – helpers `topByRevenue`, `topByWaiter`, `formatCsvRow`.
  - `apps/web/lib/local-store.ts` – possível helper de data de período predefinido.
- **Sem alterações no backend** – apenas consumo de rotas existentes.
- **Stack** – Next.js 14, React 18, TypeScript, lucide-react.

## Dependências e riscos

- **Dependências** – componentes existentes `RelatorioExportJson`, `relatorio-impresso`, types `SalesReport`, `PaidSale`.
- **Riscos** – formatação de data em Belém perto da meia‑noite pode gerar dia errado ao mudar de “Hoje” para “Ontem”. Mitigação: usar `localDate` já presente no código.
- **Mitigações** – testes unitários cobrindo bordas de data.

## Plano de implementação

1. Criar `SPEC/2026-12-02-relatorios-vendas-expansao.md` com status *implementada* após o código.
2. Adicionar helpers `topByRevenue`, `topByWaiter`, `csvifySalesReport` em `apps/web/lib/sales-report.ts`.
3. Criar componente `RelatorioExportCsv` em `apps/web/app/relatorio-export-csv.tsx` com lógica de download.
4. Modificar `RelatoriosVendasPanel` para inserir dropdown, cards e botão CSV.
5. Atualizar `RelatoriosVendas.test.tsx` com testes para dropdown e cards.
6. Executar `npm test`, `npm run build` e commitar com trailers `Agent:` e `Spec:`.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-12-02 | Criação do rascunho | rascunho |