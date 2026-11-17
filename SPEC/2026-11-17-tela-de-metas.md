# Tela de metas de vendas e comparativo

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-metas-de-vendas.md` (API), issue #39  
**Derroga:** n/a (só consome a API existente; nenhuma regra muda)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API de metas e comparativo existe e está testada (`/api/goals`, `/api/reports/compare`, SPEC de 2026-11-16, status `implementada`), mas não há tela. O dono não consegue definir a meta do mês nem acompanhar se está perto de atingi-la.

### Perguntas em aberto

- nenhuma nova. P-1 da SPEC da API (comparar com a mesma janela do mês anterior) continua valendo como está.

## Objetivo

Dar ao dono uma seção **Metas** para definir a meta de cada mês, acompanhar o atingimento e comparar dois períodos de vendas.

## Escopo

- Lógica pura em `apps/web/lib/metas.ts`: validação e corpo da meta, mês atual e navegação entre meses, rótulos de percentual e variação, largura da barra de progresso.
- Componente `apps/web/app/metas-panel.tsx` com progresso do mês, formulário da meta, metas do ano e comparativo.
- Item **Metas** no menu lateral e verificação da tela no E2E de celular.

## Fora do escopo

- Metas no modo navegador (`localStorage`).
- Gráficos com biblioteca: a barra de progresso é um elemento simples, sem dependência nova.
- Qualquer mudança na API.

## Requisitos funcionais

- **RF-01:** No modo navegador, a seção avisa que precisa do servidor e oferece **Conectar ao servidor** quando o build tem `NEXT_PUBLIC_API_URL`.
- **RF-02:** O seletor de mês começa no mês atual e permite ir ao mês anterior ou ao seguinte.
- **RF-03:** O progresso (`GET /goals/:mes/progress`) mostra, para receita, comandas e ticket médio: a meta (ou "sem meta"), o realizado, o atingimento em % com uma barra limitada a 100% de largura (o número pode passar de 100%) e a variação contra a mesma janela do mês anterior.
- **RF-04:** **Definir meta / Alterar meta** abre um formulário com receita, comandas e ticket médio, todos opcionais, mas com pelo menos um preenchido (`PUT /goals/:mes`). Campo vazio envia `null`, que tira aquela meta. **Remover meta** pede confirmação e chama `DELETE /goals/:mes`.
- **RF-05:** **Metas do ano** lista as metas do ano do mês escolhido (`GET /goals?year=`), e clicar num mês o seleciona.
- **RF-06:** O **comparativo** (`GET /reports/compare?from&to`) mostra receita, comandas e ticket médio do período escolhido e do período anterior de mesmo tamanho, com a variação.
- **RF-07:** Erros da API aparecem na tela com a mensagem que a API devolve.

## Requisitos não funcionais

- **RNF-01:** Textos em português; valores em `R$ 1.234,56`; percentuais com uma casa e vírgula (`87,5%`); variação com sinal (`+12,3%`, `−4,0%`) e "sem base" quando a API devolve nulo.
- **RNF-02:** A tela passa no E2E de celular em 375 px.
- **RNF-03:** Nenhuma dependência nova.

## Regras de negócio

As regras são as da SPEC da API, que continua sendo a fonte final. A tela repete apenas as que evitam um envio que a API recusaria, com as mesmas mensagens:

- **RN-01 (RN-02 da API):** receita e ticket médio maiores que zero, com até 2 casas; comandas inteiro maior que zero; vazio tira aquela meta. Mensagens: "Informe uma meta de receita válida.", "Informe uma meta de comandas válida.", "Informe uma meta de ticket médio válida." e "Informe pelo menos uma meta: receita, comandas ou ticket médio."
- **RN-02:** o mês segue `AAAA-MM` (RN-01 da API); a navegação passa de dezembro para janeiro do ano seguinte e vice-versa.
- **RN-03:** período do comparativo com as duas datas e a inicial menor ou igual à final.

## Critérios de aceitação verificáveis

- **CA-01:** Dado o modo navegador, quando abro **Metas**, então vejo que precisa do servidor e nenhuma requisição é feita.
- **CA-02:** Dado um mês com meta e vendas, então vejo meta, realizado, atingimento e variação de cada indicador; com atingimento acima de 100%, o número aparece inteiro e a barra fica cheia.
- **CA-03:** Dado um mês sem meta, então vejo "sem meta" e o botão **Definir meta**.
- **CA-04:** Quando defino receita "50.000,00" e deixo os outros vazios, então a API recebe `{ revenue: 50000, orders: null, averageTicket: null }` em `PUT /goals/AAAA-MM`; com tudo vazio, a tela recusa sem enviar.
- **CA-05:** Quando removo a meta e confirmo, então a API recebe `DELETE /goals/AAAA-MM` e o progresso é recarregado.
- **CA-06:** Quando vou para o mês anterior, então o progresso do novo mês é pedido; clicar num mês da lista do ano também o seleciona.
- **CA-07:** Quando comparo um período, então vejo os dois períodos e a variação; com a data inicial depois da final, a tela recusa sem chamar.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | meta, meses, percentuais, barra | RN-01 a RN-03, RNF-01 |
| T-02 | Modo navegador | renderizar | CA-01 |
| T-03 | API com meta e vendas | ver progresso | CA-02 |
| T-04 | API sem meta | ver progresso | CA-03 |
| T-05 | API | definir, recusar vazio, remover | CA-04, CA-05 |
| T-06 | API | navegar entre meses | CA-06 |
| T-07 | API | comparar períodos | CA-07 |
| T-08 | Celular 375 px | navegar até Metas | RNF-02 |

- **Camada de teste:** lógica pura (`lib/metas.test.ts`) e componente com Testing Library (`app/metas-panel.test.tsx`), com `fetch` simulado.
- **Framework:** Vitest.
- **Automação prevista:** T-01 a T-07 automáticos; T-08 no job "Uso no celular (375 px)" do CI.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/metas.ts` (novo), `apps/web/app/metas-panel.tsx` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`.
- **Persistência:** não muda.
- **Backend:** não muda.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build; na Vercel a seção mostra o aviso de RF-01.

## Dependências e riscos

- **Dependências:** API de metas (`SPEC/2026-11-16-metas-de-vendas.md`).
- **Riscos:** o mês "atual" da tela vem do relógio do aparelho, e o da API vem do servidor.
- **Mitigações:** a tela só escolhe qual mês pedir; a janela e o atingimento são calculados pela API.

## Plano de implementação

1. Commit desta SPEC.
2. `lib/metas.ts` com testes.
3. `metas-panel.tsx` e testes de componente, em commits separados.
4. Item no menu, estilos e E2E de celular.
5. Rodar testes e checagem de tipos; verificar CA-01 a CA-07.
6. README e status desta SPEC.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
