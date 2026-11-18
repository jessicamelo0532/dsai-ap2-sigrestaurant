# Zonas do salão e mesas agrupadas por zona

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #18 (backlog 2.1), `SPEC/2026-11-16-visao-do-salao.md`  
**Derroga:** n/a. Acrescenta a zona à mesa sem mudar o que já existe; mesa sem zona informada vai para a zona padrão.

---

## Contexto e problema

Fato comprovado em 2026-11-17: o salão é uma lista plana de mesas (`DiningTable` sem agrupamento, na API e no `localStorage`). A issue #18 pede o que um restaurante real usa: organizar as mesas por área (varanda, salão interno, área externa), ver o salão agrupado por área e filtrar por área.

Critérios da issue:
- toda mesa pertence a uma zona;
- o mapa mostra o estado de cada mesa (livre ou ocupada) agrupado por zona.

### Perguntas em aberto (para o cliente)

- **P-1:** qual o nome da zona padrão, que recebe as mesas que já existem? Provisório: "Salão".
- **P-2:** tamanho do nome da zona? Provisório: de 2 a 40 caracteres, sem repetir nome (sem diferenciar maiúsculas e minúsculas).
- **P-3:** pode excluir uma zona que ainda tem mesas? Provisório: não; é preciso mover as mesas antes. A última zona também não pode ser excluída (toda mesa precisa de uma zona).

## Objetivo

Cadastrar zonas, colocar cada mesa numa zona e mostrar o salão agrupado e filtrável por zona, no modo servidor e no modo navegador.

## Escopo

- **API:** tabela `Zone` e coluna obrigatória `DiningTable.zoneId`, com migração que cria a zona padrão e coloca nela as mesas existentes; rotas `/api/zones`; zona opcional ao criar mesa; `PATCH /api/tables/:id` para mudar a zona.
- **Modo navegador:** as mesmas rotas no adaptador local (`apps/web/lib/local-store.ts`), com conversão dos dados já salvos.
- **Tela Salão:** mesas agrupadas por zona, filtro por zona e a janela **Zonas** (criar, renomear, excluir, mover mesa).

## Fora do escopo

- Desenho livre do mapa (posição x/y das mesas): as mesas continuam em grade dentro de cada zona.
- Reordenar zonas arrastando: a ordem é a de criação.
- Zona no formulário de nova mesa: a mesa nova entra na primeira zona e pode ser movida na janela Zonas.
- Importação dos dados locais para a API (`import-local`): as mesas importadas vão para a zona padrão da API.

## Requisitos funcionais

- **RF-01:** `GET /zones` lista as zonas na ordem de exibição, cada uma com `tableCount`.
- **RF-02:** `POST /zones` com `{ name }` cria a zona no fim da ordem. `PATCH /zones/:id` com `{ name }` renomeia. `DELETE /zones/:id` exclui (RN-03).
- **RF-03:** `POST /tables` aceita `zoneId` opcional; sem ele, a mesa entra na primeira zona (e, se ainda não houver nenhuma, a zona padrão é criada).
- **RF-04:** `PATCH /tables/:id` com `{ zoneId }` muda a mesa de zona.
- **RF-05:** `GET /tables` devolve `zoneId` em cada mesa.
- **RF-06:** No modo navegador, as rotas RF-01 a RF-05 funcionam igual, e dados salvos antes desta mudança ganham a zona padrão com todas as mesas.
- **RF-07:** A tela Salão agrupa as mesas por zona, na ordem das zonas, com o número de mesas ocupadas de cada zona, e tem um filtro por zona junto ao filtro de situação.
- **RF-08:** O botão **Zonas** da tela Salão abre uma janela para criar, renomear e excluir zonas e mover cada mesa de zona; erros aparecem com a mensagem da regra.

## Requisitos não funcionais

- **RNF-01:** A migração não perde dados: as mesas existentes ficam na zona padrão.
- **RNF-02:** Mensagens em português; a mesma regra e a mesma mensagem nos dois modos.
- **RNF-03:** A tela passa no E2E de celular em 375 px.
- **RNF-04:** Nenhuma dependência nova.

## Regras de negócio

- **RN-01 (P-2):** nome da zona de 2 a 40 caracteres depois de tirar espaços repetidos. Mensagem: "Informe o nome da zona, de 2 a 40 caracteres."
- **RN-02 (P-2):** não pode haver duas zonas com o mesmo nome, sem diferenciar maiúsculas e minúsculas. Mensagem: "Já existe uma zona chamada NOME."
- **RN-03 (P-3):** zona com mesas não pode ser excluída. Mensagem: "Mova as mesas desta zona antes de excluí-la." A última zona não pode ser excluída. Mensagem: "O salão precisa de pelo menos uma zona."
- **RN-04 (P-1):** zona padrão "Salão", criada pela migração (modo servidor) ou pela conversão dos dados (modo navegador) e, se não houver zona nenhuma, ao criar uma mesa.
- **RN-05:** mover mesa ou criar mesa numa zona que não existe é recusado. Mensagem: "Zona não encontrada."
- **RN-06:** ordem de exibição: a das zonas (`sortOrder`, crescente); zona nova entra no fim.

