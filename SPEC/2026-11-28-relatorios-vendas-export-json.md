# Exportação JSON dos Relatórios de Vendas

**Data:** 2026-11-28  
**Status:** rascunho  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** SPEC/2026-11-25-tela-de-relatorios-de-vendas.md  
**Derroga:** n/a

## Contexto e problema

O relatório de vendas já oferece CSV, mas não há como baixar uma estrutura
programática (JSON) que preserved as métricas atuais e anteriores, facilitando
importações em BI, planilhas ou automações internas.

### Perguntas em aberto

- Que campos incluir no JSON? (padrão sugerido abaixo.)
- Deve ser incluído na mesma aba ou em sub‑menu?

## Objetivo

Fornecer um botão “Exportar JSON” na cabeça do painel de relatórios que
gera um arquivo `relatorio-vendas-AAAA-MM-DD-a-AAAA-MM-DD.json` contendo:
- dados do período atual e anterior,
- totais, KPIs,
- tabelas resumo (categorias, pagamentos, dias),
- insights automáticos.

## Escopo

- Botão “Exportar JSON” na barra de ações do painel.
- Modal de pré‑visualização do JSON (copy‑to‑clipboard e download).
- Dados gerados apenas no cliente a partir do `SalesReport` já existente.
- Nenhum novo endpoint API, nenhuma mudança de persistência.

## Fora do escopo

- Criar novo campo no banco de dados ou no `localStorage`.
- Alterar formato do CSV existente.
- Implementar autenticação, gorjeta, integração com adquirente.

## Requisitos funcionais

- **RF‑01:** Ao clicar em “Exportar JSON”, o componente deve disparar o download
  de um arquivo cujo nome segue o padrão `relatorio-vendas-AAAA-MM-DD-a-AAAA-MM-DD.json`.
- **RF‑02:** O JSON deve conter, no mínimo, os seguintes núcleos:
  ```json
  {
    "from": "2026-11-25",
    "to":   "2026-11-25",
    "revenue": "105.00",
    "netRevenue": "95.00",
    "paidOrders": 2,
    "averageTicket": "52.50",
    "itemsSold": 5,
    "categories": [...],
    "payments":   [...],
    "weekday":    [...],
    "insights":   [...]
  }
  ```
- **RF‑03:** O modal deve exibir o JSON formatado com numeração de linhas e um
  botão “Copiar para área de transferência”.
- **RF‑04:** O botão deve permanecer disabled quando não houver dados de
  relatório carregados.

## Regras de negócio

- **RN‑01:** O JSON deve usar ponto e vírgula como separador de objetos (padrão
  JSON) e vírgula decimal nas moedas (já feito por `money()`/ `csvMoney()`).
- **RN‑02:** Caso o período anterior não exista (primeira vez), o campo
  `previous` deve ser `null` e o JSON deve indicar `"hasPrevious": false`.

## Critérios de aceitação verificáveis

| CA | Descrição | Como verificar |
|---|---|---|
| **CA‑01** | Clicar em “Exportar JSON” com dados carregados dispara o download do arquivo com nome correto. | Verificar `window.location.href` termina em `.json` e `Content‑Disposition` tem o nome esperado.
| **CA‑02** | O JSON baixado contém todos os núcleos listados em RF‑02. | Parsear o arquivo e conferir chaves esperadas.
| **CA‑03** | O modal mostra o JSON formatado e o botão “Copiar” coloca o texto na área de transferência. | Usar `navigator.clipboard.writeText` e conferir `navigator.clipboard.readText`.
| **CA‑04** | Com nenhum relatório carregado, o botão permanece disabled e nenhum
  download é disparado. | Conferir atributo `disabled` e que `click` não abre diálogo.