# Tela de relatórios de vendas: rankings, horários, pagamentos e CSV

**Data:** 2026-11-25  
**Status:** aprovada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** `SPEC/2026-11-16-relatorios-de-vendas.md` (API), `SPEC/2026-11-17-tela-do-caixa.md`, issue #34 e #35  
**Derroga:** n/a — a SPEC da API deixou “telas no frontend” fora do escopo; esta SPEC cobre apenas a tela e o cálculo local equivalente.

---

## Contexto e problema

Fato comprovado em 2026-11-25: a API `GET /api/reports/sales` está implementada e testada, com ranking por quantidade e receita, categoria, hora, dia da semana, forma de pagamento e categoria × hora. **Nenhuma tela usa essa rota.** A seção Financeiro mostra apenas receita, despesas, saldo e vendas por pagamento; o dono não consegue responder “o que vendeu”, “em que horário” e “qual categoria puxa o faturamento”.

O usuário pediu, em 2026-11-25, mais volume de implementação e escolheu a tela de relatórios de vendas. A meta é entregar um relatório operacional completo, com comparativo e exportação, sem alterar a API.

### Perguntas em aberto

- nenhuma. Decisões humanas de 2026-11-25: usar a rota existente, integrar como aba do Financeiro (sem 14ª seção), incluir comparativo com o período anterior e exportação CSV.

## Objetivo

Dar ao dono/gerente uma aba **Vendas** dentro do Financeiro com o relatório do período, rankings, distribuição por categoria, hora, dia e pagamento, comparativo com o período anterior e exportação CSV, funcionando nos modos servidor e navegador.

## Escopo

- Aba **Vendas** na seção Financeiro, ao lado de **Resumo**, compartilhando o período já escolhido.
- Painel `RelatoriosVendasPanel` com:
  - KPIs: contas pagas, receita, ticket médio, itens vendidos, descontos, taxas de entrega e receita líquida.
  - Comparativo com o período anterior de mesmo tamanho em receita, contas e ticket médio.
  - Ranking de itens por quantidade e por receita, com categoria, quantidade, receita e participação.
  - Receita e quantidade por categoria, com barra de participação.
  - Receita e contas por hora (24 faixas) e por dia da semana (7 faixas), com alternância de métrica.
  - Receita e contas por forma de pagamento.
  - Heatmap categoria × hora.
  - Exportação CSV com todas as seções, em pt-BR e compatível com Excel.
  - Estado vazio, carregando e erro.
- Cálculo local equivalente em `lib/sales-report.ts` e rota `GET /reports/sales` no `local-store`, para a aba funcionar no modo navegador.
- Testes de regras, CSV, cálculo local e componente.
- Verificação no e2e de celular.
- Documentação no `README.md` e no backlog.

## Fora do escopo

- Alterar a API, o schema ou as regras de negócio de `apps/api`.
- Criar uma nova seção na navegação principal.
- Comparação com metas, por garçom ou por turno.
- Filtros por categoria/pagamento que mudem os totais (a rota devolve o período inteiro).
- Biblioteca de gráficos, PDF, impressão ou envio por e-mail.
- Nova dependência, LLM, telemetria ou persistência de relatórios.
- Reativar o backend ou mudar a estratégia de persistência.

## Requisitos funcionais

- **RF-01:** o Financeiro exibe as abas **Resumo** e **Vendas**; a aba escolhida não muda o período selecionado.
- **RF-02:** ao abrir **Vendas** ou mudar o período, o painel chama `GET /api/reports/sales?from=&to=&limit=` no modo servidor e a rota local equivalente no modo navegador.
- **RF-03:** o painel mostra os KPIs de contas pagas, receita, ticket médio, itens vendidos, descontos, taxas de entrega e receita líquida.
- **RF-04:** o painel busca também o período anterior de mesmo tamanho e mostra a variação percentual de receita, contas e ticket médio; quando o anterior é zero, mostra “sem base”.
- **RF-05:** o ranking de itens pode alternar entre **por quantidade** e **por receita**, com posição, nome, categoria, quantidade, receita e participação.
- **RF-06:** a lista por categoria mostra quantidade, receita e participação, ordenada pela receita.
- **RF-07:** o gráfico por hora mostra as 24 faixas e permite alternar entre receita e contas; o de dia da semana mostra as 7 faixas.
- **RF-08:** a lista por forma de pagamento mostra contas, receita e participação.
- **RF-09:** o heatmap mostra a receita de cada categoria em cada hora, com intensidade proporcional ao maior valor.
- **RF-10:** o seletor de limite oferece 10, 20 e 50 itens e refaz a consulta.
- **RF-11:** o botão **Exportar CSV** baixa um arquivo `relatorio-vendas-AAAA-MM-DD-a-AAAA-MM-DD.csv` com KPIs, rankings, categorias, horas, dias, pagamentos e heatmap.
- **RF-12:** o painel mostra estado vazio quando não há contas pagas, erro legível quando a consulta falha e um botão **Tentar de novo**.
- **RF-13:** no modo navegador, o cálculo usa as comandas pagas do `localStorage` e a categoria atual do cardápio, sem chamada de rede.
- **RF-14:** a aba **Vendas** é responsiva em 375 px, sem rolagem lateral da página; o heatmap pode rolar dentro do próprio contêiner.

