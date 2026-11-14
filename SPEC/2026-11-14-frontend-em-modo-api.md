# Frontend em modo API, com degradação explícita para o modo local

**Data:** 2026-11-14  
**Status:** implementada  
**Agent:** opencode/minimax-m3.1-flash-free  
**SPEC derivada de:** `SPEC/2026-11-12-reativacao-backend.md` (API reativada) e `SPEC/2026-10-01-frontend-local.md`  
**Derroga:** **em parte** `SPEC/2026-10-01-frontend-local.md`. A persistência em `localStorage` deixa de ser a única estratégia: passa a existir um modo em que os dados vivem no PostgreSQL através da API. O padrão continua sendo o modo local, e a publicação atual da Vercel **não muda** (sem `NEXT_PUBLIC_API_URL`, o app segue local-first). Justificativa: a API foi reativada e testada, mas o frontend não tinha como falar com ela — o produto não ganharia multiusuário, e o trabalho da API ficaria sem uso.

### Perguntas em aberto

- **P-1:** onde a API e o banco vão rodar em produção, e quem paga essa conta? (é a pendência P-2 da SPEC de reativação e a issue 0.5 do backlog). **Bloqueia** a publicação do modo API, não a implementação: sem isso, o app publicado continua no modo local.
- **P-2:** o modo API precisa de autenticação antes de ser exposto fora da rede local? A resposta desta SPEC é **não** (a API segue sem autenticação, como está hoje), e o risco fica registrado: a API não deve ser publicada na internet sem a SPEC de autenticação.
- **P-3:** no modo API, quem cadastra o primeiro cardápio e as mesas? Hoje a API tem `prisma/seed.ts` com os mesmos dados de demonstração do frontend. A resposta desta SPEC é: o `seed` no ambiente local e o botão de importação para quem já usa o app.

---

## Contexto e problema

A API NestJS com Prisma e PostgreSQL foi reativada em 2026-11-12 e hoje tem **248 testes de integração passando**, regras de negócio de mesas, cardápio, comandas, despesas, relatório financeiro, reservas, estoque e compras. O frontend, porém, **não sabe que a API existe**: `apps/web/lib/store.ts` implementa um adaptador local que simula as mesmas rotas HTTP sobre o `localStorage`.

Consequências today:

- **Não há multiusuário.** Cada navegador tem uma base isolada; o salão, o caixa e a cozinha nunca veem a mesma comanda.
- **O trabalho da API não aparece no produto.** 248 testes cobrem regras que nenhum usuário exercita.
- **Não há caminho testado para a API hospedada.** Quando a credencial da Vercel/banco chegar (P-1), não existe caminho de migração nem modo de operação definido.

O problema não é "faltam funcionalidades", é **faltar a ponte**: um contrato de dados único, um cliente HTTP testado e um modo de operação explícito.

## Objetivo

O frontend passa a operar contra a API quando ela está configurada e disponível, com degradação **explícita** (nunca silenciosa) para o modo local, e com um caminho controlado para levar os dados já existentes no navegador para o servidor.

## Escopo

- **Cliente HTTP no frontend** (`apps/web/lib/api-client.ts`) com o mesmo contrato de `storeRequest(path, init)` do adaptador local, traduzindo o corpo de erro do Nest para as mensagens em pt-BR do produto.
- **Modo de operação** (`api` ou `local`) resolvido a partir de `NEXT_PUBLIC_API_URL`, com troca em tempo de execução e estado observável pela interface (`useSyncExternalStore`).
- **Faixa de estado no app**: modo ativo, situação da API, ação de "tentar de novo", "usar o modo local" e "importar meus dados".
- **Importação explícita** dos dados do `localStorage` para a API (`apps/web/lib/import-local.ts`): mesas, cardápio, despesas e as comandas abertas.
- **Alinhamento das mensagens de validação** da API com as do frontend (DTOs com mensagem em pt-BR), para que a mesma ação mostre a mesma mensagem nos dois modos.
- **`docker-compose.yml` com a stack completa**: PostgreSQL, API e web, com migrações e `seed` aplicados no start do banco.
- **Testes**: cliente HTTP (com `fetch` simulado), resolução de modo, importação e mensagens da API.

