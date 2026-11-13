# Mesa Clara

Sistema de restaurante para administrar mesas, pedidos, cardápio e despesas. Nesta etapa, o produto ativo é apenas o frontend Next.js. Os dados ficam no `localStorage` do navegador; a API NestJS e o PostgreSQL foram pausados para simplificar a publicação na Vercel.

## Executar com Docker

Com Docker Desktop ou Docker Engine e Compose instalados:

```bash
docker compose up --build
```

Abra http://localhost:3000. Para encerrar, use `docker compose down`.

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

## Especificações e ferramentas

- Especificação inicial: [`SPEC/2026-10-01-restaurante.md`](SPEC/2026-10-01-restaurante.md).
- Modo frontend local: [`SPEC/2026-10-01-frontend-local.md`](SPEC/2026-10-01-frontend-local.md).
- Ferramentas/stack: Next.js, React, TypeScript e Docker. Agente: Codex. Modelo: GPT-6.
- Registro das mensagens do usuário: `prompts/sessoes/2026-10-01-codex.md`.

## Itens de entrega do PDF ainda pendentes

- Status da publicação: sistema publicado online na Vercel.
- URL pública: https://dsai-ap1-sigrestaurant.vercel.app/
- O PDF exige 100 mil linhas de código versionado. A contagem simples (`wc -l`) dos arquivos fonte versionados é 931 linhas; `cloc` não está instalado neste ambiente.
- O ambiente não oferece exportação bruta das conversas; as mensagens do usuário foram transcritas no arquivo de sessão.
