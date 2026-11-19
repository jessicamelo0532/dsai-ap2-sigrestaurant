# Módulos da API para mesas, comandas, cardápio, despesas e relatórios

**Data:** 2026-11-18  
**Status:** aprovada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** SPEC/2026-11-12-reativacao-backend.md  
**Derroga:** n/a

---

## Contexto e problema

As issues #42 e #43 pedem módulos NestJS para mesas, comandas, cardápio, despesas, relatórios e caixa, com o contrato de API espelhando as rotas usadas pelo frontend. Fato comprovado em 2026-11-18: caixa já tem módulo próprio (`cash/`), mas as rotas de mesas, comandas, cardápio, despesas e relatório financeiro continuam concentradas em `app.controller.ts` + `app.service.ts`, que também são instanciados diretamente pelos testes. Não há mudança de comportamento pedida: o contrato HTTP e as regras existentes permanecem iguais.

### Perguntas em aberto

- Nenhuma. A issue define o escopo como separação em módulos com o mesmo contrato.

## Objetivo

Separar a API em módulos de domínio, mantendo exatamente as mesmas rotas, validações e respostas, e manter a suíte de integração passando.

## Escopo

- `tables/`: serviço, controller e módulo para `GET/POST/DELETE /api/tables` e `POST /api/tables/:id/items`.
- `menu/`: serviço, controller e módulo para `GET/POST/PATCH/DELETE /api/menu-items`.
- `orders/`: serviço, controller e módulo para `GET /api/orders/open`, `GET /api/orders/:id`, `PATCH/DELETE /api/orders/:id/items/:itemId`, `POST /api/orders/:id/close` e `POST /api/orders/:id/cancel`.
- `expenses/`: serviço, controller e módulo para `GET/POST/PATCH/DELETE /api/expenses`.
- `reports/`: serviço, controller e módulo para `GET /api/reports/financial`.
- `AppModule` importa os cinco módulos novos; `app.controller.ts` e `app.service.ts` deixam de existir.
- Testes de integração continuam usando os serviços de domínio por meio de `test/support/database.ts`.

## Fora do escopo

- Mudar qualquer contrato, mensagem, validação ou regra de negócio.
- Reativar o frontend contra a API ou alterar a persistência `localStorage`.
- Módulo de caixa (já existe em `cash/`).

## Requisitos funcionais

- **RF-01:** As rotas de mesas ficam em `TablesController` e continuam respondendo no mesmo caminho e formato.
- **RF-02:** As rotas de cardápio ficam em `MenuController`, incluindo o filtro `?all=true` e a janela de disponibilidade.
- **RF-03:** As rotas de comandas ficam em `OrdersController`, com a mesma ordem de declaração (para `orders/open` não ser capturada por `orders/:id`).
- **RF-04:** As despesas ficam em `ExpensesController` e o relatório financeiro em `ReportsController`.
- **RF-05:** Cada módulo é registrado em `AppModule` e não declara rota repetida.

## Requisitos não funcionais

- **RNF-01:** A suíte de integração da API continua passando sem alteração de expectativas.
- **RNF-02:** O teste `modulos.test.ts` continua cobrindo que todo módulo e controller da pasta `src` está ligado à aplicação.
- **RNF-03:** Nenhuma dependência nova.

## Regras de negócio

- Nenhuma regra muda. Valem as SPECs já implementadas: `2026-11-12-reativacao-backend.md`, `2026-11-13-estoque-de-ingredientes.md`, `2026-11-16-cardapio-por-horario.md`, `2026-11-16-categorias-do-cardapio.md`, `2026-11-16-cozinha-kds.md`, `2026-11-16-programa-de-fidelidade.md`, `2026-11-16-delivery.md`, `2026-11-17-zonas-do-salao.md`.

## Critérios de aceitação verificáveis

- **CA-01:** Dado o frontend atual, quando ele chama qualquer rota de mesas, comandas, cardápio, despesas ou relatório, então a rota existe no mesmo caminho e devolve o mesmo contrato.
- **CA-02:** Dado um build da API, quando o `AppModule` é carregado, então os cinco módulos novos estão registrados e nenhum controller ficou órfão.
- **CA-03:** Dado o PostgreSQL de teste, quando a suíte de integração roda, então as expectativas de abertura, edição e fechamento de comanda continuam passando.
- **CA-04:** Dado o teste de rotas duplicadas, quando ele lê os metadados do Nest, então não há rota declarada duas vezes.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | AppModule carregado | ler importações e controllers | cinco módulos novos registrados; nenhum órfão |
| T-02 | PostgreSQL de teste | abertura, edição e fechamento de comanda | mesmas respostas e efeitos |
| T-03 | PostgreSQL de teste | CRUD de despesas e relatório | mesmos valores e mensagens |
| T-04 | Metadados do Nest | listar rotas | nenhuma rota repetida |

- **Camada de teste:** API (integração e estrutura de módulos)
- **Framework:** Vitest (já configurado)
- **Automação prevista:** `apps/api/test/modulos.test.ts` e suíte existente em `apps/api/test/`

## Impactos na arquitetura

- **Camadas tocadas:** `apps/api/src/tables/`, `menu/`, `orders/`, `expenses/`, `reports/` (novos); `apps/api/src/app.module.ts`; remoção de `app.controller.ts` e `app.service.ts`; `apps/api/test/support/database.ts` e `cardapio-horario.test.ts`.
- **Persistência:** não muda schema nem dados.
- **Backend pausado:** é o próprio backend; o contrato espelhado pelo frontend não muda.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build do frontend; o CI da API continua igual.

## Dependências e riscos

- **Dependências:** PostgreSQL de teste; issues #42 e #43.
- **Riscos:** alterar a ordem das rotas (`orders/open` × `orders/:id`), esquecer um módulo no `AppModule` ou quebrar a injeção do `MENU_CLOCK`. Mitigado por `modulos.test.ts` e pela suíte de integração.
