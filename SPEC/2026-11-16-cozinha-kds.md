# Envio para a cozinha, fila de produção, tempo de espera e prioridade (API)

**Data:** 2026-11-16  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issues #21 e #22 (backlog 2.4 e 2.5)  
**Derroga:** em parte `SPEC/2026-10-01-restaurante.md`, no ponto em que qualquer item de comanda aberta pode ter a quantidade mudada ou ser removido: item já enviado para a cozinha fica travado.

---

## Contexto e problema

Fato comprovado em 2026-11-16: o garçom só adiciona itens à comanda. Não existe envio para a cozinha, situação de preparo nem controle de tempo. A issue #21 pede o envio, a tela de produção (KDS) em ordem de chegada e a confirmação de preparo. A issue #22 pede o tempo desde o envio, com destaque por faixa de atraso, e a prioridade manual com registro de quem mudou.

### Perguntas em aberto (para o cliente)

- **P-1:** depois de enviar, a mesa pode pedir mais coisas (uma sobremesa, por exemplo)? Provisório: sim. Cada envio leva só os itens ainda não enviados e vira um pedido de cozinha separado. Os itens enviados ficam travados, como pede a issue #21.
- **P-2:** quais são as faixas de atraso? Provisório: no prazo até 10 minutos, atenção de 10 a 20 minutos e atrasado a partir de 20 minutos.
- **P-3:** o que acontece com o pedido de cozinha quando a comanda é cancelada? Provisório: os pedidos ainda não entregues saem da fila como cancelados.

## Objetivo

O garçom envia os itens da comanda para a cozinha, a cozinha vê a fila na ordem certa, com o tempo de espera de cada pedido, marca o preparo e a entrega, e pode subir a prioridade de um pedido dizendo quem mudou.

## Escopo

- Tabelas `KitchenTicket` (pedido de cozinha) e `KitchenPriorityChange` (histórico de prioridade), enums `KitchenTicketStatus` e `KitchenPriority`, campo `OrderItem.ticketId`.
- Módulo NestJS `kitchen` com as rotas:
  - `POST /api/orders/:id/kitchen` envia à cozinha os itens ainda não enviados;
  - `GET /api/orders/:id/kitchen` lista os pedidos de cozinha da comanda;
  - `GET /api/kitchen/queue` devolve a fila de produção;
  - `GET /api/kitchen/tickets/:id` devolve um pedido com o histórico de prioridade;
  - `POST /api/kitchen/tickets/:id/start`, `/ready` e `/deliver` mudam a situação;
  - `PUT /api/kitchen/tickets/:id/priority` muda a prioridade.
- Travas em `app.service.ts` (alterar e remover item, cancelar comanda) e em `order-moves` (junção leva os pedidos de cozinha junto).

## Fora do escopo

- A tela de KDS no frontend.
- Separar a fila por praça (bar, chapa, sobremesa).
- Aviso sonoro ou notificação ao garçom.

## Requisitos funcionais

- **RF-01:** `POST /api/orders/:id/kitchen` cria um pedido de cozinha com todos os itens da comanda que ainda não foram enviados, com a hora do envio e prioridade normal. Aceita uma observação opcional (até 200 caracteres), por exemplo "sem cebola".
- **RF-02:** `GET /api/kitchen/queue` lista os pedidos na fila (aguardando, em preparo e prontos), primeiro os de prioridade alta e, dentro de cada prioridade, por ordem de chegada. Cada pedido traz mesa, garçom, itens, minutos de espera e faixa de atraso. A resposta traz também um resumo com o total por situação e por faixa.
- **RF-03:** `start` muda de aguardando para em preparo; `ready` muda de aguardando ou em preparo para pronto; `deliver` muda de pronto para entregue. Cada mudança guarda a hora.
- **RF-04:** `PUT /api/kitchen/tickets/:id/priority` com `{ priority, changedBy }` muda a prioridade e grava no histórico quem mudou, de qual para qual e quando.
- **RF-05:** `GET /api/kitchen/tickets/:id` traz o pedido, os itens e o histórico de prioridade.
- **RF-06:** `GET /api/orders/:id/kitchen` traz os pedidos de cozinha da comanda e quantos itens ainda não foram enviados.

## Requisitos não funcionais

