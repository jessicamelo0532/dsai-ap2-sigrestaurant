# Tela do programa de fidelidade

**Data:** 2026-11-17  
**Status:** implementada  
**Agent:** claude-code/claude-opus-5.5  
**SPEC derivada de:** `SPEC/2026-11-16-programa-de-fidelidade.md` (API), issue #36  
**Derroga:** n/a (só consome a API existente; nenhuma regra muda)

---

## Contexto e problema

Fato comprovado em 2026-11-17: a API do programa de fidelidade existe e está testada (`/api/loyalty/settings`, `/api/customers/:id/loyalty`, SPEC de 2026-11-16, status `implementada`), mas não há tela. O dono não consegue ver nem mudar a regra de pontos, nem consultar o saldo e o extrato de um cliente.

### Perguntas em aberto

- nenhuma nova. P-1 a P-3 da SPEC da API continuam valendo; a regra padrão provisória (1 ponto por real, ponto a R$ 0,05, resgate mínimo de 100 pontos) é a que a API devolve enquanto não for mudada.

## Objetivo

Dar ao dono uma seção **Fidelidade** para conferir e ajustar a regra do programa e consultar o saldo e o extrato de pontos de cada cliente.

## Escopo

- Lógica pura em `apps/web/lib/fidelidade.ts`: validação da regra, simulação da regra em exemplos, sinal e rótulo das entradas do extrato.
- Componente `apps/web/app/fidelidade-panel.tsx` com a regra e a consulta por cliente.
- Item **Fidelidade** no menu lateral e verificação da tela no E2E de celular.

## Fora do escopo

- Resgatar ou desfazer o resgate de pontos numa comanda (`POST/DELETE /orders/:id/loyalty`): muda o painel da comanda e terá SPEC própria.
- Fidelidade no modo navegador (`localStorage`).
- Qualquer mudança na API.

## Requisitos funcionais

- **RF-01:** No modo navegador, a seção avisa que precisa do servidor e oferece **Conectar ao servidor** quando o build tem `NEXT_PUBLIC_API_URL`.
- **RF-02:** A seção mostra a regra atual (`GET /loyalty/settings`) em linguagem simples: pontos por real, valor de cada ponto e resgate mínimo, com exemplos calculados (quantos pontos uma conta de R$ 100 gera e quanto vale o resgate mínimo).
- **RF-03:** **Alterar regra** abre um formulário com os três campos e mostra a prévia dos exemplos enquanto o dono digita; salvar envia `PUT /loyalty/settings` só com os campos alterados.
- **RF-04:** **Consultar cliente** busca clientes pelo nome ou telefone (`GET /customers?search=`) e, ao escolher um, mostra o saldo, o valor do saldo em reais e o extrato (`GET /customers/:id/loyalty`): data, tipo (Ganho, Resgate, Devolução), pontos com sinal e a comanda ligada.
- **RF-05:** Erros da API aparecem na tela com a mensagem que a API devolve.

## Requisitos não funcionais

- **RNF-01:** Textos em português; valores em `R$ 1.234,56`; pontos com separador de milhar (`1.250 pontos`).
- **RNF-02:** A tela passa no E2E de celular em 375 px.
- **RNF-03:** Nenhuma dependência nova.

## Regras de negócio

As regras são as da SPEC da API, que continua sendo a fonte final. A tela repete apenas as que evitam um envio que a API recusaria:

- **RN-01 (RN-01 da API):** `pointsPerReal` inteiro de 0 a 100 (0 desliga o ganho), `centsPerPoint` inteiro de 1 a 1000, `minRedeemPoints` inteiro de 1 a 100000. Mensagem: "Regra de fidelidade inválida: <campo>." com o nome do campo em português.
- **RN-02 (RN-02 da API, usada só na prévia):** pontos ganhos = parte inteira de (centavos × `pointsPerReal` ÷ 100). Valor de N pontos = N × `centsPerPoint` centavos.
- **RN-03:** no extrato, Ganho e Devolução somam pontos e Resgate subtrai; o sinal mostrado é o do valor que a API devolve.

## Critérios de aceitação verificáveis

- **CA-01:** Dado o modo navegador, quando abro **Fidelidade**, então vejo que precisa do servidor e nenhuma requisição é feita.
- **CA-02:** Dada a regra padrão, então vejo "1 ponto por real", "cada ponto vale R$ 0,05", "resgate mínimo de 100 pontos" e que uma conta de R$ 100,00 gera 100 pontos e o resgate mínimo vale R$ 5,00.
- **CA-03:** Quando mudo o valor do ponto para 10 centavos, então a prévia passa a mostrar que o resgate mínimo vale R$ 10,00 e o `PUT` leva só `{ centsPerPoint: 10 }`.
- **CA-04:** Quando informo 101 pontos por real, então a tela recusa com "Regra de fidelidade inválida: pontos por real." sem enviar.
- **CA-05:** Quando busco e escolho um cliente, então vejo o saldo, o valor em reais e o extrato com Ganho (+), Resgate (−) e Devolução (+).
- **CA-06:** Dado um erro da API, então a mensagem dela aparece.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | Funções puras | validação, exemplos, extrato | RN-01 a RN-03 |
| T-02 | Modo navegador | renderizar | CA-01 |
| T-03 | API com regra padrão | ver regra | CA-02 |
| T-04 | API | alterar regra; valor inválido | CA-03, CA-04 |
| T-05 | API com clientes | buscar, escolher, ver extrato | CA-05 |
| T-06 | API com erro | consultar | CA-06 |
| T-07 | Celular 375 px | navegar até Fidelidade | RNF-02 |

- **Camada de teste:** lógica pura (`lib/fidelidade.test.ts`) e componente com Testing Library (`app/fidelidade-panel.test.tsx`), com `fetch` simulado.
- **Framework:** Vitest.
- **Automação prevista:** T-01 a T-06 automáticos; T-07 no job "Uso no celular (375 px)" do CI.

## Impactos na arquitetura

- **Camadas tocadas:** `apps/web/lib/fidelidade.ts` (novo), `apps/web/app/fidelidade-panel.tsx` (novo), `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/e2e/celular.mjs`.
- **Persistência:** não muda.
- **Backend:** não muda.
- **Stack/tecnologias:** não muda.
- **Deploy/Docker/Vercel:** não afeta o build; na Vercel a seção mostra o aviso de RF-01.

## Dependências e riscos

- **Dependências:** API de fidelidade e API de clientes (busca).
- **Riscos:** a prévia divergir do que a API credita.
- **Mitigações:** a prévia usa a mesma fórmula de RN-02 da API e é só informativa; quem credita é a API.

## Plano de implementação

1. Commit desta SPEC.
2. `lib/fidelidade.ts` com testes.
3. `fidelidade-panel.tsx` e testes de componente, em commits separados.
4. Item no menu, estilos e E2E de celular.
5. Rodar testes e checagem de tipos; verificar CA-01 a CA-06.
6. README e status desta SPEC.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| 2026-11-17 | Criação, aprovada pela Jéssica na sessão do dia | aprovada |
| 2026-11-17 | CA-01 a CA-06 verificados por 18 testes de `lib/fidelidade.test.ts` e 9 de `app/fidelidade-panel.test.tsx`; `tsc --noEmit` sem erros e os 11 testes de `page.test.tsx` passando. O build completo e o E2E de celular (T-07) ficam com o CI | implementada |
