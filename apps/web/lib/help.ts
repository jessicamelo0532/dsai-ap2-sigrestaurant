// Catálogo local da ajuda guiada (SPEC/2026-11-25-assistente-de-ajuda.md).
// Sem LLM e sem rede: o texto é derivado das SPECs e do README do repositório.
import type { Section } from './sections';

export interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  keywords: string[];
  source: string;
  section: Section;
}

export const CRITICAL_TOPIC_IDS = ['abrir-mesa', 'lancar-item', 'fechar-conta', 'receber'] as const;

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'visao-geral',
    title: 'Visão geral e modos do app',
    summary: 'Entenda a navegação e a diferença entre o modo navegador e o modo servidor.',
    steps: [
      'Use a navegação lateral no computador ou a barra no rodapé do celular para trocar de seção.',
      'No modo navegador, os dados ficam só neste aparelho; no modo servidor, a equipe vê as mesmas mesas e comandas.',
      'A faixa no topo mostra se o servidor está conectado ou indisponível.',
    ],
    keywords: ['navegação', 'menu', 'modo', 'navegador', 'servidor', 'local', 'conectar', 'offline'],
    source: 'README.md · SPEC/2026-10-01-frontend-local.md',
    section: 'operacao',
  },
  {
    id: 'abrir-mesa',
    title: 'Abrir mesa e começar a comanda',
    summary: 'Escolha uma mesa livre e lance o primeiro item para abrir a comanda.',
    steps: [
      'Abra Visão geral e clique no cartão de uma mesa livre.',
      'No painel da comanda, procure o item em “Buscar no cardápio” ou use os atalhos.',
      'Ajuste a quantidade e clique no item; se ele tiver opções, escolha a variação e os adicionais.',
      'Ao lançar o primeiro item, a comanda da mesa fica aberta e aparece como “Em atendimento”.',
    ],
    keywords: ['abrir mesa', 'mesa livre', 'começar comanda', 'nova comanda', 'primeiro item', 'atendimento'],
    source: 'SPEC/2026-11-17-atendimento-na-comanda.md',
    section: 'operacao',
  },
  {
    id: 'lancar-item',
    title: 'Adicionar, alterar e remover itens',
    summary: 'Lance mais itens, mude a quantidade ou remova uma linha da comanda.',
    steps: [
      'Selecione a mesa na Visão geral.',
      'Busque o item, ajuste a quantidade e clique nele para adicionar.',
      'Use os botões − e + na linha do item para mudar a quantidade.',
      'Use o X da linha para remover o item da comanda.',
    ],
    keywords: ['adicionar item', 'lançar item', 'quantidade', 'remover item', 'alterar', 'cardápio', 'pedido'],
    source: 'SPEC/2026-11-17-quantidade-e-cancelamento-na-comanda.md · SPEC/2026-11-17-tela-de-variacoes-e-adicionais.md',
    section: 'operacao',
  },
  {
    id: 'cozinha',
    title: 'Enviar o pedido para a cozinha',
    summary: 'Mande os itens da comanda para a fila da cozinha e acompanhe o preparo.',
    steps: [
      'Abra a comanda da mesa na Visão geral.',
      'Se precisar, escreva uma observação para a cozinha.',
      'Clique em “Enviar para a cozinha”.',
      'Acompanhe o pedido na seção Cozinha.',
    ],
    keywords: ['cozinha', 'enviar pedido', 'preparo', 'observação', 'kds', 'fila'],
    source: 'SPEC/2026-11-16-cozinha-kds.md · SPEC/2026-11-17-tela-da-cozinha.md',
    section: 'operacao',
  },
  {
    id: 'fechar-conta',
    title: 'Fechar conta e pagar',
    summary: 'Confira o total, escolha a forma de pagamento e encerre a comanda.',
    steps: [
      'Selecione a mesa na Visão geral e confira os itens e o total da comanda.',
      'Clique em “Fechar conta”.',
      'Escolha a forma de pagamento: dinheiro, crédito, débito ou Pix.',
      'Confirme; a mesa é liberada e o comprovante pode ser impresso.',
    ],
    keywords: ['fechar conta', 'pagar', 'pagamento', 'total', 'dinheiro', 'crédito', 'débito', 'pix', 'encerrar'],
    source: 'SPEC/2026-11-16-caixa-por-turno.md · SPEC/2026-11-17-tela-do-caixa.md',
    section: 'operacao',
  },
  {
    id: 'receber',
    title: 'Receber e conferir o caixa',
    summary: 'Veja como o valor recebido entra no turno e como conferir o caixa.',
    steps: [
      'Feche a conta da mesa escolhendo a forma de pagamento.',
      'Abra a seção Caixa para ver o turno em andamento.',
      'Se ainda não houver turno, informe quem está no caixa e o troco inicial e clique em “Abrir turno”.',
      'Ao terminar, clique em “Fechar turno” e confira o esperado por forma de pagamento.',
    ],
    keywords: ['caixa', 'receber', 'turno', 'sangria', 'reforço', 'conferir', 'troco', 'fechamento'],
    source: 'SPEC/2026-11-17-tela-do-caixa.md',
    section: 'caixa',
  },
  {
    id: 'reservas',
    title: 'Consultar reservas e sentar o cliente',
    summary: 'Veja a agenda do dia, registre uma reserva e encaminhe o cliente para a mesa.',
    steps: [
      'Abra a seção Reservas e escolha o dia.',
      'Use os filtros para ver agendadas, clientes que chegaram e canceladas.',
      'Clique em “Nova reserva” para registrar nome, telefone, pessoas, horário e mesa.',
      'Quando o cliente chegar, use “Assentar” para encaminhá-lo à mesa.',
    ],
    keywords: ['reserva', 'agenda', 'cliente', 'assentar', 'mesa', 'horário', 'chegada'],
    source: 'SPEC/2026-11-17-tela-de-reservas.md',
    section: 'reservas',
  },
  {
    id: 'problemas',
    title: 'Problemas comuns',
    summary: 'O que fazer quando algo não aparece ou o servidor está fora.',
    steps: [
      'Se os dados não aparecem em outro aparelho, confira se o app está no modo servidor.',
      'Se o servidor estiver indisponível, use “Tentar de novo” ou “Usar o modo local” na faixa do topo.',
      'Se um item não aparece no cardápio, ele pode estar pausado; confira em Cardápio.',
      'Se a mesa já estiver em atendimento, abra a comanda existente em vez de lançar outra.',
    ],
    keywords: ['problema', 'não aparece', 'servidor', 'offline', 'indisponível', 'item pausado', 'mesa ocupada', 'erro'],
    source: 'README.md · SPEC/2026-11-16-cardapio-por-horario.md',
    section: 'operacao',
  },
];

