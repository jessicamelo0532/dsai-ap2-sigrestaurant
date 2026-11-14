# AGENTS.md — Instruções permanentes para agentes de IA

Projeto: **Mesa Clara / SIGRestaurant**  
Disciplina: Desenvolvimento de Software Apoiado por IA (AP2)  
Repositório herdado; manutenção orientada a especificações (Spec-Driven Development).

Este arquivo é a referência permanente de conduta para agentes de IA que atuam neste repositório. Instruções em `AGENTS/README.md` (convenções humanas de trabalho) e nas SPECs históricas continuam válidas; em caso de conflito, vale a SPEC mais recente aprovada para a funcionalidade em questão.

---

## 1. Arquitetura e escopo atual

- **Produto ativo:** apenas o frontend Next.js (App Router) + React + TypeScript em `apps/web`, com persistência em `localStorage` do navegador (`apps/web/lib/store.ts`).
- **Backend NestJS + Prisma + PostgreSQL** em `apps/api/` está **pausado por decisão explícita do usuário original** para permitir publicação na Vercel. Código permanece no repositório, mas **não participa do build nem do deploy ativos**.
- **Monorepo npm workspaces:** a raiz declara somente `workspaces: ["apps/web"]`.
- **Docker:** `docker-compose.yml` e `Dockerfile` sobem somente o frontend.
- **Persistência ativa:** `localStorage` (chave `mesa-clara.data.v1`); dados não sincronizam entre dispositivos, navegadores ou perfis.
- **Escopo funcional atual:** mesas, comandas (adicionar/remover itens, fechar conta), cardápio (CRUD + pausar/reativar), despesas e relatório financeiro por período.
- **Fora de escopo permanente (spec original):** autenticação, emissão fiscal, estoque, gorjeta, integração com adquirente.

Stack de referência: Next.js 14, React 18, TypeScript, lucide-react, Docker. Backend pausado: NestJS 10, Prisma 6, PostgreSQL.

## 2. Proibição de reescrever o projeto ou trocar tecnologias

- É **proibido** reescrever o projeto do zero, migrar de framework, trocar de biblioteca principal, reativar o backend ou alterar a arquitetura (inclusive a persistência `localStorage` → API/banco) **sem uma SPEC aprovada por um humano**.
- Mudanças de stack, de estratégia de persistência, de formato de dados ou de pipeline de deploy exigem SPEC dedicada e aprovação explícita antes de qualquer código.
- Não remover funcionalidades existentes sem SPEC que justifique a remoção.

## 3. Obrigação de consultar as SPECs antes de implementar

- Antes de qualquer alteração, ler: `README.md`, `AGENTS.md` (este arquivo), `AGENTS/README.md`, **todos** os arquivos de `SPEC/` relevantes à funcionalidade, e o código que será tocado.
- A SPEC datada é a fonte da verdade do comportamento pretendido. Divergência entre SPEC e código deve ser **reportada**, não silenciosamente “corrigida” para o que o código faz.

## 4. Obrigação de criar SPEC datada antes de qualquer nova funcionalidade

- Toda funcionalidade nova ou mudança de comportamento exige **primeiro** uma SPEC datada em `SPEC/`, criada a partir de `SPEC/TEMPLATE.md`.
- Formato de nome: `AAAA-MM-DD-<slug-curto>.md` (mesmo padrão das SPECs históricas).
- A SPEC deve existir e estar aprovada **antes** do commit que implementa a funcionalidade.
- Código sem SPEC correspondente não deve ser entregue.

## 5. Manter as SPECs atualizadas quando o comportamento mudar

- Se a implementação alterar comportamento já especificado, a SPEC deve ser **atualizada na mesma mudança** (ou substituída por nova SPEC datada que declare a derrogação, conforme `SPEC/README.md`).
- SPECs históricas (`SPEC/2026-10-01-*.md`) são **imutáveis**: não editar retroativamente; registrar mudanças em SPEC nova.
- Estado da SPEC (rascunho / aprovada / implementada / desatualizada) deve refletir a realidade do repositório.

## 6. Obrigação de escrever e executar testes

