## @issue 1.1 | Ativar o backend apps/api (NestJS + Prisma + PostgreSQL)
labels: fase-1, backend, precisa-spec
depende: SPEC aprovada
spec: SPEC nova obrigatória — altera a estratégia de persistência e derroga SPEC/2026-10-01-frontend-local.md

**Contexto.** O backend NestJS + Prisma + PostgreSQL existe em `apps/api/` e está **pausado** desde a AP1 para viabilizar a publicação na Vercel. O frontend grava em `localStorage`, o que isola cada navegador: não há multiusuário, não há sincronização e não há como o salão e a cozinha enxergarem a mesma comanda.

**Escopo.**
- Definir a SPEC de reativação: modelo de dados, migração dos dados do `localStorage`, autenticação epapel por garçom.
- Subir o `apps/api` no build/docker-compose ativo.
- Ligar o frontend ao backend com estratégia de degradação definida.

**Regras de negócio a decidir na SPEC.**
- Chave de persistência e migração do `localStorage` para o banco.
- Autenticação: a AP2 mantém autenticação fora de escopo? A SPEC original a colocava fora do escopo permanente — confirmar.
- Comportamento do frontend quando a API está indisponível.

**Critérios de aceite.**
- [ ] SPEC aprovada antes de qualquer código.
- [ ] Dois navegadores compartilham a mesma comanda.
- [ ] Nenhum dado do `localStorage` é perdido silenciosamente na migração.

**Risco.** Muda a arquitetura ativa — proibido sem SPEC aprovada (`AGENTS.md` §2).

## @issue 1.2 | Corrigir o alerta crítico de dependência no next (subir para a v16)
labels: fase-1, dependencias, precisa-spec
depende: SPEC aprovada
spec: SPEC nova obrigatória — breaking change de dependência

**Contexto.** `npm audit --omit=dev` reporta **1 alerta crítico** em `next@14.2.21` (dependência de produção). A métrica de segurança da Aula 09 exige zero alertas críticos, e o pipeline hoje reprova por causa disso.

**Escopo.**
- SPEC com o plano de migração para a `next@16` (App Router, `next.config`, APIs removidas, React 18 → 19).
- Atualizar a dependência e corrigir as quebras.
- Reexecutar build, testes e `npm audit`.

**Critérios de aceite.**
- [ ] `npm audit --omit=dev` retorna zero alertas críticos.
- [ ] `npm run build` e `npm test` passam após a atualização.
- [ ] Nenhuma funcionalidade da AP1 regrediu (suíte atual + novos testes).

## @issue 1.3 | Cobertura de componente (Testing Library) e E2E (Playwright)
labels: fase-1, testes, precisa-aprovacao
depende: aprovação de dependências
spec: SPEC nova — nova camada de teste e novas dependências

**Contexto.** Hoje a suíte cobre apenas as regras de negócio do `store`. Não há teste de componente nem de fluxo completo no navegador.

**Escopo.**
- Testes de componente da tela principal (renderização de mesas, comandas, cardápio e financeiro).
- Testes E2E do fluxo: abrir mesa → adicionar item → fechar conta → conferir relatório.
- Dependências: `@testing-library/react`, `@testing-library/user-event`, `@playwright/test`.

**Critérios de aceite.**
- [ ] A suíte roda offline e de forma determinística em CI.
- [ ] O fluxo E2E principal está coberto de ponta a ponta.
- [ ] A cobertura de componente é medida e publicada.

## @issue 1.4 | Cobertura de linhas do diff no pipeline
labels: fase-1, testes, infra
depende: 1.3
spec: SPEC nova — regra de qualidade no pipeline

**Contexto.** Hoje o pipeline exige cobertura global, mas não exige que as **linhas novas** do diff estejam cobertas. Código novo pode entrar sem teste.

**Escopo.**
- Medir a cobertura apenas das linhas alteradas no pull request.
- Definir o piso mínimo (por exemplo, 80% das linhas novas cobertas).
- Falhar o pipeline quando o piso não for atingido.

**Critérios de aceite.**
- [ ] O pipeline reporta a cobertura das linhas do diff.
- [ ] Um PR com linha nova sem teste é reprovado.

## @issue 1.5 | Resolver as 4 lacunas de teste conhecidas
labels: fase-1, testes
depende: —
spec: SPEC nova — fechamento das lacunas registradas na auditoria

**Contexto.** A análise de mutação da auditoria (`docs/AUDITORIA-AP2.md`) encontrou 4 regras de negócio implementadas mas **sem nenhum teste**, por isso as mutações correspondentes sobreviveram:
1. comanda vazia não pode ser fechada;
2. comanda não paga não entra no relatório financeiro;
3. despesa com valor negativo (ou zero) é recusada;
4. item pausado/indisponível não entra na comanda.

**Escopo.**
- SPEC datada para o fechamento das lacunas.
- Testes automatizados na camada `store` para as 4 regras.
- Reprocessar a análise de mutação e registrar o resultado.

**Critérios de aceite.**
- [ ] As 4 regras têm teste automatizado que falha quando a regra é revertida.
- [ ] A suíte cresce de 6 para pelo menos 10 casos.
- [ ] A auditoria é atualizada com o novo resultado de mutação.

## @issue 1.6 | Deploy contínuo: publicar a main a cada merge
labels: fase-1, deploy, infra
depende: 0.5
spec: SPEC nova — pipeline de deploy

**Contexto.** Sem automação, a URL pública fica desatualizada a cada merge — o que quebra a métrica de URL servindo o último commit da `main`.

**Escopo.**
- Webhook da Vercel (ou ação de deploy) disparado a cada merge na `main`.
- Verificação de que a URL pública reflete o commit esperado.

**Critérios de aceite.**
- [ ] Após o merge, a URL pública serve o novo commit sem ação manual.
- [ ] O README documenta o fluxo de deploy.
