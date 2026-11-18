// Tela do programa de fidelidade (SPEC/2026-11-17-tela-de-fidelidade.md).
// Funções puras: recebem os dados como a API devolve e preparam a tela.

export type LoyaltyRule = { pointsPerReal: number; centsPerPoint: number; minRedeemPoints: number };
export type LoyaltyEntryType = 'EARN' | 'REDEEM' | 'REFUND';

export type LoyaltyEntry = { id: number; type: LoyaltyEntryType; points: number; orderId: number | null; createdAt: string };
export type CustomerLoyalty = { customerId: number; balance: number; balanceValue: string; entries: LoyaltyEntry[] };

export type RuleForm = Record<keyof LoyaltyRule, string>;

// RN-01: limites da API, com o nome do campo em português na mensagem.
export const RULE_FIELDS: { key: keyof LoyaltyRule; label: string; min: number; max: number }[] = [
  { key: 'pointsPerReal', label: 'pontos por real', min: 0, max: 100 },
  { key: 'centsPerPoint', label: 'valor do ponto em centavos', min: 1, max: 1000 },
  { key: 'minRedeemPoints', label: 'resgate mínimo', min: 1, max: 100_000 },
];

export const entryLabels: Record<LoyaltyEntryType, string> = { EARN: 'Ganho', REDEEM: 'Resgate', REFUND: 'Devolução' };

export function ruleForm(rule: LoyaltyRule): RuleForm {
  return { pointsPerReal: String(rule.pointsPerReal), centsPerPoint: String(rule.centsPerPoint), minRedeemPoints: String(rule.minRedeemPoints) };
}

// Inteiro sem sinal nem casas; qualquer outra coisa é NaN.
function integer(raw: string): number {
  const text = raw.trim().replace(/\./g, '');
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

// RN-01.
export function validateRule(form: RuleForm): string | null {
  for (const field of RULE_FIELDS) {
    const value = integer(form[field.key]);
    if (!Number.isInteger(value) || value < field.min || value > field.max) return `Regra de fidelidade inválida: ${field.label}.`;
  }
  return null;
}

export function parseRule(form: RuleForm): LoyaltyRule {
  return { pointsPerReal: integer(form.pointsPerReal), centsPerPoint: integer(form.centsPerPoint), minRedeemPoints: integer(form.minRedeemPoints) };
}

// RF-03: só os campos alterados.
export function ruleChanges(current: LoyaltyRule, form: RuleForm): Partial<LoyaltyRule> {
  const next = parseRule(form);
  const changes: Partial<LoyaltyRule> = {};
  for (const field of RULE_FIELDS) if (next[field.key] !== current[field.key]) changes[field.key] = next[field.key];
  return changes;
}

// RN-02.
export const pointsEarned = (cents: number, rule: Pick<LoyaltyRule, 'pointsPerReal'>) => Math.floor((cents * rule.pointsPerReal) / 100);
export const pointsValueCents = (points: number, rule: Pick<LoyaltyRule, 'centsPerPoint'>) => points * rule.centsPerPoint;

export const EXAMPLE_BILL_CENTS = 10_000;

// RF-02: exemplos em linguagem simples.
export function ruleExamples(rule: LoyaltyRule) {
  return {
    earned: pointsEarned(EXAMPLE_BILL_CENTS, rule),
    minRedeemValueCents: pointsValueCents(rule.minRedeemPoints, rule),
    // gasto necessário, em centavos, para juntar o resgate mínimo; null quando o ganho está desligado.
    spendForMinimumCents: rule.pointsPerReal > 0 ? Math.ceil((rule.minRedeemPoints * 100) / rule.pointsPerReal) : null,
  };
}

export function pointsLabel(points: number): string {
  const abs = Math.abs(points).toLocaleString('pt-BR');
  return Math.abs(points) === 1 ? `${abs} ponto` : `${abs} pontos`;
}

// RN-03: sinal vindo do valor da API.
export function signedPoints(points: number): string {
  if (points === 0) return '0';
  return `${points > 0 ? '+' : '−'}${Math.abs(points).toLocaleString('pt-BR')}`;
}

export function centsLabel(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function earnLabel(rule: Pick<LoyaltyRule, 'pointsPerReal'>): string {
  if (rule.pointsPerReal === 0) return 'Ganho de pontos desligado';
  return rule.pointsPerReal === 1 ? '1 ponto por real' : `${rule.pointsPerReal} pontos por real`;
}