## Fora do escopo

- **Publicar a API na internet** e a autenticação (P-2 da SPEC de reativação). A API continua sem autenticação e sem exposição pública.
- **Hospedar banco e API** (P-1): a decisão de onde rodar depende de credencial e de conversa com o cliente.
- **Mudar o app publicado**: sem `NEXT_PUBLIC_API_URL`, a Vercel continua servindo o app local-first, idêntico ao de hoje.
- **Migração automática** dos dados locais para a API (decisão humana: só por botão).
- **Fallback automático** para o modo local quando a API falhar (decisão humana: erro visível e escolha do usuário).
- Reservas, estoque, compras e fornecedores na interface: a API já tem as rotas, mas **exibí-las no app é uma SPEC por funcionalidade** (itens 2.23, 2.13 e 2.14 do backlog).

## Requisitos funcionais

- **RF-01:** com `NEXT_PUBLIC_API_URL` definida, todas as leituras e escritas do app vão para a API; sem ela, tudo continua no `localStorage`.
- **RF-02:** a interface mostra, sempre, em qual modo o app está operando.
- **RF-03:** falha de rede ou de servidor no modo API produz erro visível com "tentar de novo"; o app **não** troca de modo sozinho.
- **RF-04:** com a API indisponível, o usuário pode escolher explicitamente o modo local e voltar ao modo API depois.
- **RF-05:** com a API disponível e dados no navegador, a interface oferece "importar meus dados"; a importação informa quantos mesas, itens, despesas e comandas foram levados.
- **RF-06:** a importação não apaga nem altera os dados do navegador; ela apenas os envia para a API.
- **RF-07:** a mesma ação de negócio mostra a mesma mensagem em pt-BR nos dois modos.

## Requisitos não funcionais

- **RNF-01:** os testes rodam offline, sem banco e sem rede (ambiente `node`).
- **RNF-02:** nenhuma credencial, token ou string de conexão é embutida no bundle do navegador; a URL da API é a única configuração exposta.
- **RNF-03:** o modo local continua funcionando exatamente como hoje (nenhuma mudança de comportamento para quem usa a Vercel).
- **RNF-04:** pt-BR em todas as mensagens novas.

## Regras de negócio

- **RN-01:** o modo é **API** quando `NEXT_PUBLIC_API_URL` está definida e o usuário não escolheu o modo local; é **local** no resto dos casos. Origem: decisão humana de 2026-11-14.
- **RN-02:** erro de rede ou HTTP 5xx no modo API **não** causa troca automática de modo. O app mostra o erro e oferece "tentar de novo" e "usar o modo local". Origem: decisão humana de 2026-11-14 ("Mostrar erro e deixar escolher o modo local").
- **RN-03:** a transferência de dados do navegador para a API só acontece por ação explícita do usuário, uma vez, com relatório do que foi transferido. Origem: decisão humana de 2026-11-14 ("Botão explícito de importar").
- **RN-04:** a ordem da importação é tabelas → cardápio → despesas → comandas abertas (a comanda depende da mesa e do item). Mesas e itens já existentes no servidor são reaproveitados, não duplicados.
- **RN-05:** as mensagens de erro do produto são as mesmas nos dois modos: "Informe um número de mesa válido.", "Informe um preço válido.", "Informe o nome do item.", "Informe uma quantidade entre 1 e 500.", "Informe um valor válido.", entre outras. A API passa a devolver exatamente essas mensagens.
- **RN-06:** valor monetário (preço e valor de despesa) precisa ser número finito, maior que zero e com **no máximo duas casas decimais**. A API passou a recusar o que tinha três casas; o modo local passou a recusar igual, para que o mesmo preço digitado não produza totais diferentes nos dois modos.

