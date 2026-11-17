// Regras puras da fidelidade (SPEC/2026-11-16-programa-de-fidelidade.md).
import { BadRequestException } from '@nestjs/common';
import { brl } from '../cash/cash-rules';

export interface LoyaltyRule {
  pointsPerReal: number;
  centsPerPoint: number;
  minRedeemPoints: number;
}

// P-1 (provisório): 1 ponto por real, 100 pontos = R$ 5,00, resgate mínimo de 100 pontos.
export const DEFAULT_RULE: LoyaltyRule = { pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 };

const LIMITS: Record<keyof LoyaltyRule, [number, number]> = {
  pointsPerReal: [0, 100],
  centsPerPoint: [1, 1000],
  minRedeemPoints: [1, 100_000],
};

export const OVER_TOTAL_MESSAGE = 'Desfaça o resgate de pontos antes: o desconto passaria do total da comanda.';

// RN-01: campos não enviados ficam como estão.
export function mergeRule(current: LoyaltyRule, changes: Partial<Record<keyof LoyaltyRule, unknown>>): LoyaltyRule {
  const next = { ...current };
  for (const field of Object.keys(LIMITS) as (keyof LoyaltyRule)[]) {
    const value = changes[field];
    if (value === undefined) continue;
    const [min, max] = LIMITS[field];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw new BadRequestException(`Regra de fidelidade inválida: ${field}.`);
    }
    next[field] = value;
  }
  return next;
}

// RN-02
export function pointsEarned(paidCents: number, rule: Pick<LoyaltyRule, 'pointsPerReal'>) {
  if (paidCents <= 0) return 0;
  return Math.floor((paidCents * rule.pointsPerReal) / 100);
}

// RF-03: quanto o saldo vale hoje, em centavos.
export function balanceValueCents(balance: number, rule: Pick<LoyaltyRule, 'centsPerPoint'>) {
  return Math.max(0, balance) * rule.centsPerPoint;
}

export interface RedeemCheck {
  points: unknown;
  balance: number;
  subtotalCents: number;
  hasRedemption: boolean;
  rule: LoyaltyRule;
}

// RN-04 a RN-06: devolve os pontos e o desconto em centavos.
export function redemption({ points, balance, subtotalCents, hasRedemption, rule }: RedeemCheck) {
  if (hasRedemption) throw new BadRequestException('Esta comanda já tem um resgate. Desfaça antes de resgatar de novo.');
  if (typeof points !== 'number' || !Number.isInteger(points) || points < rule.minRedeemPoints) {
    throw new BadRequestException(`Resgate pelo menos ${rule.minRedeemPoints} pontos.`);
  }
  if (points > balance) throw new BadRequestException(`Saldo insuficiente: o cliente tem ${Math.max(0, balance)} pontos.`);
  const discount = points * rule.centsPerPoint;
  if (discount > subtotalCents) {
    throw new BadRequestException(`O desconto de ${brl(discount)} passa do total da comanda (${brl(subtotalCents)}).`);
  }
  return { points, discountCents: discount };
}

// RN-07 e RN-10
export function assertDiscountFits(subtotal: number, discount: number) {
  if (discount > subtotal) throw new BadRequestException(OVER_TOTAL_MESSAGE);
}
