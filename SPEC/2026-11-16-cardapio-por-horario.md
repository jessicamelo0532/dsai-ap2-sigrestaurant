# Disponibilidade do cardápio por dia da semana e horário (API)

**Data:** 2026-11-16  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #28 (backlog 2.11)  
**Derroga:** em parte `SPEC/2026-10-01-restaurante.md`, no ponto em que a disponibilidade do item é só o interruptor `available`. Item com janelas cadastradas passa a depender também do dia e da hora. Item sem janela continua como hoje.

---

## Contexto e problema

Fato comprovado em 2026-11-16: o item do cardápio só tem o interruptor `available`. Um prato que só sai no almoço, ou um açaí que só é servido à noite, precisa ser pausado e reativado à mão todos os dias. A issue #28 pede janelas por dia da semana e faixa de horário, com o item aparecendo e podendo ser pedido só dentro delas.

### Perguntas em aberto (para o cliente)

- **P-1:** janela que vira a noite (22h às 2h)? Provisório: não existe; cadastra-se 22:00 às 24:00 de um dia e 00:00 às 02:00 do dia seguinte.
- **P-2:** qual fuso? Provisório: horário de Belém (UTC−3, sem horário de verão), o mesmo dos relatórios de vendas.

## Objetivo

Cadastrar, por item, as janelas de dia e horário em que ele é servido, mostrar no cardápio só o que está disponível agora e impedir que o garçom lance item fora da janela.

## Escopo

- Tabela `MenuAvailability` (janelas do item).
- Rotas `GET` e `PUT /api/menu-items/:id/availability`.
- `GET /api/menu-items` sem `all=true` passa a esconder também os itens fora da janela.
- `addOrderItem` confere a janela.
- Relógio injetável no `AppService` para os testes.

## Fora do escopo

- Telas no frontend.
- Feriados e datas especiais.
- Preço diferente por horário.

## Requisitos funcionais

- **RF-01:** `PUT /api/menu-items/:id/availability` com `{ windows: [{ weekday, start, end }] }` troca todas as janelas do item; lista vazia volta o item para "sempre disponível".
- **RF-02:** `GET /api/menu-items/:id/availability` devolve as janelas em ordem de dia e horário, com o nome do dia, e se o item está disponível agora.
- **RF-03:** `GET /api/menu-items` (sem `all=true`) mostra só itens com `available` ligado e, se tiverem janelas, dentro de uma delas agora.
- **RF-04:** lançar na comanda um item fora da janela é recusado, dizendo o próximo horário em que ele volta.

## Requisitos não funcionais

- **RNF-01:** a troca das janelas é feita numa transação: ou grava todas, ou nenhuma.
- **RNF-02:** a hora "agora" vem de um relógio injetável.

## Regras de negócio

- **RN-01:** `weekday` de 0 (domingo) a 6 (sábado). Mensagem: "Informe o dia da semana de 0 (domingo) a 6 (sábado)."
- **RN-02:** `start` e `end` no formato `HH:MM`, de `00:00` a `23:59`; `end` também aceita `24:00`. Mensagem: "Informe o horário no formato HH:MM."
- **RN-03:** o início vem antes do fim (P-1). Mensagem: "O horário de início deve ser antes do fim."
- **RN-04:** janelas do mesmo dia não podem se sobrepor; encostar (uma termina 15:00 e a outra começa 15:00) pode. Mensagem: "As janelas de <dia> se sobrepõem."
- **RN-05:** no máximo 28 janelas por item. Mensagem: "Cadastre no máximo 28 janelas por item."
- **RN-06:** item sem janela segue só o interruptor `available` (critério da issue).
- **RN-07:** item com janelas está disponível quando a hora local (P-2) está dentro de alguma janela do dia: início incluído, fim excluído.
- **RN-08:** fora da janela, a mensagem é "Este item não está disponível neste horário. Volta <dia> às HH:MM." O próximo horário é o próximo início de janela a partir de agora, olhando os 7 dias seguintes; "hoje" quando for no mesmo dia (critério da issue).

## Critérios de aceitação verificáveis

- **CA-01:** fora da janela, o item não entra na comanda e a mensagem diz quando volta (critério da issue).
- **CA-02:** item sem janela continua sempre disponível, na lista e na comanda (critério da issue).
- **CA-03:** a lista do cardápio esconde o item fora da janela e mostra dentro dela; com `all=true`, mostra todos.
- **CA-04:** os limites funcionam: no minuto de início está disponível, no minuto do fim não; a virada do dia usa o horário de Belém.
- **CA-05:** janelas inválidas ou sobrepostas são recusadas sem apagar as que já existiam.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Item só no almoço de segunda | Lançar às 16h | CA-01 |
| T-02 | Item sem janela | Listar e lançar a qualquer hora | CA-02 |
| T-03 | Itens com e sem janela | Listar dentro e fora | CA-03 |
| T-04 | Janela 11:00 às 15:00 | Relógio em 10:59, 11:00, 14:59, 15:00 e 02:00 UTC | CA-04 |
| T-05 | Item com janelas | Trocar por inválidas | CA-05 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/menu-availability/` (novo), `app.service.ts`, `app.module.ts`, `apps/api/test/`.
- **Frontend:** não muda enquanto nenhum item tiver janela.

## Dependências e riscos

- **Riscos:** item sumir do cardápio por fuso errado.
- **Mitigações:** fuso fixo documentado (P-2) e teste na virada do dia em UTC.

## Plano de implementação

1. Regras puras com testes.
2. Schema e migração.
3. Serviço, rotas e checagem no lançamento.
4. Testes de integração.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 e P-2 | aprovada |
| 2026-11-16 | CA-01 a CA-05 verificados na execução 43955102280 do GitHub Actions: 580 testes da API passando contra PostgreSQL 16, módulo com 97,2% das linhas cobertas e regras com 100%; checagem de migrações sem diferença. Mutações nas regras mortas pelos testes (duas sobreviventes ganharam casos novos). P-1 e P-2 seguem abertas | implementada |
