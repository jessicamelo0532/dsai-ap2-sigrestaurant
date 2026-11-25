# Tela de delivery: pedidos, itens, taxa e acompanhamento

**Data:** 2026-11-25  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** `SPEC/2026-11-16-delivery.md` (API), issue #41 (backlog 2.24)  
**Derroga:** n/a — não muda regra da API; apenas expõe as rotas que já existem.

---

## Contexto e problema

Fato comprovado em 2026-11-25: o módulo de delivery da API está implementado e testado (`POST/GET/PATCH /api/delivery-orders`, itens, `dispatch`, `delivered`), mas **nenhuma tela o usa**. A SPEC da API deixou "telas no frontend" explicitamente fora do escopo. No app publicado, um pedido de entrega só pode ser criado por chamada direta à API.

O usuário pediu, em 2026-11-25, para começar a implementar mais telas com volume, e escolheu a tela de Delivery como primeira frente.

### Perguntas em aberto

- nenhuma. As regras de negócio são as da SPEC `2026-11-16-delivery.md`; decisões de interface estão registradas nesta SPEC.

## Objetivo

Dar ao operador uma seção **Delivery** no app que cria, acompanha, edita, envia à cozinha, paga e cancela pedidos de entrega, com os mesmos limites e mensagens da API.

## Escopo

- Nova seção **Delivery** na navegação lateral, entre **Cozinha** e **Reservas**.
- Lista de pedidos com filtros por situação (ativos, recebidos, saiu para entrega, entregues, cancelados) e resumo de contagens.
- Formulário de novo pedido: destinatário, endereço, telefone opcional, taxa e cliente opcional (busca no cadastro).
- Detalhe do pedido: itens com variação/adicionais, quantidades, subtotal, desconto, taxa e total.
- Ações: editar dados (enquanto recebido e aberto), enviar à cozinha, sair para entrega, marcar entregue, pagar e cancelar.
- Aviso no modo navegador de que o delivery precisa do servidor, no mesmo padrão das telas de Caixa/Clientes.
- Testes de regras puras e de componente.
- Documentação no `README.md`.

## Fora do escopo

- Cálculo de taxa por bairro/distância, entregadores e rotas (já fora da SPEC da API).
- Integração com aplicativos de entrega.
- Resgate de pontos de fidelidade e troca de garçom na tela (continuam nas rotas da comanda; o pagamento credita os pontos normalmente).
- Alterar regras, rotas ou schema da API.
- Modo navegador/local: o delivery continua exclusivo do modo servidor.

## Requisitos funcionais

- **RF-01:** a seção **Delivery** lista os pedidos ativos por padrão e permite filtrar por `RECEIVED`, `OUT_FOR_DELIVERY`, `DELIVERED` e `CANCELLED`, usando `GET /api/delivery-orders?status=`.
- **RF-02:** o botão **Novo pedido** abre o formulário com destinatário, endereço, telefone opcional, taxa e cliente opcional, e chama `POST /api/delivery-orders`.
- **RF-03:** o detalhe mostra os itens e os valores devolvidos pela API (`subtotal`, `discount`, `deliveryFee`, `total`), sem recalcular no navegador.
- **RF-04:** o detalhe permite lançar item do cardápio com quantidade e, quando o item tiver opções, escolher variação e adicionais; chama `POST /api/delivery-orders/:id/items`.
- **RF-05:** o detalhe permite alterar a quantidade e remover item enquanto o pedido está aberto, usando `PATCH/DELETE /api/orders/:id/items/:itemId`.
- **RF-06:** o detalhe permite editar destinatário, endereço, telefone e taxa enquanto o pedido está `OPEN` e `RECEIVED`, usando `PATCH /api/delivery-orders/:id`.
- **RF-07:** o detalhe permite enviar à cozinha (`POST /api/orders/:id/kitchen`), pagar (`POST /api/orders/:id/close`), cancelar (`POST /api/orders/:id/cancel`), sair para entrega (`POST /api/delivery-orders/:id/dispatch`) e marcar entregue (`POST /api/delivery-orders/:id/delivered`).
- **RF-08:** cada pedido mostra situação da entrega, hora de abertura e, quando houver, hora da saída e da entrega.
- **RF-09:** o modo navegador mostra um aviso de que o delivery precisa do servidor, com o botão de conexão quando houver `NEXT_PUBLIC_API_URL`.

## Requisitos não funcionais

- **RNF-01:** mensagens em pt-BR; as mensagens de erro da API são exibidas como vêm.
- **RNF-02:** a tela não faz polling; atualiza ao abrir, ao trocar de filtro e depois de cada ação.
- **RNF-03:** nenhuma chamada à API é feita no modo navegador.
- **RNF-04:** layout responsivo, sem ampliar a página em 375 px.

