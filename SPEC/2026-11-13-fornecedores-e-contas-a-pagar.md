# Fornecedores, compras e contas a pagar (API)

**Data:** 2026-11-13  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-13-estoque-de-ingredientes.md` (a compra gera entrada de estoque)  
**Derroga:** n/a. Acrescenta uma regra às despesas (RN-10): a despesa gerada pelo pagamento de uma compra não é editada nem removida pela rota de despesas.

---

## Contexto e problema

Fato comprovado em 2026-11-13: depois da SPEC de estoque, a entrada de ingredientes é registrada à mão, sem dizer de quem foi comprado, por quanto, nem quando vence o pagamento. As despesas do relatório financeiro também são lançadas à mão, então uma compra paga precisa ser digitada duas vezes (no estoque e nas despesas) e pode ficar de fora de uma delas.

Esta SPEC liga as três pontas: o fornecedor, a compra (que dá entrada no estoque) e a conta a pagar (que, quando paga, vira despesa no relatório financeiro). Só a API; as telas dependem da ligação do frontend à API.

### Perguntas em aberto (para o cliente)

- **P-1:** o restaurante compra a prazo (com vencimento) ou paga tudo na hora? Provisório: aceita os dois; vencimento igual à data da compra significa à vista.
- **P-2:** CPF/CNPJ do fornecedor é necessário? Provisório: opcional, mas validado quando informado.
- **P-3:** cancelar uma compra já usada na cozinha deve ser possível? Provisório: não; o cancelamento só acontece se o estoque ainda tiver tudo o que entrou.
- **P-4:** pagamento parcial de uma conta é comum? Provisório: não há pagamento parcial; a conta é paga inteira.

## Objetivo

Registrar uma compra uma vez só e ter, a partir dela, a entrada no estoque, a conta a pagar com vencimento e, quando paga, a despesa no relatório financeiro.

## Escopo

- Tabelas `Supplier`, `Purchase` e `PurchaseItem`; ligação da movimentação de estoque com a compra e da compra com a despesa gerada.
- Módulo NestJS `purchasing` com rotas em `/api/suppliers`, `/api/purchases` e `/api/payables`.
- Função compartilhada para gravar movimentação de estoque (`recordMovement`), usada pela compra e pela baixa de venda.
- Regra nova nas despesas (RN-10).

## Fora do escopo

- Telas no frontend.
- Pagamento parcial (P-4), parcelamento, juros e multa.
- Custo médio do ingrediente e preço de venda sugerido.
- Nota fiscal eletrônica (emissão fiscal é fora de escopo permanente).

## Requisitos funcionais

- **RF-01:** cadastrar, listar (ativos por padrão, todos se pedido), consultar, editar, desativar/reativar e remover fornecedores.
- **RF-02:** registrar compra com fornecedor, número da nota (opcional), data da compra (padrão: hoje), vencimento, observações e itens (ingrediente, quantidade, custo unitário).
- **RF-03:** ao registrar a compra, cada item dá entrada no estoque do ingrediente, com movimentação ligada à compra.
- **RF-04:** listar compras, com filtro opcional por fornecedor e situação, das mais recentes para as mais antigas; consultar uma compra com itens.
- **RF-05:** pagar uma compra em aberto informando a forma de pagamento e a data (padrão: hoje); o pagamento cria uma despesa com o total da compra na data do pagamento.
- **RF-06:** cancelar uma compra em aberto, estornando as entradas de estoque.
- **RF-07:** listar contas a pagar (compras em aberto) por vencimento, cada uma com a situação em relação a hoje, e um resumo: quantidade, total em aberto, total vencido e total que vence nos próximos 7 dias.

## Requisitos não funcionais

- **RNF-01:** dinheiro em centavos inteiros e quantidades em milésimos inteiros nas contas, para não acumular erro.
- **RNF-02:** registrar, pagar e cancelar são transações únicas: ou tudo acontece (compra, estoque, despesa), ou nada.
- **RNF-03:** o relógio é injetável para testar vencimentos sem depender da data real.
- **RNF-04:** mensagens em português; 400 para regra violada, 404 para registro inexistente.

## Regras de negócio

- **RN-01:** nome do fornecedor único (sem diferenciar maiúsculas), de 2 a 100 caracteres. CPF (11 dígitos) ou CNPJ (14 dígitos) opcional, guardado só com dígitos e com dígitos verificadores válidos. Mensagem: "CPF ou CNPJ inválido."
- **RN-02:** fornecedor inativo não recebe compra nova. Mensagem: "O fornecedor NOME está inativo."
- **RN-03:** fornecedor com compras não pode ser removido; deve ser desativado. Mensagem: "O fornecedor tem compras registradas. Desative em vez de excluir."
- **RN-04:** a compra tem de 1 a 50 itens; ingrediente não repete; quantidade maior que zero com até 3 casas; custo unitário maior que zero com até 2 casas.
- **RN-05:** total do item = quantidade × custo unitário, arredondado para o centavo mais próximo; total da compra = soma dos itens.
- **RN-06:** o vencimento não pode ser antes da data da compra. Mensagem: "O vencimento não pode ser antes da data da compra." Datas no formato AAAA-MM-DD; a compra não pode ter data futura.
- **RN-07:** situação de uma conta em aberto em relação a hoje: `OVERDUE` (vencida), `DUE_TODAY` (vence hoje) ou `UPCOMING` (a vencer). Dia em UTC, como no restante da API.
- **RN-08:** só compra em aberto (`OPEN`) pode ser paga ou cancelada. Mensagem: "Só compras em aberto podem ser pagas ou canceladas."
- **RN-09:** cancelar só é possível se o estoque atual de cada ingrediente cobrir a quantidade que entrou na compra (P-3). Mensagem: "Não é possível cancelar: o estoque de NOME já foi usado."
- **RN-10:** a despesa criada pelo pagamento tem a descrição "Compra #N - FORNECEDOR" e não pode ser editada nem removida pela rota de despesas. Mensagem: "Esta despesa veio do pagamento da compra #N e não pode ser alterada aqui."
- **RN-11:** a data do pagamento não pode ser futura nem anterior à data da compra.

## Critérios de aceitação verificáveis

- **CA-01:** dado um fornecedor ativo e dois ingredientes, quando registrar compra com dois itens, então o total segue RN-05, a compra fica `OPEN` e o estoque de cada ingrediente sobe com movimentação ligada à compra.
- **CA-02:** quando pagar a compra, então ela fica `PAID` e aparece uma despesa com o total, na data do pagamento, que entra no relatório financeiro.
- **CA-03:** quando tentar editar ou remover essa despesa, então recebe erro de RN-10.
- **CA-04:** quando cancelar uma compra em aberto com estoque intacto, então ela fica `CANCELLED` e o estoque volta ao valor anterior; se o estoque já foi usado, recebe erro de RN-09 e nada muda.
- **CA-05:** quando listar contas a pagar, então aparecem só compras em aberto, por vencimento, com situação e resumo de RF-07.
- **CA-06:** quando violar RN-01, RN-02, RN-03, RN-04, RN-06, RN-08 ou RN-11, então recebe o erro correspondente e nada é gravado.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | Centavos, total com arredondamento, CPF/CNPJ, vencimento, situação, resumo | RN-01, RN-05, RN-06, RN-07, RF-07 |
| T-02 | Fornecedor e ingredientes | Registrar compra | CA-01 |
| T-03 | Compra em aberto | Pagar; relatório do dia | CA-02 |
| T-04 | Despesa de compra | Editar e remover | CA-03 |
| T-05 | Compra em aberto | Cancelar com e sem estoque usado | CA-04 |
| T-06 | Compras com vencimentos variados | Contas a pagar | CA-05 |
| T-07 | Dados inválidos | Fornecedor e compra | CA-06 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos os cenários.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/purchasing/` (novo), `apps/api/src/stock/stock-ledger.ts` (novo, usado por `stock-sale.ts`), `app.module.ts`, `app.service.ts` (RN-10 em `updateExpense` e `deleteExpense`), `apps/api/test/`.
- **Persistência:** três tabelas novas; coluna nova opcional `purchaseId` em `StockMovement`; nenhuma coluna existente muda.
- **Backend pausado:** segue sem publicação.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Dependências:** SPEC de estoque (PR #4) por causa do empilhamento.
- **Riscos:** total arredondado diferente da nota do fornecedor; despesa duplicada se o pagamento for lançado também à mão; cancelamento de compra já consumida.
- **Mitigações:** RN-05 explícita e testada; RN-10 protege a despesa gerada; RN-09 bloqueia cancelamento com estoque usado.

## Plano de implementação

1. Schema e migração.
2. Regras puras com testes unitários.
3. `recordMovement` compartilhado no estoque.
4. Módulo de fornecedores, compras e contas a pagar; RN-10 nas despesas.
5. Testes de integração.
6. Verificar CA-01 a CA-06; README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-13 | Criação e aprovação por Jéssica Lopes Melo, com regras provisórias P-1 a P-4 | aprovada |
| 2026-11-13 | CA-01 a CA-06 verificados na execução 43365664589 do GitHub Actions: 248 testes da API passando contra PostgreSQL 16 (módulo de compras com 98,9% das linhas cobertas) e checagem de migrações sem diferença. Nove mutações nas regras puras fizeram testes falharem (uma sobreviveu na primeira rodada e ganhou caso de teste: CPF com dígito verificador 0). "Próximos 7 dias" do resumo = hoje e os 6 dias seguintes. Perguntas P-1 a P-4 seguem abertas para o cliente | implementada |
