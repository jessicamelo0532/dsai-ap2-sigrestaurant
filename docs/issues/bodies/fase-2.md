## @issue 2.1 | Zonas do salão e mapa de mesas
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** O salão é uma lista plana de mesas. Um restaurante real organiza por área (varanda, salão, terrace).

**Escopo.**
- Cadastro de zonas e associação de mesas a uma zona.
- Mapa visual de mesas agrupado por zona, com estado (livre/ocupada).
- Filtro por zona nas telas de comanda.

**Critérios de aceite.**
- [ ] Toda mesa pertence a uma zona.
- [ ] O mapa mostra o estado de cada mesa em tempo real da sessão.

## @issue 2.2 | Transferência de comanda entre mesas e junção de contas
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Hoje uma comanda pertence a uma mesa para sempre. Trocar de mesa ou juntar duas contas exige refazer o pedido à mão.

**Escopo.**
- Transferência de comanda de uma mesa para outra, com registro do motivo.
- Junção de duas comandas em uma só, preservando os itens e os snapshots de preço.

**Critérios de aceite.**
- [ ] A transferência mantém todos os itens e o total.
- [ ] A junção de contas preserva o histórico de itens e não duplica pagamento.

## @issue 2.3 | Divisão de conta por consumidor
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Hoje a conta é indivisível. Grupos que dividem a conta precisam de fechamento por pessoa.

**Escopo.**
- Definição do modo de divisão: por item, por igual ou por valor.
- Comanda dividida em parcelas, com fechamento independente de cada uma.

**Critérios de aceite.**
- [ ] A soma das parcelas é igual ao total da comanda.
- [ ] Cada parcela pode ser paga de forma independente.

## @issue 2.4 | Display de produção (KDS) com envio do pedido para a cozinha
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** **Lacuna principal apontada na issue "Primeiras impressões"**: o garçom hoje apenas adiciona itens à comanda; não existe envio para a cozinha, status de preparo nem controle de tempo.

**Escopo.**
- Ação de enviar o pedido, com a comanda passando a um estado "enviada".
- Tela de produção (KDS) listando os pedidos enviados por ordem de chegada.
- Confirmação de preparo pela cozinha.

**Critérios de aceite.**
- [ ] O garçom envia o pedido e a cozinha o vê na tela de produção.
- [ ] A comanda enviada não pode mais ter itens editados.

## @issue 2.5 | Temporizadores e prioridade de preparo
labels: fase-2, produto, precisa-spec
depende: 2.4
spec: SPEC nova obrigatória

**Contexto.** Sem tempo nem prioridade, a cozinha não sabe o que sair primeiro.

**Escopo.**
- Tempo decorrido desde o envio, destacado por faixa de atraso.
- Prioridade manual do pedido, com registro de quem alterou.

**Critérios de aceite.**
- [ ] O KDS mostra o tempo de espera de cada pedido.
- [ ] A prioridade alterada aparece em ordem na fila.

## @issue 2.6 | Impressão de cupom e bobina de comanda
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Não há comanda impressa nem cupom da conta.

**Escopo.**
- Layout de bobina (comanda) e de cupom (conta fechada), com identificação do restaurante.
- Impressão via `window.print()` com CSS de impressão, sem dependência externa.

**Critérios de aceite.**
- [ ] A bobina lista itens, quantidades e total.
- [ ] O cupom lista forma de pagamento, total e data.

## @issue 2.7 | PWA offline e leitura de código de mesa
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** O garçom no salão precisa de acesso rápido e funciona em rede instável.

**Escopo.**
- Manifesto e service worker para abrir o app e abrir comandas sem rede.
- Leitura de QR code da mesa com a câmera, abrindo a comanda correspondente.

**Critérios de aceite.**
- [ ] O app abre e lista as mesas sem conexão.
- [ ] O QR code da mesa abre a comanda certa.

