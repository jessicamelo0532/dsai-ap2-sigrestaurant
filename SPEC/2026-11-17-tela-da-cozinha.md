# Tela da cozinha (KDS) no frontend

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** opencode/minimax-m3.1-flash-free  
**SPEC derivada de:** issues #21 e #22 (backlog 2.4 e 2.5), concluindo o que a `SPEC/2026-11-16-cozinha-kds.md` deixou fora do escopo ("a tela de KDS no frontend")  
**Depende de:** `SPEC/2026-11-16-cozinha-kds.md` (API), `SPEC/2026-11-14-frontend-em-modo-api.md` (modos de operação)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API da cozinha está pronta e testada (envio, fila, situações, prioridade), mas **nenhuma tela usa essas rotas**. O garçom não consegue enviar o pedido pela interface e a cozinha não tem onde ver a fila. A `SPEC/2026-11-16-cozinha-kds.md` declarou explicitamente a tela como fora do escopo.

### Perguntas em aberto (para o cliente)

- **P-1:** de quanto em quanto tempo a tela da cozinha se atualiza? Provisório: 15 s, o mesmo tipo de escolha da tela Salão (30 s).
- **P-2:** a cozinha precisa de aviso sonoro quando entra pedido? Provisório: não; a tela destaca o pedido novo com a cor da faixa de espera.
- **P-3:** o garçom deve poder escrever a observação ("sem cebola") na hora de enviar? Provisório: sim, campo opcional no envio, como a API já aceita.

## Objetivo

O garçom envia os itens da comanda para a cozinha pela interface, e a cozinha acompanha a fila na ordem certa, com tempo de espera, faixa de atraso, prioridade e as ações de preparo e entrega.

## Escopo

- Nova seção **Cozinha** no menu, com a fila de produção.
- Botão **Enviar para a cozinha** na comanda aberta (Visão geral).
- Lógica pura em `apps/web/lib/cozinha.ts` e testes em `apps/web/lib/cozinha.test.ts`.
- Painel em `apps/web/app/cozinha-panel.tsx`, ligado em `apps/web/app/page.tsx`.
- Estilos em `apps/web/app/globals.css`, seguindo as regras de celular da `SPEC/2026-11-16-app-no-celular.md`.

## Fora do escopo

