# Assistente de ajuda guiada para a operação de salão

**Data:** 2026-11-25  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** `README.md`, `SPEC/2026-10-01-restaurante.md`, `SPEC/2026-11-17-atendimento-na-comanda.md`, `SPEC/2026-11-17-tela-do-caixa.md`  
**Derroga:** n/a

---

## Contexto e problema

Fato comprovado em 2026-11-25: o app tem 13 seções e nenhuma ajuda dentro da interface. O conhecimento operacional está espalhado em `README.md` e nas SPECs, que são longos para quem só quer aprender a abrir uma mesa, lançar um item e fechar a conta. Um atendente novo precisa de alguém ao lado para o fluxo básico.

O usuário pediu, em 2026-11-25, um “agente de IA que ensine a utilizar o sistema”. Na mesma data decidiu:

- **Ajuda guiada offline**, sem LLM, sem chave e sem chamada de rede.
- **Fluxo crítico** como primeiro escopo: abrir mesa, lançar item, fechar conta e receber.
- **Público principal:** operação de salão (garçom/atendente).

### Perguntas em aberto

- nenhuma. Decisões humanas de 2026-11-25: rótulo **Ajuda**, acesso na **barra superior** e abertura **só ao clicar**.

## Objetivo

Dar ao atendente um painel de **ajuda guiada, offline e determinística** que responde “como faço…” com passos curtos e leva à seção certa do app, sem inventar regras e sem executar operações.

## Escopo

- Catálogo local de tópicos do fluxo crítico em `apps/web/lib/help.ts`.
- Botão **Ajuda** na barra superior, abrindo um painel modal (desktop) ou tela cheia (celular); o painel não abre sozinho.
- Sugestões contextuais conforme a seção atual e os quatro tópicos críticos.
- Busca local por palavra-chave, sem diferenciar maiúsculas nem acentos.
- Cada tópico mostra resumo, passos numerados, a SPEC de origem e um botão **Ir para <seção>**.
- Mensagem de “não encontrei” com sugestões, sem chamada de rede.
- Funciona nos modos navegador e servidor; quando o passo depender do modo, o texto explica a diferença.
- Testes de regras do catálogo/busca e de componente.
- Documentação no `README.md`.

## Fora do escopo

- LLM, chat em linguagem natural, embeddings, RAG, voz ou qualquer API externa.
- Chave de API, telemetria, analytics ou armazenamento de perguntas.
- Executar cliques, preencher formulários ou operar o sistema pelo usuário.
- Alterar regras de negócio, dados, `localStorage`, backend, schema ou navegação principal.
- Criar nova seção na navegação.
- Conteúdo de gestão (cardápio, custos, metas, relatórios) nesta primeira versão.
- Idiomas além do pt-BR.

## Requisitos funcionais

- **RF-01:** o botão **Ajuda** na barra superior abre o painel; fechar por **X**, **Esc** ou clique no fundo.
- **RF-02:** ao abrir, o painel mostra sugestões da seção atual e os quatro tópicos críticos: abrir mesa, lançar item, fechar conta e receber.
- **RF-03:** o campo de busca filtra o catálogo por título, palavras-chave e passos, sem diferenciar maiúsculas nem acentos, e mostra no máximo 5 resultados.
- **RF-04:** ao escolher um tópico, o painel mostra resumo, passos numerados, a SPEC de origem e o botão **Ir para <seção>**.
- **RF-05:** o botão **Ir para <seção>** troca a seção do app e fecha o painel.
- **RF-06:** quando a busca não encontra nada, o painel mostra uma mensagem curta e volta a oferecer os tópicos críticos.
- **RF-07:** o painel não faz requisição de rede e não grava histórico; o estado vive só enquanto o painel está aberto.
- **RF-08:** o catálogo cobre, no mínimo, os tópicos: visão geral e modos; abrir mesa e lançar o primeiro item; adicionar, alterar quantidade e remover item; enviar à cozinha; fechar conta e pagar; receber no Caixa; problemas comuns (modo navegador, item pausado, mesa ocupada).
- **RF-09:** cada tópico declara a SPEC de origem e a seção de destino; nenhum texto de regra é escrito sem fonte.

## Requisitos não funcionais

- **RNF-01:** todo texto em pt-BR; mensagens curtas e orientadas à ação.
- **RNF-02:** acessível: `role="dialog"`, `aria-modal`, foco no painel ao abrir, **Esc** fecha, botões com nome acessível e alvos de pelo menos 44 px.
- **RNF-03:** em 375 px não há rolagem lateral; campos têm fonte de pelo menos 16 px.
- **RNF-04:** sem dependência nova; conteúdo empacotado no bundle do frontend.
- **RNF-05:** busca e abertura não dependem de rede, banco ou servidor.
- **RNF-06:** testes rodam offline com Vitest + Testing Library, como o restante do repositório.

## Regras de negócio

- **RN-01:** a ajuda **não inventa** regras. Cada tópico cita a SPEC de origem; se a resposta não estiver no catálogo, o painel diz que não encontrou e sugere os tópicos críticos. Origem: `AGENTS.md` §8.
- **RN-02:** a ajuda é determinística e local; não há LLM, embeddings nem chamada externa. Decisão humana de 2026-11-25.
- **RN-03:** a ajuda **não executa** operações; o máximo que faz é navegar para a seção. A execução continua sendo do operador.
- **RN-04:** nenhuma pergunta, resposta ou dado do restaurante é persistido pela ajuda.
- **RN-05:** o catálogo crítico tem no mínimo os oito tópicos do RF-08; cada um tem `title`, `keywords`, `summary`, `steps`, `source` e `section`.
- **RN-06:** sugestões contextuais usam a seção atual; se não houver tópico específico, mostram os quatro tópicos críticos.

