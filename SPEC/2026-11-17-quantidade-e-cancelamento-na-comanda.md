# Alterar quantidade e cancelar comanda pela tela

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-10-01-restaurante.md` (comandas), `SPEC/2026-11-12-reativacao-backend.md` (rotas de comanda)  
**Derroga:** n/a (a API não muda; o modo navegador ganha o cancelamento com a mesma regra)

---

## Contexto e problema

Fatos comprovados em 2026-11-17:

- A API altera a quantidade de um item (`PATCH /orders/:id/items/:itemId`) e cancela a comanda aberta (`POST /orders/:id/cancel`). O modo navegador tem a alteração de quantidade, mas não o cancelamento.
- A comanda na tela só permite remover o item inteiro. Para corrigir "2 sucos" para "3 sucos", o garçom precisa lançar de novo, o que gera outra linha. Não há como cancelar uma comanda aberta por engano.

### Perguntas em aberto

- nenhuma. O cancelamento segue a regra que a API já tem (só comanda aberta; a mesa fica livre). Itens já enviados à cozinha continuam travados pela regra da cozinha (RN-03 de `SPEC/2026-11-16-cozinha-kds.md`), e a mensagem da API aparece na tela.

## Objetivo

Na comanda aberta, nos dois modos, ajustar a quantidade de cada item com − e + e cancelar a comanda inteira com confirmação.

## Escopo

- Lógica pura em `apps/web/lib/ajustes-comanda.ts`: próxima quantidade (1 a 500), se pode diminuir ou aumentar, texto da confirmação.
- Componente `apps/web/app/quantidade-linha.tsx` (− quantidade +) em cada linha da comanda.
- Botão **Cancelar comanda** no painel da comanda, com confirmação.
- Rota `POST /orders/:id/cancel` no adaptador local, com a mesma regra e mensagem da API.

## Fora do escopo

- Motivo do cancelamento e relatório de cancelamentos.
- Mudar a API.

## Requisitos funcionais

- **RF-01:** Cada linha da comanda aberta mostra − quantidade +. **−** diminui 1 (indisponível em 1: para tirar o item, usa-se o ✕ que já existe); **+** aumenta 1 (indisponível em 500). Cada toque envia `PATCH` com a nova quantidade e recarrega a comanda.
- **RF-02:** **Cancelar comanda** pede confirmação ("Cancelar a comanda da mesa NN? Os itens lançados não serão cobrados.") e envia `POST /orders/:id/cancel`. A mesa fica livre.
- **RF-03:** No modo navegador, `POST /orders/:id/cancel` marca a comanda como `CANCELLED`, libera a mesa e não entra no relatório. Comanda que não está aberta é recusada com "Apenas comandas abertas podem ser canceladas."
- **RF-04:** Erros da API (por exemplo, item já enviado à cozinha) aparecem na tela.

## Requisitos não funcionais

- **RNF-01:** Os botões − e + têm pelo menos 44 px (E2E de celular).
- **RNF-02:** Nenhuma dependência nova.

## Regras de negócio

- **RN-01:** quantidade de 1 a 500 (mesma regra da API e do adaptador local).
- **RN-02:** só comanda aberta é cancelada. Mensagem: "Apenas comandas abertas podem ser canceladas."

## Critérios de aceitação verificáveis

- **CA-01:** Dada uma linha com 2 unidades, quando toco **+**, então o `PATCH` leva `{ quantity: 3 }`; com 1 unidade, **−** está indisponível.
- **CA-02:** No modo navegador, alterar a quantidade muda o total da comanda.
- **CA-03:** Quando confirmo **Cancelar comanda**, então a comanda some da mesa (nos dois modos) e não entra no relatório financeiro do modo navegador; sem confirmar, nada é enviado.
- **CA-04:** No modo navegador, cancelar uma comanda paga é recusado com a mensagem de RN-02.
- **CA-05:** Um erro da API ao alterar a quantidade aparece na tela.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | quantidade e confirmação | RN-01 |
| T-02 | Adaptador local | cancelar aberta e paga | CA-03, CA-04 |
| T-03 | Componente | − e +, erro | CA-01, CA-05 |
| T-04 | Tela principal no modo navegador | alterar quantidade e cancelar | CA-02, CA-03 |

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/ajustes-comanda.ts`, `apps/web/app/quantidade-linha.tsx` (novos), `apps/web/lib/local-store.ts`, `apps/web/app/page.tsx`, `globals.css`.
- **Persistência:** não muda (`CANCELLED` já existe no tipo da comanda).
- **Backend / Stack / Deploy:** não mudam.

## Dependências e riscos

- **Riscos:** cancelar por engano.
- **Mitigações:** confirmação com o número da mesa e o aviso de que os itens não serão cobrados.

## Plano de implementação

1. Commit desta SPEC.
2. Lógica pura e adaptador local com testes.
3. Componente e ligação na comanda, com testes.
4. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
| 2026-11-17 | CA-01 a CA-05 verificados por 6 testes de lógica e do adaptador local e 3 novos na tela principal (modo servidor e navegador); `tsc --noEmit` sem erros | implementada |