- **RNF-01:** o envio trava a comanda (`FOR UPDATE`) para dois envios simultâneos não mandarem o mesmo item duas vezes.
- **RNF-02:** as mudanças de situação e de prioridade travam o pedido de cozinha antes de conferir a situação.
- **RNF-03:** o relógio é injetável para os testes de tempo.

## Regras de negócio

- **RN-01:** só comanda aberta envia para a cozinha. Mensagem: "Só comandas abertas podem enviar pedidos para a cozinha."
- **RN-02:** sem item novo, o envio é recusado. Mensagem: "Não há itens novos para enviar à cozinha."
- **RN-03:** item já enviado não pode ter a quantidade mudada nem ser removido. Mensagem: "Este item já foi enviado para a cozinha e não pode ser alterado."
- **RN-04:** o tempo de espera conta do envio até o pedido ficar pronto; depois de pronto, o tempo para. Arredonda para baixo, em minutos inteiros.
- **RN-05:** faixas de atraso (P-2): `NO_PRAZO` abaixo de 10 minutos, `ATENCAO` de 10 a menos de 20, `ATRASADO` de 20 em diante.
- **RN-06:** transições fora da ordem são recusadas com a mensagem "Este pedido está <situação> e não pode <ação>.", por exemplo "Este pedido está entregue e não pode ficar pronto."
- **RN-07:** a prioridade é `NORMAL` ou `ALTA`; mudar para a mesma é recusado ("O pedido já está com essa prioridade."). Só pedidos na fila mudam de prioridade ("Só pedidos na fila podem mudar de prioridade."). Quem mudou é obrigatório, de 2 a 80 caracteres ("Informe quem mudou a prioridade, de 2 a 80 caracteres.").
- **RN-08:** ao cancelar a comanda, os pedidos de cozinha não entregues ficam cancelados e saem da fila (P-3).
- **RN-09:** ao juntar comandas, os pedidos de cozinha da origem passam para a comanda de destino; a fila mostra a mesa do destino.
- **RN-10:** a mesa mostrada na fila é sempre a mesa atual da comanda, então uma transferência aparece na hora para a cozinha.

## Critérios de aceitação verificáveis

- **CA-01:** dada uma comanda com itens, quando o garçom envia, então a cozinha vê o pedido na fila com os itens e a mesa (critério da #21).
- **CA-02:** dado um item enviado, quando alguém tenta mudar a quantidade ou remover, então a API recusa com a mensagem de RN-03; itens adicionados depois continuam editáveis e vão no próximo envio (critério da #21 e P-1).
- **CA-03:** a fila mostra os minutos de espera e a faixa certa nos limites 9, 10, 19 e 20 minutos; o tempo para quando o pedido fica pronto (critério da #22).
- **CA-04:** dados três pedidos, quando o último recebe prioridade alta, então ele passa para o topo da fila e o histórico mostra quem mudou (critério da #22).
- **CA-05:** as transições seguem RF-03 e as fora de ordem são recusadas; pedido entregue sai da fila.
- **CA-06:** cancelar a comanda tira os pedidos dela da fila; juntar comandas leva os pedidos para o destino; transferir a comanda muda a mesa na fila.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Comanda com 2 itens | Enviar, ver fila | CA-01 |
| T-02 | Item enviado | Alterar, remover, adicionar e enviar de novo | CA-02 |
| T-03 | Relógio controlado | Avançar 9, 10, 19, 20 min, marcar pronto | CA-03 |
| T-04 | Três pedidos | Prioridade alta no último | CA-04 |
| T-05 | Pedido na fila | Transições válidas e inválidas | CA-05 |
| T-06 | Pedidos enviados | Cancelar, juntar, transferir | CA-06 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/kitchen/` (novo), `app.service.ts`, `order-moves.service.ts`, `app.module.ts`, `apps/api/test/`.
- **Frontend:** não muda. Os itens continuam editáveis enquanto ninguém usar a rota de envio.

## Dependências e riscos

- **Riscos:** enviar o mesmo item duas vezes; a cozinha preparar pedido de comanda cancelada.
- **Mitigações:** trava da comanda no envio (RNF-01) e cancelamento dos pedidos junto com a comanda (RN-08).

## Plano de implementação

1. Regras puras com testes.
2. Schema e migração.
3. Serviço, rotas e travas nos módulos existentes.
4. Testes de integração.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 a P-3 | aprovada |
