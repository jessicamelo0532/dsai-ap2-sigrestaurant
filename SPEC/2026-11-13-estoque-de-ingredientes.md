# Estoque de ingredientes com ficha técnica e baixa automática (API)

**Data:** 2026-11-13  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** nova (depende de `SPEC/2026-11-12-reservas-de-mesa.md`, que criou o molde de módulos da API)  
**Derroga:** em parte a lista "fora de escopo permanente" de `SPEC/2026-10-01-restaurante.md`, no item **estoque**. Justificativa: a dupla assumiu o projeto como FDE e propõe o estoque como evolução; a decisão final é confirmada com o cliente (P-1). O fechamento de conta ganha um efeito novo (RN-08); suas regras atuais não mudam.

---

## Contexto e problema

Fato comprovado em 2026-11-13: o Mesa Clara registra o que é vendido, mas não o que é gasto para produzir. O dono não sabe quanto tem de cada ingrediente, quando comprar, nem quantas porções de um prato ainda consegue servir. A especificação original deixou estoque fora do escopo, mas esse é um dos controles que mais pesam no dia a dia de um restaurante pequeno.

Esta SPEC cria o estoque na API: cadastro de ingredientes, entradas (compras), perdas, contagem de inventário, ficha técnica dos pratos e baixa automática quando a conta é fechada. Só a API; telas dependem da ligação do frontend à API (pendência P-1 da SPEC de reativação do backend).

### Perguntas em aberto (para o cliente)

- **P-1:** o cliente quer controle de estoque no sistema? (A spec original o deixou fora.) Provisório: sim, só na API até a resposta.
- **P-2:** fechar uma conta deve ser bloqueado se faltar ingrediente no estoque? Provisório: **não bloqueia**; o estoque pode ficar negativo e o ingrediente aparece nos alertas. Motivo: o prato já foi servido e a conta precisa fechar.
- **P-3:** cancelar uma comanda deve gerar perda de ingredientes já usados? Provisório: não; a baixa só acontece no fechamento pago.
- **P-4:** unidades suficientes são unidade, quilo, grama, litro e mililitro? Provisório: sim, sem conversão entre unidades.

## Objetivo

Saber, a qualquer momento, quanto há de cada ingrediente, o histórico de cada movimentação, quais ingredientes estão abaixo do mínimo e quantas porções de cada prato ainda dá para fazer, com baixa automática pelo que foi vendido.

## Escopo

- Tabelas `Ingredient`, `RecipeItem` (ficha técnica) e `StockMovement`, com migração.
- Módulo NestJS `stock` com rotas em `/api/stock` e `/api/menu-items/:id/recipe`.
- Baixa automática dentro da transação de `closeOrder`.
- Regras puras em `stock-rules.ts`, testáveis sem banco.

## Fora do escopo

- Telas no frontend.
- Conversão entre unidades, custo médio, preço de compra e fornecedores (SPEC futura de fornecedores).
- Bloquear venda por falta de estoque (P-2).
- Pausar automaticamente itens do cardápio sem estoque.

## Requisitos funcionais

- **RF-01:** cadastrar, listar (por nome), consultar, editar (nome, unidade, mínimo) e remover ingredientes.
- **RF-02:** registrar entrada (compra) com quantidade e observação opcional.
- **RF-03:** registrar perda com quantidade e motivo obrigatório.
- **RF-04:** registrar contagem de inventário: informa a quantidade contada e o sistema grava a diferença como ajuste.
- **RF-05:** listar as movimentações de um ingrediente, da mais recente para a mais antiga.
- **RF-06:** listar alertas: ingredientes com quantidade menor ou igual ao mínimo, os negativos primeiro e depois pelo quanto faltam para o mínimo.
- **RF-07:** definir a ficha técnica de um prato (substitui a lista inteira) e consultá-la com a quantidade de porções possíveis com o estoque atual.
- **RF-08:** ao fechar uma conta, dar baixa nos ingredientes da ficha técnica de cada item, multiplicados pela quantidade pedida, registrando uma movimentação de venda por ingrediente ligada à comanda.

## Requisitos não funcionais

- **RNF-01:** quantidades com até 3 casas decimais (por exemplo 0,250 kg). As contas são feitas em milésimos inteiros para não acumular erro de arredondamento.
- **RNF-02:** toda mudança de quantidade gera uma movimentação; a quantidade do ingrediente é sempre a soma das movimentações.
- **RNF-03:** movimentações manuais travam a linha do ingrediente; a baixa da venda acontece na mesma transação do fechamento de conta.
- **RNF-04:** mensagens em português; 400 para regra violada, 404 para registro inexistente.

## Regras de negócio

