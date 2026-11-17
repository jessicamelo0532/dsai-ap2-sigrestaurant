# Tela de variações e adicionais: cadastro no cardápio e escolha ao lançar

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-variacoes-e-adicionais.md` (API), issue #38  
**Derroga:** n/a (só consome a API existente)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API guarda variações (ex.: P, M, G, cada uma com seu preço) e adicionais (ex.: borda recheada) de cada item (`GET/PUT /menu-items/:id/options`) e aceita `variantId` e `addonIds` ao lançar item na comanda. Mas:

- não há tela para cadastrar as opções;
- a comanda lança o item sem opções, e a API recusa todo item que tem variações (RN-04 da API: "Escolha a variação de …"). Ou seja, um item com variação hoje **não pode ser vendido pela tela**.

### Perguntas em aberto

- nenhuma nova. P-1 e P-2 da SPEC da API valem como decisão da dupla.

## Objetivo

No modo servidor, cadastrar variações e adicionais de cada item e, ao lançar um item que tem opções, escolher a variação e os adicionais com o preço calculado antes de confirmar.

## Escopo

- Lógica pura em `apps/web/lib/opcoes.ts`: validação das listas (como a API), corpo do `PUT`, preço da linha, validação da escolha e rótulos.
- Componente `apps/web/app/opcoes-panel.tsx`: aba **Opções** no Cardápio, com escolha do item, edição das duas listas e salvar.
- Componente `apps/web/app/escolher-opcoes.tsx`: janela de escolha ao lançar o item na comanda.
- Ligação em `apps/web/app/page.tsx`: a aba e o lançamento pelo cardápio rápido.

## Fora do escopo

- Opções no modo navegador: a aba avisa que precisa do servidor e o lançamento continua igual.
- Mudar a API.

## Requisitos funcionais

- **RF-01:** No modo navegador, a aba **Opções** avisa que precisa do servidor.
- **RF-02:** A aba lista os itens do cardápio; ao escolher um, carrega as variações e os adicionais (`GET`).
- **RF-03:** Cada lista permite incluir, editar nome e preço, remover e, nas variações, mudar a ordem (subir e descer). **Salvar** envia `PUT` com as duas listas (listas vazias tiram tudo).
- **RF-04:** Na comanda (modo servidor), clicar num item do cardápio rápido busca as opções: sem opções, lança direto como hoje; com opções, abre a janela de escolha.
- **RF-05:** A janela mostra as variações (uma obrigatória, se houver) e os adicionais (vários, até 10), com o preço unitário e o total da linha calculados ao vivo; **Lançar** envia `POST /tables/:id/items` com `menuItemId`, `quantity`, `variantId` e `addonIds`.
- **RF-06:** Erros da API aparecem na tela com a mensagem que ela devolve.

## Requisitos não funcionais

- **RNF-01:** Textos em português; valores em `R$ 1.234,56`; preços digitados com vírgula ou ponto.
- **RNF-02:** A tela passa no E2E de celular em 375 px.
- **RNF-03:** Nenhuma dependência nova.

## Regras de negócio

As da SPEC da API, repetidas na tela antes de enviar, com as mesmas mensagens:

- **RN-01:** nome de 1 a 60 caracteres, sem repetir dentro da mesma lista (sem diferenciar maiúsculas e acentos). Mensagens: "Informe o nome de cada opção, de 1 a 60 caracteres." e "A opção NOME está repetida."
- **RN-02:** preço da variação maior que zero; do adicional, zero ou mais; até 2 casas. Mensagem: "Informe um preço válido para NOME."
- **RN-03:** no máximo 20 variações e 30 adicionais. Mensagem: "Cadastre no máximo 20 variações e 30 adicionais por item."
- **RN-04:** item com variações exige uma variação. Mensagem: "Escolha a variação de ITEM: V1, V2."
- **RN-05:** no máximo 10 adicionais por linha. Mensagem: "Escolha no máximo 10 adicionais por item."
- **RN-06:** preço unitário = preço da variação (ou do item) + soma dos adicionais; total = unitário × quantidade.

## Critérios de aceitação verificáveis

- **CA-01:** Dado o modo navegador, a aba Opções avisa que precisa do servidor.
- **CA-02:** Quando escolho "Pizza", incluo as variações "Média" (R$ 40,00) e "Grande" (R$ 55,00) e o adicional "Borda" (R$ 8,00) e salvo, então a API recebe essas listas, na ordem.
- **CA-03:** Com uma variação de preço zero, ou duas opções "Borda" e "borda", a tela recusa com a mensagem da regra, sem enviar.
- **CA-04:** Na comanda, clicar num item sem opções lança direto, como antes.
- **CA-05:** Clicar na "Pizza" abre a escolha; com "Grande", "Borda" e quantidade 2, o preço unitário mostrado é R$ 63,00 e o total R$ 126,00, e a API recebe `{ menuItemId, quantity: 2, variantId, addonIds: [id da Borda] }`.
- **CA-06:** Sem escolher a variação, **Lançar** é recusado com a mensagem de RN-04.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | listas, corpo, preço, escolha | RN-01 a RN-06 |
| T-02 | Componente da aba | modo navegador; editar e salvar; inválidos | CA-01 a CA-03 |
| T-03 | Componente da escolha | sem opções; com opções; sem variação | CA-04 a CA-06 |
| T-04 | Celular 375 px | Cardápio | RNF-02 |

- **Camada de teste:** lógica pura e componentes (Vitest e Testing Library, `fetch` simulado).

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/opcoes.ts`, `apps/web/app/opcoes-panel.tsx`, `apps/web/app/escolher-opcoes.tsx` (novos), `apps/web/app/page.tsx`, `globals.css`.
- **Persistência / Backend / Stack / Deploy:** não mudam.

## Dependências e riscos

- **Riscos:** o lançamento pelo cardápio rápido passa a fazer uma consulta a mais no modo servidor.
- **Mitigações:** a consulta é pequena; sem opções, o item é lançado logo em seguida, como antes.

## Plano de implementação

1. Commit desta SPEC.
2. Lógica pura com testes.
3. Aba Opções com testes.
4. Janela de escolha com testes e ligação na comanda.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
| 2026-11-17 | CA-01 a CA-06 verificados por 19 testes de `lib/opcoes.test.ts`, 9 de `app/opcoes.test.tsx` e 1 novo em `app/page.test.tsx` (item sem opções lançado direto pela tela principal); `tsc --noEmit` sem erros | implementada |
