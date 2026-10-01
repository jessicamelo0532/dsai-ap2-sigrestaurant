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
- Ferramentas: Next.js, React, TypeScript e Docker; desenvolvimento assistido pelo Codex/GPT-6.
- Registro das mensagens do usuário: `prompts/sessoes/2026-10-01-codex.md`.

## Itens de entrega do PDF ainda pendentes

- Status da publicação: sistema publicado online na Vercel.
- URL pública: não informada nesta conversa.
- O PDF exige 100 mil linhas de código versionado. A contagem simples (`wc -l`) dos arquivos fonte versionados é 931 linhas; `cloc` não está instalado neste ambiente.
- O ambiente não oferece exportação bruta das conversas; as mensagens do usuário foram transcritas no arquivo de sessão.
