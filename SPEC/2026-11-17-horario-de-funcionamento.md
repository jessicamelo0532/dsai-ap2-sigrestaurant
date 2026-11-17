# Horário de funcionamento e reservas dentro do expediente

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #40 (backlog 2.23), `SPEC/2026-11-12-reservas-de-mesa.md`, P-1 de `SPEC/2026-11-17-tela-de-reservas.md`  
**Derroga:** `SPEC/2026-11-12-reservas-de-mesa.md`, só no ponto em que a reserva era aceita em qualquer horário: com horário de funcionamento cadastrado, a reserva precisa caber nele.

---

## Contexto e problema

Fatos comprovados em 2026-11-17:

- A issue #40 tem o critério "Reserva fora do horário de funcionamento é recusada".
- A SPEC da tela de reservas registrou que o sistema **não tem** cadastro de horário de funcionamento (P-1) e deixou esse critério como não verificável.
- A API já tem regras de janelas de dia e horário para o cardápio (`availability-rules.ts`: validação, fuso de Belém e formato), que servem igualmente para o horário da casa.

### Perguntas em aberto (decididas pela dupla, provisórias)

- **P-1:** a reserva precisa caber inteira no horário (início e fim) ou basta começar dentro dele? Provisório: inteira, dentro de uma mesma janela do dia.
- **P-2:** sem horário cadastrado, o que acontece? Provisório: a casa é considerada aberta em qualquer horário, como hoje (compatível com os dados que já existem).

## Objetivo

Cadastrar o horário de funcionamento da casa por dia da semana e recusar reservas que não cabem nele.

## Escopo

- **API:** tabela `OpeningHour` (dia, início e fim em minutos), com migração; rotas `GET/PUT /api/opening-hours`; criar, editar e buscar mesas livres para reserva passam a conferir o horário.
- **Tela (modo servidor):** botão **Horário de funcionamento** na seção Reservas, com o mesmo editor de janelas da aba Horários do cardápio.

## Fora do escopo

- Feriados e exceções por data.
- Bloquear lançamentos na comanda fora do horário.
- Modo navegador: o botão não aparece (as reservas já são só do modo servidor).

## Requisitos funcionais

- **RF-01:** `PUT /api/opening-hours` com `{ windows: [{ weekday, start, end }] }` troca todas as janelas (lista vazia volta a "sem horário cadastrado"). `GET` devolve as janelas em ordem, com o nome do dia.
- **RF-02:** Com horário cadastrado, `POST /api/reservations`, `PATCH /api/reservations/:id` (quando muda início ou duração) e `GET /api/reservations/availability` recusam a reserva que não cabe numa janela do dia.
- **RF-03:** A seção Reservas tem o botão **Horário de funcionamento**, que abre o editor (dia, início, fim, repetir nos dias úteis, sem horário) e salva.

## Requisitos não funcionais

- **RNF-01:** As janelas são validadas pelas mesmas regras do cardápio por horário (`parseWindows`), e o dia e a hora usam o mesmo fuso (`localMoment`, P-2 da SPEC do cardápio por horário).
- **RNF-02:** Trocar as janelas é uma transação.

## Regras de negócio

- **RN-01:** janelas como no cardápio por horário: dia de 0 a 6, `HH:MM`, início antes do fim, sem sobreposição no mesmo dia, até 28.
- **RN-02 (P-1):** a reserva cabe quando o início e o fim, no horário local, ficam dentro de uma mesma janela do dia do início (o fim pode ser igual ao fim da janela).
- **RN-03:** mensagens: "A casa não abre DIA." quando não há janela no dia; "A reserva fica fora do horário de funcionamento de DIA: das HH:MM às HH:MM." (com todas as janelas do dia, separadas por "e") quando há.
- **RN-04 (P-2):** sem janelas cadastradas, qualquer horário é aceito.

## Critérios de aceitação verificáveis

- **CA-01:** Com sexta das 18:00 às 23:00, uma reserva de sexta às 19:00 por 120 minutos é aceita.
- **CA-02:** Com o mesmo horário, sexta às 22:00 por 120 minutos (termina 24:00) é recusada com a mensagem de RN-03; sábado sem janela é recusado com "A casa não abre sábado."
- **CA-03:** A busca de mesas livres fora do horário é recusada com a mesma mensagem.
- **CA-04:** Editar uma reserva para um horário fora do expediente é recusado.
- **CA-05:** Sem horário cadastrado, as reservas continuam como antes (todos os testes de reservas existentes passam).
- **CA-06:** Na tela, o editor carrega, valida e salva as janelas com `PUT /opening-hours`.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Regras puras | caber, mensagens | RN-02, RN-03 |
| T-02 | PostgreSQL de teste | cadastrar horário; criar, editar e buscar | CA-01 a CA-05 |
| T-03 | Componente | carregar, validar, salvar | CA-06 |

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, migração, `apps/api/src/opening-hours/` (novo), `apps/api/src/reservations/reservations.service.ts`, `app.module.ts`, `apps/api/test/`; `apps/web/app/horario-funcionamento.tsx` (novo), `apps/web/app/reservas-panel.tsx`, `globals.css`.
- **Persistência:** tabela nova; nada existente muda.
- **Dependência de PR:** a tela usa `apps/web/lib/horarios.ts`, do PR #89 (tela de horários do cardápio). Esta branch parte da branch do #89; o #89 entra antes.

## Dependências e riscos

- **Riscos:** reservas já marcadas fora do horário novo.
- **Mitigações:** o horário só vale para criar e editar; as reservas existentes não mudam.

## Plano de implementação

1. Commit desta SPEC.
2. Schema, migração e regras puras com testes.
3. Serviço, rotas e conferência nas reservas, com testes de integração.
4. Editor na seção Reservas, com testes.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia, com P-1 e P-2 decididas pela dupla | aprovada |
