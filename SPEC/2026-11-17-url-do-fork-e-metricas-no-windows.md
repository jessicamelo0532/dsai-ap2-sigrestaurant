# URL pública do fork e script de métricas no Windows

**Data:** 2026-11-17  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-12-conformidade-ap2.md`  
**Derroga:** n/a

---

## Contexto e problema

Fatos verificados em 2026-11-17:

1. **URL pública.** O README e o script `scripts/metricas.mjs` apontam para `https://dsai-ap1-sigrestaurant.vercel.app/`, que é a publicação da AP1, e não a do fork. A Aula 09 exige que a URL pública sirva o último commit da `main` do fork. Essa condição é eliminatória (issues 0.5 e 1.6).
   - Em 2026-11-17 a dupla criou o projeto `dsai-ap2-sigrestaurant` na Vercel, ligado a este repositório, com Root Directory `apps/web`.
   - A URL `https://dsai-ap2-sigrestaurant.vercel.app/` responde HTTP 200.
   - O status `Vercel` do commit `0ad8969`, último da `main`, está como `success`, ou seja, a cada push na `main` a Vercel publica a versão nova.
2. **Script de métricas no Windows.** `npm run metricas` falha em todas as medições no Windows, com `spawnSync <comando> ENOENT`:
   - `ROOT` é calculado com `new URL(...).pathname`, que no Windows devolve `/C:/Users/...`. Esse caminho não existe e é usado como `cwd` de todos os subprocessos.
   - `npx` e `npm` são arquivos `.cmd` no Windows, e o `execFileSync` não os executa sem shell.
   - Os relatórios temporários usam `/tmp/...` fixo em vez da pasta temporária do sistema.

   No Linux (CI) o script já funciona, então o problema afeta só quem mede localmente no Windows.

### Perguntas em aberto

- nenhuma

## Objetivo

Fazer a URL do fork ser a URL pública documentada e medida, e fazer `npm run metricas` medir no Windows sem mudar o resultado no Linux.

## Escopo

- Trocar a URL padrão da métrica de produção em `scripts/metricas.mjs` para `https://dsai-ap2-sigrestaurant.vercel.app/`. A variável `PUBLIC_URL` continua sobrescrevendo esse valor.
- Calcular `ROOT` com `fileURLToPath`.
- Executar `npm` e `npx` por shell somente quando `process.platform === 'win32'`.
- Gravar os relatórios temporários em `os.tmpdir()`.
- Medir a duplicação com o mesmo alvo e as mesmas exclusões do job do CI (`apps`, ignorando `node_modules`, `.next`, `coverage` e `dist`). Sem as exclusões, a medição local entrava nas pastas geradas e dava 7,13% contra os 2,78% reais.
- Atualizar o README: seção "Publicar na Vercel" e status da publicação.

## Fora do escopo

- Instalar `cloc` ou outras ferramentas. A medição de volume continua exigindo o `cloc` no PATH, e sem ele o script continua informando o erro.
- Mudar qualquer limite ou critério das métricas.
- Mudar o pipeline de CI ou o build do frontend.

## Requisitos funcionais

- **RF-01:** Sem `PUBLIC_URL`, a métrica `url` mede `https://dsai-ap2-sigrestaurant.vercel.app/`.
- **RF-02:** No Windows, as métricas `specs`, `commits`, `frequencia`, `sessoes`, `autoria`, `seguranca` e `url` produzem resultado em vez de `erro na medicao`.
- **RF-03:** No Windows, `duplicacao` e `cobertura` executam `npx` e produzem resultado.
- **RF-05:** A duplicação local mede o mesmo conjunto de arquivos que o job `duplicacao` do CI.
- **RF-04:** O README indica a URL do fork como URL pública e registra que a Vercel publica cada push na `main`.

## Requisitos não funcionais

- **RNF-01:** No Linux o comportamento do script não muda: mesmos comandos, mesmos argumentos, sem shell.
- **RNF-02:** Nenhuma dependência nova.

## Regras de negócio

- n/a (ferramenta de medição; nenhuma regra do produto muda).

## Critérios de aceitação verificáveis

- **CA-01:** Dado o Windows com Git Bash, quando rodo `npm run metricas specs commits frequencia sessoes autoria seguranca url`, então nenhuma dessas linhas termina em `erro na medicao`.
- **CA-02:** Dado o Windows, quando rodo `npm run metricas duplicacao`, então a métrica imprime um percentual medido sobre os mesmos arquivos do CI.
- **CA-03:** Dado nenhum `PUBLIC_URL`, quando rodo `npm run metricas url`, então a linha mostra `https://dsai-ap2-sigrestaurant.vercel.app/` e `HTTP 200`.
- **CA-04:** Dado o PR aberto, quando o CI roda, então todos os jobs ficam verdes.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Windows 11, Node 24, Git Bash | `npm run metricas specs commits frequencia sessoes autoria seguranca url` | sete resultados, nenhum `erro na medicao` |
| T-02 | Windows 11, dependências instaladas | `npm run metricas duplicacao` | percentual de duplicação, sem `node_modules`, `.next` e `coverage` |
| T-03 | sem `PUBLIC_URL` | `npm run metricas url` | `HTTP 200 em https://dsai-ap2-sigrestaurant.vercel.app/` |

- **Camada de teste:** script de medição (`scripts/`), fora das suítes de `apps/web` e `apps/api`.
- **Framework:** verificação por execução do próprio script; os cenários acima ficam registrados na sessão.
- **Automação prevista:** o CI continua executando as mesmas ferramentas no Linux.

## Impactos na arquitetura

- **Camadas tocadas:** `scripts/metricas.mjs`, `README.md`.
- **Persistência:** não muda.
- **Backend:** não muda.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** o build não muda. A publicação passa a ser o projeto `dsai-ap2-sigrestaurant` da Vercel, que já existe e publica a cada push na `main`.

## Dependências e riscos

- **Dependências:** projeto da Vercel criado pela dupla em 2026-11-17.
- **Pendência conhecida:** nesta máquina Windows o Vitest encerra com `Timeout terminating forks worker` em parte dos arquivos de teste (também em `npm test`), e a métrica `cobertura` não acha o relatório. É um problema do ambiente local do Vitest, fora do escopo; a cobertura autoritativa continua sendo a do CI (Linux).
- **Riscos:** usar shell no Windows poderia mudar a forma como os argumentos são interpretados.
- **Mitigações:** o shell é usado somente no Windows e somente para `npm` e `npx`, cujos argumentos neste script não têm espaços.

## Plano de implementação

1. Commit desta SPEC.
2. Corrigir `ROOT`, a execução de `npm`/`npx` no Windows e as pastas temporárias.
3. Trocar a URL padrão da métrica de produção.
4. Atualizar o README.
5. Executar T-01 a T-03 e registrar o resultado na sessão.
6. Abrir PR e aguardar CI verde e aprovação do outro integrante.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
| 2026-11-17 | Inclui o alinhamento da duplicação com o CI; cobertura no Windows registrada como pendência do ambiente | aprovada |