## Critérios de aceitação verificáveis

- **CA-01:** Dado um banco com mesas, quando a migração roda, então existe a zona "Salão" e todas as mesas estão nela.
- **CA-02:** Quando crio "Varanda" e "varanda", então a segunda é recusada com a mensagem de RN-02; nome com 1 letra é recusado (RN-01).
- **CA-03:** Quando crio uma mesa sem zona, então ela entra na primeira zona; com `zoneId` de uma zona inexistente, é recusada (RN-05).
- **CA-04:** Quando movo uma mesa para "Varanda", então `GET /tables` mostra o novo `zoneId` e `GET /zones` atualiza a contagem.
- **CA-05:** Quando tento excluir uma zona com mesas, ou a última zona, então é recusado com a mensagem de RN-03; zona vazia (havendo outra) é excluída.
- **CA-06:** Dado um `localStorage` salvo antes desta mudança, quando o app abre, então as mesas aparecem na zona "Salão" e nada se perde.
- **CA-07:** Dadas duas zonas com mesas, então a tela Salão mostra um grupo por zona com o título e "N de M ocupadas", e o filtro por zona mostra só as mesas daquela zona.
- **CA-08:** Pela janela Zonas, consigo criar, renomear, excluir uma zona vazia e mover uma mesa; um erro da regra aparece na janela.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Regras puras da API | nome, unicidade, exclusão | RN-01 a RN-03 |
| T-02 | PostgreSQL de teste | criar, renomear, excluir zonas; criar e mover mesas | CA-02 a CA-05 |
| T-03 | Migração | `prisma migrate diff` no CI e mesas na zona padrão | CA-01 |
| T-04 | Funções puras do frontend | agrupar, contar, filtrar, validar | RN-01, RN-06, CA-07 |
| T-05 | Adaptador local | rotas e conversão dos dados antigos | RF-06, CA-06 |
| T-06 | Componente | tela Salão com zonas e janela Zonas | CA-07, CA-08 |
| T-07 | Celular 375 px | tela Salão | RNF-03 |

- **Camadas de teste:** regras puras e integração da API (Vitest com PostgreSQL); lógica pura, adaptador local e componentes do frontend (Vitest e Testing Library).
- **Automação prevista:** todos; T-02 e T-03 no job da API do CI.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/api/prisma/schema.prisma`, migração nova, `apps/api/src/zones/` (novo), `apps/api/src/app.service.ts` e `dto.ts` (zona da mesa), `apps/api/test/`; `apps/web/lib/types.ts`, `apps/web/lib/zonas.ts` (novo), `apps/web/lib/local-store.ts`, `apps/web/app/salao-panel.tsx`, `apps/web/app/zonas-modal.tsx` (novo), `globals.css`.
- **Persistência:** API ganha a tabela `Zone` e a coluna `zoneId`. O `localStorage` ganha a lista `zones` e o `zoneId` das mesas, na mesma chave `mesa-clara.data.v1`, com conversão automática dos dados antigos (RF-06).
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não muda o build. Na Vercel (modo navegador) as zonas funcionam com os dados do aparelho.

## Dependências e riscos

- **Riscos:** a migração deixar mesas sem zona; dados antigos do `localStorage` quebrarem a tela.
- **Mitigações:** a migração cria a zona padrão antes de tornar a coluna obrigatória; o adaptador local converte os dados ao ler e o teste cobre dados no formato antigo.

## Plano de implementação

1. Commit desta SPEC.
2. Schema e migração.
3. Regras puras da API com testes.
4. Serviço, rotas e zona da mesa, com testes de integração.
5. Lógica pura do frontend com testes.
6. Adaptador local com testes.
7. Tela Salão e janela Zonas com testes.
8. README e status desta SPEC.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia com P-1 a P-3 provisórias | aprovada |
| 2026-11-17 | CA-01 verificado aplicando as migrações num PostgreSQL 16 com 3 mesas (todas na zona "Salão", nenhuma sem zona) e `prisma migrate diff` sem diferença; CA-02 a CA-05 por 15 testes de regras e 13 de integração (suíte da API com 721 testes passando); CA-06 por 7 testes do adaptador local; CA-07 e CA-08 por 10 testes de lógica e 11 de componente (suíte do frontend com 206 testes). P-1 a P-3 seguem provisórias | implementada |
