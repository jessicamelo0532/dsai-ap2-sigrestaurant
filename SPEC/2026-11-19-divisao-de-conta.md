# Divisão de conta por consumidor

**Data:** 2026-11-19  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** SPEC/2026-10-01-restaurante.md; SPEC/2026-10-01-frontend-local.md  
**Derroga:** n/a

## Contexto e problema

Hoje a comanda só fecha inteira, com uma única forma de pagamento. O usuário pediu para dividir a conta entre consumidores, com três modos (por item, por igual e por valor), e decidiu que a comanda só fecha quando todas as parcelas estiverem pagas. A mudança é só no frontend local-first; o backend pausado não participa do build.

### Perguntas em aberto

- nenhuma (decisões registradas pelo humano em 2026-11-19).

## Objetivo

Permitir que uma comanda aberta seja dividida em parcelas por consumidor, pagas individualmente, fechando a mesa automaticamente quando a última parcela for paga.

## Escopo

- Três modos de divisão: `EQUAL` (por igual), `ITEM` (cada linha da comanda fica inteira com uma pessoa) e `VALUE` (valor informado por pessoa).
- Persistência das parcelas no `localStorage`, dentro da própria comanda.
- Pagamento individual de cada parcela com forma de pagamento própria.
- Fechamento automático da comanda quando todas as parcelas estiverem pagas.
- Bloqueio de alteração de itens, junção e fechamento manual enquanto houver divisão ativa.
- Desfazer a divisão enquanto nenhuma parcela foi paga.
- Relatório financeiro somando cada parcela pela sua forma de pagamento.

## Fora do escopo

- Paridade com `apps/api` (backend pausado); a API não recebe endpoints de divisão nesta SPEC.
- Divisão parcial de uma linha com quantidade maior que 1 (a linha inteira pertence a uma pessoa).
- Gorjeta, taxa de serviço, emissão fiscal e integração com adquirente.
- Alteração da chave ou do formato geral do `localStorage` além do novo campo opcional `splits` na comanda.

## Requisitos funcionais

- **RF-01:** dividir o total a pagar por igual entre 2 e 50 pessoas, com a última parcela absorvendo o resto dos centavos.
- **RF-02:** dividir por item, atribuindo cada linha da comanda a exatamente uma pessoa; o desconto por pontos é rateado proporcionalmente.
- **RF-03:** dividir por valor, exigindo que a soma das parcelas seja exatamente igual ao total a pagar.
- **RF-04:** pagar cada parcela individualmente, com forma de pagamento `CASH`, `CREDIT`, `DEBIT` ou `PIX`.
- **RF-05:** fechar a comanda automaticamente quando todas as parcelas forem pagas; usar `MIXED` quando houver mais de uma forma de pagamento.
- **RF-06:** desfazer a divisão enquanto nenhuma parcela tiver sido paga.
- **RF-07:** mostrar no relatório financeiro o valor de cada parcela na forma de pagamento usada.

## Requisitos não funcionais

- **RNF-01:** mensagens em pt-BR e valores monetários com duas casas decimais.
- **RNF-02:** regras de cálculo puras e testáveis, separadas da tela e do armazenamento.
- **RNF-03:** não alterar dados existentes; `splits` é opcional e ausente em comandas antigas.

## Regras de negócio

- **RN-01:** a divisão só pode ser criada em comanda `OPEN` com pelo menos um item.
- **RN-02:** são permitidas de 2 a 50 parcelas; cada parcela precisa de nome e valor maior que zero.
- **RN-03:** a soma das parcelas deve ser exatamente igual ao total a pagar (`subtotal − desconto`).
- **RN-04:** no modo por item, cada linha pertence a uma única pessoa e cada pessoa precisa de pelo menos uma linha.
- **RN-05:** no modo por item, o desconto é rateado proporcionalmente ao valor de cada pessoa; a última parcela absorve a diferença de arredondamento.
- **RN-06:** enquanto a comanda tiver `splits`, adicionar, alterar ou remover itens e juntar comandas é bloqueado com a mensagem `Cancele a divisão antes de alterar os itens da comanda.`
- **RN-07:** a comanda só fecha quando todas as parcelas estiverem pagas; o fechamento manual fica indisponível na tela enquanto houver divisão.
- **RN-08:** não é possível desfazer a divisão depois que qualquer parcela foi paga.
- **RN-09:** o pagamento de uma parcela já paga é recusado.

