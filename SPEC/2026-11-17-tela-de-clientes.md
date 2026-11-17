# Tela de clientes e histórico de consumo

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-clientes-e-historico.md` (API), issue #35  
**Derroga:** n/a (só consome a API existente; nenhuma regra muda)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API de clientes existe e está testada (`/api/customers`, SPEC de 2026-11-16, status `implementada`), mas não há tela. O dono não consegue cadastrar clientes, encontrá-los pelo nome ou telefone, nem ver quantas vezes cada um veio e o que costuma pedir.

### Perguntas em aberto

- nenhuma nova. P-1 a P-3 da SPEC da API continuam valendo como estão.

## Objetivo

Dar ao dono uma seção **Clientes** para cadastrar, buscar, editar e desativar clientes e consultar o histórico de consumo de cada um.

## Escopo

- Lógica pura em `apps/web/lib/clientes.ts`: validações, formato do telefone, corpo das requisições, período do histórico, rótulos.
- Componente `apps/web/app/clientes-panel.tsx` com busca, lista, formulário e histórico.
- Item **Clientes** no menu lateral e verificação da tela no E2E de celular.

## Fora do escopo

- Ligar ou trocar o cliente de uma comanda (`PUT /orders/:id/customer`): muda o painel da comanda e terá SPEC própria.
- Clientes no modo navegador (`localStorage`): o cadastro existe só no modo servidor.
- Qualquer mudança na API.

## Requisitos funcionais

- **RF-01:** No modo navegador, a seção avisa que precisa do servidor e oferece **Conectar ao servidor** quando o build tem `NEXT_PUBLIC_API_URL`.
- **RF-02:** A lista mostra os clientes (`GET /customers`) com nome, telefone formatado e observação. O campo de busca filtra pela API (`search`), e **Mostrar desativados** inclui os inativos (`all=true`).
- **RF-03:** **Novo cliente** cadastra com nome, telefone e observação (`POST /customers`); campos opcionais vazios não são enviados.
- **RF-04:** **Editar** muda nome, telefone e observação (`PATCH /customers/:id`), enviando só o que mudou; apagar o telefone ou a observação envia `null`. **Desativar/Reativar** envia `{ active }`.
- **RF-05:** **Histórico** mostra, para o cliente escolhido (`GET /customers/:id/history`), visitas, total gasto, ticket médio, primeira e última visita, os 3 itens mais pedidos e as comandas pagas (data, mesa, total). O período é opcional: sem datas, mostra todo o histórico.
- **RF-06:** Erros da API aparecem na tela com a mensagem que a API devolve (ex.: cliente duplicado).

## Requisitos não funcionais

- **RNF-01:** Textos em português; valores em `R$ 1.234,56`; telefone em `(91) 99999-9999` ou `(91) 3333-4444`.
- **RNF-02:** A busca espera o operador parar de digitar (300 ms) antes de chamar a API.
- **RNF-03:** A tela passa no E2E de celular em 375 px.
- **RNF-04:** Nenhuma dependência nova.

## Regras de negócio

As regras são as da SPEC da API, que continua sendo a fonte final. A tela repete apenas as que evitam um envio que a API recusaria, com as mesmas mensagens:

- **RN-01 (RN-01 da API):** nome de 2 a 80 caracteres. Mensagem: "Informe o nome do cliente, de 2 a 80 caracteres."
- **RN-02 (RN-02 da API):** telefone opcional; se vier, tem 10 ou 11 dígitos depois de tirar espaços, parênteses, traços e o `+55` do começo. Mensagem: "Informe o telefone com DDD, com 10 ou 11 dígitos."
- **RN-03 (RN-03 da API):** observação até 300 caracteres. Mensagem: "A observação deve ter até 300 caracteres."
- **RN-04:** período do histórico: as duas datas vazias (todo o histórico) ou as duas preenchidas, com a inicial menor ou igual à final.

A duplicidade de nome e telefone (RN-04 da API) é conferida só pela API.

## Critérios de aceitação verificáveis

- **CA-01:** Dado o modo navegador, quando abro **Clientes**, então vejo que precisa do servidor e nenhuma requisição é feita.
- **CA-02:** Dado clientes cadastrados, então a lista mostra nome, telefone formatado e observação.
- **CA-03:** Quando digito na busca, então a API é chamada com `search`; quando marco **Mostrar desativados**, com `all=true`.
- **CA-04:** Quando cadastro com nome e telefone, então a API recebe `{ name, phone }` sem observação vazia; com telefone de 9 dígitos, a tela recusa sem enviar.
- **CA-05:** Quando edito só a observação, então o `PATCH` leva só `notes`; quando desativo, leva `{ active: false }`.
- **CA-06:** Quando a API recusa um cadastro duplicado, então a mensagem dela aparece.
- **CA-07:** Quando abro o histórico de um cliente, então vejo visitas, total, ticket médio, itens favoritos e as comandas.
- **CA-08:** Quando filtro o histórico por período, então a API recebe `from` e `to`; com só uma data, a tela recusa sem chamar.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | validações, telefone, corpos, período | RN-01 a RN-04 |
| T-02 | Modo navegador | renderizar | CA-01 |
| T-03 | API com clientes | listar, buscar, mostrar desativados | CA-02, CA-03 |
| T-04 | API | cadastrar; telefone inválido; duplicado | CA-04, CA-06 |
| T-05 | API | editar e desativar | CA-05 |
| T-06 | API com histórico | abrir histórico e filtrar | CA-07, CA-08 |
| T-07 | Celular 375 px | navegar até Clientes | RNF-03 |

- **Camada de teste:** lógica pura (`lib/clientes.test.ts`) e componente com Testing Library (`app/clientes-panel.test.tsx`), com `fetch` simulado.
- **Framework:** Vitest.
- **Automação prevista:** T-01 a T-06 automáticos; T-07 no job "Uso no celular (375 px)" do CI.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/clientes.ts` (novo), `apps/web/app/clientes-panel.tsx` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`.
- **Persistência:** não muda.
- **Backend:** não muda.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build; na Vercel a seção mostra o aviso de RF-01.

## Dependências e riscos

- **Dependências:** API de clientes (`SPEC/2026-11-16-clientes-e-historico.md`).
- **Riscos:** dados pessoais (nome e telefone) aparecem na tela.
- **Mitigações:** a tela só mostra o que a API já guarda; os testes usam dados fictícios (AGENTS.md §9).

## Plano de implementação

1. Commit desta SPEC.
2. `lib/clientes.ts` com testes.
3. `clientes-panel.tsx` e testes de componente, em commits separados.
4. Item no menu, estilos e E2E de celular.
5. Rodar testes e checagem de tipos; verificar CA-01 a CA-08.
6. README e status desta SPEC.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
