# Ficha técnica e margem no cardápio (modo navegador)

**Data:** 2026-11-19  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** issue #29 (`2.12 | Ingredientes, receitas e ficha técnica de prato`)  
**Derroga:** complementa `SPEC/2026-11-13-estoque-de-ingredientes.md`, que deixou as telas de frontend e o custo de ingrediente fora do escopo. A API de estoque continua sem custo; esta SPEC cobre o modo navegador, que é o produto ativo.

---

## Contexto e problema

O cardápio mostra o preço de venda, mas o dono não sabe quanto custa produzir cada prato. A API já tem ingredientes, ficha técnica e baixa de estoque, porém sem custo por ingrediente e sem tela. O produto ativo é o frontend em `localStorage`, então a ficha técnica precisa existir nele.

Decisões do responsável humano nesta sessão:

- O custo do ingrediente é **informado manualmente** por unidade.
- A margem é **percentual sobre o preço de venda**: `(preço − custo) / preço`.
- A tela fica no **cardápio administrativo**.

## Objetivo

Permitir cadastrar ingredientes com custo, montar a ficha técnica de cada item do cardápio e ver o custo e a margem do prato no modo navegador.

## Escopo

- Cadastro de ingredientes no `localStorage`: nome, unidade e custo por unidade.
- Ficha técnica por item do cardápio: lista de ingredientes com quantidade.
- Cálculo do custo do prato e da margem percentual.
- Aba **Ficha técnica** dentro de Cardápio, com cadastro de ingredientes e editor de receita.
- Bloqueio de ingrediente repetido na ficha e de remoção de ingrediente usado.

## Fora do escopo

- Paridade com a API de estoque (`/api/stock`) e migração de custo para o Prisma.
- Baixa automática de estoque, compras, perdas, inventário e conversão entre unidades.
- Custo médio ou cálculo automático a partir de compras.
- Alterar o formato dos dados existentes de mesas, comandas e cardápio.

## Requisitos funcionais

- **RF-01:** cadastrar, listar, editar e remover ingredientes com nome, unidade e custo.
- **RF-02:** definir a ficha técnica de um item do cardápio com ingrediente e quantidade; salvar substitui a ficha inteira.
- **RF-03:** calcular o custo do prato como a soma de `custo do ingrediente × quantidade` da ficha.
- **RF-04:** exibir a margem percentual do prato no cardápio administrativo.
- **RF-05:** impedir a remoção de ingrediente usado em alguma ficha técnica.

## Requisitos não funcionais

- **RNF-01:** valores monetários em reais com duas casas; quantidades com até três casas.
- **RNF-02:** mensagens em português, no mesmo tom das telas existentes.
- **RNF-03:** dados antigos do `localStorage` continuam válidos: `ingredients` e `recipes` ausentes viram listas vazias.
- **RNF-04:** a tela funciona no modo navegador; no modo servidor mostra que a paridade da API ainda não existe.

## Regras de negócio

- **RN-01:** nome do ingrediente tem de 2 a 80 caracteres, único sem diferenciar maiúsculas, acentos e espaços extras.
- **RN-02:** unidade é `UN`, `KG`, `G`, `L` ou `ML`; custo é maior ou igual a zero, com até duas casas decimais.
- **RN-03:** quantidade da ficha é maior que zero e tem até três casas decimais.
- **RN-04:** a ficha não pode repetir ingrediente. Mensagem: "O ingrediente já está na ficha técnica."
- **RN-05:** custo do prato = soma de `custo × quantidade`; margem = `(preço − custo) / preço × 100`, arredondada a uma casa decimal. Preço zero ou negativo não tem margem (valor nulo).
- **RN-06:** ingrediente usado em ficha não pode ser removido. Mensagem: "Remova o ingrediente das fichas técnicas antes de excluir."
- **RN-07:** remover um item do cardápio remove a ficha técnica dele.
- **RN-08:** a ficha é salva por item do cardápio; lista vazia apaga a ficha.

## Critérios de aceitação verificáveis

- **CA-01:** dado um ingrediente com custo, quando salvar a ficha de um prato, então o custo exibido é a soma dos ingredientes da receita.
- **CA-02:** quando o preço do prato for maior que zero, então a margem aparece no cardápio administrativo como percentual.
- **CA-03:** quando tentar remover ingrediente usado, então a remoção é recusada com a mensagem de RN-06.
- **CA-04:** quando tentar repetir ingrediente na ficha, então o salvamento é recusado com a mensagem de RN-04.
- **CA-05:** dados antigos sem `ingredients`/`recipes` continuam abrindo o app.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Ingredientes com custo | Montar ficha de um prato | Custo = soma das linhas |
| T-02 | Preço e custo conhecidos | Abrir a ficha | Margem percentual de RN-05 |
| T-03 | Ingrediente em uso | Tentar excluir | Erro de RN-06 |
| T-04 | Ficha com ingrediente | Repetir o ingrediente | Erro de RN-04 |
| T-05 | Dados antigos sem as listas | Abrir o app | Listas vazias, sem erro |

- **Camada de teste:** regras puras (`lib/ficha-tecnica.ts`) e componente (`app/ficha-tecnica-panel.tsx`).
- **Framework:** Vitest + Testing Library, já configurados.
- **Automação prevista:** T-01 a T-05.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/types.ts`, `apps/web/lib/ficha-tecnica.ts` (novo), `apps/web/lib/local-store.ts`, `apps/web/app/ficha-tecnica-panel.tsx` (novo), `apps/web/app/page.tsx`, testes.
- **Persistência:** duas listas novas no objeto do `localStorage`; nenhuma chave nova e nenhuma alteração nos dados existentes.
- **Backend pausado:** não toca na API; a paridade fica pendente.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build.

## Dependências e riscos

- **Dependências:** nenhuma decisão pendente; o custo manual foi confirmado nesta sessão.
- **Riscos:** divergência com a API de estoque; arredondamento de custo/margem; dados antigos sem as listas.
- **Mitigações:** cálculos em centavos e testes; leitura tolerante a listas ausentes; tela separada do fluxo de comanda.

## Plano de implementação

1. Criar esta SPEC.
2. Adicionar tipos e regras puras com testes.
3. Adicionar as listas e rotas no `local-store`.
4. Criar a aba Ficha técnica e ligar no cardápio.
5. Rodar testes e build; verificar os critérios de aceitação.
6. Atualizar o status e o README se necessário.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-19 | Criação e implementação | implementada |
