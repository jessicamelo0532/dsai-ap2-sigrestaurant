export type Section = 'operacao' | 'salao' | 'cozinha' | 'delivery' | 'reservas' | 'caixa' | 'cardapio' | 'financeiro' | 'receber' | 'garcons' | 'clientes' | 'fidelidade' | 'metas';

export const sectionLabels: Record<Section, string> = {
  operacao: 'Visão geral',
  salao: 'Salão',
  cozinha: 'Cozinha',
  delivery: 'Delivery',
  reservas: 'Reservas',
  caixa: 'Caixa',
  cardapio: 'Cardápio',
  financeiro: 'Financeiro',
  receber: 'A receber',
  garcons: 'Garçons',
  clientes: 'Clientes',
  fidelidade: 'Fidelidade',
  metas: 'Metas',
};

export const sectionIds = Object.keys(sectionLabels) as Section[];
