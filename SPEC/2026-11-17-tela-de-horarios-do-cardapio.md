# Tela de horários do cardápio

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-cardapio-por-horario.md` (API), issue #41  
**Derroga:** n/a (só consome a API existente)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API guarda janelas de dia e horário por item do cardápio (`GET/PUT /menu-items/:id/availability`), esconde do pedido os itens fora da janela e recusa o lançamento fora do horário. Não há tela para cadastrar essas janelas; hoje só dá para fazer isso chamando a API à mão.

### Perguntas em aberto

- nenhuma nova. P-1 e P-2 da SPEC da API valem como decisão da dupla.

## Objetivo

No modo servidor, uma aba **Horários** no Cardápio para escolher um item, ver se ele está disponível agora e editar as janelas de dia e horário em que ele aparece no pedido.

## Escopo

- Lógica pura em `apps/web/lib/horarios.ts`: validação das janelas (como a API), ordenação, corpo do `PUT`, repetição nos dias úteis e rótulos.
- Componente `apps/web/app/horarios-panel.tsx`.
- Aba **Horários** no Cardápio (`apps/web/app/page.tsx`).

## Fora do escopo

- Horários no modo navegador: a aba avisa que precisa do servidor.
- Mudar a API ou o interruptor de disponibilidade do item.

## Requisitos funcionais

- **RF-01:** No modo navegador, a aba avisa que precisa do servidor.
- **RF-02:** Ao escolher um item, a aba carrega as janelas (`GET`) e mostra a situação: "Sempre disponível" (sem janelas), "Disponível agora" ou "Fora do horário agora".
- **RF-03:** Cada janela tem dia da semana, início e fim; dá para incluir, remover e **Repetir nos dias úteis** (copia a janela para segunda a sexta, sem duplicar dias que já têm a mesma janela).
- **RF-04:** **Salvar** envia `PUT` com as janelas em ordem de dia e horário; **Sempre disponível** limpa a lista na tela (e salvar com a lista vazia volta o item a "sempre disponível").
- **RF-05:** Erros da API aparecem com a mensagem que ela devolve.

## Requisitos não funcionais

- **RNF-01:** Textos em português; dias por extenso (domingo a sábado).
- **RNF-02:** A tela passa no E2E de celular em 375 px.
- **RNF-03:** Nenhuma dependência nova.

## Regras de negócio

As da SPEC da API, repetidas na tela antes de enviar, com as mesmas mensagens:

- **RN-01:** horário `HH:MM` de `00:00` a `23:59`; o fim também aceita `24:00`. Mensagem: "Informe o horário no formato HH:MM."
- **RN-02:** início antes do fim. Mensagem: "O horário de início deve ser antes do fim."
- **RN-03:** janelas do mesmo dia não se sobrepõem; encostar pode. Mensagem: "As janelas de DIA se sobrepõem."
- **RN-04:** no máximo 28 janelas. Mensagem: "Cadastre no máximo 28 janelas por item."

## Critérios de aceitação verificáveis

- **CA-01:** Dado o modo navegador, a aba avisa que precisa do servidor.
- **CA-02:** Dado um item sem janelas, a aba mostra "Sempre disponível".
- **CA-03:** Quando incluo segunda 11:00–15:00 e uso **Repetir nos dias úteis**, então aparecem 5 janelas (segunda a sexta), e salvar envia as 5 em ordem.
- **CA-04:** Com início 15:00 e fim 11:00, ou duas janelas de segunda 11:00–15:00 e 14:00–16:00, a tela recusa com a mensagem da regra, sem enviar.
- **CA-05:** **Sempre disponível** seguido de **Salvar** envia `{ windows: [] }`.
- **CA-06:** Dado um erro da API, a mensagem aparece.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | horário, ordem, sobreposição, dias úteis | RN-01 a RN-04, RF-03 |
| T-02 | Componente | modo navegador; situação; incluir, repetir, salvar; inválidos; limpar; erro | CA-01 a CA-06 |
| T-03 | Celular 375 px | Cardápio | RNF-02 |

- **Camada de teste:** lógica pura e componente (Vitest e Testing Library).

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/horarios.ts`, `apps/web/app/horarios-panel.tsx` (novos), `apps/web/app/page.tsx`, `globals.css`.
- **Persistência / Backend / Stack / Deploy:** não mudam.

## Dependências e riscos

- **Riscos:** o "agora" da situação é o do servidor (P-2 da API), não o do aparelho.
- **Mitigações:** a tela mostra a situação que a API devolve, sem recalcular.

## Plano de implementação

1. Commit desta SPEC.
2. Lógica pura com testes.
3. Componente com testes.
4. Aba no Cardápio, estilos e documentação.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