## @issue 2.8 | Controle de garçom por comanda e comissão
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Não há dono da comanda; com isso não há quem responder pela conta nem como calcular comissão.

**Escopo.**
- Garçom atribuído à comanda no momento da abertura.
- Relatório de comandas por garçom e cálculo de comissão sobre o total pago.

**Critérios de aceite.**
- [ ] Toda comanda tem um garçom atribuído.
- [ ] O relatório por garçom soma exatamente a receita das comandas dele.

## @issue 2.9 | Categorias de cardápio com ordenação
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** A categoria é texto livre digitado no item; não há cadastro nem ordenação.

**Escopo.**
- Cadastro de categorias com ordem de exibição.
- Item do cardápio passa a escolher uma categoria cadastrada.

**Critérios de aceite.**
- [ ] As categorias aparecem na tela de adição de item.
- [ ] A ordem definida no cadastro é respeitada na listagem.

## @issue 2.10 | Variantes e adicionais de item
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Não há forma de registrar "tamanho P ou G" ou "com borda".

**Escopo.**
- Variantes com preço próprio e adicionais cobrados por valor fixo.
- Linhas da comanda guardam a variante e os adicionais escolhidos.

**Critérios de aceite.**
- [ ] O total da linha inclui variante e adicionais.
- [ ] A comanda preserva a escolha mesmo que o cardápio mude depois.

## @issue 2.11 | Disponibilidade por horário e dia da semana
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Hoje a disponibilidade é um interruptor único: item pausado some do cardápio o dia inteiro.

**Escopo.**
- Janelas de disponibilidade por dia da semana e faixa de horário.
- O item aparece no cardápio apenas dentro da janela configurada.

**Critérios de aceite.**
- [ ] Fora da janela, o item não é adicionado à comanda.
- [ ] Item sem janela configurada mantém o comportamento atual (sempre disponível).

## @issue 2.12 | Ingredientes, receitas e ficha técnica de prato
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Sem ficha técnica, o dono não sabe quanto custa produzir um prato.

**Escopo.**
- Cadastro de ingredientes com unidade e custo.
- Receita por item do cardápio, com a quantidade de cada ingrediente.
- Custo e margem calculados por prato.

**Critérios de aceite.**
- [ ] O custo do prato é a soma dos ingredientes da receita.
- [ ] A margem aparece no cardápio administrativo.

## @issue 2.13 | Estoque, consumo por prato e perdas
labels: fase-2, produto, precisa-spec
depende: 2.12
spec: SPEC nova obrigatória

**Contexto.** Sem estoque, não há como saber se falta insumo nem o querilhar.

**Escopo.**
- Saldo de estoque por ingrediente.
- Baixa automática de consumo quando o prato é vendido.
- Registro de perda, avaria e ajuste manual com justificativa.

**Critérios de aceite.**
- [ ] Vender um prato baixa os ingredientes da receita.
- [ ] Toda perda fica registrada com valor e motivo.

## @issue 2.14 | Fornecedores, compras e entrada de mercadoria
labels: fase-2, produto, precisa-spec
depende: 2.13
spec: SPEC nova obrigatória

**Contexto.** Hoje a despesa é digitada à mão, sem nota, sem fornecedor e sem baixa de estoque.

**Escopo.**
- Cadastro de fornecedores.
- Registro de compra com itens, valores e entrada automática no estoque.
- Vínculo entre a compra e a despesa financeira.

**Critérios de aceite.**
- [ ] A entrada de mercadoria soma ao saldo do ingrediente.
- [ ] A despesa da compra aparece no relatório financeiro do período.

## @issue 2.15 | Fechamento de caixa por turno (abertura, sangria, entrada, conferência)
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** **Lacuna apontada na issue "Primeiras impressões"**: o relatório mostra quanto entrou e saiu, mas não há turno de caixa — quem abriu, quem fechou, quanto havia no cofre.

