# Tela do caixa por turno

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-caixa-por-turno.md` (API), issue #32  
**Derroga:** n/a (só consome a API existente; nenhuma regra muda)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API do caixa por turno existe e está testada (`/api/cash`, SPEC de 2026-11-16, status `implementada`), mas a SPEC da API deixou as telas fora do escopo. Hoje quem opera o caixa não tem como abrir o turno, registrar sangria e reforço ou fechar com conferência sem chamar a API à mão.

### Perguntas em aberto

- nenhuma nova. P-1 a P-3 da SPEC da API continuam valendo como estão, e a tela segue as respostas provisórias: um turno aberto por vez, contas pagas sem turno ficam fora, e qualquer diferença exige observação.

## Objetivo

Dar ao operador uma seção **Caixa** para abrir o turno, acompanhar o esperado por forma de pagamento, registrar sangria e reforço, fechar com conferência e consultar os turnos anteriores.

## Escopo

- Lógica pura em `apps/web/lib/caixa.ts`: leitura de valores digitados no formato brasileiro, validações do formulário, prévia das diferenças no fechamento, rótulos.
- Componente `apps/web/app/caixa-panel.tsx` com o turno aberto, os formulários e o histórico.
- Item **Caixa** no menu lateral (`apps/web/app/page.tsx`) e verificação da tela no E2E de celular.

## Fora do escopo

- Qualquer mudança na API ou nas regras do caixa.
- Caixa no modo navegador (`localStorage`). O caixa é um registro compartilhado da equipe e existe só no modo servidor, como a cozinha e as reservas.
- Impressão do fechamento.

## Requisitos funcionais

- **RF-01:** No modo navegador, a seção mostra que o caixa precisa do servidor e oferece **Conectar ao servidor** quando o build tem `NEXT_PUBLIC_API_URL`.
- **RF-02:** Sem turno aberto (`GET /cash/current` devolve nulo), a seção mostra o formulário **Abrir turno** com operador e troco inicial (`POST /cash/open`).
- **RF-03:** Com turno aberto, a seção mostra quem abriu e quando, o troco inicial, e uma linha por forma de pagamento (Dinheiro, Crédito, Débito, Pix) com vendas e esperado.
- **RF-04:** Com turno aberto, **Sangria** e **Reforço** abrem um formulário com valor e motivo (`POST /cash/withdrawals` e `POST /cash/deposits`). As movimentações do turno aparecem em lista, na ordem em que aconteceram.
- **RF-05:** **Fechar turno** abre um formulário com operador e o valor contado em cada forma. Enquanto o operador digita, a tela mostra a diferença de cada forma (sobra ou falta). Com diferença, a observação passa a ser obrigatória antes de enviar (`POST /cash/close`).
- **RF-06:** O histórico lista os turnos dos últimos 30 dias (`GET /cash/sessions?from&to`), do mais recente ao mais antigo, com situação, operador, horários e, nos fechados, se houve diferença.
- **RF-07:** Erros da API aparecem na tela com a mensagem que a API devolve.

## Requisitos não funcionais

- **RNF-01:** Textos em português; valores em reais no formato `R$ 1.234,56`.
- **RNF-02:** Contas de dinheiro em centavos inteiros.
- **RNF-03:** A tela passa no E2E de celular em 375 px (fonte e alvos de toque dentro dos limites).
- **RNF-04:** Nenhuma dependência nova.

## Regras de negócio

As regras são as da SPEC da API, e a API continua sendo a fonte final. A tela repete apenas as que evitam um envio que a API recusaria, com a mesma mensagem, para o operador ver o problema antes de enviar:

- **RN-01 (RN-02 da API):** operador de 2 a 80 caracteres; troco inicial zero ou mais; sangria e reforço maiores que zero; motivo de 3 a 200 caracteres; até 2 casas decimais.
- **RN-02 (RN-08 da API):** valores contados zero ou mais, com até 2 casas, nas quatro formas.
- **RN-03 (RN-07 da API):** diferença = contado − esperado, por forma; positiva é sobra, negativa é falta. Com qualquer diferença, a observação precisa ter de 5 a 500 caracteres. Mensagem: "Explique a diferença de caixa antes de fechar o turno."
- **RN-04:** o valor digitado aceita vírgula ou ponto como separador decimal (`12,50`, `12.50`) e o prefixo `R$`. Campo vazio no fechamento vale zero.

O limite da sangria (RN-05 da API) não é repetido na tela: ele depende do dinheiro na gaveta no momento do envio, e a mensagem da API é mostrada como erro (RF-07).

## Critérios de aceitação verificáveis

- **CA-01:** Dado o modo navegador, quando abro **Caixa**, então vejo que o caixa precisa do servidor e nenhuma requisição é feita.
- **CA-02:** Dado nenhum turno aberto, quando preencho operador e troco e envio, então a API recebe `{ operator, openingAmount }` e a tela passa a mostrar o turno aberto.
- **CA-03:** Dado um turno aberto, então vejo vendas e esperado das quatro formas e as movimentações.
- **CA-04:** Dado um turno aberto, quando registro uma sangria com valor e motivo, então a API recebe `{ amount, reason }` em `/cash/withdrawals`; com motivo curto, a tela recusa sem enviar.
- **CA-05:** Dado o formulário de fechamento, quando informo exatamente o esperado, então não há diferença e o envio não exige observação.
- **CA-06:** Dado o formulário de fechamento, quando informo um valor diferente, então vejo a sobra ou a falta daquela forma, e sem observação o envio é recusado com a mensagem de RN-03.
- **CA-07:** Dado turnos anteriores, então o histórico mostra cada um com operador e, nos fechados com diferença, a marcação de diferença.
- **CA-08:** Dado um erro da API (ex.: sangria acima do dinheiro), então a mensagem da API aparece na tela.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | valores digitados, validações, diferenças, rótulos | RN-01 a RN-04 |
| T-02 | Modo navegador | renderizar | CA-01 |
| T-03 | API sem turno | abrir turno | CA-02 |
| T-04 | API com turno | ver turno; sangria; reforço; motivo curto | CA-03, CA-04 |
| T-05 | API com turno | fechar sem diferença; com diferença sem e com observação | CA-05, CA-06 |
| T-06 | API com turnos | histórico | CA-07 |
| T-07 | API recusa sangria | registrar sangria | CA-08 |
| T-08 | Celular 375 px | navegar até Caixa | RNF-03 |

- **Camada de teste:** lógica pura (`lib/caixa.test.ts`) e componente com Testing Library (`app/caixa-panel.test.tsx`), com `fetch` simulado.
- **Framework:** Vitest (padrão do repositório).
- **Automação prevista:** T-01 a T-07 automáticos; T-08 no job "Uso no celular (375 px)" do CI.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/caixa.ts` (novo), `apps/web/app/caixa-panel.tsx` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`.
- **Persistência:** não muda.
- **Backend:** não muda; consome as rotas existentes.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build. Na Vercel (modo navegador) a seção mostra o aviso de RF-01.

## Dependências e riscos

- **Dependências:** API do caixa (`SPEC/2026-11-16-caixa-por-turno.md`).
- **Riscos:** a prévia de diferença da tela divergir da conta da API.
- **Mitigações:** a prévia usa o esperado que a própria API devolve; a diferença guardada é a calculada pela API no fechamento.

## Plano de implementação

1. Commit desta SPEC.
2. `lib/caixa.ts` com testes.
3. `caixa-panel.tsx` com testes de componente.
4. Item no menu, estilos e E2E de celular.
5. Rodar testes e build; verificar CA-01 a CA-08.
6. README e status desta SPEC.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
| 2026-11-17 | CA-01 a CA-08 verificados por 35 testes de `lib/caixa.test.ts` e 12 de `app/caixa-panel.test.tsx`; suíte do frontend com 225 testes passando; `npm run build` verde; cobertura de `caixa.ts` 100% e de `caixa-panel.tsx` 94,8% das linhas. T-08 (celular 375 px) fica com o job do CI | implementada |