## Critérios de aceitação verificáveis

- **CA-01:** sem `NEXT_PUBLIC_API_URL`, a suíte existente continua passando sem alteração de comportamento (modo local). → verificado por `npm test`.
- **CA-02:** o cliente HTTP monta a URL corretamente (base + caminho + query), envia `Content-Type: application/json` nos corpos e devolve o JSON da resposta. → verificado por teste com `fetch` simulado.
- **CA-03:** erro HTTP do Nest (`{ statusCode, message }`) vira `Error` com a mensagem em pt-BR; erro de rede vira mensagem de conexão recusada. → verificado por teste.
- **CA-04:** `resolveMode()` devolve `api` quando há URL da API e `local` quando não há, e a troca manual de modo é observável por quem assina a mudança de estado. → verificado por teste.
- **CA-05:** a interface exibe a faixa de modo com "tentar de novo" e "usar o modo local" quando a API falha, e não troca de modo sozinha. → verificado por inspeção do código e pelo teste do estado.
- **CA-06:** a importação envia mesas, cardápio, despesas e comandas abertas na ordem da RN-04, reaproveita mesa e item já existentes e devolve o relatório do que foi transferido. → verificado por teste com `fetch` simulado.
- **CA-07:** os DTOs da API devolvem as mensagens em pt-BR da RN-05. → verificado por teste na suíte da API.
- **CA-08:** `docker compose up --build` sobe PostgreSQL, API e web; o web fala com a API; o health check da API responde. → verificado por execução local.
- **CA-09:** `npm test` (frontend) e `npm run test:api` passam; `npm run build` do frontend e `npm run build:api` concluem. → verificado por execução.
- **CA-10:** nenhuma string de conexão, senha ou token é adicionada ao bundle do frontend. → verificado por leitura do código e do bundle gerado (o único valor embutido é a URL da API).
- **CA-11:** a stack completa sobe com `docker compose up --build`: PostgreSQL saudável, API respondendo em `/api/health`, web respondendo em `/` e a URL da API embutida no bundle do navegador. → verificado por execução.
- **CA-12:** a importação foi executada contra a API em execução: 2 mesas, 1 item de cardápio, 1 despesa e 1 linha de comanda foram para o banco, e a comanda da mesa 41 aparece na API com o item importado. → verificado por execução.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-11 | `fetch` simulado respondendo 200 com JSON | `apiRequest('/tables')` | devolve o corpo JSON e a URL chamada é `base + /tables` |
| T-12 | `fetch` simulado respondendo 400 `{ message: ['Informe um preço válido.'] }` | `apiRequest('/menu-items', { method: 'POST', body })` | erro com a mensagem "Informe um preço válido." |
| T-13 | `fetch` simulado rejeitando (rede) | `apiRequest('/tables')` | erro de conexão recusada |
| T-14 | `NEXT_PUBLIC_API_URL` ausente | `resolveMode()` | `local` |
| T-15 | `NEXT_PUBLIC_API_URL` presente | `resolveMode()` | `api` |
| T-16 | modo API, falha de rede | `storeRequest('/tables')` | o erro propaga e o modo continua `api` |
| T-17 | dados no `localStorage` (2 mesas, 2 itens, 1 despesa, 1 comanda aberta) | `importLocalData()` | 4 requisições de mesa/item já existente são reaproveitadas, o relatório traz os totais e nada é apagado do navegador |
| T-18 | DTO da API com corpo inválido | `validate(CreateMenuItemDto, ...)` | a mensagem é "Informe um preço válido." |

