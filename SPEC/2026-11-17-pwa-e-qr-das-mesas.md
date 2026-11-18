# App instalável e offline (PWA) e QR code das mesas

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** issue #24 (backlog 2.7)  
**Derroga:** n/a (acrescenta manifesto, service worker, link por mesa e cartões com QR; nada existente muda)

---

## Contexto e problema

A issue #24 pede que o garçom tenha acesso rápido no salão, mesmo com rede instável, e que o QR code da mesa abra a comanda certa. Critérios da issue:
- o app abre e lista as mesas sem conexão;
- o QR code da mesa abre a comanda correspondente.

Fatos verificados em 2026-11-17: o app não tem manifesto nem service worker, não lê nenhum parâmetro de endereço para abrir uma mesa e não há como gerar QR codes. No modo navegador (o da URL pública) os dados já ficam no aparelho, então basta o app em si abrir sem rede.

### Perguntas em aberto

- **P-1:** a câmera lê o QR com o aplicativo de câmera do próprio celular (que abre o link) ou com um leitor dentro do app? Provisório, decidido pela dupla: pelo aplicativo de câmera do celular, que já lê QR codes em Android e iOS; o QR guarda o endereço do app com `?mesa=N`.

## Objetivo

Deixar o app instalável e capaz de abrir sem rede, e imprimir, para cada mesa, um cartão com QR code que abre a comanda daquela mesa.

## Escopo

- **Manifesto** (`apps/web/app/manifest.ts`) e ícone (`apps/web/app/icon.svg`) para instalar o app na tela inicial.
- **Service worker** (`apps/web/public/sw.js`), registrado só em produção e só no navegador, que guarda as páginas e os arquivos estáticos visitados e os serve quando não há rede.
- **Link por mesa**: abrir o app com `?mesa=N` seleciona a mesa N na Visão geral (se existir) e tira o parâmetro do endereço.
- **Gerador de QR code** próprio (`apps/web/lib/qrcode.ts`, ISO/IEC 18004, nível M, modo byte, versões 1 a 10), sem dependência nova.
- **Cartões com QR** (`apps/web/app/qr-mesas.tsx`): na tela Salão, o botão **QR das mesas** abre os cartões de todas as mesas, prontos para imprimir.

## Fora do escopo

- Leitor de QR dentro do app (P-1).
- Fila de envio offline para a API: no modo servidor, as ações continuam precisando de rede.
- Notificações push.

## Requisitos funcionais

- **RF-01:** O manifesto declara nome, nome curto, cores, `start_url` `/` e `display` `standalone`.
- **RF-02:** Em produção, o app registra `/sw.js`. Sem rede, uma navegação recebe a última versão guardada da página; arquivos estáticos (`/_next/static/`) vêm do cache.
- **RF-03:** Ao abrir `/?mesa=N` com uma mesa de número N, a Visão geral seleciona essa mesa; o endereço volta a `/`. Número que não existe é ignorado e avisado: "A mesa N não existe neste salão."
- **RF-04:** `encodeQr(texto)` devolve a matriz do QR code; texto acima de 213 bytes é recusado.
- **RF-05:** **QR das mesas** mostra um cartão por mesa, em ordem de número, com o QR do endereço `ORIGEM/?mesa=N`, o nome da mesa e a instrução "Aponte a câmera do celular"; **Imprimir** usa a impressão do navegador.

## Requisitos não funcionais

- **RNF-01:** Nenhuma dependência nova.
- **RNF-02:** O QR segue a norma: a matriz é igual, módulo por módulo, à de uma biblioteca de referência (segno 1.6.6) com a mesma máscara.
- **RNF-03:** O service worker não guarda chamadas à API (`/api/`) nem requisições que não são `GET`.

## Regras de negócio

- **RN-01 (P-1):** o QR de uma mesa guarda o endereço do app com `?mesa=N`, onde N é o número da mesa.

## Critérios de aceitação verificáveis

- **CA-01:** O manifesto tem os campos de RF-01.
- **CA-02:** O gerador produz a mesma matriz da referência para textos que caem nas versões 1, 2, 4 e 8 (com informação de versão), nas 8 máscaras.
- **CA-03:** Abrindo `/?mesa=3` no modo navegador, a Visão geral mostra "Mesa 03"; com `?mesa=99`, aparece "A mesa 99 não existe neste salão."
- **CA-04:** **QR das mesas** mostra um cartão por mesa com o QR (`svg`) e o endereço da mesa.
- **CA-05:** A lógica do service worker serve do cache sem rede para navegação e estáticos, e não guarda `/api/` nem `POST`.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Gerador | comparar com as matrizes de referência; peças do algoritmo | CA-02, RF-04 |
| T-02 | Manifesto | ler o objeto | CA-01 |
| T-03 | Link por mesa | funções puras e tela principal com `?mesa=` | CA-03 |
| T-04 | Componente | cartões | CA-04 |
| T-05 | Estratégia de cache | funções puras do service worker | CA-05, RNF-03 |

- **Camada de teste:** lógica pura e componentes (Vitest e Testing Library).

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/qrcode.ts`, `apps/web/lib/qrcode.fixtures.json`, `apps/web/app/manifest.ts`, `apps/web/app/icon.svg`, `apps/web/public/sw.js`, `apps/web/app/registrar-offline.tsx`, `apps/web/app/qr-mesas.tsx` (novos); `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/salao-panel.tsx`, `globals.css`.
- **Persistência:** não muda (o cache do service worker é do navegador e guarda só arquivos do app).
- **Backend:** não muda.
- **Deploy/Vercel:** o build passa a publicar `/manifest.webmanifest`, `/icon.svg` e `/sw.js`.

## Dependências e riscos

- **Riscos:** o service worker servir uma versão antiga depois de um deploy.
- **Mitigações:** navegação usa rede primeiro (cache só sem rede); o nome do cache tem versão e caches antigos são apagados na ativação.

## Plano de implementação

1. Commit desta SPEC.
2. Gerador de QR com testes.
3. Estratégia offline, service worker, manifesto e registro, com testes.
4. Link por mesa na tela principal, com teste.
5. Cartões com QR na tela Salão, com testes.
6. README e status.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia, com P-1 decidida pela dupla | aprovada |
| 2026-11-17 | Implementação: a lógica de cache ficou no próprio `public/sw.js` (testado num ambiente simulado), sem `lib/offline.ts`. CA-01 a CA-05 verificados por 23 testes do gerador (matriz igual à do segno 1.6.6 nas versões 1, 2, 4 e 8 e nas 8 máscaras), 9 do service worker, manifesto e registro, 3 do link por mesa, 3 dos cartões e 3 novos na tela principal; suíte do frontend com 219 testes | implementada |
