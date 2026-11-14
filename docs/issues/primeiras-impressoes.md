# Primeiras impressões

Issue de entrada da AP2, conforme a entrega de hoje da Aula 09.

## 1. O projeto roda?

**Sim.** O projeto roda e o build de produção fecha sem erro.

- Local: `docker compose up --build` sobe o frontend em http://localhost:3000.
- Produção: https://dsai-ap1-sigrestaurant.vercel.app/ responde HTTP 200.
- Testes: `npm test` passa 6/6 testes.
- Build: `npm run build` gera a rota `/` estática (10,3 kB, 97,5 kB First Load JS).
- CI: pipeline em `.github/workflows/ci.yml` (install, build, testes, cobertura, duplicação, gitleaks, `npm audit`, trailers e métricas).

## 2. O que parece feito?

O escopo funcional da AP1 está presente e funcionando:

- Mesas: criar e remover; mesa com comanda aberta não pode ser removida.
- Comandas: adicionar itens do cardápio com quantidade, editar e remover linhas antes do pagamento.
- Cardápio: cadastrar, editar, pausar, reativar e remover itens.
- Fechamento: contas fechadas com Pix, dinheiro, crédito ou débito.
- Financeiro: despesas registradas e relatório de receita, despesas, saldo e formas de pagamento por período.

Backend NestJS + Prisma + PostgreSQL existe em `apps/api/` e está **pausado** (não entra no build ativo) — decisão da AP1 para viabilizar a publicação na Vercel.

## 3. Há sinal de uso?

**Não há sinal de uso direto — e essa é a lacuna principal.** Fatos:

- A aplicação é local-first: os dados ficam no `localStorage` do navegador, **não sincronizam** entre dispositivos, navegadores ou perfis. Não existe telemetria, contador de usuários ou registro de eventos.
- A deployment na Vercel responde 200, mas isso comprova apenas que o build está publicado, não que alguém o usa.
- O histórico do repositório mostra 14 commits da AP1 (autoria de `Codex` e `afonso`) e nenhum registro de uso, relato ou feedback de usuário.

**Pergunta 3 do slide ("o que foi construído foi usado?") fica, portanto, sem resposta afirmativa por evidência.** A ausência de instrumentação é, em si, o achado: sem ela, o produto não consegue demonstrar uso nem guiding a evolução da AP2.

## Três perguntas para o cliente

**P1 — Multiusuário.** Hoje cada navegador tem sua própria base de dados isolada. Faz sentido o restaurante precisar que o caixa, o salão e a cozinha vejam a mesma comanda ao mesmo tempo? Se sim, isso exige religar o backend com banco hospedado e trocar a estratégia de persistência — é uma mudança de arquitetura, não uma evolução incremental.

**P2 — Ordem dos pedidos.** O garçom hoje adiciona itens à comanda, mas **não há envio para a cozinha**: não existe display de produção, nem status de preparo, nem controle de tempo. Para o fluxo real de um restaurante, o garçom precisa enviar o pedido e a cozinha precisa confirmar. Isso está no topo do backlog da AP2.

**P3 — Fechamento e conferência.** Hoje o relatório financeiro responde "quanto entrou e quanto saiu no período". Mas não há **fechamento de caixa por turno** (quem abriu, quem fechou, qual valor esperado), nem sangria/entrada, nem relatório de produtos mais vendidos. Para o dono do restaurante decidir o que produzir amanhã, o relatório atual não responde.

## Como este repositório está evoluindo

- Especificações datadas em `SPEC/` antes de cada funcionalidade.
- Sessões de agente em `prompts/sessoes/` por dia de trabalho.
- Commits pequenos com trailers `Agent:` e `Spec:`.
- Auditoria de conformidade com as métricas da aula: [`docs/AUDITORIA-AP2.md`](../../docs/AUDITORIA-AP2.md).
