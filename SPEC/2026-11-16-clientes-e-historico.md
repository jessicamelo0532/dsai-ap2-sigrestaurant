# Cadastro de clientes e histórico de consumo (API)

**Data:** 2026-11-16  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #38 (backlog 2.21)  
**Derroga:** nenhuma. A comanda ganha um vínculo opcional com cliente; quem não usa o cadastro continua igual.

---

## Contexto e problema

Fato comprovado em 2026-11-16: o consumo é anônimo. Não há como saber quem é cliente frequente, quanto gasta nem o que costuma pedir, e a fidelidade (issue #39) depende disso. A issue #38 pede cadastro com nome, telefone e observação, vínculo opcional com a comanda e histórico de consumo e visitas.

### Perguntas em aberto (para o cliente)

- **P-1:** que telefone aceitar? Provisório: número brasileiro com DDD, 10 ou 11 dígitos, guardado só com os dígitos.
- **P-2:** dá para ligar o cliente a uma comanda já paga? Provisório: não; o vínculo é feito com a comanda aberta, para a fidelidade creditar no pagamento.
- **P-3:** ao juntar comandas, de quem fica o cliente? Provisório: o destino mantém o seu; se não tiver, herda o da origem.

## Objetivo

Cadastrar clientes, ligar o cliente à comanda e ver o histórico de cada um: visitas, total gasto, ticket médio, primeira e última visita e os itens que mais pede.

## Escopo

- Tabela `Customer` e campo opcional `Order.customerId`.
- Módulo NestJS `customers` com as rotas:
  - `GET /api/customers?search=&all=` lista (busca por nome ou telefone);
  - `GET /api/customers/:id`, `POST /api/customers`, `PATCH /api/customers/:id`;
  - `PUT /api/orders/:id/customer` com `{ customerId }` (ou `null` para tirar);
  - `GET /api/customers/:id/history?from=&to=` histórico.
- Ajuste em `order-moves` para P-3.

## Fora do escopo

- Telas no frontend.
- Fidelidade (SPEC própria, issue #39).
- Envio de mensagens ao cliente e qualquer consentimento de marketing.

## Requisitos funcionais

- **RF-01:** criar cliente com nome (obrigatório), telefone e observação (opcionais).
- **RF-02:** listar clientes ativos em ordem de nome; `search` filtra por parte do nome (sem diferenciar maiúsculas e acentos) ou por parte do telefone; `all=true` inclui inativos.
- **RF-03:** editar nome, telefone, observação e desativar ou reativar (`active`). Cliente não é apagado, para não perder o histórico.
- **RF-04:** ligar, trocar ou tirar o cliente de uma comanda aberta.
- **RF-05:** histórico do cliente com as comandas pagas ligadas a ele, opcionalmente num período: número de visitas, total gasto, ticket médio, primeira e última visita, os 3 itens mais pedidos e a lista das comandas (data, mesa, total).

## Requisitos não funcionais

- **RNF-01:** a regra de não duplicar nome e telefone é garantida pelo banco (índice único), inclusive em cadastros simultâneos.
- **RNF-02:** valores em centavos inteiros nas contas, devolvidos com duas casas.

## Regras de negócio

- **RN-01:** nome de 2 a 80 caracteres, com espaços repetidos reduzidos a um. Mensagem: "Informe o nome do cliente, de 2 a 80 caracteres."
- **RN-02:** telefone opcional; se vier, tem 10 ou 11 dígitos depois de tirar espaços, parênteses, traços e o `+55` do começo (P-1). Mensagem: "Informe o telefone com DDD, com 10 ou 11 dígitos."
- **RN-03:** observação opcional, até 300 caracteres. Mensagem: "A observação deve ter até 300 caracteres."
- **RN-04:** não pode haver dois clientes com o mesmo nome e o mesmo telefone. Nome é comparado sem diferenciar maiúsculas, acentos e espaços; dois clientes sem telefone e com o mesmo nome também contam como duplicados. Mensagem: "Já existe cliente com esse nome e telefone." (critério da issue).
- **RN-05:** só comanda aberta recebe ou perde cliente (P-2). Mensagem: "Só comandas abertas podem mudar de cliente."
- **RN-06:** cliente inativo não pode ser ligado a comanda. Mensagem: "Este cliente está desativado."
- **RN-07:** o histórico conta só comandas pagas (critério da issue). Ticket médio é o total dividido pelas visitas, arredondado para o centavo; sem visitas, é zero.
- **RN-08:** itens mais pedidos somam a quantidade pelo nome guardado na comanda; empate vai para o nome em ordem alfabética.
- **RN-09:** ao juntar comandas, o cliente do destino fica; se o destino não tiver cliente, recebe o da origem (P-3).

## Critérios de aceitação verificáveis

- **CA-01:** o histórico soma as comandas pagas ligadas ao cliente e ignora abertas, canceladas e de outros clientes (critério da issue).
- **CA-02:** o cadastro aceita cliente sem telefone e recusa duplicar nome e telefone, mesmo com outra caixa, acentos ou formatação de telefone (critério da issue).
- **CA-03:** a busca encontra por parte do nome sem acento e por parte do telefone, e esconde inativos sem `all=true`.
- **CA-04:** ligar e tirar cliente funciona em comanda aberta e é recusado em comanda paga ou com cliente inativo.
- **CA-05:** o período do histórico filtra pela data de pagamento.
- **CA-06:** na junção, o destino sem cliente herda o da origem.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Cliente com 3 comandas (2 pagas) | Histórico | CA-01 |
| T-02 | Cliente cadastrado | Cadastrar variações | CA-02 |
| T-03 | Clientes ativos e inativo | Buscar | CA-03 |
| T-04 | Comanda aberta e paga | Ligar e tirar | CA-04 |
| T-05 | Comandas em meses diferentes | Histórico com período | CA-05 |
| T-06 | Duas comandas, só a origem com cliente | Juntar | CA-06 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/customers/` (novo), `order-moves.service.ts`, `app.module.ts`, `apps/api/test/`.
- **Dados pessoais:** nome e telefone de clientes ficam no banco do restaurante. Nenhum dado real entra no repositório: os testes usam nomes e números fictícios.

## Dependências e riscos

- **Riscos:** cadastro duplicado por grafia diferente; histórico contar comanda que não foi paga.
- **Mitigações:** chave normalizada única (RN-04, RNF-01); filtro por situação paga (RN-07).

## Plano de implementação

1. Regras puras com testes.
2. Schema e migração.
3. Serviço e rotas.
4. Testes de integração.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 a P-3 | aprovada |
