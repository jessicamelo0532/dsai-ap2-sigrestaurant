# Conformidade com a Aula 09 (Kickoff da AP2) — auditoria e documentação de entrega

**Data:** 2026-11-12
**Status:** implementada (2026-11-12 — auditoria executada, métricas medidas e registradas)
**Agent:** opencode/minimax-m3.1-flash-free
**SPEC derivada de:** nova
**Derroga:** n/a — esta SPEC não altera comportamento de produto especificado; nenhuma SPEC histórica é afetada.

> Dúvidas de regra de negócio ficam em "Perguntas em aberto" até decisão humana — não inventar regras.

---

## Contexto e problema

A Aula 09 (22/10/2026, Prof. Gustavo Pinto) estabelece as diretivas e as 14 métricas da AP2 para o kickoff do projeto herdado. O repositório `dsai-ap2-sigrestaurant` já é um fork correto da AP1, com stack preservada e governança escrita, mas **a auditoria nunca havia sido feita**: não existia `.github/` (sem CI), nenhuma issue, nenhum PR, nenhuma sessão registrada para os dias de commit de agente da AP2, e o volume de código exigido (100 mil linhas novas) estava em 519 linhas — 0,5% do mínimo.

Sem esse diagnóstico, qualquer trabalho posterior é orientado por intuição em vez de evidência. Esta SPEC formaliza a auditoria como entregável e fixa o plano de conformidade.

### Perguntas em aberto

- **P-1:** `gh` não está autenticado neste ambiente. Quem executa `gh auth login` e quando as issues/PRs são criados?
- **P-2:** nome/e-mail do segundo integrante da dupla (métrica de 30% de autoria por integrante).
- **P-3:** custo/tokens reais das sessões — o ambiente não exporta esse dado; não pode ser inventado.
- **P-4:** ativar o backend `apps/api` pausado? Muda a estratégia de persistência e a stack ativa — exige SPEC própria (§2 do `AGENTS.md`).
- **P-5:** subir `next@16` para corrigir o alerta crítico? Breaking change — exige SPEC própria.
- **P-6:** a URL pública pode ser a deployment atual da AP1 ou deve ser uma nova deployment do fork?
- **P-7:** plano de deploy contínuo (Vercel) para que a URL sirva o último commit da `main`.

> As respostas a P-1..P-7 são **pendências declaradas**, não bloqueiam esta SPEC (que não altera comportamento de produto).

## Objetivo

Medir, com scripts e evidência reproduzível, o quanto o repositório está em conformidade com as diretivas e as 14 métricas da Aula 09, e registrar o plano de conformidade com as pendências que dependem de decisão humana.

## Escopo

- Auditoria das 14 métricas da Aula 09 com execução de `cloc --diff`, `jscpd`, `vitest --coverage`, `npm audit`, varredura de segredos, análise de mutação dos testes e verificação da URL pública.
- Registro em `docs/AUDITORIA-AP2.md` com estado por métrica, evidência, não conformidades e plano em fases.
- Geração e versionamento de `package-lock.json` (autorizado explicitamente pelo responsável humano nesta sessão), com a regra de geração `--include=optional`.
- Adição ao `README.md` da justificativa de escolha do repositório (exigência da entrega de hoje) e correção das linhas de pendência factualmente desatualizadas.
- Criação das sessões de agente em `prompts/sessoes/` para os dias de commit da AP2, com o registro de custo marcado como pendente (não inventado).

## Fora do escopo

- **Implementar as funcionalidades de produto** da Fase 2 do plano (mesa 100 mil linhas). Decisão humana adiada: o usuário pediu "só auditoria, sem escrever código" nesta sessão.
- Criar `.github/workflows/ci.yml`, scripts de métrica e issues remotas — dependem do login do `gh` (P-1) e de aprovação do plano.
- Subir `next@16` (P-5) ou ativar o backend `apps/api` (P-4) — ambos exigem SPEC dedicada.
- Mover a `main` do fork ou reescrever histórico.

## Requisitos funcionais

- **RF-01:** cada uma das 14 métricas da Aula 09 tem estado declarado (conforme / parcial / não conforme) com o valor medido e o mínimo exigido.
- **RF-02:** cada não conformidade tem evidência verificável (comando ou arquivo) no repositório.
- **RF-03:** o plano de conformidade está dividido em fases com entregável verificável por fase.
- **RF-04:** as pendências que dependem do humano estão listadas com o motivo do bloqueio.
- **RF-05:** o README contém as 2-3 linhas de justificativa da escolha do repositório exigidas pela entrega de hoje.

## Requisitos não funcionais

- **RNF-01:** o relatório distingue explicitamente **fato comprovado** de **hipótese**.
- **RNF-02:** nenhum comando destrutivo (sem `push --force`, sem remoção de módulo da AP1).
- **RNF-03:** a auditoria é reproduzível: os comandos usados estão listados no relatório.
- **RNF-04:** pt-BR em todos os documentos.

## Regras de negócio

- **RN-01:** a base de comparação de volume é o commit `d0a6caf` (último commit da AP1 em `iurivinicius/dsai-ap1-sigrestaurant`), conforme os slides ("a diferença entre o fork e o último commit da AP1"). Origem: Aula 09.
- **RN-02:** lockfiles, `build/`, `vendor/` e arquivos minificados ficam fora da contagem de linhas. Origem: Aula 09, restrições 3 e 4.
- **RN-03:** commits dos autores originais da AP1 não contam para as métricas de volume, autoria e commit com agente. Origem: Aula 09, restrição 6.
- **RN-04:** o lockfile deve registrar os pacotes opcionais de todas as plataformas (`--include=optional`); sem isso o `next` tenta patcheá-lo e o build quebra. Origem: falha observada nesta sessão (fato).

