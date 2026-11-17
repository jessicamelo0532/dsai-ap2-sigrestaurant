# Mesa Clara

Sistema de restaurante para administrar mesas, pedidos, cardápio e despesas. O produto publicado é o frontend Next.js: os dados ficam no `localStorage` do navegador. A API NestJS com Prisma e PostgreSQL voltou ao workspace e é compilada e testada no CI, mas ainda não é publicada — a ligação do frontend com a API é SPEC própria, pendente de decisão da dupla (SPEC [`2026-11-12-reativacao-backend.md`](SPEC/2026-11-12-reativacao-backend.md)).

## Por que este repositório

Este é o fork `dsai-ap2-sigrestaurant` do trabalho da AP1 (`iurivinicius/dsai-ap1-sigrestaurant`), escolhido como base porque entrega um produto em funcionamento (mesas, comandas, cardápio e financeiro) com persistência local e deploy publicado. A AP2 evolui esse código sem reescrevê-lo: cada funcionalidade nova é especificada antes em `SPEC/` e implementada sobre a base herdada.

## Executar com Docker

Com Docker Desktop ou Docker Engine e Compose instalados:

```bash
docker compose up --build
```

Abra http://localhost:3000. Para encerrar, use `docker compose down`.

A stack sobe três serviços: **PostgreSQL** (porta 55433), a **API** (porta 4000) e o **frontend** (porta 3000). A API aplica as migrações e carrega os dados de demonstração ao subir.

## Os dois modos de operação

O app funciona em dois modos, e a interface sempre mostra em qual deles está:

| Modo | Quando | Onde os dados ficam |
|---|---|---|
| **Servidor** | `NEXT_PUBLIC_API_URL` está definida no build | no PostgreSQL, pela API — a equipe inteira vê a mesma comanda |
| **Navegador** | sem `NEXT_PUBLIC_API_URL` (é o caso da publicação na Vercel) | no `localStorage` deste navegador |

- **API fora do ar**: o app **não** troca de modo sozinho. Aparece uma faixa vermelha com "Tentar de novo" e "Usar o modo local" — quem opera o caixa vê que o servidor não responde.
- **Dados do navegador para o servidor**: com a API no ar e dados neste navegador, a faixa oferece "Importar meus dados". Mesas e itens que já existem no servidor são reaproveitados, não duplicados, e nada é apagado do navegador.
- **Para forçar o modo servidor** em um build local, monte a imagem com o argumento:

```bash
docker compose build --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000/api web
```

## Publicar na Vercel

Importe o repositório e defina `apps/web` como **Root Directory**. Não é necessário configurar `NEXT_PUBLIC_API_URL`, `DATABASE_URL` ou outros serviços externos no modo frontend.

## Executar os testes

Com as dependências instaladas, na raiz do repositório:

```bash
npm test
```

O comando delega ao workspace `apps/web` e executa a suíte Vitest uma única vez (`vitest run`). Para observação contínua durante o desenvolvimento:

```bash
npm --workspace apps/web run test:watch
```

Os testes ficam em arquivos `*.test.ts` colados ao módulo testado (ex.: `apps/web/lib/store.test.ts`); novos arquivos seguem a mesma convenção e são coletados automaticamente, sem mudar configuração. A suíte roda offline, em ambiente `node`, sem rede, banco ou serviços externos.

## Funcionalidades disponíveis

- Criar e remover mesas; mesas ocupadas não podem ser removidas.
- Selecionar quantidade e adicionar itens às comandas; editar e remover itens antes do pagamento.
- Cadastrar, editar, pausar, reativar e remover itens do cardápio.
- Fechar contas com Pix, dinheiro, crédito ou débito.
- Registrar despesas e consultar receita, despesas, saldo e formas de pagamento por período.
- **Salão**: numa tela só, as mesas ocupadas e livres, o que cada mesa pediu (itens iguais somados), há quanto tempo a conta está aberta, o total de cada uma e o total em aberto no salão, com filtros e atualização a cada 30 s. Funciona no celular. Ver [`SPEC/2026-11-16-visao-do-salao.md`](SPEC/2026-11-16-visao-do-salao.md).
- **Celular**: em telas de até 650 px a navegação fica no rodapé, os textos têm 14 px ou mais, os botões 44 px ou mais e os campos não fazem o celular ampliar a tela. `npm run e2e:celular` confere isso (roda no CI). Ver [`SPEC/2026-11-16-app-no-celular.md`](SPEC/2026-11-16-app-no-celular.md).