- **RN-01:** nome do ingrediente único (sem diferenciar maiúsculas), de 2 a 80 caracteres; unidade `UN`, `KG`, `G`, `L` ou `ML` (P-4); mínimo maior ou igual a zero. Ingrediente novo começa com quantidade zero.
- **RN-02:** quantidades de entrada, perda e ficha técnica são maiores que zero e têm no máximo 3 casas decimais. Mensagem: "Informe uma quantidade maior que zero com até 3 casas decimais."
- **RN-03:** perda não pode deixar o estoque negativo. Mensagem: "Estoque insuficiente: há Q U de NOME."
- **RN-04:** contagem aceita zero ou mais; se for igual à quantidade atual, nada é gravado e a resposta informa que não houve diferença.
- **RN-05:** a baixa por venda pode deixar o estoque negativo (P-2).
- **RN-06:** a ficha técnica não pode repetir ingrediente; lista vazia apaga a ficha. Mensagem: "O ingrediente NOME aparece mais de uma vez na ficha técnica."
- **RN-07:** porções possíveis = menor valor, entre os ingredientes da ficha, de (estoque ÷ quantidade por porção), arredondado para baixo e nunca menor que zero. Prato sem ficha técnica não tem cálculo (valor nulo).
- **RN-08:** a baixa considera a ficha técnica no momento do fechamento; itens cujo prato saiu do cardápio não geram baixa. Comandas canceladas não geram baixa (P-3).
- **RN-09:** ingrediente usado em alguma ficha técnica não pode ser removido. Mensagem: "Remova NOME das fichas técnicas antes de excluir."

## Critérios de aceitação verificáveis

- **CA-01:** dado um ingrediente, quando registrar entrada, perda e contagem, então a quantidade final é a soma das movimentações e o histórico mostra as três.
- **CA-02:** quando a perda passar do estoque, então recebe erro de RN-03 e nada muda.
- **CA-03:** dado um prato com ficha técnica, quando fechar a conta com 2 unidades dele, então cada ingrediente baixa 2 × a quantidade da ficha, com movimentação de venda ligada à comanda.
- **CA-04:** dado estoque insuficiente, quando fechar a conta, então a conta fecha e o ingrediente fica negativo e aparece nos alertas.
- **CA-05:** quando cancelar uma comanda ou fechar conta de item sem ficha técnica, então nenhum estoque muda.
- **CA-06:** quando consultar a ficha técnica, então as porções possíveis seguem RN-07.
- **CA-07:** quando violar RN-01, RN-02, RN-06 ou RN-09, então recebe o erro correspondente.
- **CA-08:** quando listar alertas, então só aparecem ingredientes no mínimo ou abaixo, na ordem de RF-06.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | Converter quantidades, somar baixas, porções, ajuste, alertas | RN-02, RN-04, RN-07, RF-06 |
| T-02 | Ingrediente com 0 | Entrada 5, perda 1,5, contagem 3 | Quantidade 3; ajuste de −0,5 |
| T-03 | Ingrediente com 1 | Perda 2 | Erro RN-03 |
| T-04 | Prato com ficha (0,2 kg de peixe, 1 un de açaí) | Fechar conta com 2 pratos | Peixe −0,4; açaí −2; 2 movimentações de venda |
| T-05 | Peixe com 0,1 kg | Fechar conta com o prato | Conta paga; peixe −0,1 nos alertas |
| T-06 | Comanda cancelada | Cancelar | Estoque igual |
| T-07 | Ficha com ingrediente repetido | Salvar | Erro RN-06 |
| T-08 | Ingrediente em ficha | Remover | Erro RN-09 |
| T-09 | Vários ingredientes | Alertas | Ordem de RF-06 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos os cenários.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/stock/` (novo), `app.module.ts`, `app.service.ts` (`closeOrder` chama a baixa), `apps/api/test/`.
- **Persistência:** três tabelas novas; nenhuma coluna existente muda.
- **Backend pausado:** segue sem publicação.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Dependências:** SPEC de reservas (PR #3) por causa do empilhamento das branches.
- **Riscos:** baixa errada por arredondamento; fechamento de conta mais lento; cliente não querer estoque (P-1).
- **Mitigações:** contas em milésimos inteiros (RNF-01) com testes; baixa em poucas consultas por comanda; módulo isolado e fácil de desligar.

## Plano de implementação

1. Schema e migração.
2. Regras puras com testes unitários.
3. Módulo de estoque e ficha técnica.
4. Baixa no fechamento de conta.
5. Testes de integração.
6. Verificar CA-01 a CA-08; README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-13 | Criação e aprovação por Jéssica Lopes Melo, com regras provisórias P-1 a P-4 | aprovada |
| 2026-11-13 | CA-01 a CA-08 verificados na execução 43363922645 do GitHub Actions: 182 testes da API passando contra PostgreSQL 16 (módulo de estoque com 97,3% das linhas cobertas) e checagem de migrações sem diferença. Sete mutações nas regras puras fizeram testes falharem. O CI pegou erros de quantidade lançados de forma síncrona, corrigidos no serviço. Perguntas P-1 a P-4 seguem abertas para o cliente | implementada |