- Mudar a API: as rotas, regras e mensagens já estão na `SPEC/2026-11-16-cozinha-kds.md`.
- Reimplementar no frontend as regras de negócio da cozinha (transições, prioridade, trava de item enviado): o frontend só **exibe** o que a API devolve e **repassa** as mensagens de erro dela.
- Separação da fila por praça, aviso sonoro e impressão de cupom (issues #23 e 2.6).

## Requisitos funcionais

- **RF-01:** a seção Cozinha mostra a fila de `GET /api/kitchen/queue`, com o resumo (total, aguardando, em preparo, prontos, alta prioridade, atrasados) e um cartão por pedido com: mesa ou delivery, garçom, itens (quantidade, nome e adicionais), observação, minutos de espera, faixa de atraso e prioridade.
- **RF-02:** cada cartão mostra só as ações permitidas pela situação (`RF-03` da SPEC da API): aguardando → "Iniciar preparo" e "Pronto"; em preparo → "Pronto"; pronto → "Entregue".
- **RF-03:** as ações chamam `POST /api/kitchen/tickets/:id/start`, `/ready` e `/deliver`, e a tela se atualiza depois.
- **RF-04:** o cartão permite marcar prioridade alta ou normal (`PUT /api/kitchen/tickets/:id/priority`), exigindo "quem mudou" com 2 a 80 caracteres antes de enviar.
- **RF-05:** o botão "Enviar para a cozinha" na comanda aberta chama `POST /api/orders/:id/kitchen` com observação opcional de até 200 caracteres e mostra a mensagem de sucesso ou a da API.
- **RF-06:** a tela se atualiza sozinha a cada 15 s (P-1) e tem botão de atualizar manualmente.
- **RF-07:** filtros Todas, Aguardando, Em preparo, Prontos, Atrasados e Alta prioridade, com contagem em cada um.
- **RF-08:** no **modo navegador** (`localStorage`), a seção Cozinha mostra um aviso de que a fila de produção existe apenas no modo servidor, com o botão de conectar quando a API estiver configurada — não chama rota inexistente.

## Requisitos não funcionais

- **RNF-01:** a lógica de formatação, faixas, filtros, ordenação e validação fica em `lib/cozinha.ts`, sem React, e é coberta por testes.
- **RNF-02:** o painel não quebra com fila vazia, pedido sem garçom e pedido de delivery (mesa 0).
- **RNF-03:** botões e textos seguem os tamanhos mínimos do celular (44 px e 14 px).

## Regras de negócio

- **RN-01:** as faixas de atraso exibidas são as da API: no prazo até 9 min, atenção de 10 a 19, atrasado a partir de 20 (RN-05 da SPEC da API). O frontend calcula a faixa apenas para o cartão que a API não mandar; quando vier, usa a da API.
- **RN-02:** o tempo de espera é o da API (`waitingMinutes`); o frontend só formata.
- **RN-03:** "quem mudou" com menos de 2 ou mais de 80 caracteres é recusado **antes** do envio, com a mesma mensagem da API: "Informe quem mudou a prioridade, de 2 a 80 caracteres."
- **RN-04:** observação com mais de 200 caracteres é recusada antes do envio: "A observação pode ter até 200 caracteres."
- **RN-05:** pedido pronto não conta como atrasado no resumo (mesma regra da API).
- **RN-06:** a ordem exibida é a da API (prioridade alta primeiro, depois chegada). O frontend reordena de forma defensiva com a mesma regra.

## Critérios de aceitação verificáveis

- **CA-01:** dada uma comanda com itens no modo servidor, quando o garçom clica em "Enviar para a cozinha", então o pedido aparece na seção Cozinha com mesa, itens e tempo (critério da issue #21).
- **CA-02:** os cartões mostram só as ações permitidas em cada situação e, ao acionar, a situação muda na tela.
- **CA-03:** o resumo e as faixas batem com os limites 9/10/19/20 minutos; pedido pronto não entra em atrasados (critério da issue #22).
- **CA-04:** marcar prioridade alta com "quem mudou" sobe o pedido para o topo; sem o nome, o envio é bloqueado com a mensagem da RN-03 (critério da issue #22).
- **CA-05:** no modo navegador, a seção Cozinha mostra o aviso do RF-08 e não faz requisição.
- **CA-06:** filtros e contagens conferem com a fila exibida.

## Cenários de teste

- `lib/cozinha.test.ts`: faixas nos limites 0, 9, 10, 19, 20 e 120; formatação de espera (agora, minutos, horas); rótulos de situação, prioridade e canal; mesa 0 como Delivery; ações por situação; validação de "quem mudou" (vazio, 1, 2, 80, 81) e de observação (200, 201); ordenação defensiva (prioridade e chegada); resumo (pronto fora de atrasados, alta prioridade); filtros e contagens; itens com e sem adicionais.
- Verificação manual no navegador em 1366 px e 375 px (fila vazia, fila com pedido, ação de preparo e prioridade).

## Histórico de verificação

**Implementação (2026-11-17, `opencode/minimax-m3.1-flash-free`):**

- `apps/web/lib/cozinha.ts` com as funções puras; `apps/web/app/cozinha-panel.tsx` com o painel; seção e botão de envio em `page.tsx`; estilos em `globals.css`.
- `apps/web/lib/cozinha.test.ts`: **26 casos** novos (faixas nos limites 0/9/10/19/20/120, formatação, rótulos, mesa 0 como Delivery, ações por situação, validações 1/2/80/81 e 200/201, ordenação, resumo, filtros e contagens, cartões). Suíte do frontend: **74 testes**.
- `npm run build` (Next 16) verde; `npm run e2e:celular` com a tela Cozinha incluída: 10 telas dentro dos limites em 375 px.
- Verificação no navegador (Chrome headless, 1366 px, modo servidor): envio pela comanda com observação "sem gelo" → cartão "Mesa 88" com a observação; "Iniciar preparo" muda para **Em preparo** e as ações passam a "Pronto" e "Marcar alta"; "Marcar alta" com "Cozinha" mostra o selo **Alta** e o resumo passa a "Alta prioridade 1".
- Verificação da API no fluxo completo (curl): envio → fila → `start`/`ready`/`deliver` (201) → fila vazia; transição fora de ordem recusada com a mensagem da RN-06.
- Modo navegador: a seção mostra o aviso do RF-08 sem fazer requisição (verificado no e2e, que roda o build sem `NEXT_PUBLIC_API_URL`).

**Pendências:** P-1 (intervalo de 15 s), P-2 (sem aviso sonoro) e P-3 (observação no envio) seguem como decisões provisórias para o cliente.
