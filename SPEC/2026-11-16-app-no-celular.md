# App inteiro utilizável no celular

**Data:** 2026-11-16  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** nova, a partir da entrevista com o cliente (`docs/entrevistas/2026-11-13-cliente.md`, prioridade 3.3); complementa `SPEC/2026-11-16-visao-do-salao.md`  
**Derroga:** n/a (só muda a apresentação em telas de até 650 px; nenhuma regra de negócio muda)

---

## Contexto e problema

O cliente pediu que o sistema funcione bem no celular:

> os botões terem um tamanho bom, os textos ficarem legíveis e dar pra lançar pedidos sem precisar ampliar a tela.

Fato comprovado em 2026-11-16, medindo o app numa tela de 375 px (script `apps/web/e2e/celular.mjs`): na Visão geral há **75 problemas**. Textos de 8 a 13 px (nomes dos pratos no cardápio rápido com 9 px, legendas com 8 px), botões de 16 a 41 px de altura ("Nova mesa" com 16 px, "Remover item" com 22×24 px), campos de digitação com fonte de 10 px (o celular amplia a tela ao tocar num campo com menos de 16 px) e o menu lateral espremido numa coluna de 72 px com os nomes escondidos. A tela Salão já foi feita dentro dos limites.

### Perguntas em aberto

- nenhuma. Os limites usados são referências conhecidas de acessibilidade: alvo de toque de 44 px (WCAG 2.5.5) e 16 px em campos para o navegador do celular não ampliar a tela.

## Objetivo

Em telas de até 650 px, todo o app pode ser usado com o dedo, sem ampliar a tela: texto legível, alvos de toque confortáveis, campos que não disparam zoom e navegação ao alcance do polegar.

## Escopo

- Estilos para telas de até 650 px em `apps/web/app/globals.css`.
- Menu lateral vira **barra de navegação fixa no rodapé**, com ícone e nome de cada seção.
- Verificação automática `apps/web/e2e/celular.mjs` com Chrome em modo celular, rodando no CI.
- Script `npm run e2e:celular` e dependência de desenvolvimento `playwright-core` no `apps/web`.

## Fora do escopo

- Mudar o layout de computador (acima de 650 px).
- Funcionar sem internet ou instalar como aplicativo (issue 2.7, PWA).
- Tema escuro, idiomas.

## Requisitos funcionais

- **RF-01:** em até 650 px, a navegação fica numa barra fixa no rodapé com as quatro seções, cada uma com ícone e nome visível.
- **RF-02:** lançar um pedido (escolher mesa, escolher item, ajustar quantidade) e fechar a conta funcionam sem ampliar a tela.
- **RF-03:** os formulários (mesa, item do cardápio, despesa, fechamento de conta) ocupam a largura da tela e ficam acima da barra de navegação.

## Requisitos não funcionais

- **RNF-01:** nenhum texto visível com menos de 14 px.
- **RNF-02:** nenhum botão, link ou campo com menos de 44 px de altura; botões também com pelo menos 44 px de largura.
- **RNF-03:** campos de digitação com fonte de 16 px ou mais.
- **RNF-04:** sem rolagem lateral em 375 px.
- **RNF-05:** acima de 650 px, nada muda.

## Regras de negócio

- Não se aplica: a SPEC só muda a apresentação.

## Critérios de aceitação verificáveis

- **CA-01:** dado o app numa tela de 375 px, quando `npm run e2e:celular` percorre Visão geral (com e sem comanda), Fechar conta, Adicionar mesa, Salão, Cardápio, Novo item, Financeiro e Registrar despesa, então nenhuma tela tem problema de RNF-01 a RNF-04.
- **CA-02:** no CI, um push que reduza um texto para menos de 14 px no celular deixa o job vermelho.
- **CA-03:** numa tela de 1366 px, a aparência do app é a mesma de antes (comparação por print).

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | App em 375 px | `npm run e2e:celular` | Todas as telas "ok" |
| T-02 | Regra quebrada de propósito | Rodar o script | Sai com código 1 e aponta o elemento |
| T-03 | App em 1366 px | Print antes e depois | Iguais |

- **Camada de teste:** ponta a ponta no navegador (Chrome sem interface, modo celular).
- **Framework:** `playwright-core` com o Chrome do sistema, sem baixar navegadores.
- **Automação prevista:** T-01 e T-02 automáticos (T-01 no CI); T-03 manual, com prints no PR.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs` (novo), `apps/web/package.json`, `.github/workflows/ci.yml`.
- **Persistência e API:** não mudam.
- **Deploy/Docker/Vercel:** não afeta o build.

## Dependências e riscos

- **Dependências:** `playwright-core` (só desenvolvimento). Os executores do GitHub Actions já têm o Chrome instalado.
- **Riscos:** textos maiores quebrarem o layout de computador; a barra fixa cobrir conteúdo.
- **Mitigações:** tudo dentro de `@media (max-width: 650px)`; espaço reservado no fim da página para a barra.

## Plano de implementação

1. Script de verificação e medição do estado atual.
2. Estilos de celular até o script passar.
3. Job no CI.
4. Prints de antes e depois no PR.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, a partir do pedido do cliente | aprovada |
| 2026-11-16 | CA-01 a CA-03 verificados: `npm run e2e:celular` passa nas nove telas (eram 75 problemas só na Visão geral); rótulo de 13 px de propósito reprova o script; prints de 1366 px iguais antes e depois, exceto o horário da comanda. Prints do celular antes e depois em `docs/evidencias/` | implementada |