## Critérios de aceitação verificáveis

- **CA-01:** Dado uma comanda de R$ 60,00, quando dividir por igual entre 2 pessoas, então cada parcela fica em R$ 30,00.
- **CA-02:** Dado uma comanda com itens de R$ 45,00 e R$ 15,00, quando dividir por item atribuindo um item a cada pessoa, então as parcelas ficam em R$ 45,00 e R$ 15,00.
- **CA-03:** Dado o modo por valor, quando a soma das parcelas não fechar no total, então a criação é recusada com `A soma das parcelas precisa ser igual ao total da comanda.`
- **CA-04:** Dado uma divisão com duas parcelas, quando pagar a primeira, então a comanda continua aberta; quando pagar a segunda, então a comanda fecha e a mesa é liberada.
- **CA-05:** Dado uma divisão sem parcelas pagas, quando desfazer, então a comanda volta ao estado não dividido.
- **CA-06:** Dado uma divisão ativa, quando tentar alterar item ou juntar comanda, então a operação é recusada.
- **CA-07:** Dado uma comanda dividida paga com Pix e dinheiro, quando gerar o relatório, então cada parcela aparece na forma de pagamento correspondente.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Comanda de R$ 60,00 | Dividir por igual entre 2 | Parcelas de R$ 30,00 |
| T-02 | Comanda de R$ 100,00 | Dividir por igual entre 3 | R$ 33,33, R$ 33,33 e R$ 33,34 |
| T-03 | Itens de R$ 45,00 e R$ 15,00 | Dividir por item | Parcelas de R$ 45,00 e R$ 15,00 |
| T-04 | Itens de R$ 45,00 e R$ 15,00 com R$ 10,00 de desconto | Dividir por item | R$ 37,50 e R$ 12,50 |
| T-05 | Modo por valor | Somar R$ 20,00 + R$ 20,00 em comanda de R$ 60,00 | Erro de soma |
| T-06 | Duas parcelas | Pagar as duas | Comanda `PAID` e `onClosed` chamado |
| T-07 | Divisão sem pagamento | Desfazer | Volta ao formulário de divisão |
| T-08 | Divisão ativa | Alterar item ou juntar | Erro `Cancele a divisão antes de alterar os itens da comanda.` |

- **Camada de teste:** regras de negócio (`lib/divisao`) e componente (`app/divisao-conta`).
- **Framework:** Vitest + Testing Library (já configurado no repositório).
- **Automação prevista:** T-01 a T-08 em testes automatizados; relatório verificado por teste de regra/local-store quando aplicável.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/types.ts`, `apps/web/lib/divisao.ts`, `apps/web/lib/local-store.ts`, `apps/web/lib/impressao.ts`, `apps/web/app/divisao-conta.tsx`, `apps/web/app/page.tsx`.
- **Persistência:** novo campo opcional `splits` em `Order`; dados antigos continuam válidos.
- **Backend pausado:** não tocar; sem paridade nesta SPEC.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** build do frontend; sem mudança de configuração.

## Dependências e riscos

- **Dependências:** `dueCents`/`subtotalCents` de `lib/comanda.ts`; decisões humanas de 2026-11-19.
- **Riscos:** erro de arredondamento na soma das parcelas; fechamento indevido; relatório divergente.
- **Mitigações:** validação da soma no cliente e no `local-store`; testes de regra e de componente; relatório somando parcelas pagas.

## Plano de implementação

1. Criar tipos `OrderSplit`/`OrderSplitItem` e funções puras de divisão.
2. Adicionar rotas de criar/pagar/desfazer divisão no `local-store`, com bloqueios e relatório.
3. Criar o componente de divisão e integrar na comanda.
4. Executar testes da camada afetada e build; registrar resultado.
5. Verificar item a item os Critérios de Aceitação; registrar resultado.
6. Atualizar status desta SPEC e `README.md` se necessário.
7. Commit pequeno com `Agent:` e `Spec:` no corpo.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-19 | Criação da SPEC com decisões humanas | aprovada |
| 2026-11-19 | Implementação no modo navegador; 569 testes e build verdes | implementada |
