// Gerador de QR code (ISO/IEC 18004) para os cartões das mesas (SPEC/2026-11-17-pwa-e-qr-das-mesas.md).
// Modo byte (UTF-8), correção de erros nível M, versões 1 a 10 (até 213 bytes), sem dependência externa.
// O algoritmo segue a norma; os testes comparam a matriz com uma biblioteca de referência.

export type QrMatrix = { version: number; size: number; mask: number; modules: boolean[][] };

export const MAX_VERSION = 10;

// Nível M: codewords de correção por bloco e número de blocos, versões 1..10.
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
// Total de codewords (dados + correção) por versão, 1..10.
const RAW_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
// Centros dos padrões de alinhamento, 1..10.
const ALIGNMENT = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const FORMAT_BITS_M = 0b00;

export const dataCodewords = (version: number) => RAW_CODEWORDS[version - 1] - ECC_PER_BLOCK[version - 1] * BLOCKS[version - 1];
const countBits = (version: number) => (version <= 9 ? 8 : 16);

// Capacidade em bytes (modo byte, nível M).
export function byteCapacity(version: number): number {
  return Math.floor((dataCodewords(version) * 8 - 4 - countBits(version)) / 8);
}

export function chooseVersion(byteLength: number): number {
  for (let version = 1; version <= MAX_VERSION; version += 1) if (byteLength <= byteCapacity(version)) return version;
  throw new Error(`Texto longo demais para o QR code: até ${byteCapacity(MAX_VERSION)} bytes.`);
}

// ---------- Campo de Galois GF(256), polinômio 0x11D ----------
export function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

export function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

export function reedSolomonRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coefficient, index) => { result[index] ^= gfMultiply(coefficient, factor); });
  }
  return result;
}

// ---------- Dados ----------
export function encodeData(bytes: readonly number[], version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => { for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, countBits(version));
  for (const byte of bytes) push(byte, 8);
  const capacity = dataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  for (let pad = 0xec; codewords.length < dataCodewords(version); pad ^= 0xec ^ 0x11) codewords.push(pad);
  return codewords;
}

// Divide em blocos, calcula a correção de cada um e intercala.
export function addEccAndInterleave(data: readonly number[], version: number): number[] {
  const blocks = BLOCKS[version - 1];
  const eccLength = ECC_PER_BLOCK[version - 1];
  const raw = RAW_CODEWORDS[version - 1];
  const shortBlocks = blocks - (raw % blocks);
  const shortLength = Math.floor(raw / blocks);
  const divisor = reedSolomonDivisor(eccLength);
  const all: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i += 1) {
    const dataLength = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const block = data.slice(k, k + dataLength);
    k += dataLength;
    const ecc = reedSolomonRemainder(block, divisor);
    if (i < shortBlocks) block.push(0);
    all.push([...block, ...ecc]);
  }
  const result: number[] = [];
  for (let i = 0; i < all[0].length; i += 1) {
    all.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= shortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// ---------- Matriz ----------
type Grid = { size: number; modules: boolean[][]; isFunction: boolean[][] };

function emptyGrid(version: number): Grid {
  const size = version * 4 + 17;
  return {
    size,
    modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    isFunction: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}

function setFunction(grid: Grid, x: number, y: number, dark: boolean) {
  grid.modules[y][x] = dark;
  grid.isFunction[y][x] = true;
}

const bit = (value: number, index: number) => ((value >>> index) & 1) !== 0;

export function formatBits(mask: number): number {
  const data = (FORMAT_BITS_M << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  return ((data << 10) | remainder) ^ 0x5412;
}

function drawFormat(grid: Grid, mask: number) {
  const bits = formatBits(mask);
  const { size } = grid;
  for (let i = 0; i <= 5; i += 1) setFunction(grid, 8, i, bit(bits, i));
  setFunction(grid, 8, 7, bit(bits, 6));
  setFunction(grid, 8, 8, bit(bits, 7));
  setFunction(grid, 7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i += 1) setFunction(grid, 14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i += 1) setFunction(grid, size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i += 1) setFunction(grid, 8, size - 15 + i, bit(bits, i));
  setFunction(grid, 8, size - 8, true);
}

export function versionBits(version: number): number {
  let remainder = version;
  for (let i = 0; i < 12; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  return (version << 12) | remainder;
}

function drawFunctionPatterns(grid: Grid, version: number) {
  const { size } = grid;
  for (let i = 0; i < size; i += 1) {
    setFunction(grid, 6, i, i % 2 === 0);
    setFunction(grid, i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) setFunction(grid, x, y, distance !== 2 && distance !== 4);
      }
    }
  }
  const positions = ALIGNMENT[version - 1];
  const last = positions.length - 1;
  positions.forEach((px, i) => positions.forEach((py, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) setFunction(grid, px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }));
  drawFormat(grid, 0);
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(grid, a, b, bit(bits, i));
      setFunction(grid, b, a, bit(bits, i));
    }
  }
}

