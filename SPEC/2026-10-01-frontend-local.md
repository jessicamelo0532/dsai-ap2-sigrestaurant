# Entrega frontend local-first

Data: 2026-10-01
Status: alteração de escopo, escrita antes desta implementação.

## Objetivo

Deixar a aplicação básica utilizável como frontend Next.js hospedado na Vercel, sem exigir que API NestJS ou PostgreSQL estejam implantados.

## Comportamento

- Mesas, cardápio, comandas, pagamentos e despesas são mantidos no `localStorage` do navegador.
- Na primeira visita, a aplicação apresenta dados de demonstração editáveis.
- As telas existentes continuam permitindo adicionar/remover mesas, selecionar quantidade e item, manter o cardápio, fechar uma conta e consultar o resumo financeiro por datas.
- O build e a publicação da Vercel executam somente `apps/web`.
- Docker Compose executa somente o frontend. API, banco e arquivos Prisma ficam no repositório sem participar do fluxo ativo.

## Limites de aceite

- As operações principais funcionam sem requisições para a API NestJS.
- Os dados sobrevivem ao recarregamento da página no mesmo navegador e perfil.
- Os dados não são compartilhados entre dispositivos, navegadores ou perfis, pois ainda não há backend nem banco remoto.
- A URL pública é gerada quando o projeto Next.js for publicado na Vercel.
