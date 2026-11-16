# Atualizar o Next.js para a v16 e zerar os alertas críticos

**Data:** 2026-11-16  
**Status:** aprovada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #13 (backlog 1.2)  
**Derroga:** nenhuma. Muda só versões de dependências do frontend e torna bloqueante o job de auditoria do CI.

---

## Contexto e problema

Fato comprovado em 2026-11-16: `npm audit --omit=dev` aponta 1 alerta crítico, em `next@14.2.x`. Os alertas críticos são de execução remota de código na otimização de imagens e em servidores Windows, corrigidos só a partir da `15.5.28` e da linha 16. A métrica de segurança da Aula 09 exige zero alertas críticos, e por isso o job `dependencias` do CI roda hoje com `continue-on-error: true`.

### Perguntas em aberto (para o cliente)

- **P-1:** existe alguma hospedagem fixada em Node 18? Provisório: não; a v16 pede Node 20.9 ou mais novo, e o CI e a Vercel já usam Node 22.

## Objetivo

Subir o frontend para `next@16` com React 19, sem mudar nenhuma tela, e deixar o CI reprovando qualquer alerta crítico novo.

## Escopo

- `apps/web/package.json`: `next` para `^16.4.6`, `react` e `react-dom` para `^19`, `@types/react` e `@types/react-dom` para `^19`.
- Ajustes de código que o build da v16 exigir (tipos do React 19, `next.config`, `tsconfig` gerado pelo Next).
- `package-lock.json` atualizado.
- `.github/workflows/ci.yml`: job `dependencias` passa a bloquear.

## Fora do escopo

- Alertas altos e moderados do NestJS, do Prisma e de outras dependências da API (sobem de versão maior; ficam para outra SPEC).
- Mudanças de tela ou de comportamento.

## Requisitos funcionais

- **RF-01:** o app abre e funciona igual nas 10 seções, no modo local e no modo API.

## Requisitos não funcionais

- **RNF-01:** `npm audit --audit-level=critical` termina com código 0.
- **RNF-02:** o build continua gerando a página inicial estática.

## Regras de negócio

- **RN-01:** nenhuma regra muda. Os testes de `apps/web/lib` passam sem edição.

## Critérios de aceitação verificáveis

- **CA-01:** `npm audit --omit=dev` mostra zero alertas críticos (critério da issue).
- **CA-02:** `npm run build` e `npm test` passam (critério da issue).
- **CA-03:** a verificação de uso no celular (`npm run e2e:celular`, 9 telas a 375 px) passa sem mudança, mostrando que nada da AP1 regrediu (critério da issue).
- **CA-04:** o job `dependencias` do CI deixa de ter `continue-on-error` e fica verde.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Dependências atualizadas | `npm audit` | CA-01 |
| T-02 | Dependências atualizadas | `npm run build`, `npm test` | CA-02 |
| T-03 | App rodando com `next start` | `npm run e2e:celular` | CA-03 |
| T-04 | PR aberto | CI | CA-04 |

- **Camada de teste:** build, unitários do frontend e verificação de ponta a ponta no navegador.
- **Framework:** Vitest e playwright-core.
- **Automação prevista:** todos.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/package.json`, `package-lock.json`, possivelmente `apps/web/tsconfig.json`, `apps/web/next-env.d.ts` e `apps/web/app/*.tsx`, `.github/workflows/ci.yml`.
- **API:** não muda.

## Dependências e riscos

- **Riscos:** quebra de tipos do React 19 (por exemplo `useRef` sem valor inicial e o namespace global `JSX`); o Turbopack, padrão no build da v16, tratar CSS de forma diferente.
- **Mitigações:** build no CI, verificação de celular com medidas de fonte e de toque, e comparação visual das telas.

## Plano de implementação

1. Atualizar as versões e o lockfile.
2. Corrigir o que o build apontar.
3. Rodar testes, auditoria e a verificação de celular.
4. Tornar o job de auditoria bloqueante.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-16 | Criação e aprovação por Jéssica Lopes Melo, com P-1 | aprovada |