const CONTEXT_TOPICS: Partial<Record<Section, string[]>> = {
  operacao: ['abrir-mesa', 'lancar-item', 'fechar-conta'],
  salao: ['abrir-mesa', 'reservas'],
  cozinha: ['cozinha'],
  caixa: ['receber', 'fechar-conta'],
  reservas: ['reservas'],
  cardapio: ['problemas'],
};

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function score(topic: HelpTopic, terms: string[], query: string): number {
  const title = normalize(topic.title);
  const keywords = normalize(topic.keywords.join(' '));
  const summary = normalize(topic.summary);
  const steps = normalize(topic.steps.join(' '));
  let total = 0;
  if (title.includes(query)) total += 10;
  for (const term of terms) {
    if (title.includes(term)) total += 4;
    if (keywords.includes(term)) total += 3;
    if (summary.includes(term)) total += 1;
    if (steps.includes(term)) total += 1;
  }
  return total;
}

export function searchTopics(query: string, topics: HelpTopic[] = HELP_TOPICS): HelpTopic[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  const terms = normalized.split(' ').filter(Boolean);
  return topics
    .map((topic) => ({ topic, points: score(topic, terms, normalized) }))
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.points - a.points || a.topic.title.localeCompare(b.topic.title, 'pt-BR'))
    .slice(0, 5)
    .map((entry) => entry.topic);
}

export function topicById(id: string, topics: HelpTopic[] = HELP_TOPICS): HelpTopic | undefined {
  return topics.find((topic) => topic.id === id);
}

export function criticalTopics(topics: HelpTopic[] = HELP_TOPICS): HelpTopic[] {
  return CRITICAL_TOPIC_IDS.map((id) => topicById(id, topics)).filter((topic): topic is HelpTopic => Boolean(topic));
}

export function contextualTopics(section: Section, topics: HelpTopic[] = HELP_TOPICS): HelpTopic[] {
  const ids = CONTEXT_TOPICS[section] ?? [];
  const specific = ids.map((id) => topicById(id, topics)).filter((topic): topic is HelpTopic => Boolean(topic));
  const seen = new Set(specific.map((topic) => topic.id));
  return [...specific, ...criticalTopics(topics).filter((topic) => !seen.has(topic.id))];
}