Na primeira visita, o app cria dados editáveis de demonstração. Eles permanecem após recarregar a página no mesmo navegador e perfil. `localStorage` não sincroniza dados entre dispositivos, navegadores ou perfis; para isso, será necessário reativar a API e conectar um banco hospedado.

## Backend (API NestJS)

O backend NestJS com Prisma e PostgreSQL fica em `apps/api/`. Ele voltou ao workspace, é compilado e testado no CI, mas ainda **não é publicado** e o frontend continua usando `localStorage` (SPEC [`2026-11-12-reativacao-backend.md`](SPEC/2026-11-12-reativacao-backend.md)). O `docker-compose.yml` segue subindo só o frontend.

Os testes da API são de integração e precisam de um PostgreSQL. Por segurança, só rodam em banco cujo nome termina em `_test`, porque apagam os dados entre os testes:

```bash
createdb restaurante_test
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/restaurante_test?schema=public" npm run test:api
```

`npm run build:api` gera o Prisma Client e compila a API. `npm run test:api:coverage` gera a cobertura em `apps/api/coverage/`.

### Reservas de mesa (somente API)

Rotas em `/api/reservations` (SPEC [`2026-11-12-reservas-de-mesa.md`](SPEC/2026-11-12-reservas-de-mesa.md)):

| Método e rota | Uso |
|---|---|
| `POST /api/reservations` | Agendar (mesa, cliente, telefone, pessoas, início ISO 8601 com fuso, duração, observações) |
| `GET /api/reservations?date=AAAA-MM-DD&status=` | Agenda do dia, em ordem de horário |
| `GET /api/reservations/availability?startsAt=&partySize=&durationMinutes=` | Mesas livres com lugares suficientes |
| `GET /api/reservations/:id` | Consultar |
| `PATCH /api/reservations/:id` | Remarcar |
| `POST /api/reservations/:id/seat`, `/cancel`, `/no-show` | Chegada, cancelamento, falta |

A mesma mesa não aceita duas reservas ativas em horários sobrepostos, e mesas com reserva agendada não podem ser removidas. Duração padrão (120 min), antecedência máxima (90 dias) e fuso da agenda (UTC) são provisórios até a resposta do cliente.

### Estoque de ingredientes (somente API)

Rotas em `/api/stock` e `/api/menu-items/:id/recipe` (SPEC [`2026-11-13-estoque-de-ingredientes.md`](SPEC/2026-11-13-estoque-de-ingredientes.md)):

| Método e rota | Uso |
|---|---|
| `GET/POST /api/stock/ingredients`, `GET/PATCH/DELETE /api/stock/ingredients/:id` | Ingredientes (nome, unidade `UN`, `KG`, `G`, `L`, `ML`, estoque mínimo) |
| `POST /api/stock/ingredients/:id/entries` | Entrada (compra) |
| `POST /api/stock/ingredients/:id/losses` | Perda, com motivo obrigatório |
| `POST /api/stock/ingredients/:id/count` | Contagem de inventário (grava só a diferença) |
| `GET /api/stock/ingredients/:id/movements` | Histórico, do mais recente ao mais antigo |
| `GET /api/stock/alerts` | Ingredientes no mínimo ou abaixo |
| `GET/PUT /api/menu-items/:id/recipe` | Ficha técnica do prato e porções possíveis |

Ao fechar uma conta, os ingredientes da ficha técnica de cada item vendido saem do estoque automaticamente. A baixa não bloqueia o fechamento: se faltar ingrediente, o estoque fica negativo e aparece nos alertas (provisório até a resposta do cliente).

### Fornecedores, compras e contas a pagar (somente API)

Rotas em `/api/suppliers`, `/api/purchases` e `/api/payables` (SPEC [`2026-11-13-fornecedores-e-contas-a-pagar.md`](SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md)):