**Escopo.**
- Abertura de turno com valor inicial e usuário responsável.
- Sangrias e entradas de dinheiro com justificativa.
- Fechamento de turno com conferência: esperado por forma de pagamento versus informado.
- Divergência de caixa sinalizada no fechamento.

**Critérios de aceite.**
- [ ] O fechamento compara o total das comandas pagas do turno com o valor informado.
- [ ] Divergência aparece explicitamente e não é silenciosamente absorvida.

## @issue 2.16 | Contas a receber e a pagar
labels: fase-2, produto, precisa-spec
depende: 2.15
spec: SPEC nova obrigatória

**Contexto.** Não há conceito de parcelamento de cliente nem de conta de fornecedor.

**Escopo.**
- Contas a receber geradas por venda a prazo, com vencimento.
- Contas a pagar ligadas a compras.
- Baixa por pagamento e status de vencido/quitado.

**Critérios de aceite.**
- [ ] Uma venda a prazo entra no contas a receber e não na receita de caixa do turno.
- [ ] O saldo total do contas a receber bate com a soma dos títulos.

## @issue 2.17 | Relatório de produtos mais vendidos e ticket médio
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** O dono não consegue responder "o que vender amanhã" com o relatório atual.

**Escopo.**
- Ranking de itens por quantidade e por faturamento no período.
- Ticket médio (receita dividida por comandas pagas) e por garçom.

**Critérios de aceite.**
- [ ] O ranking soma exatamente o total de linhas do período.
- [ ] O ticket médio é a receita dividida pelo número de comandas pagas.

## @issue 2.18 | Relatório por categoria, por hora e por forma de pagamento
labels: fase-2, produto, precisa-spec
depende: 2.17
spec: SPEC nova obrigatória

**Contexto.** Hoje só há o total por forma de pagamento; falta a leitura por categoria e por horário (para dimensionar o turno).

**Escopo.**
- Receita por categoria de cardápio.
- Receita por faixa de hora do dia.
- Cruzamento categoria × hora.

**Critérios de aceite.**
- [ ] A soma por categoria é igual à receita total do período.
- [ ] As faixas horárias cobrem 100% das comandas pagas.

## @issue 2.19 | DRE do mês e fechamento mensal
labels: fase-2, produto, precisa-spec
depende: 2.15, 2.17
spec: SPEC nova obrigatória

**Contexto.** Não há visão financeira consolidada do mês.

**Escopo.**
- DRE simplificada: receita, custo, despesas, resultado do mês.
- Fechamento mensal comsnapshot do período, para comparar com o mês anterior.

**Critérios de aceite.**
- [ ] A DRE do mês bate com o relatório financeiro do mesmo período.
- [ ] O mês fechado não muda com lançamentos posteriores, ou exibe aviso de reabertura.

## @issue 2.20 | Metas de vendas e comparativo com o período anterior
labels: fase-2, produto, precisa-spec
depende: 2.19
spec: SPEC nova obrigatória

**Contexto.** Sem meta, não há como avaliar o desempenho do mês.

**Escopo.**
- Cadastro de meta mensal (receita, comandas, ticket médio).
- Comparativo do período com o mesmo período anterior, com percentual de atingimento.

**Critérios de aceite.**
- [ ] O percentual de atingimento usa a meta do período correto.
- [ ] O comparativo usa o mesmo tamanho de janela do período anterior.

## @issue 2.21 | Cadastro de clientes e histórico de consumo
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Não há cadastro de cliente; o consumo é anônimo.

**Escopo.**
- Cadastro de cliente com nome, telefone e observação.
- Vínculo opcional do cliente à comanda.
- Histórico de consumo e visitas por cliente.

**Critérios de aceite.**
- [ ] O histórico do cliente soma as comandas pagas vinculadas a ele.
- [ ] O cadastro aceita cliente sem telefone, sem duplicar nome e telefone.

## @issue 2.22 | Programa de fidelidade
labels: fase-2, produto, precisa-spec
depende: 2.21
spec: SPEC nova obrigatória