## Requisitos não funcionais

- **RNF-01:** dinheiro em centavos inteiros no cálculo; valores exibidos em pt-BR com duas casas.
- **RNF-02:** participação com uma casa decimal; percentual de variação com uma casa e sinal.
- **RNF-03:** hora e dia da semana no horário de Belém (UTC−3), como na API.
- **RNF-04:** a tela não faz polling; consulta ao abrir a aba, ao mudar o período e ao mudar o limite.
- **RNF-05:** acessibilidade: tabelas com cabeçalho, botões com `aria-pressed`, gráficos com `aria-label` e valores textuais.
- **RNF-06:** sem dependência nova; gráficos em HTML/CSS.
- **RNF-07:** o CSV usa `;`, BOM UTF-8 e vírgula decimal, para abrir no Excel em pt-BR.
- **RNF-08:** testes offline com Vitest + Testing Library.

## Regras de negócio

- **RN-01:** entram só comandas `PAID` com `paidAt` no período e forma de pagamento preenchida; a data final é inclusiva. Origem: `SPEC/2026-11-16-relatorios-de-vendas.md`, RN-01.
- **RN-02:** a receita de uma linha é o preço guardado na comanda × quantidade. Origem: RN-02.
- **RN-03:** itens são agrupados pelo item de origem e pelo nome registrado na comanda; a categoria vem do cardápio atual e, se o item saiu, vira “Item removido do cardápio”. Origem: RN-03.
- **RN-04:** ticket médio = receita ÷ contas pagas, em centavos, arredondado ao centavo; sem contas, zero. Origem: RN-04.
- **RN-05:** hora e dia da semana usam o pagamento em Belém (UTC−3). Origem: RN-05.
- **RN-06:** `limit` inteiro de 1 a 50 (padrão 10); a tela oferece 10, 20 e 50. Origem: RN-06.
- **RN-07:** a soma por categoria, hora, dia e pagamento é igual à receita total. Origem: RN-07.
- **RN-08:** receita líquida = receita − descontos + taxas de entrega. Origem: resposta da API (`netRevenue`).
- **RN-09:** o período anterior termina no dia anterior ao início e tem a mesma quantidade de dias do período atual. Se o período atual tem 1 dia, o anterior tem 1 dia.
- **RN-10:** o cálculo local deve produzir a mesma forma e os mesmos valores da API para os mesmos dados; divergência é bug.
- **RN-11:** a exportação CSV não inventa dados: usa exatamente o relatório carregado.

## Critérios de aceitação verificáveis