| Método e rota | Uso |
|---|---|
| `GET/POST /api/suppliers`, `GET/PATCH/DELETE /api/suppliers/:id` | Fornecedores (CPF/CNPJ opcional e validado; `?all=true` inclui inativos) |
| `POST /api/purchases` | Registrar compra: fornecedor, nota, data, vencimento e itens (ingrediente, quantidade, custo unitário) |
| `GET /api/purchases?supplierId=&status=`, `GET /api/purchases/:id` | Consultar compras |
| `POST /api/purchases/:id/pay` | Pagar (forma e data); gera a despesa no relatório financeiro |
| `POST /api/purchases/:id/cancel` | Cancelar compra em aberto, estornando o estoque |
| `GET /api/payables` | Contas a pagar por vencimento, com situação e resumo |

Registrar a compra dá entrada no estoque. Pagar cria a despesa "Compra #N - Fornecedor" na data do pagamento, que só pode ser mudada pela própria compra. Cancelar só é possível se o estoque ainda tiver tudo o que entrou.

### Fechamento mensal (somente API)

Rotas em `/api/closings` (SPEC [`2026-11-16-fechamento-mensal.md`](SPEC/2026-11-16-fechamento-mensal.md)):

| Método e rota | Uso |
|---|---|
| `GET /api/closings/AAAA-MM` | DRE do mês: receita por forma de pagamento, compras de insumos, outras despesas, resultado, ticket médio, mês anterior, variação e, se fechado, valores guardados e divergências |
| `POST /api/closings` | Fechar um mês já encerrado (`{ month, notes? }`) |
| `POST /api/closings/AAAA-MM/reopen` | Reabrir com motivo (`{ reason }`) |
| `GET /api/closings` | Fechamentos, do mais recente para o mais antigo |

Com o mês fechado, despesas e pagamentos de compra com data naquele mês são recusados até a reabertura.

### Relatório de vendas (somente API)

`GET /api/reports/sales?from=AAAA-MM-DD&to=AAAA-MM-DD&limit=10` (SPEC [`2026-11-16-relatorios-de-vendas.md`](SPEC/2026-11-16-relatorios-de-vendas.md)): contas pagas, receita, itens vendidos, ticket médio, ranking dos itens por quantidade e por receita, receita por categoria, por hora do dia e dia da semana (horário de Belém), por forma de pagamento e categoria × hora. Todas as quebras somam a receita do período, que é a mesma do relatório financeiro.

### Caixa por turno (somente API)

Rotas em `/api/cash` (SPEC [`2026-11-16-caixa-por-turno.md`](SPEC/2026-11-16-caixa-por-turno.md)): `POST open` (operador e troco), `POST withdrawals` (sangria) e `POST deposits` (reforço) com motivo, `GET current` (vendas, movimentações e esperado por forma de pagamento), `POST close` (valores conferidos em dinheiro, crédito, débito e Pix; com diferença, a observação é obrigatória), `GET sessions?from&to` e `GET sessions/:id`. Um turno aberto por vez; a sangria não passa do dinheiro na gaveta.

### Garçons e comissão (somente API)

Rotas `/api/waiters` (cadastro, edição, desativação), `PUT /api/orders/:id/waiter` (atribui ou troca o garçom de uma comanda aberta, guardando nome e taxa daquele momento) e `GET /api/reports/waiters?from&to` (contas, receita, ticket médio e comissão por garçom, com "Sem garçom" e os totais). Comissão padrão de 10%, de 0 a 30% por garçom. SPEC [`2026-11-16-garcons-e-comissao.md`](SPEC/2026-11-16-garcons-e-comissao.md).

### Transferir comanda e juntar contas (somente API)

`POST /api/orders/:id/transfer` (`{ tableId, reason }`) move a comanda aberta para uma mesa livre; `POST /api/orders/:id/merge` (`{ sourceOrderId, reason }`) passa os itens de outra comanda aberta para esta, com os preços guardados, e a outra fica como juntada (`MERGED`), sem poder ser paga; `GET /api/orders/:id/history` mostra as mudanças com o motivo. SPEC [`2026-11-16-transferencia-e-juncao-de-comandas.md`](SPEC/2026-11-16-transferencia-e-juncao-de-comandas.md).

### Cozinha: envio, fila de produção e prioridade (somente API)

