// Tela de variações e adicionais (SPEC/2026-11-17-tela-de-variacoes-e-adicionais.md).
// Funções puras: validam as listas e a escolha como a API e calculam o preço da linha.

export type MenuOption = { id: number; name: string; price: string };
export type MenuOptions = { menuItemId: number; variants: MenuOption[]; addons: MenuOption[] };
export type OptionRow = { key: string; name: string; price: string };

export const MAX_VARIANTS = 20;
export const MAX_ADDONS = 30;
export const MAX_ADDONS_PER_LINE = 10;

export const OPTION_MESSAGES = {
  name: 'Informe o nome de cada opção, de 1 a 60 caracteres.',
  repeated: (name: string) => `A opção ${name} está repetida.`,
  price: (name: string) => `Informe um preço válido para ${name}.`,
  limit: `Cadastre no máximo ${MAX_VARIANTS} variações e ${MAX_ADDONS} adicionais por item.`,
  variant: (item: string, names: string[]) => `Escolha a variação de ${item}: ${names.join(', ')}.`,
  addons: `Escolha no máximo ${MAX_ADDONS_PER_LINE} adicionais por item.`,
};

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

// RN-01: comparação sem maiúsculas e sem acentos, como a API.
export const nameKey = (name: string) => cleanName(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Valor digitado ("12,50", "12.5", "R$ 8") em centavos; inválido -> null.
export function priceCents(raw: string): number | null {
  const compact = raw.replace(/R\$/i, '').replace(/\s+/g, '');
  if (!compact) return null;
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [reais, centavos = ''] = normalized.split('.');
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
}

export const formatCents = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Linha editável a partir da opção salva (preço "40.00" -> "40,00").
export function toRow(option: MenuOption, index: number): OptionRow {
  return { key: `s${option.id}-${index}`, name: option.name, price: Number(option.price).toFixed(2).replace('.', ',') };
}

// RN-01 a RN-03 para uma lista.
function listProblem(rows: readonly OptionRow[], allowZero: boolean): string | null {
  const seen = new Set<string>();
  for (const row of rows) {
    const name = cleanName(row.name);
    if (name.length < 1 || name.length > 60) return OPTION_MESSAGES.name;
    const key = nameKey(name);
    if (seen.has(key)) return OPTION_MESSAGES.repeated(name);
    seen.add(key);
    const cents = priceCents(row.price);
    if (cents === null || (allowZero ? cents < 0 : cents <= 0) || cents > 10_000_000) return OPTION_MESSAGES.price(name);
  }
  return null;
}

export function validateOptions(variants: readonly OptionRow[], addons: readonly OptionRow[]): string | null {
  if (variants.length > MAX_VARIANTS || addons.length > MAX_ADDONS) return OPTION_MESSAGES.limit;
  return listProblem(variants, false) ?? listProblem(addons, true);
}

// RF-03: corpo do PUT, com preço em número e nome limpo, na ordem da tela.
export function optionsBody(variants: readonly OptionRow[], addons: readonly OptionRow[]) {
  const toOption = (row: OptionRow) => ({ name: cleanName(row.name), price: (priceCents(row.price) ?? 0) / 100 });
  return { variants: variants.map(toOption), addons: addons.map(toOption) };
}

// RF-03: sobe (-1) ou desce (+1) uma linha; fora dos limites, não muda.
export function moveRow<T>(rows: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= rows.length) return [...rows];
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const hasOptions = (options: MenuOptions | null) => !!options && (options.variants.length > 0 || options.addons.length > 0);

// RN-06: preço unitário e total da linha.
export function linePrice(itemPrice: string, options: MenuOptions, variantId: number | null, addonIds: readonly number[], quantity: number) {
  const variant = options.variants.find((entry) => entry.id === variantId);
  const base = Math.round(Number(variant ? variant.price : itemPrice) * 100);
  const extras = options.addons
    .filter((addon) => addonIds.includes(addon.id))
    .reduce((sum, addon) => sum + Math.round(Number(addon.price) * 100), 0);
  const unitCents = base + extras;
  return { unitCents, totalCents: unitCents * quantity };
}

// RN-04 e RN-05.
export function validateChoice(itemName: string, options: MenuOptions, variantId: number | null, addonIds: readonly number[]): string | null {
  if (options.variants.length && !options.variants.some((entry) => entry.id === variantId)) {
    return OPTION_MESSAGES.variant(itemName, options.variants.map((entry) => entry.name));
  }
  if (addonIds.length > MAX_ADDONS_PER_LINE) return OPTION_MESSAGES.addons;
  return null;
}

// RF-05: corpo do lançamento.
export function launchBody(menuItemId: number, quantity: number, variantId: number | null, addonIds: readonly number[]) {
  return {
    menuItemId,
    quantity,
    ...(variantId !== null ? { variantId } : {}),
    ...(addonIds.length ? { addonIds: [...addonIds] } : {}),
  };
}

export function toggleAddon(addonIds: readonly number[], id: number): number[] {
  return addonIds.includes(id) ? addonIds.filter((entry) => entry !== id) : [...addonIds, id];
}
