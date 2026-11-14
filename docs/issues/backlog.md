# Backlog da AP2

Issues do backlog, na ordem de dependência. Cada item exige **SPEC datada em `SPEC/` antes** do primeiro commit de código (métrica de specs da Aula 09).

O texto completo de cada issue está em [`bodies/`](bodies/) — um arquivo por fase, com o corpo, os labels e as dependências. A publicação no GitHub é feita por `node scripts/publicar-issues.mjs` (idempotente: issue já existente com o mesmo título é pulada).

## Fase 0 — Bloqueadores de avaliação

| # | Issue | Depende de |
|---|---|---|
| 0.1 | Ativar o pipeline de CI e publicá-lo na `main` | — |
| 0.2 | Consolidar a auditoria de conformidade no repositório | 0.1 |
| 0.3 | Registrar custo/tokens de cada sessão | informação do humano |
| 0.4 | Alternar autoria entre os dois integrantes da dupla | identidade do segundo integrante |
| 0.5 | Publicar URL do fork servindo o último commit da `main` | credencial de deploy |

## Fase 1 — Fundação técnica

| # | Issue | Depende de |
|---|---|---|
| 1.1 | Ativar o backend `apps/api` (NestJS + Prisma + PostgreSQL) | SPEC aprovada — muda estratégia de persistência |
| 1.2 | Corrigir o alerta crítico de dependência no `next` (subir para a v16) | SPEC aprovada — breaking change |
| 1.3 | Cobertura de componente (Testing Library) e E2E (Playwright) | aprovação de dependências |
| 1.4 | Cobertura de linhas do *diff* no pipeline (linhas novas cobertas) | 1.3 |
| 1.5 | Resolver as 4 lacunas de teste conhecidas (comanda vazia, comanda não paga no relatório, despesa negativa, item pausado) | — |
| 1.6 | Deploy contínuo: publicar a `main` a cada merge | 0.5 |

## Fase 2 — Produto (operação)

| # | Issue | Depende de |
|---|---|---|
| 2.1 | Zonas do salão e mapa de mesas | 1.1 |
| 2.2 | Transferência de comanda entre mesas e junção de contas | 1.1 |
| 2.3 | Divisão de conta por CONSUMIDOR | 1.1 |
| 2.4 | Display de produção (KDS) com envio do pedido para a cozinha | 1.1 |
| 2.5 | Temporizadores e prioridade de preparo | 2.4 |
| 2.6 | Impressão de cupom e bobina de comanda | 1.1 |
| 2.7 | PWA offline e leitura de código de mesa | 1.1 |
| 2.8 | Controle de garçom por comanda e comissão | 1.1 |

## Fase 2 — Produto (cardápio e estoque)

| # | Issue | Depende de |
|---|---|---|
| 2.9 | Categorias de cardápio com ordenação | 1.1 |
| 2.10 | Variantes e adicionais de item | 1.1 |
| 2.11 | Disponibilidade por horário e dia da semana | 1.1 |
| 2.12 | Ingredientes, receitas e ficha técnica de prato | 1.1 |
| 2.13 | Estoque, consumo por prato e perdas | 2.12 |
| 2.14 | Fornecedores, compras e entrada de mercadoria | 2.13 |

## Fase 2 — Produto (financeiro)

| # | Issue | Depende de |
|---|---|---|
| 2.15 | Fechamento de caixa por turno (abertura, sangria, entrada, conferência) | 1.1 |
| 2.16 | Contas a receber e a pagar | 2.15 |
| 2.17 | Relatório de produtos mais vendidos e ticket médio | 1.1 |
| 2.18 | Relatório por categoria, por hora e por forma de pagamento | 2.17 |
| 2.19 | DRE do mês e fechamento mensal | 2.15, 2.17 |
| 2.20 | Metas de vendas e comparativo com o período anterior | 2.19 |

## Fase 2 — Produto (clientes)

| # | Issue | Depende de |
|---|---|---|
| 2.21 | Cadastro de clientes e histórico de consumo | 1.1 |
| 2.22 | Programa de fidelidade | 2.21 |
| 2.23 | Reservas de mesa | 2.21 |
| 2.24 | Delivery: pedidos e taxas | 1.1 |

## Fase 2 — API (paridade com o frontend)

| # | Issue | Depende de |
|---|---|---|
| 2.25 | Módulos NestJS para mesas, comandas e cardápio | 1.1 |
| 2.26 | Módulos NestJS para despesas, relatórios e caixa | 2.15 |
| 2.27 | Módulos NestJS para estoque, clientes e reservas | 2.13, 2.21 |
| 2.28 | Testes de integração da API contra PostgreSQL | 2.25 |