`POST /api/orders/:id/kitchen` (`{ note? }`) envia à cozinha os itens da comanda ainda não enviados; cada envio vira um pedido de cozinha, e os itens enviados não podem mais ser alterados nem removidos. `GET /api/kitchen/queue` traz a fila (prioridade alta primeiro, depois ordem de chegada) com a mesa atual, os itens, os minutos de espera e a faixa de atraso (no prazo até 10 min, atenção até 20, atrasado a partir de 20), além de um resumo. `POST /api/kitchen/tickets/:id/start`, `/ready` e `/deliver` mudam a situação; `PUT /api/kitchen/tickets/:id/priority` (`{ priority: NORMAL | HIGH, changedBy }`) muda a prioridade e grava quem mudou. Cancelar a comanda tira os pedidos dela da fila. SPEC [`2026-11-16-cozinha-kds.md`](SPEC/2026-11-16-cozinha-kds.md).

### Clientes e histórico de consumo (somente API)

Rotas `/api/customers` (cadastro com nome, telefone com DDD e observação; busca por parte do nome, sem acento, ou do telefone; edição e desativação), `PUT /api/orders/:id/customer` (`{ customerId }` ou `null`, só em comanda aberta) e `GET /api/customers/:id/history?from&to` (visitas, total gasto, ticket médio, primeira e última visita, 3 itens mais pedidos e as comandas pagas). Nome e telefone não se repetem, mesmo com outra grafia. SPEC [`2026-11-16-clientes-e-historico.md`](SPEC/2026-11-16-clientes-e-historico.md).

## Especificações e ferramentas

- Especificação inicial: [`SPEC/2026-10-01-restaurante.md`](SPEC/2026-10-01-restaurante.md).
- Modo frontend local: [`SPEC/2026-10-01-frontend-local.md`](SPEC/2026-10-01-frontend-local.md).
- Ferramentas/stack: Next.js, React, TypeScript e Docker. Agente: Codex. Modelo: GPT-6.
- Registro das mensagens do usuário: `prompts/sessoes/2026-10-01-codex.md`.
- Auditoria de conformidade com a Aula 09 (AP2): [`docs/AUDITORIA-AP2.md`](docs/AUDITORIA-AP2.md).
- Backlog da AP2: [`docs/issues/backlog.md`](docs/issues/backlog.md) e as [issues publicadas no fork](https://github.com/jessicamelo0532/dsai-ap2-sigrestaurant/issues).

## Como a dupla trabalha

O fluxo completo está em [`docs/FLUXO-DE-TRABALHO.md`](docs/FLUXO-DE-TRABALHO.md): da fila de issues até a entrega.

- **Integração contínua**: o pipeline da branch `jessica/ci-pipeline` roda em todo push e em todo PR para a `main` (build, testes com cobertura, duplicação, segredos e `npm audit`). Ver [`SPEC/2026-11-12-integracao-continua.md`](SPEC/2026-11-12-integracao-continua.md).
- **Medir as métricas da aula**: `npm run metricas` reproduz localmente as 14 métricas da Aula 09 (volume, duplicação, cobertura, specs, trailers, frequência, sessões, autoria, segurança e URL pública).
- **Publicar issues**: `node scripts/publicar-issues.mjs` cria as issues a partir de `docs/issues/bodies/`; o script é idempotente e pula as que já existem.
- **SPEC antes do código**: toda funcionalidade nova tem SPEC datada em `SPEC/` antes do primeiro commit de código.

## Itens de entrega do PDF ainda pendentes

- Status da publicação: sistema publicado online na Vercel.
- URL pública: https://dsai-ap1-sigrestaurant.vercel.app/ — ainda serve a deployment da AP1; falta publicar o fork (issue 0.5).
- O PDF exige 100 mil linhas de código versionado. A contagem por `cloc --diff` entre o último commit da AP1 (`d0a6caf`) e o estado atual da AP2 é de **2 097 linhas adicionadas** (medido em `d77cd1a`; `npm run metricas` refaz a conta) — 2,1% do mínimo exigido, das quais **582 são código** (testes, scripts de métrica e publicação de issues) e o restante é documentação e configuração. Detalhamento em [`docs/AUDITORIA-AP2.md`](docs/AUDITORIA-AP2.md).
- O ambiente não oferece exportação bruta das conversas; as mensagens do usuário foram transcritas no arquivo de sessão.
