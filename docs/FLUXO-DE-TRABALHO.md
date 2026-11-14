# Fluxo de trabalho da dupla

Documento curto e operacional: como o trabalho entra, como circula e como sai. As regras permanentes valem em [`AGENTS.md`](../AGENTS.md) e o ciclo das especificações em [`SPEC/README.md`](../SPEC/README.md); aqui está o como fazer no dia a dia.

---

## 1. Onde cada coisa vive

| Onde | O que é | Quem escreve |
|---|---|---|
| `SPEC/AAAA-MM-DD-<slug>.md` | a decisão do que vai ser construído, antes do código | quem vai implementar |
| `docs/issues/` | a fila de trabalho e o texto de cada issue | a dupla |
| `prompts/sessoes/AAAA-MM-DD-<ferramenta>.md` | o registro do dia (mensagens do humano, o que foi feito, o que ficou pendente) | o agente da sessão |
| `apps/`, `scripts/` | o código | o agente ou a dupla |
| `docs/AUDITORIA-AP2.md` | a foto medida do repositório e as pendências | a dupla |
| `.github/workflows/ci.yml` | o pipeline (build, testes, duplicação, segredos, dependências) | pipeline da Jéssica |

Regra que não se negocia: **nenhum código entra sem SPEC datada antes**. A SPEC nasce em `rascunho`, vira `aprovada` com a decisão humana, e só depois existe o commit de código.

---

## 2. O ciclo de uma issue

```
issue na fila  →  SPEC datada (rascunho → aprovada)  →  commits pequenos com trailers
       →  testes executados  →  PR com pipeline verde  →  revisão do outro integrante
       →  merge na main  →  sessão registrada  →  métricas medidas
```

**1. Escolher a issue.** A fila é o backlog publicado no fork. Cada issue traz contexto, escopo, critérios de aceite, dependências e a marcação `precisa-spec` / `precisa-humano` / `precisa-aprovacao`.

**2. Escrever a SPEC.** Copiar `SPEC/TEMPLATE.md`, datar com o dia, declarar a derrogação se tocar comportamento já especificado e listar as **perguntas em aberto**. Regra de negócio que não está em SPEC não se decide no código: vai para a lista de perguntas.

**3. Implementar em commits pequenos.** Um assunto por commit, no tamanho da SPEC, sempre com `Agent:` e `Spec:` no corpo:

```
feat(api): registra reserva com capacidade conferida

SPEC: SPEC/2026-11-12-reservas-de-mesa.md
Agent: claude-code/claude-opus-5.5
```

**4. Rodar os testes da camada afetada** e registrar o resultado. Sem evidência de execução, a entrega não está pronta.

**5. Abrir o PR.** A descrição do PR carrega o que faz, a SPEC, os testes executados, os critérios de aceite marcados e as pendências que sobraram. O checklist está em [`.github/pull_request_template.md`](../.github/pull_request_template.md).

**6. Revisão.** O outro integrante revisa. Se a PR for grande demais para revisar, ela volta como SPEC ou como PR menor. Ninguém aprova o próprio PR.

**7. Merge na `main`** só com pipeline verde. A `main` é a base do deploy público.

**8. Fechar o dia.** A sessão vai para `prompts/sessoes/`, com as mensagens do humano transcritas e as pendências declaradas.

**9. Medir.** `npm run metricas` refaz as métricas da Aula 09. É o espelho do estado real do repositório.

---

## 3. Papéis

A dupla trabalha com papéis iguais. Não existe dono da branch nem dono da parte do produto.

| | |
|---|---|
| **Autoria** | alterna entre os dois. A métrica exige 30% de commits de cada um |
| **Revisão** | todo PR na `main` passa por aprovação de um dos dois |
| **Decisão de regra de negócio** | quando há dúvida, a dupla pergunta ao cliente e registra a resposta; o agente não decide sozinho |
| **Pipeline** | mantido por quem iniciou; hoje é o da Jéssica |

---

## 4. O que o agente faz e o que ele não faz

**Faz:** escreve a SPEC a partir do template, implementa o escopo aprovado, escreve e roda os testes, mede as métricas, registra a sessão, abre a PR e revisa a PR do outro.

**Não faz, sem pedido explícito:** inventar regra de negócio, alterar stack ou estratégia de persistência, dar push ou merge sem autorização, publicar segredo, disparar `npm audit fix`, mexer em SPEC histórica (`SPEC/2026-10-01-*.md`) ou editar o histórico.

---

## 5. Comandos do dia a dia

```bash
npm test                                  # suíte do frontend
npm --workspace apps/web run test:watch   # observação contínua
npm run build                             # build do frontend
npm run build:api                         # build da API (Prisma + Nest)
npm run test:api                          # testes da API (exige PostgreSQL _test)
npm run metricas                          # as 10 métricas da Aula 09
node scripts/publicar-issues.mjs          # publica o backlog (idempotente)
docker compose up --build                 # sobe o frontend
```

---

## 6. Naming

| Tipo | Padrão | Exemplo |
|---|---|---|
| SPEC | `AAAA-MM-DD-slug.md` | `2026-11-13-estoque-de-ingredientes.md` |
| Branch de trabalho | `feat/<tema>` | `feat/kds-producao` |
| Sessão | `AAAA-MM-DD-<ferramenta>.md` | `2026-11-14-opencode.md` |
| Commit | `feat|fix|docs|test|chore(escopo): assunto` | `fix(api): impede baixa de estoque em comanda cancelada` |

---

## 7. Definition of done de uma issue

- [ ] SPEC datada, aprovada, com status atualizado para `implementada`
- [ ] Código no escopo da SPEC, sem função fora dela e nada sobrando
- [ ] Testes automatizados da camada afetada, **executados**, com o resultado registrado
- [ ] Critérios de aceitação da SPEC verificados um a um
- [ ] PR com pipeline verde e aprovação do outro integrante
- [ ] Merge na `main` e sessão do dia registrada em `prompts/sessoes/`
- [ ] Nenhuma pendência silenciosa: o que ficou aberto está na SPEC ou na issue

---

## 8. Pendências conhecidas (não são segredo, são fila)

| Pendência | Onde | Quem resolve |
|---|---|---|
| URL pública servindo o fork e deploy contínuo | issues 0.5 e 1.6 | dupla, com credencial da Vercel |
| Alerta crítico do `next@14` | issue 1.2 | dupla (SPEC com plano de migração) |
| Ligar o frontend à API | SPEC de reativação, P-1 | dupla e cliente |
| Custos/tokens das sessões | P-3 | responsável humano da sessão |
| Volume de código (6% do mínimo) | backlog de 40 issues | dupla, por SPEC |