## Regras de negócio

- **RN-01:** destinatário de 2 a 80 caracteres; endereço de 5 a 200; telefone opcional com 10 ou 11 dígitos; taxa de R$ 0,00 a R$ 100,00 com até 2 casas. Mensagens idênticas às da API (`2026-11-16-delivery.md`, RN-01 a RN-03).
- **RN-02:** a entrega segue `RECEIVED` → `OUT_FOR_DELIVERY` → `DELIVERED`; a tela só oferece a ação válida para a situação atual.
- **RN-03:** editar dados só é oferecido com pedido aberto e ainda recebido; pagar e cancelar só com pedido aberto.
- **RN-04:** o total exibido é o da API, que soma a taxa de entrega; a tela não inventa total.
- **RN-05:** o pedido de delivery não aparece no Salão nem na lista de comandas abertas; a tela usa somente as rotas de delivery.

## Critérios de aceitação verificáveis

- **CA-01:** dado um pedido com itens e taxa, quando o detalhe abre, então mostra subtotal, taxa e total iguais aos da API, com o total somando a taxa.
- **CA-02:** dado um pedido recém-criado (`RECEIVED`), quando o operador clica em **Saiu para entrega**, então a situação muda e a ação de **Entregue** passa a aparecer.
- **CA-03:** dado um pedido já saído, quando o detalhe abre, então **Editar dados** não é oferecido.
- **CA-04:** dado um formulário com destinatário curto, endereço curto ou taxa acima de R$ 100,00, quando o operador salva, então a mensagem da API é exibida e nenhuma chamada de criação é feita.
- **CA-05:** no modo navegador, a seção mostra o aviso de servidor e não faz requisição.
- **CA-06:** quando `npm test` roda, então os testes de `lib/delivery.ts` e do painel passam.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Modo servidor com um pedido de delivery | Abrir a seção e o detalhe | Itens, taxa e total da API (CA-01) |
| T-02 | Pedido recebido | Clicar em Saiu para entrega | Situação muda e Entregue aparece (CA-02) |
| T-03 | Pedido saído | Abrir o detalhe | Sem Editar dados (CA-03) |
| T-04 | Formulário inválido | Salvar | Mensagem e nenhuma criação (CA-04) |
| T-05 | Modo navegador | Abrir a seção | Aviso, sem fetch (CA-05) |
| T-06 | Suíte do frontend | `npm test` | Testes novos verdes (CA-06) |

- **Camada de teste:** regras puras (`lib/delivery.ts`) e componente (`delivery-panel.tsx`).
- **Framework:** Vitest + Testing Library, o mesmo do repositório.
- **Automação prevista:** T-01 a T-06 em testes automatizados com `stubApi`.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/delivery.ts` (novo), `apps/web/lib/delivery.test.ts` (novo), `apps/web/app/delivery-panel.tsx` (novo), `apps/web/app/delivery-panel.test.tsx` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/app/escolher-opcoes.tsx` (prop opcional de rota), `README.md`, `docs/issues/backlog.md`.
- **Persistência:** não muda o `localStorage`; a tela só existe no modo servidor.
- **Backend pausado:** não toca na API; consome as rotas já implementadas.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build além do novo código.

## Dependências e riscos

- **Dependências:** API de delivery no ar (Render) para uso real; sem ela, a tela fica indisponível como as demais telas de servidor.
- **Riscos:** divergir das mensagens da API; oferecer ação inválida para a situação; total calculado no cliente diferente do servidor.
- **Mitigações:** validação espelhando a API, ações derivadas da situação devolvida e total sempre lido da resposta.

## Plano de implementação

1. Criar esta SPEC.
2. Implementar `lib/delivery.ts` e os testes de regras.
3. Implementar `delivery-panel.tsx` e os testes de componente.
4. Integrar a seção na navegação e no `page.tsx`; ajustar `EscolherOpcoes` para rota configurável.
5. Estilos em `globals.css`.
6. Rodar `npm test`, `npm run build` e registrar os resultados.
7. Atualizar `README.md`, backlog, status e histórico desta SPEC.
8. Commit com `Agent:` e `Spec:`.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-25 | Criação da SPEC com decisão humana de implementar a tela de Delivery | aprovada |
| 2026-11-25 | Implementação concluída: `lib/delivery.ts`, painel, integração na navegação, estilos e testes. `npm test` 604 testes em 51 arquivos, todos verdes; cobertura de linhas 89,55%; `npm run build` verde. CA-01 a CA-06 cobertos pelos testes de regras e de componente (T-01 a T-06). | implementada |
