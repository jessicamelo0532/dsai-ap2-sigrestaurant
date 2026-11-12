# Fluxo de pull request

## Antes de abrir

- [ ] A funcionalidade tem SPEC datada em `SPEC/` commitada **antes** deste PR.
- [ ] O commit cita a SPEC no trailer `Spec:`.
- [ ] O commit cita o agente no trailer `Agent:`.
- [ ] `npm test` e `npm run build` passam localmente.
- [ ] Se houve refatoração, a issue correspondente justifica o motivo.

## Revisão

Toda PR para a `main` precisa de **aprovação de um dos integrantes da dupla**
antes do merge (métrica de revisão da Aula 09). Nenhum approves automático.

## After merge

A `main` é a base do deploy público. O CI precisa estar verde no commit
resultante — é esse commit que a URL pública precisa servir.
