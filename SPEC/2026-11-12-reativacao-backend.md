# Reativação do backend NestJS em desenvolvimento e CI, com testes de integração

**Data:** 2026-11-12  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** nova (depende de `SPEC/2026-11-12-integracao-continua.md`)  
**Derroga:** em parte `SPEC/2026-10-01-frontend-local.md`, apenas no ponto em que API e Prisma ficam "sem participar do fluxo ativo": passam a participar do desenvolvimento e do CI. A publicação e o frontend não mudam.

---

## Contexto e problema

Fato comprovado em 2026-11-12, sobre o commit `b2b1194`:

- `apps/api/` contém um backend NestJS 10 com Prisma 6 e PostgreSQL (cerca de 500 linhas): mesas, cardápio, comandas, despesas e relatório financeiro, expostos em `/api/*`.
- O backend foi pausado pelo autor original (SPEC `2026-10-01-frontend-local.md`) para publicar só o frontend na Vercel. A raiz declara apenas `apps/web` como workspace, então o backend não é instalado, compilado nem testado.
- Não existe nenhum teste do backend. Inclui regras de negócio relevantes (fechamento de conta, cancelamento, remoção de mesa ocupada, relatório por forma de pagamento) que hoje podem quebrar sem ninguém perceber.
- Existem commits do autor original depois da AP1 (13/10) acrescentando endpoints de consulta por id, cancelamento de comanda e edição/remoção de despesas, que nunca foram executados em CI.

Como FDE, a dupla precisa de um backend que compile e tenha testes antes de evoluí-lo com novas funcionalidades. Esta SPEC é o primeiro passo: reativar sem alterar comportamento.

### Perguntas em aberto

- **P-1:** quando e como o frontend publicado passará a usar a API (troca de `localStorage` por API e banco hospedado). Fora do escopo; exige SPEC própria, decisão da dupla e conversa com o cliente.
- **P-2:** onde hospedar a API e o banco quando P-1 for decidida.

## Objetivo

O backend volta a ser instalado, compilado e testado automaticamente (local e no CI), com testes de integração contra PostgreSQL real que cobrem as regras de negócio existentes, sem mudar o comportamento da API nem o produto publicado.

## Escopo

- Incluir `apps/api` nos workspaces da raiz e scripts `build:api`, `test:api` e `test:api:coverage`.
- Ajustar o `Dockerfile` apenas para que a instalação continue funcionando com o novo workspace.
- Vitest no `apps/api` e testes de integração do `AppService` e das validações do `AppController` e dos DTOs, contra um banco PostgreSQL de teste.
- Job novo no CI com serviço PostgreSQL 16, que aplica as migrações, compila e testa a API.

## Fora do escopo

- Ligar o frontend à API ou mudar o `localStorage` (P-1).
- Publicar a API ou o banco (P-2).
- Mudar regras de negócio, rotas, formato das respostas ou o schema Prisma.
- Tocar em `apps/web` (frente do outro integrante).

## Requisitos funcionais

- **RF-01:** `npm install` na raiz instala também as dependências de `apps/api`.
- **RF-02:** `npm run build:api` gera o Prisma Client e compila o backend sem erros.
- **RF-03:** `npm run test:api` executa os testes de integração usando o banco indicado em `DATABASE_URL`, aplicando as migrações antes e limpando os dados entre os testes.
- **RF-04:** o CI executa build e testes da API a cada push e PR, com PostgreSQL 16 como serviço, e publica o relatório de cobertura da API como artefato.

## Requisitos não funcionais

- **RNF-01:** os testes nunca usam um banco que não seja de teste: o nome do banco em `DATABASE_URL` precisa terminar em `_test`, senão a suíte aborta antes de apagar qualquer dado.
- **RNF-02:** nenhuma credencial real versionada; o CI usa usuário e senha descartáveis do container de teste.
- **RNF-03:** testes e mensagens em português, seguindo o padrão do repositório.

## Regras de negócio

Nenhuma regra nova. Os testes registram as regras que o código atual já implementa (origem: `apps/api/src/app.service.ts`, `app.controller.ts`, `dto.ts` e `SPEC/2026-10-01-restaurante.md`):

