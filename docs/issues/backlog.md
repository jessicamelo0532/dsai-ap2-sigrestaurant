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

## Estado em 2026-11-17

Os PRs #54 a #70 levaram para a `main` a maior parte da Fase 2. Issues **fechadas** com evidência no GitHub:

| Fase | Fechadas |
|---|---|
| 0 | 0.1 (#7), 0.2 (#8) e a #6 (primeiras impressões) |
| 1 | 1.1 (#12), 1.2 (#13) e 1.5 (#16) |
| 2 | 2.2 (#19), 2.4 (#21), 2.5 (#22), 2.8 (#25), 2.10 (#27), 2.11 (#28), 2.13 (#30), 2.14 (#31), 2.15 (#32), 2.17 (#34), 2.18 (#35), 2.19 (#36), 2.20 (#37), 2.21 (#38), 2.22 (#39), 2.24 (#41), 2.27 (#44) e 2.28 (#45) |

**Abertas por estarem parciais** (o que falta está no comentário de cada issue):

- 2.9 (#26): API de categorias pronta; falta a tela de adição de item usar a ordem.
- 2.12 (#29): ingredientes, receita e custo prontos na API; falta a margem no cardápio administrativo.
- 2.16 (#33): contas a pagar prontas; contas a receber não.
- 2.23 (#40): reservas prontas; falta converter reserva em comanda.
- 2.25 (#42) e 2.26 (#43): mesas, comandas, cardápio, despesas e relatórios ainda vivem no `AppService`, sem módulo próprio.
- 1.3 (#14): E2E de celular existe; falta Testing Library e o diff coverage da 1.4.

**Pendentes de decisão ou credencial:** 0.3 (#9, custo/tokens), 0.4 (#10, autoria — a primeira integrante estava em 29% antes dos commits de documentação de 2026-11-17), 0.5 (#11) e 1.6 (#17) (publicação e deploy contínuo).

## Estado em 2026-11-18

Os 18 PRs abertos (#77 a #94) foram integrados na `main` e enviados ao GitHub em 2026-11-18; os PRs ficaram como `MERGED` e as branches remotas foram apagadas. Issues no GitHub não foram fechadas nesta sessão. Entraram, entre outros: cobertura do diff no CI, `.mailmap`, zonas, horários de funcionamento, contas a receber, caixa, garçons, clientes, fidelidade, metas, transferência/junção de comandas, variações e adicionais, PWA/QR, quantidade e cancelamento na comanda. Frontend com 552 testes verdes, build e e2e de celular verdes; a suíte da API não foi executada por falta de credencial do PostgreSQL local.

## Estado em 2026-11-19

A **2.3 (#20, divisão de conta por consumidor)** foi implementada no modo navegador no PR da branch `feat/divisao-de-conta`: três modos (por igual, por item e por valor), pagamento individual das parcelas, fechamento automático da comanda quando todas forem pagas e relatório por forma de pagamento. A paridade com a API pausada ficou fora do escopo. SPEC [`2026-11-19-divisao-de-conta.md`](../SPEC/2026-11-19-divisao-de-conta.md).
