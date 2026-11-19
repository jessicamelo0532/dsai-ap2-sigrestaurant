# Autoria dos dois integrantes da dupla

**Data:** 2026-11-19  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** issue #10 (`0.4 | Alternar autoria entre os dois integrantes da dupla`)  
**Derroga:** n/a

---

## Contexto e problema

A métrica de autoria da Aula 09 exige pelo menos 30% dos commits para cada integrante da dupla. O histórico da AP2 tem commits de Jéssica Lopes Melo e de yurisawaki; também existem identidades de outras origens (Codex e afonso), que não são os dois integrantes da AP2. A sessão de 2026-11-12 registra a dupla como Jéssica e Yuri, e o `git config` do ambiente confirma `yurisawaki <brenoyurisawaki@gmail.com>`.

O script `scripts/metricas.mjs` contava todos os autores do período e todos os commits, inclusive merges do GitHub. Isso distorcia a métrica: merges não têm os trailers `Agent:`/`Spec:` e autores fora da dupla entravam no denominador.

### Perguntas em aberto

Nenhuma. A identidade do segundo integrante está registrada nas sessões e no `git config`; a regra de contagem foi derivada da própria issue.

## Objetivo

Medir a autoria apenas entre os dois integrantes da AP2 e verificar os trailers nos commits de trabalho, sem reescrever o histórico.

## Escopo

- Registrar nesta SPEC a identidade do segundo integrante: Yuri (`yurisawaki <brenoyurisawaki@gmail.com>`).
- Ajustar `scripts/metricas.mjs` para contar, na métrica de autoria, somente Jéssica Lopes Melo e yurisawaki.
- Ajustar a métrica de trailers para considerar apenas commits sem merge e exigir 100% deles com `Agent:` e `Spec:`.
- Registrar o novo estado no backlog.

## Fora do escopo

- Reescrever o histórico para atribuir commits antigos ao outro integrante.
- Criar commits artificiais só para inflar a proporção.
- Alterar a autoria de commits já publicados.
- Mudar o pipeline de CI ou o deploy.

## Requisitos funcionais

- **RF-01:** a métrica de autoria considera somente os dois integrantes da AP2; identidades de agentes ou de terceiros não entram no cálculo.
- **RF-02:** a métrica de trailers considera somente commits sem merge e exige `Agent:` e `Spec:` em todos eles.
- **RF-03:** o resultado das duas métricas é exibido por `npm run metricas autoria commits`.

## Requisitos não funcionais

- **RNF-01:** nenhum dado histórico é reescrito; a mudança é apenas de medição e documentação.
- **RNF-02:** os comandos continuam funcionando no Linux e no Windows, seguindo o padrão do script.

## Regras de negócio

- **RN-01:** os dois integrantes da AP2 são Jéssica Lopes Melo e yurisawaki (Yuri). Origem: sessões `2026-11-12-claude-code.md` e `2026-11-16-claude-code.md`, que citam a dupla como Jéssica e Yuri, e `git config user.name`/`user.email`.
- **RN-02:** a métrica de autoria exige pelo menos 30% dos commits da dupla para cada integrante. Origem: issue #10 e métrica da Aula 09.
- **RN-03:** todo commit de trabalho (sem merge) da AP2 deve ter os trailers `Agent:` e `Spec:`. Merges gerados pelo GitHub ficam fora da contagem porque não são commits de trabalho da dupla.
- **RN-04:** a agente não atribui um commit ao integrante que não o solicitou; cada pessoa commita as próprias sessões.

## Critérios de aceitação verificáveis

- **CA-01:** `npm run metricas autoria` mostra Jéssica Lopes Melo e yurisawaki, cada um com pelo menos 30%, e resultado `CONFORME`.
- **CA-02:** `npm run metricas commits` mostra 100% dos commits sem merge com `Agent:` e `Spec:`, e resultado `CONFORME`.
- **CA-03:** nenhum commit do histórico é reescrito; `git log` mantém os mesmos hashes anteriores à mudança.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Branch com a mudança | `npm run metricas autoria` | Dois integrantes, ambos >= 30%, `CONFORME` |
| T-02 | Branch com a mudança | `npm run metricas commits` | 100% dos commits sem merge com trailers, `CONFORME` |
| T-03 | Histórico anterior | Comparar hashes antes/depois | Nenhum hash reescrito |

- **Camada de teste:** script de métricas (verificação de comando).
- **Framework:** o script existente, sem runner novo.
- **Automação prevista:** T-01 e T-02 executados na verificação da entrega.

## Impactos na arquitetura

- **Camadas tocadas:** `scripts/metricas.mjs`, `docs/issues/backlog.md`, esta SPEC.
- **Persistência:** não muda.
- **Backend pausado:** não toca.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta.

## Dependências e riscos

- **Dependências:** identidade do segundo integrante (resolvida nesta SPEC).
- **Riscos:** excluir um autor legítimo por engano; considerar merge como commit de trabalho.
- **Mitigações:** `.mailmap` já unifica as identidades de Jéssica; a lista dos dois integrantes é explícita e documentada; merges são excluídos apenas da métrica de trailers.

## Plano de implementação

1. Criar esta SPEC.
2. Ajustar `scripts/metricas.mjs`.
3. Rodar `npm run metricas autoria commits` e registrar o resultado.
4. Atualizar o estado no backlog.
5. Verificar os critérios de aceitação item a item.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-19 | Criação e implementação | implementada |
