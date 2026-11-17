import { describe, expect, it } from 'vitest';
import {
  addEccAndInterleave, byteCapacity, chooseVersion, dataCodewords, encodeData, encodeQr, formatBits, gfMultiply,
  maskApplies, MAX_VERSION, penalty, qrPath, reedSolomonDivisor, reedSolomonRemainder, utf8Bytes, versionBits,
} from './qrcode';
import fixtures from './qrcode.fixtures.json';

// SPEC/2026-11-17-pwa-e-qr-das-mesas.md (T-01). As matrizes de referência foram geradas
// com a biblioteca Python segno 1.6.6 (nível M, modo byte, UTF-8), fora do repositório, com um
// ajuste para seguir a ISO/IEC 18004 7.4.10: o segno acrescenta 8 bits de preenchimento quando os
// dados já terminam no limite do byte, e a norma só preenche quando não terminam.
// A comparação usa a máscara da referência: a escolha automática da máscara pode variar entre
// implementações (todas geram símbolos válidos) e é testada à parte, pela menor penalidade.
type Fixture = { text: string; mask: number; forced: boolean; version: number; rows: string[] };
const rowsOf = (modules: boolean[][]) => modules.map((row) => row.map((dark) => (dark ? '1' : '0')).join(''));

describe('matriz igual à referência', () => {
  for (const fixture of fixtures as Fixture[]) {
    const label = `${fixture.text.slice(0, 30)} (versão ${fixture.version}, máscara ${fixture.mask}${fixture.forced ? ' forçada' : ''})`;
    it(label, () => {
      expect(encodeQr(fixture.text).version).toBe(fixture.version);
      const qr = encodeQr(fixture.text, { mask: fixture.mask });
      expect(qr.version).toBe(fixture.version);
      expect(qr.size).toBe(fixture.version * 4 + 17);
      expect(qr.mask).toBe(fixture.mask);
      expect(rowsOf(qr.modules)).toEqual(fixture.rows);
    });
  }
});

describe('capacidade e versão', () => {
  it('capacidade em bytes no nível M', () => {
    expect(dataCodewords(1)).toBe(16);
    expect(byteCapacity(1)).toBe(14);
    expect(byteCapacity(4)).toBe(62);
    expect(byteCapacity(10)).toBe(213);
  });

  it('escolhe a menor versão que cabe e recusa texto longo', () => {
    expect(chooseVersion(14)).toBe(1);
    expect(chooseVersion(15)).toBe(2);
    expect(chooseVersion(62)).toBe(4);
    expect(() => chooseVersion(214)).toThrow('Texto longo demais para o QR code: até 213 bytes.');
    expect(() => encodeQr('x', { minVersion: MAX_VERSION + 1 })).toThrow();
  });

  it('conta bytes em UTF-8', () => {
    expect(utf8Bytes('ã')).toEqual([0xc3, 0xa3]);
  });
});

describe('peças do algoritmo', () => {
  it('multiplicação no campo de Galois', () => {
    expect(gfMultiply(0, 7)).toBe(0);
    expect(gfMultiply(1, 0x53)).toBe(0x53);
    expect(gfMultiply(2, 0x80)).toBe(0x1d);
    expect(gfMultiply(0x53, 0xca)).toBe(gfMultiply(0xca, 0x53));
  });

  it('divisor e resto de Reed-Solomon', () => {
    const divisor = reedSolomonDivisor(10);
    expect(divisor).toHaveLength(10);
    // A mensagem seguida do próprio resto é divisível: o resto passa a ser zero.
    const data = encodeData(utf8Bytes('Mesa 01'), 1);
    const remainder = reedSolomonRemainder(data, divisor);
    expect(reedSolomonRemainder([...data, ...remainder], divisor)).toEqual(new Array(10).fill(0));
  });

  it('preenche os dados até a capacidade com 0xEC e 0x11', () => {
    const data = encodeData(utf8Bytes('A'), 1);
    expect(data).toHaveLength(16);
    expect(data.slice(0, 3)).toEqual([0x40, 0x14, 0x10]);
    expect(data.slice(3, 6)).toEqual([0xec, 0x11, 0xec]);
  });

  it('intercala blocos com o total de codewords da versão', () => {
    expect(addEccAndInterleave(encodeData(utf8Bytes('x'.repeat(150)), 8), 8)).toHaveLength(242);
  });

  it('bits de formato e de versão', () => {
    expect(formatBits(0).toString(2).padStart(15, '0')).toBe('101010000010010');
    expect(versionBits(7).toString(16)).toBe('7c94');
  });

  it('condições das 8 máscaras na origem', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((mask) => maskApplies(mask, 0, 0))).toEqual(new Array(8).fill(true));
    expect(() => maskApplies(8, 0, 0)).toThrow('Máscara inválida.');
  });

  it('a máscara escolhida é a de menor penalidade', () => {
    const chosen = encodeQr('https://exemplo.test/?mesa=3');
    const scores = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => penalty(encodeQr('https://exemplo.test/?mesa=3', { mask }).modules));
    expect(scores[chosen.mask]).toBe(Math.min(...scores));
  });

  it('caminho SVG com margem', () => {
    const qr = encodeQr('Mesa 01');
    const path = qrPath(qr);
    expect(path.startsWith('M4,4h1v1h-1z')).toBe(true);
    expect(path.match(/M/g)).toHaveLength(qr.modules.flat().filter(Boolean).length);
  });
});
