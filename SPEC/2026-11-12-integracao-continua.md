# Integração contínua (CI) com GitHub Actions

**Data:** 2026-11-12  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** nova (depende de `SPEC/2026-11-10-infraestrutura-de-testes.md`)  
**Derroga:** n/a

---

## Contexto e problema

Fato comprovado em 2026-11-12: o repositório não tem pipeline de integração contínua (não existe `.github/workflows/`). Os requisitos da AP2 (aula 09) tornam o CI pré-requisito de avaliação: sem pipeline verde no último commit da `main` a AP2 não é avaliada. Além disso, vários critérios são medidos por script sobre o repositório (cobertura, duplicação, segredos, alertas de dependência), e o CI é o lugar natural para gerar e registrar essas evidências a cada commit.

Verificação local feita antes desta SPEC, sobre o commit `29e65f2`:

- `npm run build`: sucesso.
- `npm test`: 6 de 6 testes passando.
- Cobertura de linhas de `apps/web/lib/store.ts`: 81,48%.
- `jscpd` em `apps/`: 0,39% de linhas duplicadas (limite da AP2: 5%).
- `gitleaks` no histórico completo: nenhum segredo encontrado.
- `npm audit --audit-level=critical`: **1 alerta crítico e 1 alto** no `next@14.2.x` (e `postcss` transitivo). Não existe versão 14.x corrigida; a correção exige `next` 15.5.28 ou superior.

### Perguntas em aberto

- **P-1:** atualização do Next.js para eliminar os alertas críticos. É mudança de versão principal do framework, fora do escopo desta SPEC; será tratada em SPEC própria, decidida pela dupla.
- **P-2:** versionar ou não um `package-lock.json`. Hoje o repositório não tem lockfile e o `AGENTS.md` proíbe criá-lo sem autorização. Nesta SPEC o CI gera um lockfile temporário apenas para o `npm audit`, sem versioná-lo.

## Objetivo

Ter um pipeline no GitHub Actions que, a cada push e a cada PR para a `main`, verifique build, testes com cobertura, duplicação de código, segredos no histórico e alertas de dependência, deixando o resultado visível no commit e no PR.

## Escopo

- Workflow `.github/workflows/ci.yml` com os jobs descritos nos requisitos funcionais.
- Script `test:coverage` em `apps/web/package.json` e na raiz.
- Configuração de cobertura no `apps/web/vitest.config.ts`.
- Dependência de desenvolvimento `@vitest/coverage-v8` (mesma versão principal do `vitest`).

## Fora do escopo

- Atualizar o Next.js ou qualquer dependência de produção (ver P-1).
- Versionar lockfile (ver P-2).
- Configurar deploy na Vercel e proteção da branch `main` (configuração feita na interface do GitHub e da Vercel, registrada em SPEC própria).
- Cálculo automático de cobertura apenas do código novo (diff coverage); fica para SPEC posterior quando houver código novo suficiente para medir.
- Alterar código de produto em `apps/web/app` ou `apps/web/lib/store.ts`.

## Requisitos funcionais

- **RF-01:** o workflow roda em todo push (qualquer branch) e em todo PR com destino à `main`.
- **RF-02:** job `build-e-testes`: instala dependências, executa `npm run build` e `npm run test:coverage`; falha se build ou teste falhar.
- **RF-03:** o relatório de cobertura (`apps/web/coverage/`) é publicado como artefato da execução.
- **RF-04:** job `duplicacao`: executa `jscpd` sobre `apps/` e falha se a duplicação passar de 5%.
- **RF-05:** job `segredos`: executa `gitleaks` sobre o histórico completo e falha se encontrar segredo.
- **RF-06:** job `dependencias`: executa `npm audit --audit-level=critical`. Enquanto P-1 não for resolvida, o job é marcado como não bloqueante (`continue-on-error`), de modo que o alerta aparece na execução sem deixar o pipeline vermelho.

## Requisitos não funcionais

- **RNF-01:** nomes de jobs e passos em português.
- **RNF-02:** permissões mínimas (`contents: read`).
- **RNF-03:** execuções antigas da mesma branch são canceladas quando chega um push novo.
- **RNF-04:** versões das ferramentas fixadas (Node 22, `jscpd@4`, `gitleaks` 8.24.3).

## Regras de negócio

- Não se aplica: esta SPEC não altera regras do restaurante.
- O limite de 5% de duplicação vem dos critérios de avaliação da AP2 (aula 09).

## Critérios de aceitação verificáveis

- **CA-01:** dado um push nesta branch, quando o workflow rodar, então os quatro jobs aparecem na aba Actions e `build-e-testes`, `duplicacao` e `segredos` terminam verdes.
- **CA-02:** dado um teste quebrado de propósito, quando `npm run test:coverage` rodar, então o comando termina com código diferente de zero (o job falharia).
- **CA-03:** dado o estado atual das dependências, quando o job `dependencias` rodar, então ele registra o alerta crítico do Next.js e o pipeline continua verde.
- **CA-04:** dado o comando `npm run test:coverage` executado localmente, então é gerada a pasta `apps/web/coverage/` com `lcov.info` e `coverage-summary.json`.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Dependências instaladas | `npm run build` | Código de saída 0 |
| T-02 | Dependências instaladas | `npm run test:coverage` | 6 testes passam; pasta `coverage/` gerada |
| T-03 | Teste alterado para falhar | `npm run test:coverage` | Código de saída diferente de 0 |
| T-04 | Repositório atual | `jscpd` com limite 5% | Código de saída 0 |
| T-05 | Histórico completo | `gitleaks git .` | Nenhum segredo, código de saída 0 |

- **Camada de teste:** infraestrutura (pipeline).
- **Framework:** Vitest (já aprovado na SPEC de 2026-11-10) com `@vitest/coverage-v8`.
- **Automação prevista:** T-01, T-02, T-04 e T-05 rodam no próprio CI; T-03 é verificação manual registrada nesta entrega.

## Impactos na arquitetura

- **Camadas tocadas:** `.github/workflows/ci.yml`, `apps/web/package.json`, `apps/web/vitest.config.ts`, `package.json`.
- **Persistência:** não muda.
- **Backend pausado:** não tocar.
- **Stack/tecnologias:** não muda; adiciona apenas ferramenta de cobertura de testes.
- **Deploy/Docker/Vercel:** não afeta o build de produção.

## Dependências e riscos

- **Dependências:** SPEC `2026-11-10-infraestrutura-de-testes.md` (Vitest). Esta branch parte de `feat/ap2-development`; o PR deve entrar depois do PR dessa branch.
- **Riscos:** sem lockfile, uma versão nova de dependência pode quebrar o CI sem mudança no código; o job de dependências não bloqueante pode esconder o alerta se ninguém olhar.
- **Mitigações:** P-1 e P-2 registradas como pendências; o alerta fica visível no resumo da execução.

## Plano de implementação

1. Adicionar `@vitest/coverage-v8`, script `test:coverage` e configuração de cobertura.
2. Criar `.github/workflows/ci.yml`.
3. Rodar localmente T-01 a T-05; registrar resultado.
4. Enviar a branch e verificar CA-01 e CA-03 na aba Actions.
5. Atualizar o status desta SPEC para `implementada`.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-12 | Criação e aprovação por Jéssica Lopes Melo | aprovada |