## Critérios de aceitação verificáveis

- **CA-01:** dado o app aberto, quando o operador clica em **Ajuda**, então o painel abre com foco e pode ser fechado por **X** ou **Esc**.
- **CA-02:** dada a seção **Caixa**, quando o painel abre, então a sugestão contextual inclui receber/pagamento.
- **CA-03:** quando o operador busca “fechar conta”, “FECHAR CONTA” ou “fechar contá”, então o tópico de fechamento aparece.
- **CA-04:** dado um tópico aberto, então os passos estão numerados, a SPEC de origem é exibida e o botão **Ir para <seção>** existe.
- **CA-05:** quando o operador clica em **Ir para Visão geral**, então a seção do app muda e o painel fecha.
- **CA-06:** quando a busca não encontra nada, então aparece a mensagem de não encontrado e nenhuma chamada de rede é feita.
- **CA-07:** em 375 px, o painel não causa rolagem lateral e os alvos de toque respeitam 44 px.
- **CA-08:** quando `npm test` roda, então os testes de `lib/help.ts` e do painel passam.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | App aberto | Clicar em Ajuda; fechar com Esc | Painel abre com foco e fecha (CA-01) |
| T-02 | Seção Caixa | Abrir Ajuda | Sugestão de recebimento (CA-02) |
| T-03 | Painel aberto | Buscar “FECHAR CONTA” | Tópico de fechamento (CA-03) |
| T-04 | Tópico aberto | Observar passos e fonte | Passos numerados, SPEC e botão de navegação (CA-04) |
| T-05 | Tópico “Abrir mesa” | Clicar em Ir para Visão geral | Seção muda e painel fecha (CA-05) |
| T-06 | Painel aberto | Buscar “xyzabc” | Não encontrado, sem fetch (CA-06) |
| T-07 | Viewport 375 px | Abrir Ajuda | Sem rolagem lateral; alvos ≥ 44 px (CA-07) |
| T-08 | Suíte do frontend | `npm test` | Testes novos verdes (CA-08) |

- **Camada de teste:** regras puras (`lib/help.ts`) e componente (`help-agent.tsx`).
- **Framework:** Vitest + Testing Library, o mesmo do repositório.
- **Automação prevista:** T-01 a T-06 e T-08 em testes automatizados; T-07 no e2e de celular existente.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/help.ts` (novo), `apps/web/lib/help.test.ts` (novo), `apps/web/app/help-agent.tsx` (novo), `apps/web/app/help-agent.test.tsx` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`, `README.md`, `docs/issues/backlog.md`.
- **Tipo de seção:** extrair `Section` e `sectionLabels` de `page.tsx` para `apps/web/lib/sections.ts` para o catálogo e o painel usarem o mesmo tipo, sem duplicar a lista.
- **Persistência:** não muda o `localStorage`; nenhum dado novo é gravado.
- **Backend pausado:** não toca em `apps/api`; nenhuma rota nova.
- **Stack/tecnologias:** não muda; sem LLM e sem dependência nova.
- **Deploy/Docker/Vercel:** não afeta o build além do novo código; não exige variável de ambiente.

## Dependências e riscos

- **Dependências:** texto dos passos conferido contra a UI atual.
- **Riscos:** o texto da ajuda envelhecer quando a tela mudar; a busca não achar sinônimos; o painel atrapalhar o atendimento; o usuário achar que é um chat com IA.
- **Mitigações:** campo `source` obrigatório e revisão junto de mudanças de tela; sinônimos nas palavras-chave e testes de busca; botão discreto na barra e sem abertura automática; rótulo **Ajuda guiada** e aviso de que é offline.

## Plano de implementação

1. Extrair `Section`/`sectionLabels` para `lib/sections.ts`.
2. Criar `lib/help.ts` com o catálogo crítico e a busca; escrever `help.test.ts`.
3. Criar `help-agent.tsx` e `help-agent.test.tsx`.
4. Integrar o botão na barra superior e a navegação no `page.tsx`; estilos em `globals.css`.
5. Adicionar a verificação do painel ao e2e de celular.
6. Rodar `npm test`, `npm run build` e `npm run e2e:celular`; registrar os resultados.
7. Atualizar `README.md`, backlog, status e histórico desta SPEC.
8. Commit com `Agent:` e `Spec:`.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-25 | Criação do rascunho com as decisões humanas: ajuda offline, fluxo crítico e público de salão. | rascunho |
| 2026-11-25 | Decisões humanas: rótulo Ajuda, acesso na barra superior e abertura só ao clicar. SPEC aprovada. | aprovada |
| 2026-11-25 | Implementação concluída: `lib/sections.ts`, `lib/help.ts`, painel, integração na barra superior, estilos e e2e. `npm test` 614 testes em 53 arquivos, todos verdes; cobertura de linhas 89,65%; `npm run build` e `npm run e2e:celular` verdes. CA-01 a CA-08 cobertos por T-01 a T-08. | implementada |