- **CA-01:** dado um período com contas pagas, quando a aba **Vendas** abre, então os KPIs batem com a resposta da rota (receita, contas, ticket, itens, descontos, taxas e líquido).
- **CA-02:** quando o operador alterna o ranking entre quantidade e receita, então a ordem e os valores mudam conforme a regra, sem nova chamada de rede.
- **CA-03:** quando o período muda, então o painel consulta o novo período e o período anterior correspondente.
- **CA-04:** dado um período anterior sem receita, então a variação mostra “sem base” em vez de divisão por zero.
- **CA-05:** quando o operador clica em **Exportar CSV**, então o arquivo contém as seções de KPIs, itens, categorias, horas, dias, pagamentos e heatmap, com `;` e vírgula decimal.
- **CA-06:** no modo navegador, a aba calcula o relatório a partir das comandas pagas locais e não chama `fetch`.
- **CA-07:** quando a consulta falha, então o painel mostra a mensagem e o botão **Tentar de novo**.
- **CA-08:** em 375 px, a página não rola na horizontal e o heatmap rola apenas dentro do contêiner.
- **CA-09:** quando `npm test` roda, então os testes de `sales-report`, do cálculo local e do painel passam.
- **CA-10:** o build e o e2e de celular continuam verdes.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Vendas com itens, categorias e pagamentos | `buildSalesReport` | Totais, rankings, faixas e participações (RN-01 a RN-07) |
| T-02 | Pagamento às 23h30 UTC | `localSlot` | 20h em Belém e dia correto (RN-05) |
| T-03 | Período de 3 dias | `previousPeriod` | 3 dias anteriores, sem sobreposição (RN-09) |
| T-04 | Relatório com acentos e `;` | `salesReportCsv` | CSV escapado, BOM e vírgula decimal (RN-11) |
| T-05 | Modo navegador com comandas pagas | `GET /reports/sales` local | Mesmos totais do cálculo puro (RN-10) |
| T-06 | Painel com resposta simulada | Abrir, alternar ranking, mudar limite | KPIs, ordem e nova consulta (CA-01, CA-02, CA-06) |
| T-07 | Período anterior zerado | Abrir painel | “sem base” (CA-04) |
| T-08 | Erro simulado | Abrir painel | Mensagem e Tentar de novo (CA-07) |
| T-09 | Relatório carregado | Exportar CSV | Conteúdo das seções (CA-05) |
| T-10 | Suíte e build | `npm test`, `npm run build` | Verdes (CA-09, CA-10) |
| T-11 | Celular 375 px | Abrir Financeiro > Vendas | Sem rolagem lateral (CA-08) |

- **Camada de teste:** regras puras, `local-store`, CSV e componente.
- **Framework:** Vitest + Testing Library.
- **Automação prevista:** T-01 a T-09 em testes; T-10 na suíte/build; T-11 no e2e de celular.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/sales-report.ts` (novo), `apps/web/lib/sales-report.test.ts` (novo), `apps/web/app/relatorios-vendas.tsx` (novo), `apps/web/app/relatorios-vendas.test.tsx` (novo), `apps/web/lib/local-store.ts`, `apps/web/lib/local-sales-report.test.ts` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`, `README.md`, `docs/issues/backlog.md`.
- **Persistência:** não muda o formato nem a chave do `localStorage`; a rota local só lê os dados existentes.
- **Backend pausado:** não toca em `apps/api`; consome a rota já publicada.
- **Stack/tecnologias:** não muda; gráficos em HTML/CSS, sem biblioteca.
- **Deploy/Docker/Vercel:** não muda variável nem pipeline; novo código entra no build do frontend.

## Dependências e riscos

- **Dependências:** rota `/api/reports/sales` disponível no servidor; `discountCents` e `orderTotalCents` já existentes; período do Financeiro.
- **Riscos:** divergência entre o cálculo local e a API; fuso horário; CSV com separador errado; heatmap largo no celular; consulta duplicada ao abrir a aba.
- **Mitigações:** funções puras espelhando a API e testes de paridade; UTC−3 explícito; CSV com BOM e `;`; rolagem interna no heatmap; `AbortController`/flag de montagem e dependências estáveis no `useEffect`.

## Plano de implementação

1. Criar `lib/sales-report.ts` com tipos, cálculos, período anterior, variação e CSV; escrever `sales-report.test.ts`.
2. Adicionar `/reports/sales` ao `local-store` e testar a paridade em `local-sales-report.test.ts`.
3. Criar `relatorios-vendas.tsx` com KPIs, comparativo, rankings, gráficos, heatmap, estados e CSV.
4. Escrever `relatorios-vendas.test.tsx`.
5. Integrar as abas no Financeiro em `page.tsx` e os estilos em `globals.css`.
6. Adicionar a verificação da aba ao e2e de celular.
7. Rodar `npm test`, `npm run coverage`, `npm run build` e `npm run e2e:celular`; registrar os resultados.
8. Atualizar `README.md`, backlog, status e histórico desta SPEC.
9. Commit com `Agent:` e `Spec:`.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-25 | Criação da SPEC com decisão humana de implementar a aba de relatórios de vendas, com comparativo e CSV. | aprovada |
