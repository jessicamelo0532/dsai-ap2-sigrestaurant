# Atendimento na comanda: garçom, cliente e pontos de fidelidade

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-garcons-e-comissao.md` (RF-02), `SPEC/2026-11-16-clientes-e-historico.md` (RF-04), `SPEC/2026-11-16-programa-de-fidelidade.md` (RF-04, RF-05); issues #34, #35 e #36  
**Derroga:** n/a (só consome rotas existentes; nenhuma regra muda)

---

## Contexto e problema

Fatos comprovados em 2026-11-17:

- A API já permite atribuir o garçom à comanda (`PUT /orders/:id/waiter`), ligar o cliente (`PUT /orders/:id/customer`) e trocar pontos por desconto (`POST` e `DELETE /orders/:id/loyalty`). A comanda devolvida em `GET /tables` já traz `waiterId`, `waiterName`, `customerId`, `discount` e `loyaltyPoints`.
- O painel da comanda (`apps/web/app/page.tsx`) ignora esses campos. Sem eles, o relatório de comissão só tem a linha "Sem garçom", o histórico do cliente fica vazio e ninguém ganha nem usa pontos.
- O total mostrado na comanda soma só os itens e não desconta os pontos resgatados.

As SPECs das telas de garçons, clientes e fidelidade (2026-11-17) deixaram essa parte de fora porque ela muda o painel da comanda.

### Perguntas em aberto

- nenhuma nova. As regras vêm das três SPECs da API, que continuam valendo como estão.

## Objetivo

No modo servidor, permitir na própria comanda escolher o garçom, ligar o cliente e usar os pontos dele como desconto, mostrando o total já com o desconto.

## Escopo

- Lógica pura em `apps/web/lib/comanda.ts`: garçons que podem ser escolhidos, validação e prévia do resgate, subtotal, desconto e total a pagar.
- Componente `apps/web/app/comanda-atendimento.tsx` com os três blocos (Garçom, Cliente, Pontos), mostrado dentro da comanda aberta no modo servidor.
- Campos opcionais novos no tipo `Order` (`apps/web/lib/types.ts`) e as linhas "Desconto (pontos)" e "Total a pagar" no resumo da comanda.

## Fora do escopo

- Modo navegador: o bloco não aparece, como o envio para a cozinha. O `localStorage` não tem garçons, clientes nem pontos.
- Cadastrar garçom ou cliente pela comanda (isso é feito nas seções Garçons e Clientes).
- Qualquer mudança na API ou no fechamento de conta.

## Requisitos funcionais

- **RF-01:** Com uma comanda aberta no modo servidor, o painel mostra o bloco **Atendimento** com Garçom, Cliente e Pontos.
- **RF-02 (Garçom):** uma lista com os garçons ativos (`GET /waiters`) e o garçom atual. Escolher outro envia `PUT /orders/:id/waiter` com `{ waiterId }`. Se o garçom atual foi desativado depois, ele continua aparecendo como atual.
- **RF-03 (Cliente):** mostra o cliente ligado (nome por `GET /customers/:id`). **Ligar cliente** busca por nome ou telefone (`GET /customers?search=`) e envia `PUT /orders/:id/customer` com `{ customerId }`. **Tirar cliente** envia `{ customerId: null }`.
- **RF-04 (Pontos):** com cliente ligado, mostra o saldo (`GET /customers/:id/loyalty`) e a regra (`GET /loyalty/settings`). **Usar pontos** pede a quantidade, mostra a prévia do desconto e envia `POST /orders/:id/loyalty` com `{ points }`. Com resgate feito, mostra os pontos usados e o desconto, e **Desfazer resgate** envia `DELETE /orders/:id/loyalty`.
- **RF-05:** O resumo da comanda mostra o subtotal dos itens e, quando há desconto, as linhas "Desconto (pontos)" e "Total a pagar".
- **RF-06:** Depois de cada ação, a comanda é recarregada e a mensagem de sucesso ou o erro da API aparece.

## Requisitos não funcionais

- **RNF-01:** Textos em português; valores em `R$ 1.234,56`; pontos com separador de milhar.
- **RNF-02:** O E2E de celular continua passando (o bloco só aparece no modo servidor; o E2E roda no modo navegador).
- **RNF-03:** Nenhuma dependência nova.

## Regras de negócio

As regras são as das SPECs da API, que continuam sendo a fonte final. A tela repete apenas as que evitam um envio que a API recusaria, com as mesmas mensagens:

- **RN-01 (RN-03 da API de garçons):** só garçons ativos aparecem para escolha.
- **RN-02 (RN-05 da API de fidelidade):** pontos inteiros, no mínimo `minRedeemPoints` e no máximo o saldo. Mensagens: "Resgate pelo menos N pontos." e "Saldo insuficiente: o cliente tem N pontos."
- **RN-03 (RN-06 da API de fidelidade):** desconto = pontos × `centsPerPoint`, sem passar do subtotal. Mensagem: "O desconto de R$ X passa do total da comanda (R$ Y)."
- **RN-04 (RN-04 e RN-09 da API de fidelidade):** com resgate feito, **Usar pontos** e **Tirar cliente** ficam indisponíveis, e a tela explica que é preciso desfazer o resgate antes.
- **RN-05:** total a pagar = subtotal − desconto, nunca negativo (RN-10 da API de fidelidade).

## Critérios de aceitação verificáveis

- **CA-01:** Dado o modo navegador, então o bloco Atendimento não aparece e nenhuma requisição dele é feita.
- **CA-02:** Dada uma comanda sem garçom, quando escolho "Rui", então a API recebe `PUT /orders/:id/waiter` com `{ waiterId }` do Rui e a comanda é recarregada.
- **CA-03:** Dada uma comanda sem cliente, quando busco e escolho "Ana", então a API recebe `{ customerId }` da Ana; quando tiro o cliente, recebe `{ customerId: null }`.
- **CA-04:** Dado um cliente com 250 pontos e a regra padrão, quando peço 200 pontos, então vejo a prévia de R$ 10,00 e a API recebe `{ points: 200 }`.
- **CA-05:** Quando peço 50 pontos (abaixo do mínimo de 100), 300 pontos (acima do saldo) ou um desconto maior que o subtotal, então a tela recusa com a mensagem da regra, sem enviar.
- **CA-06:** Dada uma comanda com resgate, então vejo os pontos usados e o desconto, **Usar pontos** e **Tirar cliente** não estão disponíveis, e **Desfazer resgate** envia o `DELETE`.
- **CA-07:** Dada uma comanda com R$ 60,00 em itens e R$ 10,00 de desconto, então o resumo mostra "Desconto (pontos)" de R$ 10,00 e "Total a pagar" de R$ 50,00.
- **CA-08:** Dado um erro da API, então a mensagem dela aparece.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | garçons, resgate, totais | RN-01 a RN-05 |
| T-02 | Modo navegador | renderizar o painel | CA-01 |
| T-03 | API | escolher garçom | CA-02 |
| T-04 | API | ligar e tirar cliente | CA-03 |
| T-05 | API com saldo | usar pontos; inválidos | CA-04, CA-05 |
| T-06 | API com resgate | ver e desfazer | CA-06 |
| T-07 | Funções puras e componente | resumo com desconto | CA-07 |
| T-08 | API com erro | ação recusada | CA-08 |

- **Camada de teste:** lógica pura (`lib/comanda.test.ts`) e componente com Testing Library (`app/comanda-atendimento.test.tsx`), com `fetch` simulado.
- **Framework:** Vitest.
- **Automação prevista:** T-01 a T-08 automáticos; o E2E de celular segue no CI.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/comanda.ts` (novo), `apps/web/app/comanda-atendimento.tsx` (novo), `apps/web/lib/types.ts` (campos opcionais), `apps/web/app/page.tsx` (painel da comanda), `apps/web/app/globals.css`.
- **Persistência:** não muda. Os campos novos do tipo são opcionais, e o modo navegador continua sem eles.
- **Backend:** não muda.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build; na Vercel (modo navegador) nada muda na comanda.

## Dependências e riscos

- **Dependências:** APIs de garçons, clientes e fidelidade.
- **Riscos:** o total mostrado divergir do total cobrado.
- **Mitigações:** o desconto mostrado é o que a API guardou na comanda (`discount`), e o fechamento continua calculado pela API.

## Plano de implementação

1. Commit desta SPEC.
2. `lib/comanda.ts` e campos do tipo `Order`, com testes.
3. `comanda-atendimento.tsx` e testes de componente, em commits separados.
4. Ligar o bloco e o resumo com desconto no painel da comanda.
5. Rodar testes e checagem de tipos; verificar CA-01 a CA-08.
6. README e status desta SPEC.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
