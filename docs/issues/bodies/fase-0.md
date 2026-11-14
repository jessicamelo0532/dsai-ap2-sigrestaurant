## @issue Primeiras impressões — o projeto roda? o que parece feito? há sinal de uso?
labels: fase-0, entrega
depende: —
arquivo: docs/issues/primeiras-impressoes.md

## @issue 0.1 | Ativar o pipeline de CI e publicá-lo na main
labels: fase-0, infra
depende: —
spec: não exige SPEC nova — cobertura já prevista na SPEC/2026-11-12-conformidade-ap2.md

**Contexto.** A métrica de CI da Aula 09 exige pipeline **verde no último commit da `main`**. O workflow `.github/workflows/ci.yml` já existe no repositório, mas a `main` do fork ainda aponta para o commit `d0a6caf` (último commit da AP1), sem execução de pipeline.

**Escopo.**
- Publicar a branch de trabalho na `main` do fork.
- Confirmar que a execução do pipeline no último commit da `main` termina com sucesso.
- Registrar a URL da execução no README.

**Critérios de aceite.**
- [ ] O último commit da `main` tem uma execução de CI concluída com sucesso.
- [ ] A execução cobre build, testes, cobertura, duplicação, segredos e `npm audit`.
- [ ] O README contém a URL da execução.

**Fora do escopo.** Criar novos jobs de CI ou alterar o pipeline já commitado.

## @issue 0.2 | Consolidar a auditoria de conformidade no repositório
labels: fase-0, docs
depende: 0.1
spec: não exige SPEC nova — cobertura prevista na SPEC/2026-11-12-conformidade-ap2.md

**Contexto.** A auditoria vive em `docs/AUDITORIA-AP2.md` e a medição das 14 métricas em `scripts/metricas.mjs`. Se as duas fontes divergirem, a auditoria deixa de ser evidência.

**Escopo.**
- Rodar `npm run metricas` e anexar a saída ao relatório.
- Atualizar `docs/AUDITORIA-AP2.md` a cada mudança relevante (novas funcionalidades, novos testes, mudança de volume).
- Manter a lista de pendências humanas (P-1 a P-7) atualizada.

**Critérios de aceite.**
- [ ] A saída de `npm run metricas` confere com os números do relatório.
- [ ] Toda pendência humana aberta aparece no relatório com o motivo do bloqueio.
- [ ] O relatório distingue fato comprovado de hipótese.

## @issue 0.3 | Registrar custo e tokens de cada sessão
labels: fase-0, docs, precisa-humano
depende: informação do humano
spec: não exige SPEC nova — métrica de sessões

**Contexto.** A métrica de sessões da Aula 09 exige o custo ou a contagem de tokens registrados por sessão. O ambiente do agente **não expõe** esse dado, e `AGENTS.md` proíbe inventar números.

**Escopo.**
- Adicionar em `prompts/sessoes/AAAA-MM-DD-<ferramenta>.md` a seção de custo com o valor real.
- Manter a seção preenchida pelo responsável humano da sessão.

**Critérios de aceite.**
- [ ] Toda sessão em `prompts/sessoes/` tem a seção de custo com valor real (ou a pendência explicitada enquanto não houver).

**Bloqueio.** Precisa do valor real fornecido pelo humano.

## @issue 0.4 | Alternar autoria entre os dois integrantes da dupla
labels: fase-0, git, precisa-humano
depende: identidade do segundo integrante
spec: não exige SPEC nova — métrica de autoria

**Contexto.** A métrica de autoria exige 30% de commits de cada integrante da dupla. Hoje há commits de `Codex`, `afonso` e `yurisawaki` — a proporção entre os dois integrantes da AP2 não é known e o nome/e-mail do segundo integrante não foi informado.

**Escopo.**
- Informar nome e e-mail do segundo integrante.
- Alternar a autoria dos commits de código entre os dois.
- Manter os trailers `Agent:` e `Spec:` no corpo de todo commit.

**Critérios de aceite.**
- [ ] Cada integrante tem pelo menos 30% dos commits da AP2.
- [ ] Nenhum commit da AP2 fica sem trailer `Agent:` nem `Spec:`.

**Bloqueio.** Falta o nome/e-mail do segundo integrante.

## @issue 0.5 | Publicar URL do fork servindo o último commit da main
labels: fase-0, deploy, precisa-humano
depende: credencial de deploy
spec: não exige SPEC nova — impacto de deploy a declarar

**Contexto.** A entrega da Aula 09 exige uma URL pública que sirva o **último commit da `main` do fork**. A URL hoje publicada (`https://dsai-ap1-sigrestaurant.vercel.app/`) serve a deployment da AP1, não o fork.

**Escopo.**
- Importar o fork na Vercel com `apps/web` como Root Directory.
- Configurar o deploy da `main` do fork.
- Publicar a URL no README e nas issues.

**Critérios de aceite.**
- [ ] A URL responde HTTP 200.
- [ ] O bundle servido corresponde ao último commit da `main` do fork.

**Bloqueio.** Precisa da credencial da conta Vercel do fork.
