# Visão do salão: mesas, pedidos e contas abertas numa tela só

**Data:** 2026-11-16  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** nova, a partir da entrevista com o cliente (`docs/entrevistas/2026-11-13-cliente.md`, prioridade 3.1)  
**Derroga:** n/a (acrescenta uma seção ao app; nenhuma regra existente muda)

---

## Contexto e problema

Fato comprovado em 2026-11-16: a tela "Visão geral" mostra as mesas como cartões com "Livre" ou "Em atendimento" e o total, mas **o que cada mesa pediu só aparece depois de clicar nela**, no painel da comanda, uma mesa por vez. Para saber o que está acontecendo no salão inteiro, a pessoa precisa clicar mesa por mesa.

O cliente pediu exatamente isso na entrevista:

> conseguir bater o olho e saber quais mesas estão ocupadas, o que cada uma pediu e quais contas ainda estão abertas, sem precisar ficar entrando em várias telas.

### Perguntas em aberto

- **P-1:** a partir de quanto tempo uma conta aberta deve chamar a atenção (por exemplo, mesa esquecida)? Provisório: nenhum destaque por tempo; o painel só mostra há quanto tempo cada conta está aberta e ordena da mais antiga para a mais nova.
- **P-2:** de quanto em quanto tempo o painel deve se atualizar sozinho? Provisório: a cada 30 segundos enquanto a tela estiver aberta (útil no modo API, em que mais de um aparelho lança pedidos).

## Objetivo

Uma tela "Salão" em que, sem clicar em nada, se vê quais mesas estão ocupadas, o que cada uma pediu, há quanto tempo a conta está aberta, quanto deve e o total em aberto no salão.

## Escopo

- Lógica pura em `apps/web/lib/salao.ts`: montar o painel a partir das mesas, agrupar itens iguais, calcular tempo aberto, totais e resumo, filtrar e ordenar.
- Componente `apps/web/app/salao-panel.tsx` e item "Salão" no menu lateral.
- Botão em cada mesa que leva para a "Visão geral" com a mesa já selecionada, para lançar pedido ou fechar a conta.
- Atualização automática do painel e do tempo aberto (P-2).
- Estilos do painel já pensados para celular (grade que vira uma coluna, textos e botões em tamanho legível). A revisão do restante do app para celular é a SPEC seguinte.

## Fora do escopo

- Lançar pedido ou fechar conta direto no painel (continua na "Visão geral").
- Destaque de mesa por tempo de espera (P-1).
- Zonas do salão e mapa por posição (issue 2.1).
- Envio para a cozinha (issue 2.4).

## Requisitos funcionais

- **RF-01:** o menu lateral ganha a seção "Salão".
- **RF-02:** o topo do painel mostra: mesas ocupadas de um total, contas abertas, valor total em aberto e a conta aberta há mais tempo (mesa e tempo).
- **RF-03:** cada mesa ocupada mostra número, lugares, horário de abertura, tempo aberto, a lista do que foi pedido (quantidade, nome e subtotal) e o total da conta.
- **RF-04:** itens iguais (mesmo nome e mesmo preço) lançados em momentos diferentes aparecem numa linha só, com a quantidade somada.
- **RF-05:** cada mesa livre mostra número e lugares, em formato compacto.
- **RF-06:** filtros "Todas", "Ocupadas" e "Livres", cada um com a contagem.
- **RF-07:** ordem: mesas ocupadas primeiro, da conta aberta há mais tempo para a mais recente (empate pelo número da mesa); depois as livres, pelo número.
- **RF-08:** o botão de cada mesa abre a "Visão geral" com aquela mesa selecionada.
- **RF-09:** o painel se atualiza sozinho a cada 30 segundos enquanto está aberto (P-2), e o tempo aberto acompanha o relógio.

## Requisitos não funcionais

- **RNF-01:** toda a lógica de montagem do painel fica em funções puras testáveis, sem React.
- **RNF-02:** valores em centavos inteiros nas contas, para não acumular erro de arredondamento.
- **RNF-03:** funciona igual no modo local e no modo API (usa a mesma rota `/tables` que o app já usa).
- **RNF-04:** no celular, o painel vira uma coluna, sem rolagem lateral, com texto de pelo menos 14 px e botões de pelo menos 44 px de altura.

## Regras de negócio

- **RN-01:** mesa ocupada é a que tem comanda aberta, como já é no app e na API.
- **RN-02:** tempo aberto = minutos inteiros desde a abertura da comanda, nunca negativo. Exibição: "agora" abaixo de 1 minuto, "N min" abaixo de 1 hora, "H h MM min" a partir de 1 hora.
- **RN-03:** subtotal da linha = preço unitário × quantidade; total da conta = soma das linhas; total em aberto = soma das contas abertas.

## Critérios de aceitação verificáveis

- **CA-01:** dado um salão com mesas livres e ocupadas, quando abrir "Salão", então o resumo mostra ocupadas/total, contas abertas, total em aberto e a conta mais antiga.
- **CA-02:** dada uma mesa com o mesmo prato lançado duas vezes, quando abrir "Salão", então o prato aparece numa linha com a quantidade somada e o subtotal correto.
- **CA-03:** quando escolher cada filtro, então só aparecem as mesas daquele grupo, na ordem de RF-07.
- **CA-04:** quando tocar no botão de uma mesa, então a "Visão geral" abre com ela selecionada.
- **CA-05:** com a tela aberta, o tempo aberto e os dados se atualizam sem recarregar a página.
- **CA-06:** numa tela de 375 px de largura, não há rolagem lateral e os textos e botões seguem RNF-04.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | Tempo aberto e formato | RN-02 |
| T-02 | Comanda com linhas repetidas | Agrupar itens | RF-04, RN-03 |
| T-03 | Mesas livres e ocupadas | Montar painel e resumo | RF-02, RF-03, RF-05 |
| T-04 | Painel montado | Filtrar e ordenar | RF-06, RF-07 |
| T-05 | App no navegador | Abrir "Salão", filtrar, tocar numa mesa | CA-01 a CA-05 |
| T-06 | Navegador com 375 px | Abrir "Salão" | CA-06 |

- **Camada de teste:** lógica pura (unitário, Vitest) e verificação manual no navegador para a tela.
- **Framework:** Vitest. Testes de componente dependem da issue 1.4 (Testing Library).
- **Automação prevista:** T-01 a T-04 automatizados; T-05 e T-06 manuais, com registro no PR.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/salao.ts` (novo), `apps/web/lib/salao.test.ts` (novo), `apps/web/app/salao-panel.tsx` (novo), `apps/web/app/page.tsx` (item de menu e seção), `apps/web/app/globals.css` (estilos do painel).
- **Persistência:** não muda.
- **API:** não muda.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Dependências:** nenhuma.
- **Riscos:** salão com muitas mesas ficar longo demais; atualização automática gastar requisições à toa.
- **Mitigações:** filtros e cartão compacto para mesa livre; atualização só com a tela "Salão" aberta.

## Plano de implementação

1. Lógica pura com testes.
2. Componente e item de menu.
3. Estilos do painel, desktop e celular.
4. Verificação no navegador (CA-01 a CA-06) e registro no PR.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, a partir do pedido do cliente | aprovada |
| 2026-11-16 | CA-01 a CA-06 verificados: 21 testes da lógica (100% das linhas de `salao.ts`, onze mutações detectadas); tela conferida no Chrome headless em 1366 px e 375 px, com relógio controlado para a atualização automática. Prints em `docs/evidencias/2026-11-16-salao-*.jpg`. P-1 e P-2 seguem abertas para o cliente | implementada |