- **RN-01:** número de mesa é único; mesa com comanda aberta não pode ser removida.
- **RN-02:** a listagem do cardápio mostra só itens disponíveis, a menos que se peça todos.
- **RN-03:** item indisponível não pode ser adicionado a uma comanda; adicionar o primeiro item abre a comanda da mesa.
- **RN-04:** a comanda guarda nome e preço do item no momento do pedido (alterar o cardápio depois não muda a comanda).
- **RN-05:** remover o último item de uma comanda apaga a comanda.
- **RN-06:** só comanda aberta e com itens pode ser fechada; só comanda aberta pode ser cancelada ou ter itens alterados.
- **RN-07:** o relatório soma a receita das comandas pagas no período por forma de pagamento, subtrai as despesas do período e ignora comandas canceladas ou abertas.
- **RN-08:** datas do relatório e das despesas usam o formato AAAA-MM-DD; data final inclusiva; data inicial não pode ser maior que a final.

## Critérios de aceitação verificáveis

- **CA-01:** dado um clone limpo, quando rodar `npm install` e `npm run build:api`, então o comando termina com código 0.
- **CA-02:** dado PostgreSQL com banco `*_test`, quando rodar `npm run test:api`, então todos os testes passam.
- **CA-03:** dado `DATABASE_URL` apontando para banco cujo nome não termina em `_test`, quando rodar `npm run test:api`, então a suíte aborta sem apagar dados.
- **CA-04:** dada uma regra RN-01 a RN-07 revertida no código de propósito, quando rodar os testes, então pelo menos um teste falha.
- **CA-05:** dado um push, quando o CI rodar, então o job da API termina verde e o build do frontend continua verde.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Mesa 1 existe | Criar outra mesa 1 | Erro "Já existe uma mesa com esse número." |
| T-02 | Mesa com comanda aberta | Remover a mesa | Erro "Feche a comanda antes de remover esta mesa." |
| T-03 | Item pausado no cardápio | Listar cardápio padrão e com `all` | Item some só da listagem padrão |
| T-04 | Item pausado | Adicionar à comanda | Erro "Este item não está disponível no cardápio." |
| T-05 | Item na comanda | Mudar preço no cardápio | Comanda mantém nome e preço antigos |
| T-06 | Comanda com um item | Remover o item | Comanda deixa de existir |
| T-07 | Comanda aberta sem itens / já paga | Fechar | Erros correspondentes |
| T-08 | Comandas pagas, canceladas e despesas em datas variadas | Gerar relatório | Totais por forma de pagamento, despesas e saldo corretos só no período |
| T-09 | Datas inválidas ou invertidas | Relatório e despesas | Erro 400 com a mensagem do controller |
| T-10 | DTOs com valores fora dos limites | Validar | Erros de validação |

- **Camada de teste:** API (serviço e controller com banco real).
- **Framework:** Vitest (mesmo do frontend, SPEC `2026-11-10-infraestrutura-de-testes.md`).
- **Automação prevista:** todos os cenários.

## Impactos na arquitetura

- **Camadas tocadas:** `package.json` (raiz), `apps/api/package.json`, `apps/api/vitest.config.ts`, `apps/api/test/`, `Dockerfile`, `.github/workflows/ci.yml`, `README.md`.
- **Persistência:** não muda o `localStorage` nem o schema Prisma.
- **Backend pausado:** passa a ser compilado e testado; continua sem ser publicado.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** Vercel não é afetada (raiz `apps/web`). Docker continua subindo só o frontend.

## Dependências e riscos

- **Dependências:** SPEC de integração contínua (PR #1).
- **Riscos:** testes apagarem um banco real por engano; aumento do tempo do CI; novas dependências trazerem alertas de segurança.
- **Mitigações:** trava RNF-01; job separado; `npm audit` já roda no CI.

## Plano de implementação

1. Workspace, scripts e Vitest no `apps/api`; ajuste do `Dockerfile`.
2. Infraestrutura de teste (banco `_test`, migrações, limpeza entre testes).
3. Testes de mesas e cardápio.
4. Testes de comandas.
5. Testes de despesas, relatório e validações.
6. Job da API no CI.
7. Verificar CA-01 a CA-05; atualizar status e README.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-12 | Criação e aprovação por Jéssica Lopes Melo | aprovada |
| 2026-11-12 | CA-01, CA-02, CA-03 e CA-05 verificados: execução 43320533827 do GitHub Actions com 57 testes passando contra PostgreSQL 16 (cobertura de linhas: 91,6% da API, 100% do `app.service.ts`) e frontend verde; suíte abortou localmente com banco "restaurante". O `Dockerfile` não precisou de ajuste (instalação conferida com o novo workspace). CA-04 (reverter regra e ver teste falhar) fica pendente de verificação manual, pois os motores do Prisma não puderam ser baixados no ambiente local | implementada |