function drawCodewords(grid: Grid, codewords: readonly number[]) {
  const { size } = grid;
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!grid.isFunction[y][x] && index < codewords.length * 8) {
          grid.modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7));
          index += 1;
        }
      }
    }
  }
}

export function maskApplies(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: throw new Error('Máscara inválida.');
  }
}

function applyMask(grid: Grid, mask: number) {
  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      if (!grid.isFunction[y][x] && maskApplies(mask, x, y)) grid.modules[y][x] = !grid.modules[y][x];
    }
  }
}

// ---------- Penalidade (escolha da máscara) ----------
function addHistory(length: number, history: number[], size: number) {
  if (history[0] === 0) length += size;
  history.pop();
  history.unshift(length);
}

function countFinderLike(history: readonly number[]): number {
  const n = history[1];
  const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
  return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) + (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
}

function terminateAndCount(color: boolean, length: number, history: number[], size: number): number {
  if (color) { addHistory(length, history, size); length = 0; }
  length += size;
  addHistory(length, history, size);
  return countFinderLike(history);
}

export function penalty(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let result = 0;
  const line = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < size; a += 1) {
      let color = false;
      let run = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];
      for (let b = 0; b < size; b += 1) {
        if (get(a, b) === color) {
          run += 1;
          if (run === 5) result += 3;
          else if (run > 5) result += 1;
        } else {
          addHistory(run, history, size);
          if (!color) result += countFinderLike(history) * 40;
          color = get(a, b);
          run = 1;
        }
      }
      result += terminateAndCount(color, run, history, size) * 40;
    }
  };
  line((y, x) => modules[y][x]);
  line((x, y) => modules[y][x]);
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = modules[y][x];
      if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) result += 3;
    }
  }
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return result + k * 10;
}

export function utf8Bytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

// Monta o QR code; sem `mask`, escolhe a de menor penalidade.
export function encodeQr(text: string, options: { mask?: number; minVersion?: number } = {}): QrMatrix {
  const bytes = utf8Bytes(text);
  const version = Math.max(chooseVersion(bytes.length), options.minVersion ?? 1);
  if (version > MAX_VERSION) throw new Error(`Versão máxima: ${MAX_VERSION}.`);
  const codewords = addEccAndInterleave(encodeData(bytes, version), version);
  const build = (mask: number) => {
    const grid = emptyGrid(version);
    drawFunctionPatterns(grid, version);
    drawCodewords(grid, codewords);
    applyMask(grid, mask);
    drawFormat(grid, mask);
    return grid;
  };
  if (options.mask !== undefined) {
    const grid = build(options.mask);
    return { version, size: grid.size, mask: options.mask, modules: grid.modules };
  }
  let best: { mask: number; grid: Grid; score: number } | null = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const grid = build(mask);
    const score = penalty(grid.modules);
    if (!best || score < best.score) best = { mask, grid, score };
  }
  return { version, size: best!.grid.size, mask: best!.mask, modules: best!.grid.modules };
}

// Caminho SVG dos módulos escuros, com margem (zona de silêncio) de 4 módulos.
export function qrPath(matrix: QrMatrix, border = 4): string {
  const parts: string[] = [];
  matrix.modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) parts.push(`M${x + border},${y + border}h1v1h-1z`); }));
  return parts.join('');
}

