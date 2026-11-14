/** Regras de validação compartilhadas entre o modo local e o modo API. */

/** Valor monetário válido: número finito, maior que zero e com no máximo duas casas. */
export function isValidMoney(value: unknown): boolean {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return false;
  const cents = number * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
}
