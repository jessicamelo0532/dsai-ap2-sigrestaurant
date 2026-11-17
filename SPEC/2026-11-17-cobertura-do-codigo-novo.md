# Cobertura do código novo (diff) medida no CI

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #15 (backlog 1.4), `SPEC/2026-11-12-integracao-continua.md`, `SPEC/2026-11-12-conformidade-ap2.md`  
**Derroga:** n/a (acrescenta um job ao pipeline; nenhum job existente muda)

---

## Contexto e problema

A Aula 09 avalia a **cobertura de linhas do código novo** (diff coverage), com mínimo de 70%: só contam as linhas adicionadas desde o último commit da AP1 (`d0a6caf`).

Fatos verificados em 2026-11-17:

- O CI gera a cobertura do frontend (`apps/web/coverage/lcov.info`) e da API (`apps/api/coverage/lcov.info`) em jobs separados, cada um como artefato.
- Nenhum passo cruza essas coberturas com as linhas novas. O `npm run metricas` mede só a cobertura total de `apps/web`, que não é a métrica da aula e deixa a API de fora.
- Hoje não há no repositório nenhuma evidência do número que a aula pede.

### Perguntas em aberto

- nenhuma.

## Objetivo

Calcular, a cada push, a cobertura das linhas novas de código (frontend e API) desde `d0a6caf`, publicar o resultado no resumo do CI e falhar o pipeline abaixo de 70%.

## Escopo

- Regras puras em `scripts/cobertura-diff/regras.mjs`: ler o `git diff -U0`, ler `lcov.info`, decidir quais arquivos contam e calcular a cobertura.
- Linha de comando `scripts/cobertura-diff.mjs`, com testes em `node --test` (sem dependência nova).
- Job **Cobertura do código novo (diff, mínimo 70%)** no CI, depois dos jobs do frontend e da API, usando os artefatos de cobertura deles.
- Script `npm run cobertura:diff` e `npm run test:scripts`; o job do frontend passa a rodar também `test:scripts`.

## Fora do escopo

- Mudar o que cada suíte cobre, ou os limites de cobertura das suítes.
- Mudar a métrica `cobertura` do `npm run metricas`.

## Requisitos funcionais

- **RF-01:** `node scripts/cobertura-diff.mjs --base <commit> --lcov <arquivo>:<pasta> [--lcov ...] --min <n>` lista as linhas adicionadas desde `<commit>` (`git diff -U0 <commit> HEAD -- apps`) e cruza com os relatórios lcov.
- **RF-02:** Saída: total de linhas novas medidas, linhas cobertas, percentual, os 10 arquivos com mais linhas novas descobertas e os arquivos sem relatório. Com `GITHUB_STEP_SUMMARY`, o mesmo resultado vai em tabela para o resumo do job.
- **RF-03:** Código de saída 1 se o percentual ficar abaixo de `--min`, ou se não houver nenhum relatório lcov legível; 0 caso contrário.

## Requisitos não funcionais

- **RNF-01:** Nenhuma dependência nova: Node e `git`.
- **RNF-02:** Funciona com caminhos do lcov relativos (com `/` ou `\`) ou absolutos.

## Regras de negócio

- **RN-01:** Contam arquivos `.ts` e `.tsx` de `apps/web` e `apps/api`. Ficam de fora: testes (`*.test.ts(x)`, pasta `test/`), `e2e/`, `*.d.ts`, arquivos de configuração (`*.config.*`), `apps/api/prisma/` e `apps/api/src/main.ts` (já excluído da cobertura da API).
- **RN-02:** Para um arquivo com relatório, contam só as linhas novas que o lcov marca como executáveis (`DA:`); a linha está coberta se o número de execuções for maior que zero.
- **RN-03:** Um arquivo que conta mas não aparece em nenhum relatório (nenhum teste o carregou) entra como **descoberto**: todas as suas linhas novas que não são vazias nem só comentário contam como não cobertas. É a escolha conservadora: não melhora o número escondendo código sem teste. Exceção: arquivo só de tipos (`type`, `interface`, `import type`), que não tem nada que rode e por isso nunca aparece no lcov, não entra na conta.
- **RN-04:** Percentual = cobertas ÷ medidas × 100, com uma casa. Sem linhas medidas, o resultado é 100% com o aviso "nenhuma linha nova de código".

## Critérios de aceitação verificáveis

- **CA-01:** Dado um diff `-U0` com arquivo novo e arquivo alterado, então as linhas adicionadas de cada arquivo são exatamente as dos trechos `+`.
- **CA-02:** Dado um lcov com `SF:` relativo com `\` ou absoluto, então o caminho vira `apps/<app>/...` com `/`.
- **CA-03:** Dados arquivos de teste, de configuração e de código, então só os de código contam (RN-01).
- **CA-04:** Dadas linhas novas executáveis com e sem execução, então o percentual segue RN-02 e RN-04.
- **CA-05:** Dado um arquivo de código sem relatório, então suas linhas novas não vazias e que não são só comentário contam como não cobertas; um arquivo só de tipos sem relatório não conta (RN-03).
- **CA-06:** Dado percentual abaixo do mínimo, então o comando sai com código 1; acima, com 0.
- **CA-07:** Dado o CI, então o job novo roda depois dos jobs de frontend e API e escreve o resultado no resumo.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Diff de exemplo | ler linhas adicionadas | CA-01 |
| T-02 | lcov de exemplo | ler e normalizar caminhos | CA-02 |
| T-03 | Lista de arquivos | filtrar | CA-03 |
| T-04 | Diff e lcov | calcular | CA-04, CA-05 |
| T-05 | Repositório real | rodar a linha de comando com `--min` alto e baixo | CA-06 |
| T-06 | CI | ver o job e o resumo | CA-07 |

- **Camada de teste:** regras puras com `node --test` (`scripts/cobertura-diff/regras.test.mjs`).
- **Automação prevista:** T-01 a T-04 automáticos; T-05 local; T-06 na execução do CI deste PR.

## Impactos na arquitetura

- **Camadas tocadas:** `scripts/cobertura-diff.mjs` (novo), `scripts/cobertura-diff/` (novo), `package.json` (scripts), `.github/workflows/ci.yml` (job novo e checkout com histórico).
- **Persistência / Backend / Stack:** não mudam.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Dependências:** os artefatos `cobertura` e `cobertura-api` publicados pelos jobs existentes; o commit `d0a6caf` no histórico (checkout com `fetch-depth: 0`).
- **Riscos:** a ferramenta da aula pode medir de outro jeito (por exemplo, sem RN-03).
- **Mitigações:** RN-03 deixa o nosso número igual ou menor que o de uma medição que ignore arquivos sem relatório; o critério de aprovação continua o da aula (70%).

## Plano de implementação

1. Commit desta SPEC.
2. Regras puras com testes.
3. Linha de comando e scripts do `package.json`.
4. Job no CI.
5. Rodar os testes e a linha de comando localmente; conferir o CI.
6. README e status desta SPEC.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
| 2026-11-17 | RN-03 e CA-05: arquivo só de tipos não entra na conta (encontrado ao rodar T-05: `apps/web/lib/types.ts` aparecia como descoberto) | aprovada |