- **Camada de teste:** regras de negócio do cliente HTTP e da importação (frontend) e validação de entrada (API).
- **Framework:** Vitest 5.1.0 (já aprovado na SPEC de 2026-11-10).
- **Automação prevista:** T-11 a T-18 entram na suíte e rodam no pipeline.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/store.ts` (vira fachada do modo), `apps/web/lib/local-store.ts` (adaptador local, movido), `apps/web/lib/api-client.ts` (novo), `apps/web/lib/import-local.ts` (novo), `apps/web/app/page.tsx` (faixa de modo), `apps/web/app/globals.css` (estilo da faixa), `apps/api/src/dto.ts` (mensagens em pt-BR), `docker-compose.yml` (stack completa), `Dockerfile` (build da API e variável da API).
- **Persistência:** o formato do `localStorage` **não muda** (`mesa-clara.data.v1`). Nenhuma migração de dados do navegador é necessária; a importação para a API é aditiva.
- **Backend:** as rotas existentes são consumidas como estão; a única alteração é a mensagem de validação dos DTOs.
- **Stack/tecnologias:** não muda (nenhuma dependência nova).
- **Deploy/Docker/Vercel:** o build do frontend passa a aceitar `NEXT_PUBLIC_API_URL` como argumento de build. A publicação atual, sem a variável, não muda.

## Dependências e riscos

- **Dependências:** SPECs de reativação e de conformidade; Postgres 16 disponível por Docker para a verificação local.
- **Riscos:** (a) o app publicado mudar de comportamento se `NEXT_PUBLIC_API_URL` for definida sem a API no ar — mitigado pela regra de mostrar o erro, sem fallback silencioso; (b) divergência de dados entre navegador e servidor após a importação — mitigado pelo relatório da importação e por não apagar nada local; (c) a API sem autenticação ser exposta por engano — mitigado por manter a API fora da publicação e registrar o risco na SPEC.
- **Mitigações:** testes de contrato do cliente HTTP, verificação manual do `docker compose up` e do bundle gerado.

## Plano de implementação

1. ✅ Mover o adaptador local para `apps/web/lib/local-store.ts` e deixar `store.ts` como fachada (modo, assinatura de mudanças, helpers).
2. ✅ Implementar `api-client.ts` com o contrato de `storeRequest` e a tradução de erros.
3. ✅ Implementar a seleção de modo e a assinatura de mudanças.
4. ✅ Escrever os testes do cliente, do modo e da importação (T-11 a T-16).
5. ✅ Implementar `import-local.ts` e o teste da importação (T-17).
6. ✅ Alinhar as mensagens dos DTOs da API e o teste correspondente (T-18).
7. ✅ Montar a faixa de estado no app e o estilo correspondente.
8. ✅ Atualizar `docker-compose.yml` e o `Dockerfile` para a stack completa; subir e verificar.
9. ✅ Rodar as suítes, o build e registrar o resultado.
10. ✅ Verificar item a item os Critérios de Aceitação; atualizar o status desta SPEC.

### Achados durante a execução

- **O build da API em produção estava incompleto.** O `tsconfig.build.tsbuildinfo` (build incremental) versionado por engano fazia o `nest build` em Docker emitir arquivos parciais — faltavam `prisma.service.js` e os módulos novos, e a API caía no boot. Corrigido removendo o artefato antes do build e ignorando `**/*.tsbuildinfo` no contexto do Docker. **Este bug não existia no CI**, porque o CI roda os testes contra o código TypeScript, não contra o `dist`.
- **`NODE_ENV=production` antes do `npm ci` omitia as devDependencies** da imagem da API (o `tsx` do seed), quebrando a carga inicial de dados.
- **A regra de valor monetário divergia entre os modos**: a API recusava preço com três casas e o modo local aceitava e arredondava. Unificada pela RN-06, com o validador `IsMoney` na API e `isValidMoney` no frontend.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-14 | Criação do rascunho, com as duas decisões humanas de modo (erro visível em vez de fallback; importação por botão) | rascunho |
| 2026-11-14 | Aprovada pelo responsável humano; implementação concluída com CA-01 a CA-12 verificados | implementada |
