# Restaurante — especificação do sistema

Data: 2026-10-01  
Status: versão inicial, escrita antes da implementação.

## Objetivo

Aplicação web para operar um restaurante: configurar mesas, manter o cardápio, lançar pedidos por mesa, encerrar contas e consultar o movimento financeiro em um período.

## Usuários e fluxo principal

O funcionário abre o painel, escolhe uma mesa livre ou ocupada e lança itens disponíveis com suas quantidades. A aplicação agrupa os itens em uma comanda aberta para a mesa. Ao fechar a conta, registra o pagamento, libera a mesa e preserva os valores históricos dos itens. O gerente mantém mesas e cardápio e consulta receitas, despesas e saldo em datas escolhidas.

## Requisitos funcionais

1. Cadastrar mesas com número e capacidade, listar e remover mesas livres. Mesas com comandas abertas não podem ser removidas.
2. Listar itens do cardápio, com nome, descrição opcional, categoria, preço e disponibilidade. Cadastrar, editar, ativar/desativar e remover itens sem apagar o histórico de pedidos.
3. Selecionar mesa, item disponível e quantidade inteira positiva para adicionar à comanda aberta. Adições posteriores acumulam na mesma comanda. Preço e nome são copiados para a linha do pedido no momento do lançamento.
4. Exibir total da comanda e permitir seu fechamento. O fechamento marca a comanda como paga e libera a mesa em uma transação.
5. Registrar despesas com descrição, valor e data. Consultar um relatório por início e fim inclusivos, mostrando vendas pagas, despesas, saldo e vendas por forma de pagamento.
6. Mostrar erros de validação e falhas de conexão em português, sem descartar dados digitados.

## Regras de negócio e critérios de aceitação

- Uma mesa tem no máximo uma comanda aberta.
- Não se pode pedir item indisponível, quantidade não positiva ou preço inválido.
- Alterar/remover o item do cardápio não altera linhas de comandas antigas.
- Fechar uma comanda duas vezes não duplica receita.
- O relatório considera apenas comandas pagas e despesas dentro do período selecionado; início posterior ao fim é inválido.
- Mesa ocupada não pode ser excluída. O último número de mesa não implica quantidade fixa: o gerente pode cadastrar e remover mesas conforme o estado.
- Valores são armazenados como decimais no PostgreSQL e exibidos em reais.

## Escopo da primeira entrega

Monorepo com API NestJS, interface Next.js/TypeScript e PostgreSQL via Prisma. Inclui painel de mesas, pedidos, cardápio e financeiro, validação da API, migração/seed e instruções locais. Autenticação, emissão fiscal, estoque, gorjeta e integração com adquirente ficam fora do escopo.

## Decisões técnicas

- API REST sob `/api`; a interface acessa a URL definida por `NEXT_PUBLIC_API_URL`.
- PostgreSQL como fonte persistente; Prisma para esquema, migrações e consultas.
- Valores monetários usam `Decimal` no banco e strings decimais na API para evitar arredondamento binário.
- Operações de fechar conta e liberar mesa são transacionais.
- O fechamento registra forma de pagamento (dinheiro, crédito, débito ou Pix).

## Verificação de aceite

- Instruções documentam como subir PostgreSQL, migrar e iniciar API e interface.
- Fluxos de mesas, cardápio, pedido, pagamento e relatório usam persistência PostgreSQL.
- Contagem de linhas de código versionado é registrada no README conforme o requisito da atividade.
- O README contém URL pública de apresentação quando houver implantação acessível.
