// Regras puras da cobertura do código novo (SPEC/2026-11-17-cobertura-do-codigo-novo.md).
// Sem acesso a disco nem a git: recebem texto e devolvem dados, para serem testadas com node --test.

const toPosix = (path) => path.replace(/\\/g, '/');

// CA-01: linhas adicionadas por arquivo a partir de um `git diff -U0`.
// Com -U0 cada trecho "@@ -a,b +c,d @@" traz só as linhas novas c..c+d-1 (d omitido vale 1; d = 0 não adiciona).
export function parseAddedLines(diffText) {
  const added = new Map();
  let current = null;
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4).trim();
      current = target === '/dev/null' ? null : toPosix(target.replace(/^b\//, ''));
      if (current && !added.has(current)) added.set(current, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let offset = 0; offset < count; offset += 1) added.get(current).add(start + offset);
    }
  }
  for (const [file, lines] of added) if (!lines.size) added.delete(file);
  return added;
}

// CA-02 / RNF-02: caminho do lcov para "apps/<app>/..." com barras normais.
export function normalizeLcovPath(path, prefix) {
  const posix = toPosix(path.trim());
  const marker = posix.lastIndexOf('/apps/');
  if (marker >= 0) return posix.slice(marker + 1);
  if (posix.startsWith('apps/')) return posix;
  const base = toPosix(prefix).replace(/\/+$/, '');
  return `${base}/${posix.replace(/^\.\//, '')}`;
}

// RN-02: linhas executáveis (DA:linha,execuções) por arquivo.
export function parseLcov(text, prefix) {
  const files = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      current = normalizeLcovPath(line.slice(3), prefix);
      if (!files.has(current)) files.set(current, new Map());
    } else if (line.startsWith('DA:') && current) {
      const [lineNumber, hits] = line.slice(3).split(',').map(Number);
      const lines = files.get(current);
      // O mesmo arquivo pode aparecer mais de uma vez; vale a maior contagem.
      lines.set(lineNumber, Math.max(lines.get(lineNumber) ?? 0, hits));
    } else if (line === 'end_of_record') {
      current = null;
    }
  }
  return files;
}

export function mergeLcov(...reports) {
  const merged = new Map();
  for (const report of reports) {
    for (const [file, lines] of report) {
      const target = merged.get(file) ?? new Map();
      for (const [line, hits] of lines) target.set(line, Math.max(target.get(line) ?? 0, hits));
      merged.set(file, target);
    }
  }
  return merged;
}

// RN-01: só código de produto do frontend e da API.
export function isMeasured(file) {
  const path = toPosix(file);
  if (!/^apps\/(web|api)\/.+\.tsx?$/.test(path)) return false;
  if (/\.d\.ts$/.test(path)) return false;
  if (/\.test\.tsx?$/.test(path)) return false;
  if (/\.config\.[^/]+$/.test(path)) return false;
  if (/^apps\/[^/]+\/(test|e2e)\//.test(path)) return false;
  if (path.startsWith('apps/api/prisma/')) return false;
  if (path === 'apps/api/src/main.ts') return false;
  return true;
}

// RN-03: linha que conta num arquivo sem relatório (não vazia e não só comentário).
export function isCodeLine(text) {
  const line = (text ?? '').trim();
  if (!line) return false;
  return !(line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('*/'));
}

// RN-03: arquivo só de tipos (type, interface, import type) não tem nada que rode e não entra na conta.
export function hasRuntimeCode(lines) {
  const code = lines
    .filter(isCodeLine)
    .filter((line) => !/^\s*import\s+type\b/.test(line))
    .join('\n');
  return /\b(function|class|const|let|var|return|new|if|for|while|switch|throw|enum)\b|=>/.test(code);
}

// CA-04 e CA-05: cobertura das linhas novas. `readLines(file)` dá as linhas do arquivo atual (RN-03).
export function diffCoverage(added, lcov, readLines) {
  const files = [];
  const missing = [];
  for (const [file, lines] of added) {
    if (!isMeasured(file)) continue;
    const report = lcov.get(file);
    let total = 0;
    let covered = 0;
    if (report) {
      for (const line of lines) {
        if (!report.has(line)) continue;
        total += 1;
        if (report.get(line) > 0) covered += 1;
      }
    } else {
      const content = readLines(file);
      if (!hasRuntimeCode(content)) continue;
      for (const line of lines) if (isCodeLine(content[line - 1])) total += 1;
      if (total) missing.push(file);
    }
    if (total) files.push({ file, total, covered, uncovered: total - covered });
  }
  const total = files.reduce((sum, entry) => sum + entry.total, 0);
  const covered = files.reduce((sum, entry) => sum + entry.covered, 0);
  return { total, covered, percent: percent(covered, total), files, missing };
}

// RN-04.
export function percent(covered, total) {
  if (!total) return 100;
  return Math.round((covered / total) * 1000) / 10;
}

export function worstFiles(result, limit = 10) {
  return [...result.files]
    .filter((entry) => entry.uncovered > 0)
    .sort((a, b) => b.uncovered - a.uncovered || a.file.localeCompare(b.file))
    .slice(0, limit);
}

const decimal = (value) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// RF-02: resumo em Markdown para o GITHUB_STEP_SUMMARY.
export function summaryMarkdown(result, minimum, base) {
  const ok = result.percent >= minimum;
  const lines = [
    `## Cobertura do código novo desde \`${base}\``,
    '',
    result.total
      ? `**${decimal(result.percent)}%** (${result.covered} de ${result.total} linhas novas cobertas). Mínimo: ${minimum}%. ${ok ? 'Conforme.' : 'Abaixo do mínimo.'}`
      : 'Nenhuma linha nova de código para medir.',
  ];
  const worst = worstFiles(result);
  if (worst.length) {
    lines.push('', '| Arquivo | Linhas novas | Descobertas |', '|---|---|---|');
    for (const entry of worst) lines.push(`| \`${entry.file}\` | ${entry.total} | ${entry.uncovered} |`);
  }
  if (result.missing.length) {
    lines.push('', `Sem relatório de cobertura (contados como descobertos): ${result.missing.map((file) => `\`${file}\``).join(', ')}.`);
  }
  return `${lines.join('\n')}\n`;
}
