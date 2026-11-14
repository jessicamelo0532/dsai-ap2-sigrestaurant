# SPEC — Convenções e regras das especificações

Este diretório é a **fonte da verdade do comportamento pretendido** do produto. Nenhuma funcionalidade nova ou mudança de comportamento deve existir sem uma SPEC datada que a descreva.

## 1. Arquivos e nomenclatura

- Nome: `AAAA-MM-DD-<slug-curto>.md` (ex.: `2026-11-10-edicao-quantidade-comanda.md`).
- Um arquivo por funcionalidade/mudança; mudanças grandes podem usar um índice na própria SPEC.
- Idioma: português.
- Criar sempre a partir de `TEMPLATE.md`.
- Incluir na SPEC: **Identificação, Data e Status** no topo.

## 2. Status possíveis

| Status | Significado |
|---|---|
| `rascunho` | Escrita em andamento; perguntas em aberto; não implementar ainda |
| `aprovada` | Aprovada por humano; autoriza implementação |
| `implementada` | Código entregue, critérios de aceitação verificados |
| `desatualizada` | O código mudou depois; precisa de revisão ou substituição |
| `derrogada` | Substituída por SPEC mais recente (registrar qual) |

O status deve ser atualizado **na mesma mudança** que altera o estado real.

## 3. Ciclo de vida (Spec-Driven Development)

1. Identificar a necessidade (fato ou pedido do usuário).
2. Ler `AGENTS.md`, `README.md` e SPECs existentes relacionadas.
3. Criar `SPEC/AAAA-MM-DD-<slug>.md` em `rascunho`.
4. Tirar perguntas em aberto com o humano (nunca inventar regra de negócio).
5. Obter aprovação → status `aprovada`.
6. Implementar **somente** o que está no escopo, com testes.
7. Verificar critérios de aceitação um a um.
8. Atualizar status para `implementada` e atualizar `README.md` se o estado do produto mudar.
9. Commit pequeno com trailer `Spec: SPEC/AAAA-MM-DD-<slug>.md`.

## 4. Regras de imutabilidade

- **SPECs históricas são imutáveis:** `SPEC/2026-10-01-restaurante.md` e `SPEC/2026-10-01-frontend-local.md` não devem ser editadas retroativamente.
- Mudança de comportamento que atinja as specs históricas: criar **nova SPEC datada**, declarando no "Contexto e problema" o que foi derrogado e por quê.
- Este `README.md` e o `TEMPLATE.md` podem ser ajustados por decisão humana; alterações aqui afetam convenções futuras, não as SPECs já escritas.

## 5. Relação com o código

- A SPEC descreve **comportamento**, não detalhes de implementação, salvo quando a decisão técnica for restrição obrigatória (ex.: persistência em `localStorage`, stack pausada).
- Divergência SPEC × código detectada durante trabalho: **reportar ao humano** e registrar em pendência — não escolher silenciosamente um dos lados.
- Após cada mudança de comportamento, revisar se outras SPECs do domínio ficaram desatualizadas.

## 6. Critérios de aceitação

- Devem ser **verificáveis** (dado/quando/então ou passo a passo observável).
- Sem critérios verificáveis, a funcionalidade não pode ser aprovada.
- A entrega lista cada critério → método de verificação → resultado (incluindo resultado de testes automatizados e build).

## 7. Testes

- A SPEC deve indicar a **camada de teste** (store/regras de negócio, componente, ou API) e, se não houver runner no repositório, propor o framework a ser usado (sujeito a aprovação humana).
- Cenários de teste da SPEC viram testes automatizados reais — nunca testes vazios ou contadores artificiais.

## 8. Referências

- Modelo: `TEMPLATE.md`.
- Regras permanentes de conduta: `../AGENTS.md`.
- Contexto humano do trabalho: `../AGENTS/README.md`.
- Especificações históricas: `2026-10-01-restaurante.md`, `2026-10-01-frontend-local.md`.
