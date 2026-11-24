# Publicação da API na Render para a Vercel usar o modo servidor

**Data:** 2026-11-24  
**Status:** aprovada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** `SPEC/2026-11-12-reativacao-backend.md`, `SPEC/2026-11-14-frontend-em-modo-api.md`  
**Derroga:** **em parte** `SPEC/2026-11-14-frontend-em-modo-api.md`, apenas nos itens que mantinham a API fora da internet e a autenticação como bloqueio. A publicação passa a existir para dados sintéticos de demonstração, **sem autenticação**, por decisão humana de 2026-11-24.

---

## Contexto e problema

Fato comprovado em 2026-11-24:

- O frontend publicado na Vercel (`https://dsai-ap2-sigrestaurant.vercel.app/`) roda no **modo navegador**: sem `NEXT_PUBLIC_API_URL`, os dados ficam no `localStorage` de cada aparelho e não há multiusuário.
- A API NestJS + Prisma + PostgreSQL compila, tem suíte de integração e sobe junto no `docker compose` local, mas **não está publicada**. A SPEC de reativação deixou **P-1** (onde hospedar) e **P-2** (autenticação) em aberto.
- O README e a SPEC `2026-11-14-frontend-em-modo-api.md` registram que a API **não deve ser publicada sem autenticação**. Hoje não existe nenhuma camada de autenticação em `apps/api`.

O usuário pediu para resolver a publicação da API para a Vercel sair do modo navegador. Em 2026-11-24 decidiu:

- **P-1:** hospedar API e PostgreSQL na **Render**.
- **P-2:** **sem autenticação**, apenas com **dados sintéticos** de demonstração; o risco fica aceito e registrado.
- O deploy será aplicado por quem tem acesso à Vercel (a dupla), a partir da configuração versionada.

### Perguntas em aberto

- nenhuma para esta SPEC. O domínio final do serviço Render é conhecido só depois da criação; o passo de copiar a URL para a Vercel está nos critérios de aceitação.

## Objetivo

Publicar a API e o PostgreSQL na Render a partir de um Blueprint versionado e apontar a Vercel para ela via `NEXT_PUBLIC_API_URL`, para que o app publicado passe a operar no modo servidor com dados compartilhados.

## Escopo

- `render.yaml` na raiz do repositório com:
  - um PostgreSQL free (`mesa-clara-db`, banco `restaurante`);
  - um web service Docker (`mesa-clara-api`) a partir de `apps/api/Dockerfile`, com contexto na raiz;
  - `DATABASE_URL` vindo do banco criado;
  - `WEB_ORIGIN` apontando para a publicação da Vercel;
  - health check em `/api/health`;
  - comando de start que aplica migrações, roda o seed idempotente e inicia a API.
- Documentação no `README.md` do passo a passo de deploy e das limitações do plano free.
- Ajuste do `apps/api/.env.example` com o exemplo de produção.
- Teste automatizado que valida os invariantes do `render.yaml` (arquivos referenciados, health check, ligação do banco e origem).
- Atualização da nota do README que hoje proíbe publicar a API sem autenticação.

## Fora do escopo

