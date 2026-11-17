# Transferir comanda e juntar contas pela tela

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-transferencia-e-juncao-de-comandas.md` (API), issue #37  
**Derroga:** n/a (mesmas regras da API; o modo navegador passa a ter as mesmas rotas)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API já transfere uma comanda para outra mesa, junta duas contas e guarda o histórico (`POST /orders/:id/transfer`, `POST /orders/:id/merge`, `GET /orders/:id/history`), mas a comanda na tela não oferece nada disso. No modo navegador, que é o da URL pública, essas rotas não existem.

### Perguntas em aberto

- nenhuma nova. P-1 (garçom do destino é mantido) e P-2 (só para mesa livre) da SPEC da API valem como decisão da dupla.

## Objetivo

Na comanda aberta, permitir **Transferir mesa** e **Juntar contas** com motivo, e mostrar o histórico de mudanças da comanda, nos dois modos.

## Escopo

- Lógica pura em `apps/web/lib/mover.ts`: mesas livres para transferir, comandas que podem ser juntadas, validação do motivo, texto de cada evento do histórico.
- Componente `apps/web/app/comanda-mover.tsx` com os dois formulários e o histórico, dentro da comanda aberta.
- Rotas no adaptador local (`apps/web/lib/local-store.ts`) com as mesmas regras e mensagens da API, e lista `events` nos dados do navegador.
- Situação `MERGED` no tipo `Order` do frontend.

## Fora do escopo

- Mudar a API.
- Desfazer uma junção.

## Requisitos funcionais

- **RF-01:** Na comanda aberta, **Transferir mesa** mostra só as mesas livres (exceto a atual) e pede o motivo. Ao confirmar, envia `POST /orders/:id/transfer` com `{ tableId, reason }` e a tela passa a mostrar a comanda na nova mesa.
- **RF-02:** **Juntar contas** mostra as outras mesas com comanda aberta e pede o motivo. Ao confirmar, envia `POST /orders/:id/merge` com `{ sourceOrderId, reason }`: os itens da outra comanda vêm para esta, e a outra mesa fica livre.
- **RF-03:** Se houver mudanças, a comanda mostra o **histórico** (`GET /orders/:id/history`): "Transferida da mesa 3 para a mesa 5" ou "Recebeu a comanda #12 da mesa 4", com data, hora e motivo.
- **RF-04:** No modo navegador, as três rotas funcionam com as mesmas regras e mensagens (RN-01 a RN-07 da SPEC da API). A comanda de origem de uma junção fica `MERGED`, sem itens, e some da mesa.
- **RF-05:** Sem mesa livre, ou sem outra comanda aberta, o botão correspondente fica indisponível com a explicação.

## Requisitos não funcionais

- **RNF-01:** Mensagens em português, iguais nos dois modos.
- **RNF-02:** A tela passa no E2E de celular em 375 px.
- **RNF-03:** Dados do navegador salvos antes desta mudança continuam válidos (sem `events`, a lista começa vazia).

## Regras de negócio

As da SPEC da API, repetidas no modo navegador e, as de formulário, na tela antes de enviar:

- **RN-01:** motivo de 3 a 200 caracteres. Mensagem: "Informe o motivo, de 3 a 200 caracteres."
- **RN-02:** só comandas abertas. Mensagens: "Só comandas abertas podem mudar de mesa." e "Só comandas abertas podem ser juntadas."
- **RN-03:** destino da transferência é outra mesa, que existe e está livre. Mensagens: "A comanda já está nessa mesa.", "Mesa não encontrada." e "A mesa N já tem uma comanda aberta. Junte as contas em vez de transferir."
- **RN-04:** junção com duas comandas diferentes. Mensagem: "Escolha duas comandas diferentes."
- **RN-05:** depois da junção, o total do destino é a soma dos dois totais de antes.

## Critérios de aceitação verificáveis

- **CA-01:** Dada a mesa 1 com comanda e a mesa 2 livre, quando transfiro para a 2 com motivo "Cliente pediu janela", então a comanda aparece na mesa 2 e a mesa 1 fica livre (nos dois modos).
- **CA-02:** Dadas as mesas 1 e 3 com comanda, quando junto a da mesa 3 na da mesa 1, então a comanda da mesa 1 tem os itens das duas, o total é a soma e a mesa 3 fica livre.
- **CA-03:** Com motivo de 2 caracteres, a tela recusa com a mensagem de RN-01 sem enviar.
- **CA-04:** No modo navegador, transferir para mesa ocupada e juntar uma comanda nela mesma são recusados com as mensagens de RN-03 e RN-04.
- **CA-05:** Depois de transferir e juntar, o histórico da comanda mostra os dois eventos com o motivo.
- **CA-06:** Sem mesa livre, **Transferir mesa** fica indisponível com "Nenhuma mesa livre".

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | candidatas, motivo, textos | RN-01, RF-05 |
| T-02 | Adaptador local | transferir, juntar, recusas, histórico | CA-01, CA-02, CA-04, CA-05 |
| T-03 | Componente com API simulada | transferir, juntar, motivo curto, histórico, sem mesa livre | CA-01 a CA-03, CA-05, CA-06 |
| T-04 | Tela principal no modo navegador | transferir pela comanda | CA-01 |

- **Camada de teste:** lógica pura, adaptador local e componente (Vitest e Testing Library).

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/mover.ts` (novo), `apps/web/app/comanda-mover.tsx` (novo), `apps/web/lib/local-store.ts`, `apps/web/lib/types.ts`, `apps/web/app/page.tsx`, `globals.css`.
- **Persistência:** o `localStorage` ganha a lista `events` na mesma chave; dados antigos continuam válidos (RNF-03).
- **Backend:** não muda.
- **Deploy/Vercel:** não muda o build; a função passa a existir na URL pública.

## Dependências e riscos

- **Riscos:** a comanda `MERGED` aparecer em relatórios do modo navegador.
- **Mitigações:** o relatório local só conta comandas `PAID`; a lista de mesas só mostra comandas `OPEN`.

## Plano de implementação

1. Commit desta SPEC.
2. Lógica pura e adaptador local, com testes.
3. Componente com testes.
4. Comanda na tela principal, estilos e documentação.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
| 2026-11-17 | CA-01 a CA-06 verificados por 8 testes de `lib/mover.test.ts`, 9 de `lib/local-mover.test.ts` (inclui o total pago depois de juntar), 8 de `app/comanda-mover.test.tsx` e 1 novo em `app/page.test.tsx` (transferência no modo navegador); `tsc --noEmit` sem erros | implementada |
