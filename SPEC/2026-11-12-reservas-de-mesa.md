# Reservas de mesa (API)

**Data:** 2026-11-12  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** nova (depende de `SPEC/2026-11-12-reativacao-backend.md`)  
**Derroga:** n/a (acrescenta uma regra à remoção de mesas, RN-09; nenhuma regra histórica muda)

---

## Contexto e problema

Fato comprovado em 2026-11-12: o Mesa Clara controla mesas, comandas, cardápio e despesas, mas não tem como registrar reservas. A especificação original (`SPEC/2026-10-01-restaurante.md`) não trata do assunto. Hoje o restaurante precisaria anotar reservas fora do sistema, sem saber se a mesa já está prometida para outra pessoa no mesmo horário.

Como FDE, a dupla propõe reservas como primeira funcionalidade nova do backend. É um módulo independente: usa as mesas existentes sem alterar comandas, cardápio, despesas ou relatório. Também serve de molde para os próximos módulos, separando o código em um módulo NestJS próprio em vez de crescer o `AppService`.

Esta SPEC cobre só a API. A tela de reservas no frontend depende da decisão de ligar o frontend à API (pendência P-1 da SPEC de reativação do backend).

### Perguntas em aberto (para o cliente)

Os valores abaixo são **provisórios**, escolhidos para o sistema funcionar. Ficam centralizados em constantes para mudar com uma linha quando o cliente responder:

- **P-1:** quanto tempo dura uma reserva por padrão? Provisório: 120 minutos, podendo variar de 30 a 360 por reserva.
- **P-2:** com quanta antecedência máxima se pode reservar? Provisório: 90 dias.
- **P-3:** o "dia" da agenda segue UTC, como o relatório financeiro atual, ou o horário de Belém (UTC−3)? Provisório: UTC, por coerência com o código existente.
- **P-4:** reserva para mais pessoas do que a capacidade da mesa deve ser recusada ou só avisada? Provisório: recusada.
- **P-5:** marcar a chegada do cliente deve abrir a comanda da mesa automaticamente? Provisório: não; fica para SPEC futura.

## Objetivo

Permitir agendar, consultar, remarcar e acompanhar reservas de mesa pela API, impedindo duas reservas ativas na mesma mesa em horários que se sobrepõem.

## Escopo

- Tabela `Reservation` no banco, com migração.
- Módulo NestJS `reservations` com rotas em `/api/reservations`.
- Consulta de mesas livres para um horário e tamanho de grupo.
- Regra nova na remoção de mesas (RN-09).
- `PrismaModule` compartilhado, para que o módulo novo e o atual usem a mesma conexão.
- Checagem no CI de que as migrações correspondem ao `schema.prisma`.

## Fora do escopo

- Telas no frontend.
- Abrir comanda automaticamente na chegada (P-5).
- Lembretes por mensagem, lista de espera, pagamento de sinal.
- Autenticação (fora de escopo permanente na spec original).

## Requisitos funcionais

- **RF-01:** `POST /api/reservations` cria reserva com mesa, nome do cliente, telefone (opcional), número de pessoas, início, duração (opcional) e observações (opcional).
- **RF-02:** `GET /api/reservations?date=AAAA-MM-DD` lista as reservas que começam no dia, em ordem de horário; aceita filtro opcional `status`.
- **RF-03:** `GET /api/reservations/:id` mostra uma reserva.
- **RF-04:** `PATCH /api/reservations/:id` remarca: muda mesa, horário, duração, pessoas, nome, telefone ou observações.
- **RF-05:** `POST /api/reservations/:id/seat` marca a chegada do cliente.
- **RF-06:** `POST /api/reservations/:id/cancel` cancela.
- **RF-07:** `POST /api/reservations/:id/no-show` marca que o cliente não compareceu.
- **RF-08:** `GET /api/reservations/availability?startsAt=...&partySize=...&durationMinutes=...` lista as mesas livres com capacidade suficiente, da menor para a maior capacidade.

## Requisitos não funcionais

- **RNF-01:** mensagens de erro em português, com status 400 para regra violada e 404 para registro inexistente.
- **RNF-02:** duas reservas simultâneas para a mesma mesa não podem passar juntas: a criação e a remarcação travam a linha da mesa durante a verificação.
- **RNF-03:** a reserva guarda o número da mesa; se a mesa for removida depois, o histórico continua legível (mesmo padrão das comandas).
- **RNF-04:** regras de tempo e capacidade ficam em funções puras, testáveis sem banco.

## Regras de negócio