**Contexto.** Sem fidelidade, não há retenção — e o histórico de clientes já permite o acúmulo de pontos.

**Escopo.**
- Regras de pontuação por valor consumido.
- Saldo de pontos do cliente e resgate como desconto na comanda.

**Critérios de aceite.**
- [ ] Os pontos creditados batem com a regra configurada.
- [ ] O resgate não deixa o total da comanda negativo.

## @issue 2.23 | Reservas de mesa
labels: fase-2, produto, precisa-spec
depende: 2.21
spec: SPEC nova obrigatória

**Contexto.** Não há como saber que a mesa 3 está reservada às 20h.

**Escopo.**
- Reserva com data, hora, número de pessoas e mesa (ou preferência de mesa).
- Indicação de conflito e opção de espera.
- Conversão da reserva em comanda.

**Critérios de aceite.**
- [ ] Reserva fora do horário de funcionamento é recusada.
- [ ] A reserva convertida gera comanda com os mesmos itens.

## @issue 2.24 | Delivery: pedidos e taxas
labels: fase-2, produto, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** Não há venda fora do salão, nem taxa de entrega.

**Escopo.**
- Pedido de delivery com endereço, itens e taxa.
- Cálculo do total com taxa e forma de pagamento.
- Separação do pedido de delivery na cozinha.

**Critérios de aceite.**
- [ ] O total do delivery inclui a taxa de entrega.
- [ ] O pedido de delivery aparece no relatório financeiro da categoria correta.

## @issue 2.25 | Módulos NestJS para mesas, comandas e cardápio
labels: fase-2, backend, precisa-spec
depende: 1.1
spec: SPEC nova obrigatória

**Contexto.** O backend pausado não cobre toda a superfície do frontend.

**Escopo.**
- Módulo de mesas, módulo de comandas (itens, edição, fechamento) e módulo de cardápio.
- Contrato de API espelhando as rotas já usadas pelo frontend.

**Critérios de aceite.**
- [ ] As rotas do frontend funcionam contra a API com o mesmo contrato.
- [ ] Testes de integração cobrem abertura, edição e fechamento de comanda.

## @issue 2.26 | Módulos NestJS para despesas, relatórios e caixa
labels: fase-2, backend, precisa-spec
depende: 2.15
spec: SPEC nova obrigatória

**Contexto.** A paridade de API precisa acompanhar o módulo de caixa.

**Escopo.**
- Módulo de despesas, módulo de relatórios financeiros e módulo de caixa (turno, sangria, conferência).

**Critérios de aceite.**
- [ ] O relatório da API devolve os mesmos valores do frontend.
- [ ] O fechamento de turno pela API registra a divergência de caixa.

## @issue 2.27 | Módulos NestJS para estoque, clientes e reservas
labels: fase-2, backend, precisa-spec
depende: 2.13, 2.21
spec: SPEC nova obrigatória

**Contexto.** Mesma paridade, agora para os módulos novos de estoque e clientes.

**Escopo.**
- Módulo de estoque (saldo, consumo por prato, perdas), módulo de clientes e módulo de reservas.

**Critérios de aceite.**
- [ ] A baixa de estoque por venda funciona via API.
- [ ] A reserva e o cliente têm endpoints com validação equivalente à do frontend.

## @issue 2.28 | Testes de integração da API contra PostgreSQL
labels: fase-2, backend, testes
depende: 2.25
spec: SPEC nova obrigatória

**Contexto.** Testes de API exigem banco real para validar transação, constraint e migração.

**Escopo.**
- Ambiente de teste com PostgreSQL efêmero (serviço de containers em CI ou base local).
- Testes de integração dos módulos de mesas, comandas, cardápio, despesas e caixa.

**Critérios de aceite.**
- [ ] A suíte de integração sobe com o banco de teste em um comando.
- [ ] Nenhum teste depende de dados deixados por outro teste.
