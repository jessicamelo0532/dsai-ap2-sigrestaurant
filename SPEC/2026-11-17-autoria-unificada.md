# Autoria unificada no histórico (.mailmap)

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-12-conformidade-ap2.md` (métrica Autoria)  
**Derroga:** n/a

---

## Contexto e problema

Fato comprovado em 2026-11-17: o merge do PR #76, feito pelo site do GitHub, saiu com o autor `Jéssica Melo <148357784+jessicamelo0532@users.noreply.github.com>`. Os outros 143 commits da mesma pessoa usam `Jéssica Lopes Melo <jessicamelo0532@gmail.com>`. A métrica de autoria da Aula 09 (30% por integrante) agrupa por autor, e `npm run metricas` agrupa por `%an`, então a mesma integrante aparece como duas pessoas.

### Perguntas em aberto

- nenhuma.

## Objetivo

Fazer o Git, e as medições do repositório, tratarem as duas identidades da mesma integrante como uma só, sem reescrever o histórico.

## Escopo

- Arquivo `.mailmap` na raiz, ligando a identidade do site do GitHub ao nome usado nos commits.
- `scripts/metricas.mjs` passa a agrupar a autoria por `%aN` (o nome já corrigido pelo `.mailmap`).

## Fora do escopo

- Reescrever commits (proibido pela Aula 09).
- Mudar o limite da métrica.

## Requisitos funcionais

- **RF-01:** `git log --format='%aN'` mostra `Jéssica Lopes Melo` também para os commits feitos pelo site do GitHub.
- **RF-02:** `npm run metricas autoria` conta duas pessoas na dupla.

## Requisitos não funcionais

- **RNF-01:** Nenhum commit é alterado; o `.mailmap` só muda como o nome é mostrado.

## Regras de negócio

- n/a (ferramenta de medição).

## Critérios de aceitação verificáveis

- **CA-01:** Dado o commit `fbdf5b6`, quando rodo `git log -1 --format=%aN fbdf5b6`, então aparece `Jéssica Lopes Melo`.
- **CA-02:** Quando rodo `npm run metricas autoria`, então aparecem dois integrantes.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | `.mailmap` na raiz | `git log -1 --format=%aN fbdf5b6` | `Jéssica Lopes Melo` |
| T-02 | `.mailmap` na raiz | `npm run metricas autoria` | dois integrantes |

- **Camada de teste:** verificação por comando, registrada no PR.

## Impactos na arquitetura

- **Camadas tocadas:** `.mailmap` (novo), `scripts/metricas.mjs`.
- **Persistência / Backend / Stack / Deploy:** não mudam.

## Dependências e riscos

- **Riscos:** a ferramenta da aula pode não ler o `.mailmap`.
- **Mitigações:** daqui em diante, os merges pelo site usam a mesma integrante; o `.mailmap` é o mecanismo padrão do Git para isso.

## Plano de implementação

1. Commit desta SPEC.
2. `.mailmap` e `%aN` no script; verificar CA-01 e CA-02.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
