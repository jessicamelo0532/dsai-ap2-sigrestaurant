# Sistema de restaurante

Aplicação para mesas, comandas, cardápio e controle financeiro. A especificação funcional anterior à implementação está em [`SPEC/2026-10-01-restaurante.md`](SPEC/2026-10-01-restaurante.md).

## Ferramentas e modelos

- Backend: NestJS, TypeScript e Prisma.
- Frontend: Next.js e TypeScript.
- Banco: PostgreSQL.
- Assistente de desenvolvimento: Codex, modelo GPT-6 (sessão registrada em `prompts/sessoes/`).

## Executar com Docker

Requisito local: Docker Desktop ou Docker Engine com o plugin Compose. Node.js, npm e PostgreSQL rodam dentro dos contêineres.

1. (Opcional) Copie `.env.example` para `.env` se quiser alterar portas ou credenciais locais.
2. Na raiz do projeto, rode `docker compose up --build`.
3. Para carregar mesas e pratos de demonstração, em outro terminal rode `docker compose exec api npm run db:seed`.

Interface: http://localhost:3000

API: http://localhost:4000/api

Verificação da API: http://localhost:4000/api/health

Para encerrar os serviços, rode `docker compose down`. Os dados do PostgreSQL permanecem no volume `restaurante_pgdata`.

## O que está implementado

- Salão com quantidade de mesas configurável; mesas ocupadas não podem ser removidas.
- Comandas por mesa, itens e quantidades, correção de itens e fechamento por Pix, dinheiro, crédito ou débito.
- Cardápio com cadastro, edição de preço e descrição, disponibilidade e remoção.
- Lançamento de despesas e relatório de vendas, despesas, saldo e formas de pagamento em um intervalo de datas.
- Migração PostgreSQL e dados opcionais de demonstração.

## Apresentação e entrega

URL pública: pendente de implantação. O Compose deixa API, interface e banco prontos para execução; a publicação requer um host com Docker acessível pela internet.

Especificação funcional: [`SPEC/2026-10-01-restaurante.md`](SPEC/2026-10-01-restaurante.md). Registro de conversa: `prompts/sessoes/`. A exportação bruta da conversa não é disponibilizada pelo ambiente; o arquivo atual transcreve literalmente as mensagens enviadas pelo usuário.

O requisito do PDF pede no mínimo 100 mil linhas versionadas de código, excluindo documentação e dados. A contagem simples de arquivos fonte versionados (`wc -l`, TypeScript, CSS, SQL, Prisma e Docker) é 782 linhas; `cloc` não está instalado neste ambiente. O mínimo de 100 mil linhas ainda não foi atingido.
