# Fechamento das lacunas de teste das regras de negócio do store

**Data:** 2026-11-14  
**Status:** implementada  
**Agent:** opencode/minimax-m3.1-flash-free  
**SPEC derivada de:** `SPEC/2026-11-10-infraestrutura-de-testes.md`  
**Derroga:** n/a — esta SPEC não altera comportamento de produto; ela apenas fixa em teste o comportamento que já existe no código.

> Perguntas em aberto: nenhuma. As quatro regras já estão implementadas em `apps/web/lib/store.ts` e o que falta é a evidência de que elas seguram.

---

## Contexto e problema

A auditoria de conformidade (`docs/AUDITORIA-AP2.md`, seção 4) fez uma análise de mutação manual da suíte `apps/web/lib/store.test.ts` e encontrou **12 mutações**, das quais **6 foram detectadas e 4 sobreviveram**. As quatro sobreviventes são regras de negócio reais do produto, hoje **sem nenhum teste**:

| # | Regra | Implementação | Mutação que sobreviveu |
|---|---|---|---|
| M7 | Comanda sem item não pode ser fechada | `store.ts:193` | "comanda vazia passa a ser fechável" |
| M10 | Comanda não paga não entra no relatório financeiro | `store.ts:219` | "relatório conta comanda não paga" |
| M11 | Despesa com valor negativo ou zero é recusada | `store.ts:209` | "despesa com valor negativo aceita" |
| M12 | Item pausado (indisponível) não entra na comanda | `store.ts:156` | "item indisponível aceito na comanda" |

O impacto não é só de métrica: são as quatro regras que protegem dinheiro. Uma comanda vazia "fechada" gera receita zero com pagamento registrado; uma despesa negativa distorce o saldo; um item pausado aparece como venda de um prato que a cozinha não produz; comanda não paga no relatório falseia a receita do período.

## Objetivo

Cada uma das quatro regras passa a ter um teste automatizado que **falha quando a regra é revertida**, fechando a lacuna de evidência apontada pela auditoria.

## Escopo

- Quatro casos de teste novos na suíte `apps/web/lib/store.test.ts`, na camada de regras de negócio (`store`).
- Reprocessamento da análise de mutação das quatro regras e registro do resultado na auditoria.

## Fora do escopo

- Mudança de comportamento no produto: nenhuma regra é criada, alterada ou removida.
- Testes de componente e E2E (issue 1.3 do backlog).
- Cobertura de linhas do diff no pipeline (issue 1.4 do backlog).

## Requisitos funcionais

- **RF-01:** uma comanda sem itens não pode ser fechada e continua aberta após a recusa.
- **RF-02:** o relatório financeiro não conta comanda que não foi paga.
- **RF-03:** despesa com valor zero ou negativo é recusada com mensagem de valor inválido.
- **RF-04:** item marcado como indisponível no cardápio não pode ser adicionado à comanda.

## Requisitos não funcionais

- **RNF-01:** os testes rodam offline, no ambiente `node`, sem banco ou serviço externo (mesma suíte existente).
- **RNF-02:** pt-BR nas mensagens de erro verificadas.
- **RNF-03:** os testes não dependem de data fixa nem de estado compartilhado entre casos.

## Regras de negócio

As quatro regras já existem no código e não mudam:

- **RN-01:** a comanda precisa ter ao menos um item para ser fechada; caso contrário, erro "Adicione pelo menos um item antes de fechar a conta." Origem: `apps/web/lib/store.ts`, comportamento herdado da AP1.
- **RN-02:** o relatório financeiro soma apenas comandas com status `PAID` e `paidAt` dentro do período. Origem: idem.
- **RN-03:** o valor da despesa precisa ser finito e maior que zero; caso contrário, erro "Informe um valor válido." Origem: idem.
- **RN-04:** só item de cardápio com `available === true` pode entrar na comanda; caso contrário, erro "Este item não está disponível no cardápio." Origem: idem.

## Critérios de aceitação verificáveis

- **CA-01:** a suíte tem ao menos 10 casos (era 6) e todos passam. → verificado por `npm test`.
- **CA-02:** o caso de comanda vazia semeia uma comanda aberta sem itens no `localStorage` e espera a recusa do fechamento, conferindo que a comanda continua aberta. → verificado por `npm test`.
- **CA-03:** o caso de relatório semeia uma comanda aberta com item e confere que a receita e a contagem de comandas pagas do período são zero. → verificado por `npm test`.
- **CA-04:** o caso de despesa tenta gravar valor `-10` e depois `0` e espera a recusa nos dois. → verificado by `npm test`.
- **CA-05:** o caso de item pausado marca o item como indisponível e espera a recusa ao adicionar à comanda. → verificado por `npm test`.
- **CA-06:** reverter cada uma das quatro regras no código faz o teste correspondente falhar. → verificado por mutação manual (reverter, rodar a suíte, restaurar).
- **CA-07:** a auditoria registra o novo resultado da análise de mutação. → verificado por leitura de `docs/AUDITORIA-AP2.md`.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-07 | Comanda aberta sem itens no `localStorage` | Fechar a comanda | Erro "Adicione pelo menos um item antes de fechar a conta."; comanda continua aberta |
| T-08 | Comanda aberta com item, no período de hoje | Ler o relatório financeiro | `paidOrders` = 0 e receita = "0.00" |
| T-09 | Nenhuma despesa | Gravar despesa de -10 e depois de 0 | Erro "Informe um valor válido." nos dois casos; nenhuma despesa gravada |
| T-10 | Item de cardápio pausado | Adicionar o item à comanda | Erro "Este item não está disponível no cardápio."; comanda sem itens |

- **Camada de teste:** regras de negócio (`store`).
- **Framework:** Vitest 5.1.0 (aprovado na SPEC de 2026-11-10).
- **Automação prevista:** T-07 a T-10 entram na suíte; T-07 a T-10 rodam no pipeline a cada push.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/store.test.ts` (novos casos) e `docs/AUDITORIA-AP2.md` (resultado da mutação).
- **Persistência:** não muda. Nenhum formato de dado no `localStorage` é alterado.
- **Backend pausado:** não tocado. As mesmas regras existem na API e já são cobertas pela suíte de integração (`apps/api/test`).
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build.

## Dependências e riscos

- **Dependências:** SPEC `2026-11-10-infraestrutura-de-testes.md`.
- **Riscos:** os testes semeiam dados no `localStorage`; um vazamento entre casos falsearia o resultado. Mitigação: cada caso parte de um `localStorage` limpo, o mesmo mecanismo já usado pelos seis testes existentes.
- **Mitigações:** mutação manual das quatro regras para comprovar que os testes detectam a reversão.

## Plano de implementação

1. Escrever esta SPEC.
2. Adicionar T-07 a T-10 em `apps/web/lib/store.test.ts`.
3. Executar `npm test` e `npm run coverage`.
4. Reverter cada uma das quatro regras, confirmar a falha do teste correspondente e restaurar.
5. Atualizar a auditoria com o novo resultado da análise de mutação.
6. Verificar item a item os Critérios de Aceitação.
7. Commit pequeno com `Agent:` e `Spec:` no corpo.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-14 | Criação do rascunho | rascunho |
| 2026-11-14 | T-07 a T-10 implementados; mutações M7, M10, M11 e M12 agora detectadas; CA-01 a CA-07 verificados | implementada |
