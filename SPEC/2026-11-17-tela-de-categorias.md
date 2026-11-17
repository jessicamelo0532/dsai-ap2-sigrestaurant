# Tela de categorias do cardápio (issue 2.9)

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** issue #26 (backlog 2.9)  
**SPEC da API:** [`2026-11-16-categorias-do-cardapio.md`](2026-11-16-categorias-do-cardapio.md)  
**Derroga:** nada. Consome as rotas já implementadas e mantém o texto `category` do item.

---

## Contexto e problema

Fato comprovado: a API de categorias (`GET/POST/PATCH/DELETE /api/menu-categories`, `PUT /api/menu-categories/order`, `POST /api/menu-categories/import`, `PUT /api/menu-items/:id/category`) está implementada e testada, mas **nenhuma tela a usa**. A issue #26 registra que a parte de frontend ficou pendente: não há como criar, renomear, reordenar, apagar nem importar categorias, e o formulário de item não oferece as categorias cadastradas.

### Perguntas em aberto (para o cliente)

- **P-1:** no modo navegador (localStorage) não existe categoria cadastrada. Provisório: a tela mostra o mesmo aviso da cozinha e não chama a API — o cardápio local continua usando o texto livre, como hoje.
- **P-2:** desligar um item da categoria (`PUT /api/menu-items/:id/category` com `null`) não ganha botão nesta tela. Provisório: o item pode ser desligado editando o texto da categoria no formulário de item; a rota fica para uma tela de detalhe do item.

## Objetivo

Dar à equipe uma tela para cadastrar e ordenar as categorias do cardápio e para escolher a categoria ao criar ou editar um item, usando as rotas que já existem.

## Escopo

- Nova aba **Categorias** dentro da seção **Cardápio** (`apps/web/app/categorias-panel.tsx`).
- Lista na ordem com o número de itens de cada categoria.
- Criar, renomear, mover para cima/baixo, apagar e importar dos itens.
- Formulário de item do cardápio passa a sugerir as categorias cadastradas (datalist), continuando a enviar o texto `category`.
- Lógica pura em `apps/web/lib/categorias.ts`, com testes.

## Fora do escopo

- Criar categoria a partir do formulário de item (o item continua só escolhendo/sugerindo).
- Subcategorias, imagem de categoria e desligar item pela tela (P-2).
- Mudar a API ou o formato de dados.

## Requisitos funcionais

- **RF-01:** a aba Categorias lista as categorias na ordem da API, com o número de itens.
- **RF-02:** criar categoria com nome válido; a lista recarrega com a nova categoria no fim.
- **RF-03:** renomear categoria; o texto dos itens ligados é atualizado pela API e a lista do cardápio recarrega.
- **RF-04:** mover categoria para cima ou para baixo envia `PUT /menu-categories/order` com **todas** as categorias, uma vez cada.
- **RF-05:** apagar categoria sem itens; quando a API recusa (categoria com itens), a mensagem da API aparece na tela.
- **RF-06:** importar as categorias dos textos dos itens com `POST /menu-categories/import` e informar quantas foram criadas e quantos itens foram ligados.
- **RF-07:** o formulário de item do cardápio oferece as categorias cadastradas como sugestão (`<datalist>`), sem impedir texto novo.
- **RF-08:** no modo navegador a aba mostra o aviso de que categorias precisam do servidor e **não** chama a API.

## Requisitos não funcionais

- **RNF-01:** os botões de mover ficam desabilitados nas pontas; nada é enviado sem mudança real.
- **RNF-02:** as ações desabilitam os botões enquanto a requisição está em andamento (sem duplo envio).
- **RNF-03:** a tela funciona em 375 px (alvos de toque ≥ 44 px, texto ≥ 14 px) e usa as classes existentes.
- **RNF-04:** a lógica pura tem teste unitário; o componente tem teste de componente (jsdom + `fetch` simulado).

## Regras de negócio

- **RN-01:** nome de 2 a 50 caracteres, com espaços repetidos reduzidos a um. Mensagem: "Informe o nome da categoria, de 2 a 50 caracteres." (validação local antes de chamar a API, espelhando a API).
- **RN-02:** nome repetido (sem diferenciar maiúsculas e acentos) é bloqueado localmente com "Já existe uma categoria com esse nome."
- **RN-03:** a nova ordem enviada é sempre a lista completa atual com a categoria deslocada uma posição.
- **RN-04:** o número de itens e a recusa de apagar vêm da API; a tela não recalcula a regra.

## Critérios de aceitação verificáveis

- **CA-01:** `npm test` passa com os testes novos de `lib/categorias.ts` e de `categorias-panel.tsx`.
- **CA-02:** com a API no ar (Docker), a tela cria, renomeia, move, apaga e importa categorias; a ordem é a mesma que `GET /api/menu-categories` devolve.
- **CA-03:** criar item com o texto de uma categoria cadastrada liga o item a ela (verificado na tela e na API).
- **CA-04:** no modo navegador a aba não faz nenhuma requisição e explica o motivo.
- **CA-05:** `npm run build` e `npm run e2e:celular` continuam verdes; a nova tela entra no E2E de celular.

## Cenários de teste

- Lógica: nome válido/inválido, nome repetido com acento, ordem ao mover para cima/baixo/pontas, contagem de itens, opções do datalist.
- Componente: lista vazia, lista com categorias, criar, renomear, mover (ordem enviada), apagar recusado com mensagem da API, importar com resumo, modo navegador sem requisição.
- E2E: aba Categorias em 375 px.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/categorias.ts` (novo), `apps/web/app/categorias-panel.tsx` (novo), `apps/web/app/page.tsx` (aba e datalist), `apps/web/app/globals.css` (poucos estilos), `apps/web/e2e/celular.mjs`.
- **API:** nenhuma mudança.
- **Persistência:** a mesma (`localStorage` no modo navegador; sem categorias nele).

## Dependências e riscos

- **Riscos:** a lista mudar entre o clique e o envio da ordem (outra pessoa mexeu). Mitigação: a tela recarrega a lista depois de cada ação e envia sempre o que está na tela; a API recusa ordem incompleta (RN-03 da SPEC da API) e a mensagem aparece.
- **Dependência:** API de categorias no ar para o modo servidor.

## Plano de implementação

1. `lib/categorias.ts` + testes.
2. `categorias-panel.tsx` + testes de componente.
3. Aba no cardápio e datalist no formulário de item.
4. E2E, README e verificação na API real.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação a partir da issue #26 e da SPEC da API, com P-1 e P-2 | rascunho |
| 2026-11-17 | Implementada. Verificação: `npm test` 136 testes em 11 arquivos (20 de `lib/categorias.ts` + 14 de `categorias-panel.tsx` novos), todos passando; cobertura de linhas 87,14%; API real (Docker) criou, listou com `itemCount`, importou (4 categorias, 6 itens ligados), reordenou (`sortOrder` 0..4), apagou vazia (200) e recusou com itens (400 com a mensagem da RN-04); `npm run build` verde; `npm run e2e:celular` com 11 telas (inclui "Categorias do cardápio") dentro dos limites. P-1 e P-2 seguem como provisórias | implementada |
