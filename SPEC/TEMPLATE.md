# <Título curto da funcionalidade>

**Data:** AAAA-MM-DD  
**Status:** rascunho | aprovada | implementada | desatualizada | derrogada  
**Agent:** <identificação do agente/modelo>  
**SPEC derivada de:** <arquivo ou "nova">  
**Derroga:** <SPEC histórica afetada, se houver, ou "n/a">

> Preencher todos os campos antes de sair de `rascunho`.  
> Dúvidas de regra de negócio ficam em "Perguntas em aberto" até decisão humana — não inventar regras.

---

## Contexto e problema

<O que existe hoje: fato comprovado, o que o usuário pediu, qual a dor.  
Se altera comportamento já especificado, dizer qual SPEC é afetada e por quê.>

### Perguntas em aberto

- <lista ou "nenhuma">

## Objetivo

<Resultado desejado em uma ou duas frases.>

## Escopo

- <o que será implementado, ponto a ponto>

## Fora do escopo

- <o que explicitamente não será feito nesta SPEC (ex.: reativar backend, auth, troca de stack)>

## Requisitos funcionais

- **RF-01:** <comportamento observável>
- **RF-02:** ...

## Requisitos não funcionais

- **RNF-01:** <desempenho, acessibilidade, pt-BR nas mensagens, tamanho de bundle, etc.>
- **RNF-02:** ...

## Regras de negócio

- **RN-01:** <regra específica e testável; com limites numéricos exatos; mensagens de erro, se houver>
- **RN-02:** ...
- Se a regra vier de SPEC/README histórica, citar a origem. Se for nova, justificar.

## Critérios de aceitação verificáveis

- **CA-01:** Dado <condição>, quando <ação>, então <resultado observável>.
- **CA-02:** ...

> Todo CA deve ser verificável manualmente ou por teste automatizado.

## Cenários de teste

| # | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|
| T-01 | ... | ... | ... |
| T-02 | ... | ... | ... |

- **Camada de teste:** <store/regras de negócio | componente | API>
- **Framework:** <atualmente o repositório NÃO tem runner de testes; propor framework exige aprovação humana>
- **Automação prevista:** <quais cenários viram teste automatizado>

## Impactos na arquitetura

- **Camadas tocadas:** <ex.: `apps/web/lib/store.ts`, `apps/web/app/page.tsx`>
- **Persistência:** <muda formato/chave do `localStorage`? exige migração de dados?> — regra padrão: **não** alterar formato sem tratar dados existentes.
- **Backend pausado:** <não tocar / afeta paridade com `apps/api` — listar endpoints espelhados>
- **Stack/tecnologias:** <não muda | justificar com aprovação>
- **Deploy/Docker/Vercel:** <afeta build? sim/não>

## Dependências e riscos

- **Dependências:** <SPECs anteriores, decisões humanas pendentes, runners de teste>
- **Riscos:** <perda de dados, regressão financeira, divergência com backend, quebra de URLs publicadas>
- **Mitigações:** <teste automatizado, verificação manual do CA, rollback>

## Plano de implementação

1. <etapa pequena e atômica>
2. <etapa pequena e atômica>
3. Executar testes da camada afetada; registrar resultado.
4. Verificar item a item os Critérios de Aceitação; registrar resultado.
5. Atualizar status desta SPEC e `README.md` se necessário.
6. Commit pequeno com `Agent:` e `Spec:` no corpo.

## Histórico

| Data | Mudança | Status |
|---|---|---|
| AAAA-MM-DD | Criação do rascunho | rascunho |