- Toda funcionalidade deve vir acompanhada de testes automatizados adequados à camada afetada (regras de negócio do `store`, componentes, ou API quando reativada).
- Os testes devem ser **executados** antes de considerar a tarefa concluída; o resultado (sucesso/falha) deve ser reportado.
- É proibido entregar alteração de comportamento sem evidência de execução dos testes.
- Framework de testes: definir na SPEC da funcionalidade se ainda não houver padrão no repositório (hoje **não há** runner de testes configurado — pendência registrada na auditoria).

## 7. Proibição de concluir funcionalidade sem critérios de aceitação verificados

- “Concluído” só após **verificar item a item** os Critérios de Aceitação da SPEC.
- O relatório de entrega deve mapear cada critério → como foi verificado → resultado.
- Critérios não verificáveis ou não verificados devem ser declarados como pendência, nunca omitidos.

## 8. Proibição de inventar regras de negócio

- Regras de negócio só existem se estiverem em SPEC ou no README/spec histórico.
- Em caso de dúvida (limite, validação, mensagens, comportamento de borda): **perguntar ao humano** ou abrir rascunho de SPEC com as perguntas — não decidir sozinho.
- Não copiar silenciosamente regras do backend pausado para o frontend (ou vice-versa) sem declarar na SPEC.

## 9. Proibição de inserir segredos, credenciais ou dados pessoais reais

- Nunca versionar `.env` real, senhas, tokens, chaves de API ou dados pessoais (PII).
- Credenciais de exemplo só em arquivos `*.example` com valores fictícios locais.
- Dados de demonstração no `localStorage` devem ser sintéticos.
- Violado esse item: reverter imediatamente e registrar o incidente na entrega.

## 10. Registro das sessões em `prompts/sessoes/`

- As mensagens relevantes do usuário nas sessões de desenvolvimento devem ser registradas em `prompts/sessoes/` (conforme `AGENTS/README.md`).
- Se o ambiente não exportar a conversa em bruto, registrar a limitação e transcrever as mensagens do usuário sem reescrita de sentido.
- Nome sugerido: `AAAA-MM-DD-<ferramenta>.md`.

## 11. Commits pequenos, com trailers `Agent:` e `Spec:` no corpo

- Commits pequenos e atômicos; mensagem no estilo do repositório (ex.: `feat(web): ...`, `docs: ...`, `fix: ...`).
- **Corpo do commit deve conter obrigatoriamente:**
  - `Agent: <identificação do agente/modelo>` (ex.: `Agent: codex/gpt-6`, `Agent: opencode/<modelo>`)
  - `Spec: SPEC/AAAA-MM-DD-<slug>.md` (ou `Spec: n/a` para documentação pura sem mudança de comportamento)
- Não fazer commit de: `node_modules/`, `.next/`, `dist/`, `.env`, lockfiles não autorizados na tarefa.
- Não fazer `push` ou abrir PR sem pedido explícito do humano.

## 12. Revisão antes de merges na branch principal

- **Nunca** fazer merge (ou push direto) em branch principal sem revisão humana.
- PRs/entregas devem incluir: SPEC referenciada, testes executados, resultados de build/lint, critérios de aceitação verificados e pendências abertas.
- Conflitos com este arquivo ou com SPECs devem ser resolvidos por decisão humana.

---

## Restrições transversais

- Não ocultar erros, warnings ou limitações: sempre reportar.
- Não rodar `npm audit fix` nem alterar versões de dependências sem aprovação.
- Não criar lockfiles nem alterar configuração de build/deploy sem autorização na tarefa.
- Não fabricar testes apenas para inflar contagem.
- Não alterar `SPEC/2026-10-01-*.md` históricas.
- Diferenciar **fato comprovado** de **hipótese** em relatórios.

## Referências rápidas

| Documento | Uso |
|---|---|
| `README.md` | Estado atual do produto, execução e pendências |
| `AGENTS/README.md` | Convenções humanas de sessão e commits |
| `SPEC/README.md` | Ciclo de vida e convenções das SPECs |
| `SPEC/TEMPLATE.md` | Modelo de nova funcionalidade |
| `SPEC/2026-10-01-restaurante.md` | Especificação original do sistema |
| `SPEC/2026-10-01-frontend-local.md` | Alteração de escopo para frontend local-first |
| `prompts/sessoes/` | Histórico de mensagens do usuário |
