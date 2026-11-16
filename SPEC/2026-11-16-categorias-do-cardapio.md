# Categorias do cardápio com ordem de exibição (API)

**Data:** 2026-11-16  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #26 (backlog 2.9)  
**Derroga:** em parte `SPEC/2026-10-01-restaurante.md`, no ponto em que a categoria é só um texto livre e o cardápio sai em ordem alfabética de categoria. Itens ligados a categorias cadastradas passam a sair na ordem do cadastro. O texto `category` continua existindo e sendo devolvido, para a tela atual não quebrar.

---

## Contexto e problema

Fato comprovado em 2026-11-16: a categoria é texto livre digitado em cada item. "Bebidas" e "bebidas" viram duas categorias, e o cardápio sai em ordem alfabética, com "Bebidas" antes de "Entradas". A issue #26 pede cadastro de categorias com ordem de exibição e o item escolhendo uma categoria cadastrada.

### Perguntas em aberto (para o cliente)

- **P-1:** o que fazer com as categorias que já existem como texto? Provisório: uma rota de importação cria as categorias a partir dos textos e liga os itens; ninguém é obrigado a usar.
- **P-2:** item pode ficar sem categoria cadastrada? Provisório: pode; ele sai depois dos itens com categoria, como hoje (texto em ordem alfabética).

## Objetivo

Cadastrar as categorias do cardápio, definir a ordem em que aparecem e fazer a lista do cardápio respeitar essa ordem, sem quebrar quem ainda manda a categoria como texto.

## Escopo

- Tabela `MenuCategory` e campo opcional `MenuItem.categoryId`.
- Módulo NestJS `menu-categories` com as rotas:
  - `GET /api/menu-categories` lista na ordem, com o número de itens;
  - `POST /api/menu-categories`, `PATCH /api/menu-categories/:id`, `DELETE /api/menu-categories/:id`;
  - `PUT /api/menu-categories/order` com `{ ids }` define a ordem;
  - `POST /api/menu-categories/import` cria categorias a partir dos textos (P-1);
  - `PUT /api/menu-items/:id/category` com `{ categoryId }` (ou `null`).
- `createMenuItem` e `updateMenuItem`: o texto da categoria liga o item à categoria cadastrada com o mesmo nome.
- `listMenu`: ordem do cadastro.

## Fora do escopo

- A tela de adição de item com a lista de categorias (critério da issue que depende do frontend; fica para o frontend com estas rotas).
- Subcategorias e imagem de categoria.

## Requisitos funcionais

- **RF-01:** criar categoria com nome; ela entra no fim da ordem.
- **RF-02:** listar categorias na ordem, com quantos itens cada uma tem.
- **RF-03:** renomear categoria; os itens ligados passam a mostrar o nome novo.
- **RF-04:** reordenar todas as categorias de uma vez.
- **RF-05:** apagar categoria sem itens.
- **RF-06:** ligar ou desligar um item de uma categoria.
- **RF-07:** importar os textos de categoria dos itens que ainda não têm categoria cadastrada.
- **RF-08:** `GET /api/menu-items` sai na ordem das categorias cadastradas e, dentro delas, por nome; itens sem categoria cadastrada vêm depois (P-2).

## Requisitos não funcionais

- **RNF-01:** nome único garantido pelo banco (índice único na chave do nome).
- **RNF-02:** reordenar, renomear e importar são transações.

## Regras de negócio

- **RN-01:** nome de 2 a 50 caracteres, com espaços repetidos reduzidos a um. Mensagem: "Informe o nome da categoria, de 2 a 50 caracteres."
- **RN-02:** não pode haver duas categorias com o mesmo nome, sem diferenciar maiúsculas e acentos. Mensagem: "Já existe uma categoria com esse nome."
- **RN-03:** a nova ordem precisa ter todas as categorias, uma vez cada. Mensagem: "Informe todas as categorias, uma vez cada, na nova ordem."
- **RN-04:** categoria com itens não é apagada. Mensagem: "Esta categoria tem N item(ns). Mova os itens antes de apagá-la."
- **RN-05:** ao criar ou editar item, se o texto `category` bater (sem maiúsculas e acentos) com uma categoria cadastrada, o item é ligado a ela e o texto fica igual ao nome cadastrado; se não bater, o item fica sem categoria cadastrada, com o texto digitado.
- **RN-06:** ligar item a uma categoria troca o texto `category` pelo nome dela; desligar mantém o texto.
- **RN-07:** a importação agrupa os textos sem maiúsculas e acentos, usa a grafia que vem primeiro na ordem dos caracteres (maiúscula antes de minúscula, então "Bebidas" vence "bebidas"), cria as que faltam no fim da ordem (em ordem alfabética) e liga também os itens cujos textos batem com categorias que já existiam.

## Critérios de aceitação verificáveis

- **CA-01:** a ordem definida no cadastro é respeitada na listagem do cardápio (critério da issue).
- **CA-02:** as categorias saem na ordem pela API, com o número de itens, prontas para a tela de adição de item (critério da issue, parte da API).
- **CA-03:** criar item com o texto "bebidas" liga à categoria "Bebidas".
- **CA-04:** renomear muda o texto dos itens; apagar com itens é recusado; reordenar com lista incompleta ou repetida é recusado.
- **CA-05:** a importação cria uma categoria por texto, sem duplicar por maiúscula ou acento, e liga os itens.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Três categorias e itens | Reordenar e listar o cardápio | CA-01 |
| T-02 | Categorias com itens | Listar categorias | CA-02 |
| T-03 | Categoria "Bebidas" | Criar e editar itens com textos | CA-03 |
| T-04 | Categoria com itens | Renomear, apagar, reordenar errado | CA-04 |
| T-05 | Itens só com texto | Importar | CA-05 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/menu-categories/` (novo), `app.service.ts`, `app.module.ts`, `apps/api/test/`.
- **Frontend:** continua mandando e recebendo o texto `category`; nada quebra. Sem categorias cadastradas, a ordem do cardápio é a mesma de hoje.

## Dependências e riscos

- **Riscos:** texto e categoria ficarem diferentes.
- **Mitigações:** o texto é sempre reescrito com o nome cadastrado ao ligar e ao renomear (RN-05, RN-06, RF-03).

## Plano de implementação

1. Regras puras com testes.
2. Schema e migração.
3. Serviço, rotas e ajustes no cardápio.
4. Testes de integração.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 e P-2 | aprovada |