## Critérios de aceitação verificáveis

- **CA-01:** `docs/AUDITORIA-AP2.md` existe e contém uma linha por métrica da Aula 09 com estado e valor medido. → verificado por leitura do arquivo.
- **CA-02:** o volume foi medido por `cloc --diff` contra `d0a6caf` e o resultado (519 linhas) está no relatório. → verificado por execução.
- **CA-03:** a duplicação foi medida por `jscpd` e o resultado (0,63%) está no relatório. → verificado por execução.
- **CA-04:** a cobertura foi medida por `vitest --coverage` e o resultado (81,48% de linhas em `store.ts`) está no relatório. → verificado por execução.
- **CA-05:** `npm audit --omit=dev` foi executado e o alerta crítico de `next` está registrado como pendência P-5, sem correção unilateral. → verificado por execução.
- **CA-06:** a varredura de segredos no histórico completo foi executada e o resultado está no relatório. → verificado por execução.
- **CA-07:** a análise de mutação cobriu 10 mutações e o relatório lista quais foram detectadas e quais sobreviveram. → verificado por execução.
- **CA-08:** o README tem a seção de justificativa da escolha do repositório. → verificado por leitura.
- **CA-09:** existem sessões em `prompts/sessoes/` para `2026-11-10` e `2026-11-12`, com o campo de custo marcado como pendente. → verificado por leitura.
- **CA-10:** `npm test` passa (6/6) e `npm run build` termina com exit 0 **com o `package-lock.json` versionado**. → verificado por execução.
- **CA-11:** o histórico do repositório não foi reescrito e nenhum módulo da AP1 foi removido. → verificado por `git log` e `git status`.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Dependências instaladas | `npm test` na raiz | 6/6 testes passando, exit 0 |
| T-02 | Dependências instaladas | `npm run build` na raiz | build estático sem erro, exit 0 |
| T-03 | `package-lock.json` versionado | `npm run build` | nenhum aviso "Found lockfile missing swc dependencies" |
| T-04 | Repositório no commit `d0a6caf` disponível | `cloc --diff` | total de linhas adicionadas calculado |
| T-05 | Código de produto atual | `npx jscpd apps/web` | duplicação abaixo de 5% |
| T-06 | Suíte de 6 testes | mutação de uma regra em `store.ts` | a suíte falha ao reverter a mudança |

- **Camada de teste:** regras de negócio (`store`) — já coberta pela SPEC `2026-11-10-infraestrutura-de-testes.md`; a auditoria **estende** a evidência com análise de mutação.
- **Framework:** Vitest 5.1.0 (aprovado na SPEC de 2026-11-10).
- **Automação prevista:** T-01 a T-05 entram no pipeline de CI (Fase 0 do plano); T-06 é a verificação de que os testes detectam a reversão.

## Impactos na arquitetura

- **Camadas tocadas:** `docs/AUDITORIA-AP2.md` (novo), `README.md` (seção nova + pendências corrigidas), `package-lock.json` (novo), `prompts/sessoes/2026-11-10-opencode.md` e `prompts/sessoes/2026-11-12-opencode.md` (novos).
- **Persistência:** não muda. Nenhum arquivo de produto é alterado.
- **Backend pausado:** não tocado.
- **Stack/tecnologias:** não muda. `package-lock.json` **não** altera versões — registra exatamente as versões já instaladas (`next@14.2.35`, `vitest@5.1.0`).
- **Deploy/Docker/Vercel:** não afeta o build (verificado por execução). O Dockerfile não usa o lockfile; **pendência** a resolver na Fase 0 (copiar o lockfile para a imagem e usar `npm ci`).

## Dependências e riscos

- **Dependências:** SPEC `2026-11-10-infraestrutura-de-testes.md`; login do `gh` (P-1); decisões humanas P-2 a P-7.
- **Riscos:** (a) o lockfile gerado sem `--include=optional` quebra o build em outros ambientes — mitigado por RN-04 e por documentar a regra no README e no relatório; (b) o volume de 100 mil linhas exige ativação do backend ou um conjunto muito maior de funcionalidades de frontend — risco de decisão, não técnico; (c) o alerta crítico do `next` permanece exposto até P-5.
- **Mitigações:** regra do lockfile documentada e verificada; plano por fases com verificação por etapa; pendências declaradas e não omitidas.

## Plano de implementação

1. ✅ Medir as 14 métricas com scripts (`cloc`, `jscpd`, `vitest --coverage`, `npm audit`, varredura de segredos, mutação).
2. ✅ Verificar fork, histórico, stack e ausência de reescrita.
3. ✅ Gerar `package-lock.json` com `--include=optional` a partir de `node_modules` limpo.
4. ✅ Verificar `npm test` e `npm run build` com o lockfile versionado.
5. ✅ Escrever `docs/AUDITORIA-AP2.md`.
6. ✅ Atualizar `README.md` (justificativa de escolha + pendências corrigidas).
7. ✅ Criar as duas sessões em `prompts/sessoes/`.
8. ✅ Verificar item a item os Critérios de Aceitação (CA-01 a CA-11).
9. ✅ Atualizar o status desta SPEC para `implementada`.
10. Commits pequenos com `Agent:` e `Spec:` no corpo.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-12 | Criação do rascunho | rascunho |
| 2026-11-12 | Auditoria executada, plano aprovado para execução; 8 pendências humanas registradas (P-1 a P-7) | aprovada |
| 2026-11-12 | Métricas medidas, documentos escritos, build e testes verificados com lockfile versionado | implementada |
