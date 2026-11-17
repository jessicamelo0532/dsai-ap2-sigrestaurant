# Relatórios de vendas: mais vendidos, ticket médio, categoria, horário e pagamento (API)

**Data:** 2026-11-16  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issues #34 (backlog 2.17) e #35 (backlog 2.18); usa as mesmas regras de receita de `SPEC/2026-10-01-restaurante.md` (relatório financeiro)  
**Derroga:** n/a

---

## Contexto e problema

Fato comprovado em 2026-11-16: o relatório financeiro responde quanto entrou e quanto saiu no período, com a receita por forma de pagamento. Ele não diz **o que** foi vendido, **em que categoria**, nem **em que horário**. As issues #34 e #35 pedem isso para o dono "responder o que vender amanhã" e "dimensionar o turno".

### Perguntas em aberto (para o cliente)

- **P-1:** o horário e o dia da semana dos relatórios devem seguir o relógio de Belém? Provisório: sim, horário de Belém (UTC−3, sem horário de verão). O período (datas de/até) continua em UTC, como no relatório financeiro, para os totais baterem.
- **P-2:** quantos itens mostrar no ranking? Provisório: 10 por padrão, de 1 a 50 por pedido.
- **P-3:** ticket médio por garçom (pedido da issue #34) depende de existir garçom na comanda (issue #25). Fica fora desta SPEC.

## Objetivo

Um relatório de vendas por período com o ranking dos itens, o ticket médio e a receita por categoria, por hora do dia, por dia da semana, por forma de pagamento e por categoria × hora, sempre somando exatamente a receita do período.

## Escopo

- Função compartilhada de período (`src/common/period.ts`), usada também pelo relatório financeiro existente, para não repetir a validação de datas.
- Módulo NestJS `sales-reports` com a rota `GET /api/reports/sales`.
- Regras puras em `sales-rules.ts`.

## Fora do escopo

- Ticket médio por garçom (P-3).
- Telas no frontend.
- Comparação com metas e com o período anterior (issue #37).

## Requisitos funcionais

- **RF-01:** `GET /api/reports/sales?from=AAAA-MM-DD&to=AAAA-MM-DD&limit=N` devolve o relatório do período.
- **RF-02:** totais: contas pagas, receita, itens vendidos e ticket médio.
- **RF-03:** ranking de itens por quantidade (empate: maior receita, depois nome) com quantidade, receita e participação na receita; e o mesmo ranking ordenado por receita.
- **RF-04:** receita e quantidade por categoria do cardápio, com participação.
- **RF-05:** receita e contas pagas por hora do dia (24 faixas, de 0 a 23) e por dia da semana (7 faixas), no horário de Belém (P-1).
- **RF-06:** receita e contas pagas por forma de pagamento.
- **RF-07:** cruzamento categoria × hora: para cada categoria, a receita em cada uma das 24 faixas.

## Requisitos não funcionais

- **RNF-01:** contas em centavos inteiros; valores devolvidos com 2 casas.
- **RNF-02:** participação em porcentagem com uma casa decimal.
- **RNF-03:** a validação de período é a mesma do relatório financeiro (mesmas mensagens).

## Regras de negócio

- **RN-01:** entram só comandas pagas (`PAID`) com data de pagamento dentro do período (mesma regra do relatório financeiro); a data final é inclusiva.
- **RN-02:** a receita de uma linha é preço guardado na comanda × quantidade.
- **RN-03:** itens são agrupados pelo nome registrado na comanda e pelo item do cardápio de origem; a categoria vem do cardápio atual; se o item saiu do cardápio, a categoria é "Item removido do cardápio".
- **RN-04:** ticket médio = receita ÷ contas pagas, arredondado ao centavo; sem contas, zero.
- **RN-05:** a hora e o dia da semana de uma conta são os do seu pagamento no horário de Belém (UTC−3).
- **RN-06:** `limit` inteiro de 1 a 50 (padrão 10). Mensagem: "Informe um limite de 1 a 50 itens."
- **RN-07:** a soma por categoria, por hora, por dia da semana e por forma de pagamento é igual à receita total do período.

## Critérios de aceitação verificáveis

- **CA-01:** dado um período com contas pagas, abertas e canceladas, quando pedir o relatório, então só as pagas entram e a receita é igual à do relatório financeiro do mesmo período.
- **CA-02:** o ranking por quantidade soma exatamente as quantidades vendidas no período, e o ticket médio é receita ÷ contas pagas (critérios da issue #34).
- **CA-03:** a soma por categoria é igual à receita total, e as faixas horárias cobrem 100% das contas pagas (critérios da issue #35).
- **CA-04:** uma conta paga às 23h30 UTC entra na faixa das 20h e no dia da semana correspondente em Belém.
- **CA-05:** item removido do cardápio continua no ranking com a categoria "Item removido do cardápio".
- **CA-06:** datas inválidas, período invertido e limite fora de 1 a 50 são recusados.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | Agrupar, ordenar, participação, faixas, limite | RN-02 a RN-07 |
| T-02 | Período com contas variadas | Relatório | CA-01 a CA-04 |
| T-03 | Item removido | Relatório | CA-05 |
| T-04 | Parâmetros inválidos | Relatório | CA-06 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/api/src/common/period.ts` (novo), `app.controller.ts` (passa a usar a função compartilhada, sem mudar comportamento), `apps/api/src/sales-reports/` (novo), `app.module.ts`, `apps/api/test/`.
- **Persistência:** não muda.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Riscos:** períodos longos ficarem lentos; diferença de fuso confundir quem compara com o relatório financeiro.
- **Mitigações:** uma consulta só por período; P-1 registrada e documentada no README.

## Plano de implementação

1. Período compartilhado e regras puras com testes.
2. Serviço e rota.
3. Testes de integração.
4. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 a P-3 | aprovada |
| 2026-11-16 | CA-01 a CA-06 verificados na execução 43946632253 do GitHub Actions: 321 testes da API passando contra PostgreSQL 16 (relatórios de vendas com 97,4% das linhas cobertas); receita igual à do relatório financeiro. Dez mutações nas regras puras fizeram testes falharem. P-1 a P-3 seguem abertas | implementada |
