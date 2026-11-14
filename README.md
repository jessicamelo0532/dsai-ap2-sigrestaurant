# Mesa Clara

Sistema de restaurante para administrar mesas, pedidos, cardápio e despesas. Nesta etapa, o produto ativo é apenas o frontend Next.js. Os dados ficam no `localStorage` do navegador; a API NestJS e o PostgreSQL foram pausados para simplificar a publicação na Vercel.

## Por que este repositório

Este é o fork `dsai-ap2-sigrestaurant` do trabalho da AP1 (`iurivinicius/dsai-ap1-sigrestaurant`), escolhido como base porque entrega um produto em funcionamento (mesas, comandas, cardápio e financeiro) com persistência local e deploy publicado. A AP2 evolui esse código sem reescrevê-lo: cada funcionalidade nova é especificada antes em `SPEC/` e implementada sobre a base herdada.

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

## Código pausado

O backend NestJS, as migrações Prisma e a configuração PostgreSQL seguem em `apps/api/` e `docker-compose.yml` registra que os serviços estão pausados. Eles não participam do build frontend atual.

## Especificações e ferramentas

- Especificação inicial: [`SPEC/2026-10-01-restaurante.md`](SPEC/2026-10-01-restaurante.md).
- Modo frontend local: [`SPEC/2026-10-01-frontend-local.md`](SPEC/2026-10-01-frontend-local.md).
- Ferramentas/stack: Next.js, React, TypeScript e Docker. Agente: Codex. Modelo: GPT-6.
- Registro das mensagens do usuário: `prompts/sessoes/2026-10-01-codex.md`.
- Auditoria de conformidade com a Aula 09 (AP2): [`docs/AUDITORIA-AP2.md`](docs/AUDITORIA-AP2.md).

## Itens de entrega do PDF ainda pendentes

- Status da publicação: sistema publicado online na Vercel.
- URL pública: https://dsai-ap1-sigrestaurant.vercel.app/
- O PDF exige 100 mil linhas de código versionado. A contagem por `cloc --diff` entre o último commit da AP1 (`d0a6caf`) e o estado atual da AP2 é de **2 490 linhas adicionadas** — 2,5% do mínimo exigido, e **zero linhas de código de produto novo** (179 são TypeScript de teste/configuração; o restante é documentação de governança e auditoria). Detalhamento em [`docs/AUDITORIA-AP2.md`](docs/AUDITORIA-AP2.md).
- O ambiente não oferece exportação bruta das conversas; as mensagens do usuário foram transcritas no arquivo de sessão.