- **RN-01:** a reserva tem status `BOOKED` (agendada), `SEATED` (cliente chegou), `CANCELLED` (cancelada) ou `NO_SHOW` (não compareceu). Toda reserva nasce `BOOKED`.
- **RN-02:** o fim da reserva é o início mais a duração. Duração padrão 120 minutos; permitida de 30 a 360 (P-1).
- **RN-03:** o início precisa ser no futuro e no máximo 90 dias à frente (P-2). Mensagens: "A reserva precisa começar no futuro." e "Só é possível reservar com até 90 dias de antecedência."
- **RN-04:** o número de pessoas não pode passar da capacidade da mesa (P-4). Mensagem: "A mesa N comporta no máximo C pessoas."
- **RN-05:** a mesma mesa não pode ter duas reservas ativas (`BOOKED` ou `SEATED`) com horários sobrepostos. Uma reserva que termina exatamente quando a outra começa não conta como sobreposição. Mensagem: "A mesa N já está reservada nesse horário."
- **RN-06:** só reservas `BOOKED` podem ser remarcadas, ter a chegada marcada, ser canceladas ou ser marcadas como falta. Mensagem: "Só reservas agendadas podem ser alteradas."
- **RN-07:** a chegada só pode ser marcada antes do fim da reserva ("O horário desta reserva já terminou."); a falta só depois do início ("Só é possível marcar falta depois do horário da reserva.").
- **RN-08:** ao remarcar, RN-02 a RN-05 valem de novo, sem contar a própria reserva como conflito.
- **RN-09:** mesa com reserva `BOOKED` que ainda não terminou não pode ser removida. Mensagem: "Esta mesa tem reservas agendadas. Cancele ou remarque antes de remover."
- **RN-10:** nome do cliente de 2 a 100 caracteres, sem espaços sobrando; telefone opcional com 8 a 20 caracteres entre dígitos, espaço, `+`, `-` e parênteses; observações até 500 caracteres; pessoas de 1 a 100.
- **RN-11:** datas de consulta no formato AAAA-MM-DD (dia em UTC, P-3); horários de início em ISO 8601 com fuso.

## Critérios de aceitação verificáveis

- **CA-01:** dada mesa livre, quando criar reserva válida, então ela volta com status `BOOKED`, fim calculado e número da mesa.
- **CA-02:** dada reserva ativa, quando criar outra sobreposta na mesma mesa, então recebe erro de RN-05; em outra mesa ou em horário encostado, a criação funciona.
- **CA-03:** quando violar RN-03, RN-04 ou RN-10, então recebe o erro correspondente e nada é gravado.
- **CA-04:** dada reserva agendada, quando marcar chegada, cancelar ou falta, então o status muda; uma segunda mudança é recusada (RN-06, RN-07).
- **CA-05:** quando remarcar respeitando as regras, então a reserva muda; quando a remarcação conflitar, nada muda.
- **CA-06:** quando consultar disponibilidade, então só aparecem mesas sem conflito e com capacidade suficiente, da menor para a maior.
- **CA-07:** dada mesa com reserva agendada futura, quando tentar removê-la, então recebe erro de RN-09; cancelada a reserva, a remoção funciona e a reserva mantém o número da mesa.
- **CA-08:** no CI, a checagem de migrações falha se o `schema.prisma` e as migrações divergirem.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | Calcular fim, sobreposição, janela, capacidade, transições | Resultados de RN-02 a RN-07 |
| T-02 | Mesa 1 livre | Criar reserva | CA-01 |
| T-03 | Reserva 19h–21h na mesa 1 | Criar 20h–22h na mesa 1; 21h–23h na mesa 1; 20h na mesa 2 | Primeira recusada, outras aceitas |
| T-04 | Reserva cancelada 19h–21h | Criar 19h na mesma mesa | Aceita (cancelada não bloqueia) |
| T-05 | Mesa de 2 lugares | Reservar para 3 | Erro RN-04 |
| T-06 | Relógio fixo | Reservar no passado e a 91 dias | Erros RN-03 |
| T-07 | Reservas em dias diferentes | Listar por dia e por status | Só as do dia, em ordem |
| T-08 | Reserva agendada | Chegada, cancelamento, falta, repetição | CA-04 |
| T-09 | Duas reservas | Remarcar uma para cima da outra; remarcar sem conflito | CA-05 |
| T-10 | Mesas de 2, 4 e 6 lugares, uma reservada | Disponibilidade para 3 pessoas | Só a de 6 ou a de 4 livre, em ordem |
| T-11 | Mesa com reserva futura | Remover mesa | CA-07 |
| T-12 | Dados fora dos limites | Validar DTOs | Erros de RN-10 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos os cenários. O relógio é injetável para testar regras de tempo sem depender da hora real.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/api/prisma/schema.prisma`, nova migração, `apps/api/src/prisma.module.ts` (novo), `apps/api/src/app.module.ts`, `apps/api/src/app.service.ts` (só RN-09 em `deleteTable`), `apps/api/src/reservations/` (novo), `apps/api/test/`, `.github/workflows/ci.yml`.
- **Persistência:** tabela nova; nenhuma coluna existente muda. Não afeta o `localStorage`.
- **Backend pausado:** segue sem publicação; o módulo novo entra no build e nos testes.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Dependências:** SPEC de reativação do backend (PR #2).
- **Riscos:** migração escrita à mão divergir do schema; regras provisórias não refletirem o restaurante real; fuso horário confundir o dia da agenda.
- **Mitigações:** CA-08 no CI; constantes centralizadas e perguntas P-1 a P-5 para o cliente; P-3 registrada.

## Plano de implementação

1. Schema, migração, `PrismaModule` e checagem de migrações no CI.
2. Regras puras com testes unitários.
3. Módulo NestJS (DTOs, serviço, controller) e RN-09.
4. Testes de integração.
5. Verificar CA-01 a CA-08; atualizar README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-12 | Criação e aprovação por Jéssica Lopes Melo, com regras provisórias P-1 a P-5 | aprovada |