- Autenticação de usuários (login, JWT, tokens). A API segue aberta; só dados sintéticos.
- Publicar o frontend fora da Vercel ou trocar a Vercel por outro host.
- Hospedagem paga, domínio próprio, backups e observabilidade.
- Preview deployments da Vercel (URLs `*.vercel.app` de PR): o CORS cobre só a origem de produção.
- Migrar automaticamente dados de `localStorage` para o banco: continua sendo o botão explícito de importação.
- Integrar os PRs de módulos da API (#95–#101): trabalho separado.
- Mudar regras de negócio, rotas, formato de dados ou o schema Prisma.

## Requisitos funcionais

- **RF-01:** aplicar o Blueprint da Render cria o PostgreSQL e o web service da API, com a API respondendo `200` em `/api/health`.
- **RF-02:** o start da API aplica `prisma migrate deploy`, executa o seed idempotente e inicia o processo.
- **RF-03:** a API aceita requisições do navegador da Vercel (CORS com `WEB_ORIGIN` igual à URL de produção).
- **RF-04:** a Vercel, com `NEXT_PUBLIC_API_URL=https://<serviço>.onrender.com/api`, passa a servir o app no modo servidor após novo build.
- **RF-05:** o repositório não contém senha, token ou string de conexão real; a senha do banco é gerada pela Render.

## Requisitos não funcionais

- **RNF-01:** configuração declarativa e idempotente; reaplicar o Blueprint não duplica recursos.
- **RNF-02:** documentação em pt-BR e passos executáveis por quem tem as contas.
- **RNF-03:** nenhuma credencial versionada; só placeholders e referências `fromDatabase`.

## Regras de negócio

- **RN-01:** a API publicada usa **somente dados sintéticos**; é proibido inserir dados pessoais reais (AGENTS §9). Origem: decisão humana de 2026-11-24.
- **RN-02:** a ausência de autenticação é um risco aceito e temporário; qualquer uso com dados reais exige nova SPEC de autenticação. Origem: derrogação registrada no topo.
- **RN-03:** o frontend continua **sem fallback automático** para o modo local quando a API falha; mostra erro e oferece "Tentar de novo" e "Usar o modo local" (`SPEC/2026-11-14-frontend-em-modo-api.md`, RN-02).
- **RN-04:** a origem permitida no CORS é exatamente a URL de produção da Vercel; outras origens são recusadas. Origem: decisão humana de 2026-11-24.

## Critérios de aceitação verificáveis

- **CA-01:** dado o `render.yaml` aplicado, quando o deploy termina, então `GET https://<serviço>.onrender.com/api/health` responde `{"status":"ok"}`.
- **CA-02:** dado o banco criado, quando a API sobe, então as migrações estão aplicadas e o seed deixou 5 mesas, a zona "Salão" e 5 itens de cardápio.
- **CA-03:** dado um `OPTIONS`/`GET` com `Origin: https://dsai-ap2-sigrestaurant.vercel.app`, quando a API responde, então o cabeçalho `Access-Control-Allow-Origin` traz essa origem.
- **CA-04:** dado `NEXT_PUBLIC_API_URL` definida na Vercel e um novo deploy, quando o app abre, então a faixa mostra o modo **servidor** e as mesas vêm da API.
- **CA-05:** quando `npm run test:scripts` roda, então o teste do `render.yaml` passa e falha se o health check, o Dockerfile ou a ligação do banco forem removidos.
- **CA-06:** quando o repositório é varrido por segredos, então não há senha/token real (só referências `fromDatabase`).

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | `render.yaml` no repositório | Rodar `npm run test:scripts` | Teste estrutural passa |
| T-02 | Blueprint aplicado | Abrir `/api/health` | `200 {"status":"ok"}` |
| T-03 | Blueprint aplicado | `GET /api/tables` | Lista com as mesas do seed |
| T-04 | Origem da Vercel | Requisição com `Origin` de produção | CORS permite a origem |
| T-05 | Origem desconhecida | Requisição com outra `Origin` | Sem `Access-Control-Allow-Origin` para ela |
| T-06 | Vercel com a variável | Abrir o app publicado | Faixa no modo servidor |

- **Camada de teste:** configuração de deploy (script) e verificação manual do serviço publicado.
- **Framework:** `node:test` (já usado por `npm run test:scripts`).
- **Automação prevista:** T-01 automatizado; T-02 a T-06 verificados na aplicação do deploy por quem tem as contas.

## Impactos na arquitetura

- **Camadas tocadas:** `render.yaml` (novo), `README.md`, `apps/api/.env.example`, `scripts/render-yaml.test.mjs` (novo).
- **Persistência:** não muda o formato do `localStorage` nem o schema Prisma. O banco publicado nasce vazio e recebe o seed.
- **Backend pausado:** não está pausado; a API já é compilada e testada. Esta SPEC só a publica.
- **Stack/tecnologias:** não muda (NestJS, Prisma, PostgreSQL, Docker).
- **Deploy/Docker/Vercel:** novo deploy da API na Render e nova variável de build na Vercel. O `docker-compose.yml` local não muda.

## Dependências e riscos

- **Dependências:** conta na Render e acesso de edição de variáveis na Vercel (com a dupla); decisões humanas de 2026-11-24.
- **Riscos:**
  - **API aberta sem autenticação**: qualquer pessoa lê e escreve. Mitigação: só dados sintéticos e aviso explícito no README.
  - **PostgreSQL free expira em 30 dias** (1 GB, um por workspace): o app perde os dados se não houver upgrade. Mitigação: documentar e recriar o banco + seed quando necessário.
  - **Web service free dorme após 15 min** e acorda em ~1 min: a primeira requisição pode falhar. Mitigação: o app já mostra erro com "Tentar de novo".
  - **CORS só cobre a origem de produção**: previews da Vercel não funcionam no modo servidor. Mitigação: documentado; produção é o alvo.
  - **URL do serviço só existe após o deploy**: o passo de copiar para a Vercel está nos CAs.
- **Mitigações:** teste estrutural do Blueprint, verificação manual dos CAs e documentação das limitações.

## Plano de implementação

1. Criar esta SPEC com as decisões humanas de 2026-11-24.
2. Criar `render.yaml` (banco + web service + start com migração e seed).
3. Atualizar `README.md` e `apps/api/.env.example`.
4. Criar o teste `scripts/render-yaml.test.mjs`.
5. Rodar `npm run test:scripts` e `npm test`; registrar o resultado.
6. Verificar o que é verificável sem as contas; marcar o deploy como pendente de quem tem acesso.
7. Atualizar status e histórico; commit com `Agent:` e `Spec:`.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-24 | Criação da SPEC com decisões humanas (Render, sem auth, dados sintéticos) | aprovada |
