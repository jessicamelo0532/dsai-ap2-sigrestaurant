# Tela de reservas de mesa (issue 2.23)

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** issue #40 (backlog 2.23)  
**SPEC da API:** [`2026-11-12-reservas-de-mesa.md`](2026-11-12-reservas-de-mesa.md)  
**Derroga:** nada. Consome as rotas já implementadas.

---

## Contexto e problema

Fato comprovado: a API de reservas (`GET/POST/PATCH /api/reservations`, `/seat`, `/cancel`, `/no-show`, `/availability`) está implementada e testada, mas **nenhuma tela a usa**. A issue #40 pede registro de reservas, indicação de conflito, conversão em comanda e recusa fora do horário de funcionamento.

### Perguntas em aberto (para o cliente)

- **P-1 (da issue, sem definição):** "Reserva fora do horário de funcionamento é recusada." O sistema **não tem** cadastro de horário de funcionamento (existe `menu-availability`, mas é do cardápio, não da abertura da casa). A API hoje recusa passado e mais de 90 dias à frente, mas não um horário "fechado". **Esta tela não implementa** essa recusa; a mensagem virá da API se/quando o horário for definido. Critério da issue **não verificável** sem a definição do horário.
- **P-2 (da issue, sem definição):** "A reserva convertida gera comanda com os mesmos itens." Uma reserva não tem itens (nome, pessoas, mesa, horário). A API de assentar só muda o status para `SEATED` (P-5 da SPEC da API: não abre comanda automaticamente). **Esta tela** implementa a conversão como: ao assentar, a equipe pode **abrir a mesa na Visão geral** para lançar o primeiro item (a comanda é criada ao lançar o item, regra já existente). **Não** cria comanda com itens, porque não há itens na reserva. Critério da issue **não verificável** como escrito sem definição do que seriam "os mesmos itens".
- **P-3:** no modo navegador não existe agenda compartilhada. Provisório: a tela mostra aviso e não chama a API (mesmo padrão da Cozinha).

## Objetivo

Dar à equipe uma tela para ver a agenda do dia, criar reservas escolhendo mesa livre, remarcar/assentar/cancelar/marcar falta e, após assentar, levar a equipe à mesa para abrir a comanda.

## Escopo

- Nova seção **Reservas** na navegação (`apps/web/app/reservas-panel.tsx`).
- Lista por dia (AAAA-MM-DD) com filtro por situação.
- Criar reserva: nome, telefone, pessoas, início, duração e mesa escolhida a partir da disponibilidade.
- Ações: assentar, cancelar, marcar falta; após assentar, botão para abrir a mesa na Visão geral.
- Lógica pura em `apps/web/lib/reservas.ts`, com testes.

## Fora do escopo

- Recusa por horário de funcionamento (P-1).
- Criar comanda com itens ao converter (P-2).
- Lembretes, lista de espera, pagamento de sinal.
- Edição completa de reserva na tela (a API suporta PATCH; nesta tela fica só criar e mudar situação, para manter o escopo enxuto).

## Requisitos funcionais

- **RF-01:** listar as reservas do dia escolhido, em ordem de horário, com mesa, cliente, pessoas, horário e situação.
- **RF-02:** filtrar a lista por situação (todas, agendadas, cliente chegou, canceladas, faltas).
- **RF-03:** criar reserva informando nome, pessoas, início e mesa; telefone, duração e observações são opcionais.
- **RF-04:** buscar mesas livres para o início e o número de pessoas informados (`GET /api/reservations/availability`) e permitir escolher uma.
- **RF-05:** assentar, cancelar e marcar falta chamam as rotas correspondentes; a lista recarrega.
- **RF-06:** após assentar, mostrar ação "Abrir comanda" que leva à Visão geral com a mesa da reserva selecionada (P-2, conversão parcial).
- **RF-07:** erros da API (conflito, capacidade, janela, mensagens de regra) aparecem na tela.
- **RF-08:** no modo navegador a tela mostra aviso e não chama a API.

## Requisitos não funcionais

- **RNF-01:** validações locais simples (nome, pessoas, início preenchido) antes de chamar a API, sem duplicar todas as regras de tempo (a API é a fonte final).
- **RNF-02:** ações desabilitam botões durante a requisição.
- **RNF-03:** funciona em 375 px.
- **RNF-04:** lógica pura e componente têm teste.

## Regras de negócio

- **RN-01:** situação exibida por extenso: BOOKED "Agendada", SEATED "Cliente chegou", CANCELLED "Cancelada", NO_SHOW "Não compareceu".
- **RN-02:** duração padrão 120 min; opções 30–360 em passos de 30 (espelhando a API).
- **RN-03:** só reservas agendadas (BOOKED) oferecem assentar/cancelar/falta (espelhando RN-06 da API).
- **RN-04:** para buscar disponibilidade é preciso início e número de pessoas válidos.

## Critérios de aceitação verificáveis

- **CA-01:** a lista do dia mostra as reservas com situação e horário, e os filtros funcionam.
- **CA-02:** criar reserva com mesa livre a grava e ela aparece na lista (verificado na API real).
- **CA-03:** conflito de horário devolvido pela API é mostrado na tela (mensagem da RN-05 da API).
- **CA-04:** assentar/cancelar/falta mudam a situação; após assentar aparece "Abrir comanda" que seleciona a mesa na Visão geral.
- **CA-05:** no modo navegador não há requisições.
- **CA-06:** `npm test`, `npm run build` e `npm run e2e:celular` verdes.
- **CA-NV-01 (issue #40, não verificável):** recusa fora do horário de funcionamento — depende de P-1.
- **CA-NV-02 (issue #40, não verificável):** conversão gerando comanda com os mesmos itens — depende de P-2.

## Cenários de teste

- Lógica: rótulos de situação, formatação de horário, filtro, ações permitidas, opções de duração, validação de criação, montagem do payload.
- Componente: lista, filtro, criar com disponibilidade, erro de conflito, assentar e abrir comanda, cancelar/falta, modo navegador.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/reservas.ts`, `apps/web/app/reservas-panel.tsx`, `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`.
- **API:** nenhuma mudança.

## Dependências e riscos

- **Risco:** agenda UTC vs local (P-3 da SPEC da API). Mitigação: a tela envia e pede datas em UTC como a API espera, mas mostra horários no fuso do aparelho; fica documentado.
- **Risco:** disponibilidade consulta um instante; outra reserva pode entrar antes do envio. Mitigação: a API é a autoridade e devolve conflito (CA-03).

## Plano de implementação

1. `lib/reservas.ts` + testes.
2. `reservas-panel.tsx` + testes.
3. Seção na navegação e e2e.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação a partir da issue #40 e da SPEC da API, com P-1 a P-3; CA-NV-01/02 abertos | rascunho |
| 2026-11-17 | Implementada (parcial quanto à issue #40). `npm test` 178 testes em 15 arquivos (15 `lib/reservas.ts` + 8 `reservas-panel.test.tsx` novos), todos passando; build verde; e2e com tela "Reservas". CA-01/02/03/04/05/06 verificados (lista/filtro, criar com disponibilidade, erro de conflito da API, assentar→abrir comanda, cancelar/falta, modo navegador). **CA-NV-01** (recusa fora do horário de funcionamento) e **CA-NV-02** (conversão gerando comanda com os mesmos itens) permanecem abertos — dependem de decisão do cliente (P-1/P-2); a issue #40 não é fechada | implementada |
