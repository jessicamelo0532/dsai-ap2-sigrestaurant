# Impressão de bobina e cupom (issue 2.6)

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** opencode/deepseek-v4.1-flash-free  
**SPEC derivada de:** issue #23 (backlog 2.6)  
**Derroga:** nada. Só frontend, sem rota nova.

---

## Contexto e problema

Fato comprovado: não existe bobina de comanda nem cupom de conta. A issue #23 pede os dois layouts com identificação do restaurante e impressão por `window.print()`, sem dependência externa. Hoje a equipe só vê a comanda na tela.

### Perguntas em aberto (para o cliente)

- **P-1:** qual é o nome e o endereço que devem sair no papel? Provisório: "Mesa Clara" como nome e nenhum endereço (não há cadastro de restaurante no sistema).
- **P-2:** a bobina sai só da comanda aberta ou também das comandas fechadas? Provisório: só da comanda selecionada (aberta) e do cupom gerado no fechamento.
- **P-3:** o cupom precisa de via do cliente e via da casa? Provisório: uma via; a impressão pode ser repetida pelo mesmo botão.

## Objetivo

Imprimir a comanda em bobina (itens, quantidades e total) e o cupom da conta fechada (forma de pagamento, total e data), com layout próprio de papel, usando só `window.print()` e CSS de impressão.

## Escopo

- `apps/web/lib/impressao.ts`: monta os dados de bobina e cupom (funções puras).
- `apps/web/app/print-sheet.tsx`: prévia na tela e conteúdo impresso.
- Botão **Imprimir bobina** na comanda selecionada (Visão geral).
- Modal **Conta fechada** com o cupom e o botão **Imprimir cupom** logo após o fechamento.
- CSS `@media print` que imprime só a folha da bobina/cupom.

## Fora do escopo

- Impressora térmica específica, ESC/POS, PDF, envio por e-mail ou WhatsApp.
- Cadastro de dados da casa (P-1).
- Reimpressão a partir do histórico de contas fechadas (não há tela de histórico).

## Requisitos funcionais

- **RF-01:** a bobina lista identificação da casa, mesa, abertura, cada item com quantidade e preço, e o total.
- **RF-02:** o cupom lista identificação da casa, mesa, itens, total, forma de pagamento por extenso e data/hora do pagamento.
- **RF-03:** os dois documentos aparecem em prévia na tela e podem ser impressos com `window.print()`.
- **RF-04:** ao imprimir, só a folha aparece no papel (o resto da tela fica oculto).
- **RF-05:** o cupom aparece automaticamente depois de fechar a conta, com a forma de pagamento escolhida.
- **RF-06:** o botão de bobina existe para a comanda selecionada, aberta ou não (P-2: só a selecionada).

## Requisitos não funcionais

- **RNF-01:** nenhuma dependência nova.
- **RNF-02:** layout de 80 mm (bobina) com fonte monoespaçada na impressão.
- **RNF-03:** a prévia funciona em 375 px (sem rolagem lateral) e usa as classes existentes.
- **RNF-04:** a lógica pura e o componente têm teste (jsdom + `window.print` espionado).

## Regras de negócio

- **RN-01:** o total é o mesmo que a tela mostra (`orderTotal`), para papel e tela nunca divergirem.
- **RN-02:** a forma de pagamento sai por extenso com o mesmo mapa já usado no Financeiro (Dinheiro, Crédito, Débito, Pix); valor desconhecido sai como veio.
- **RN-03:** item sem preço unitário válido sai com o preço que veio do servidor, sem recálculo.

## Critérios de aceitação verificáveis

- **CA-01:** a bobina lista itens, quantidades e total (critério da issue).
- **CA-02:** o cupom lista forma de pagamento, total e data (critério da issue).
- **CA-03:** clicar em imprimir chama `window.print()` uma vez e a folha é a única parte visível na impressão.
- **CA-04:** `npm test`, `npm run build` e `npm run e2e:celular` verdes; a prévia entra no E2E de celular.

## Cenários de teste

- Lógica: bobina com itens, comanda sem itens, total com desconto, cupom com cada forma de pagamento, data/hora, forma desconhecida.
- Componente: prévia da bobina, prévia do cupom, botão imprimir chama `window.print`, botão fechar.
- Tela: fechar conta mostra o cupom com a forma escolhida.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/impressao.ts` (novo), `apps/web/app/print-sheet.tsx` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`.
- **API:** nenhuma mudança.
- **Persistência:** nenhuma.

## Dependências e riscos

- **Riscos:** `window.print()` bloqueia a aba em alguns navegadores. Mitigação: só é chamado no clique do botão, depois de a prévia estar montada.
- **Risco:** o CSS de impressão afetar outras telas. Mitigação: regras presas a `.print-sheet` e `body:has(.print-sheet)`.

## Plano de implementação

1. `lib/impressao.ts` + testes.
2. `print-sheet.tsx` + testes.
3. Botões na tela principal, modal do cupom e CSS de impressão.
4. E2E, README e verificação.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação a partir da issue #23, com P-1 a P-3 | rascunho |
| 2026-11-17 | Implementada. Verificação: `npm test` 155 testes em 13 arquivos (12 de `lib/impressao.ts` + 7 de `print-sheet.test.tsx` novos), todos passando; `npm run build` verde; E2E com a prévia da bobina (tela "Bobina da comanda"). `window.print()` chamado no clique (espionado). Cupom aparece após o fechamento com forma de pagamento, total e data. P-1 a P-3 seguem como provisórias | implementada |
