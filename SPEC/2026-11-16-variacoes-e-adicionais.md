# Variações e adicionais dos itens do cardápio (API)

**Data:** 2026-11-16  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #27 (backlog 2.10)  
**Derroga:** em parte `SPEC/2026-10-01-restaurante.md`, no ponto em que o preço da linha da comanda é sempre o preço do item. Com variação, vale o preço da variação; com adicionais, o preço deles é somado. Item sem variação e sem adicional continua igual.

---

## Contexto e problema

Fato comprovado em 2026-11-16: não há como lançar "açaí de 500 ml" ou "tapioca com queijo extra". Hoje é preciso cadastrar um item para cada combinação. A issue #27 pede variações com preço próprio e adicionais com valor fixo, e que a linha da comanda guarde a escolha mesmo que o cardápio mude depois.

### Perguntas em aberto (para o cliente)

- **P-1:** item com variações cadastradas pode ser lançado sem escolher uma? Provisório: não; a variação é obrigatória quando existe.
- **P-2:** adicional gratuito existe (por exemplo "sem cebola")? Provisório: sim, adicional pode custar R$ 0,00.

## Objetivo

Cadastrar variações e adicionais por item, lançar na comanda com a escolha e guardar na linha o nome, a variação, os adicionais e o preço daquele momento.

## Escopo

- Tabelas `MenuVariant`, `MenuAddon` e `OrderItemAddon`; campo `OrderItem.variantName`.
- Rotas `GET` e `PUT /api/menu-items/:id/options` (troca a lista de variações e de adicionais do item).
- `POST /api/tables/:id/items` aceita `variantId` e `addonIds`, opcionais.
- O detalhe da comanda e a fila da cozinha mostram a variação e os adicionais da linha.

## Fora do escopo

- Telas no frontend.
- Adicional com quantidade (por exemplo "2× queijo") e limite de adicionais por grupo.
- Ficha técnica (estoque) por variação.

## Requisitos funcionais

- **RF-01:** `PUT /api/menu-items/:id/options` com `{ variants: [{ name, price }], addons: [{ name, price }] }` troca as variações e os adicionais do item; listas vazias tiram tudo.
- **RF-02:** `GET /api/menu-items/:id/options` devolve as variações (na ordem enviada) e os adicionais (por nome).
- **RF-03:** lançar item com `variantId` e `addonIds` cria a linha com nome `Item (Variação)`, `variantName`, os adicionais com nome e preço e o preço unitário = preço da variação (ou do item) + soma dos adicionais.
- **RF-04:** o detalhe da comanda e a fila da cozinha mostram os adicionais de cada linha.

## Requisitos não funcionais

- **RNF-01:** a troca das opções é uma transação.
- **RNF-02:** a linha guarda cópia de nome e preço; mudar ou apagar a variação ou o adicional depois não muda a comanda (critério da issue).

## Regras de negócio

- **RN-01:** nome de variação e de adicional de 1 a 60 caracteres, sem repetir dentro da mesma lista (sem diferenciar maiúsculas e acentos). Mensagens: "Informe o nome de cada opção, de 1 a 60 caracteres." e "A opção <nome> está repetida."
- **RN-02:** preço da variação maior que zero; preço do adicional zero ou mais (P-2); até 2 casas decimais. Mensagem: "Informe um preço válido para <nome>."
- **RN-03:** no máximo 20 variações e 30 adicionais por item. Mensagem: "Cadastre no máximo 20 variações e 30 adicionais por item."
- **RN-04:** item com variações exige variação ao lançar (P-1). Mensagem: "Escolha a variação de <item>: <variação 1>, <variação 2>."
- **RN-05:** a variação e os adicionais precisam ser deste item. Mensagens: "Variação não encontrada para este item." e "Adicional não encontrado para este item."
- **RN-06:** o mesmo adicional não pode vir duas vezes, e no máximo 10 por linha. Mensagens: "O adicional <nome> foi escolhido duas vezes." e "Escolha no máximo 10 adicionais por item."
- **RN-07:** preço unitário da linha = preço da variação (ou do item, sem variação) + soma dos adicionais; total da linha = preço unitário × quantidade (critério da issue).

## Critérios de aceitação verificáveis

- **CA-01:** o total da linha inclui variação e adicionais (critério da issue).
- **CA-02:** a comanda guarda a escolha mesmo que o cardápio mude depois: trocar preço, renomear ou apagar a opção não muda a linha (critério da issue).
- **CA-03:** item sem opções é lançado como antes; item com variações sem escolha é recusado; opção de outro item é recusada.
- **CA-04:** listas inválidas são recusadas sem apagar as opções que já existiam.
- **CA-05:** a cozinha vê os adicionais da linha.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Açaí com 300 e 500 ml e adicionais | Lançar 2 de 500 ml com granola e leite em pó | CA-01 |
| T-02 | Linha lançada | Mudar e apagar as opções | CA-02 |
| T-03 | Itens com e sem opções | Lançar com e sem escolha | CA-03 |
| T-04 | Item com opções | Trocar por listas inválidas | CA-04 |
| T-05 | Linha com adicionais | Enviar à cozinha | CA-05 |

- **Camada de teste:** regras puras (unitário) e API (integração com PostgreSQL).
- **Framework:** Vitest.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `schema.prisma`, nova migração, `apps/api/src/menu-options/` (novo), `app.service.ts`, `dto.ts`, `kitchen.service.ts`, `app.module.ts`, `apps/api/test/`.
- **Relatórios:** já usam o preço guardado na linha e o nome guardado; cada variação aparece como uma linha própria no relatório de vendas, sem mudança no código deles.
- **Frontend:** não muda enquanto nenhum item tiver variações.

## Dependências e riscos

- **Riscos:** preço da linha errado; comanda mudar quando o cardápio muda.
- **Mitigações:** preço calculado numa regra pura testada (RN-07) e cópia na linha (RNF-02).

## Plano de implementação

1. Regras puras com testes.
2. Schema e migração.
3. Serviço, rotas e lançamento com opções.
4. Testes de integração.
5. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 e P-2 | aprovada |
| 2026-11-16 | CA-01 a CA-05 verificados na execução 43957049686 do GitHub Actions: 635 testes da API passando contra PostgreSQL 16, módulo com 97,3% das linhas cobertas e regras com 100%; checagem de migrações sem diferença; relatório de vendas mostra a variação como linha própria. Mutações nas regras mortas pelos testes. P-1 e P-2 seguem abertas | implementada |
