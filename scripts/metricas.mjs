#!/usr/bin/env node
/**
 * Mede localmente as metricas da Aula 09 (AP2) que o extrator automatico
 * verifica no repositorio. Cada metrica tem uma funcao propria e o script
 * imprime o resultado no formato "metrica: valor (limite) -> CONFORME/NAO CONFORME".
 *
 * Uso:
 *   node scripts/metricas.mjs              # todas as metricas
 *   node scripts/metricas.mjs volume       # apenas as informadas
 *
 * Fatos medidos, nao estimativas: o script executa as ferramentas de verdade.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const BASE_REF = process.env.AP1_BASE_REF || 'd0a6caf';
const MIN_LINHAS = 100000;
const MAX_DUPLICACAO = 5;
const MIN_COBERTURA = 70;
const MIN_DIAS_COMMIT = 2;
const MAX_COMMIT_MEDIANO = 400;
const MIN_AUTORIA = 30;

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    if (error.stdout) return error.stdout;
    throw error;
  }
}

function heading(titulo) {
  console.log(`\n=== ${titulo} ===`);
}

function resultado(nome, valor, limite, conforme, detalhe = '') {
  const marca = conforme ? 'CONFORME' : 'NAO CONFORME';
  console.log(`${nome}: ${valor} (limite: ${limite}) -> ${marca}${detalhe ? ` | ${detalhe}` : ''}`);
  return conforme;
}

const METRICAS = {};

METRICAS.volume = () => {
  heading('Tamanho — linhas novas no cloc --diff');
  const base = mkdtempSync(join(tmpdir(), 'ap1-base-'));
  const worktree = join(base, 'ap1');
  try {
    run('git', ['worktree', 'add', '--detach', worktree, BASE_REF]);
    // O cloc 2.04 nao aplica --exclude-list-file no modo diff, entao a
    // filtragem dos arquivos fora da contagem e feita aqui, sobre o relatorio
    // por arquivo. Lockfiles, build/, vendor/ e minificados ficam de fora
    // (restricao 4 da aula).
    const csv = run('cloc', [
      '--diff', worktree, ROOT,
      '--exclude-dir=node_modules,.next,.git,dist,vendor,build,coverage',
      '--by-file', '--csv',
    ]);
    const linhas = csv.trim().split('\n');
    const cabecalho = linhas[0].split(',');
    const indiceAdded = cabecalho.findIndex((coluna) => coluna.trim() === '+ code');
    const foraDaContagem = /(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/;
    const ehCodigo = (caminho) => /\.(ts|tsx|js|jsx|mjs|cjs|css|sql|prisma|py|java|go|rs)$/.test(caminho);
    const ehDocumentacao = (caminho) => /\.(md|mdx|json|ya?ml|toml|lock)$/.test(caminho);

    let total = 0;
    let codigo = 0;
    let documentacao = 0;
    const porArquivo = [];
    for (const linha of linhas.slice(1)) {
      const colunas = linha.split(',');
      if (colunas.length <= indiceAdded) continue;
      const adicionadas = Number(colunas[indiceAdded]);
      if (!Number.isFinite(adicionadas) || adicionadas === 0) continue;
      const caminho = colunas[0].replace(/^\.\//, '').replace(`${ROOT}/`, '');
      if (foraDaContagem.test(caminho)) continue;
      total += adicionadas;
      if (ehCodigo(caminho)) codigo += adicionadas;
      else if (ehDocumentacao(caminho)) documentacao += adicionadas;
      porArquivo.push({ caminho, adicionadas });
    }
    porArquivo.sort((a, b) => b.adicionadas - a.adicionadas);
    console.log('  por arquivo:');
    for (const item of porArquivo.slice(0, 10)) {
      console.log(`    ${String(item.adicionadas).padStart(5)}  ${item.caminho}`);
    }
    console.log(`  quebra: ${codigo} linhas de codigo, ${documentacao} de documentacao/configuracao`);
    return resultado('linhas novas', total, `>= ${MIN_LINHAS}`, total >= MIN_LINHAS,
      `${((total / MIN_LINHAS) * 100).toFixed(1)}% do minimo; ${codigo} sao codigo de produto`);
  } finally {
    run('git', ['worktree', 'remove', worktree, '--force']);
    rmSync(base, { recursive: true, force: true });
  }
};

METRICAS.duplicacao = () => {
  heading('Duplicacao — jscpd');
  const relatorio = '/tmp/ap1-jscpd';
  rmSync(relatorio, { recursive: true, force: true });
  // Reporter JSON: a saida de console carrega codigos ANSI que quebram parsing.
  run('npx', ['jscpd', 'apps/web', '--min-lines', '5', '--min-tokens', '50',
    '--reporters', 'json', '--output', relatorio]);
  const arquivo = join(relatorio, 'jscpd-report.json');
  if (!existsSync(arquivo)) {
    console.log('duplicacao: relatorio do jscpd nao encontrado -> NAO CONFORME');
    return false;
  }
  const dados = JSON.parse(readFileSync(arquivo, 'utf8'));
  const percentual = dados.statistics?.total?.percentage ?? Number.NaN;
  if (!Number.isFinite(percentual)) {
    console.log('duplicacao: resultado do jscpd ilegivel -> NAO CONFORME');
    return false;
  }
  return resultado('duplicacao', `${percentual}%`, `<= ${MAX_DUPLICACAO}%`, percentual <= MAX_DUPLICACAO,
    `${dados.statistics.total.lines} linhas duplicadas em ${dados.statistics.total.clones} clones`);
};

METRICAS.cobertura = () => {
  heading('Cobertura de linhas do codigo novo');
  const relatorio = '/tmp/ap1-cobertura';
  run('npx', ['vitest', 'run', '--root', 'apps/web', '--coverage',
    '--coverage.reporter=json-summary', '--coverage.reporter=text',
    '--coverage.include=lib/**', '--coverage.include=app/**',
    `--coverage.reportsDirectory=${relatorio}`]);
  const resumo = join(relatorio, 'coverage-summary.json');
  if (!existsSync(resumo)) {
    console.log('cobertura: relatorio nao encontrado -> NAO CONFORME');
    return false;
  }
  const dados = JSON.parse(readFileSync(resumo, 'utf8'));
  const total = dados.total.lines;
  return resultado('cobertura de linhas', `${total.pct}%`, `>= ${MIN_COBERTURA}%`, total.pct >= MIN_COBERTURA,
    `${total.covered}/${total.total} linhas`);
};

METRICAS.specs = () => {
  heading('Specs — spec datada para cada funcionalidade');
  const specs = Number(run('bash', ['-c',
    "ls SPEC/ | grep -cE '^[0-9]{4}-[0-9]{2}-[0-9]{2}-.*\\.md$' || true"]).trim());
  // README.md e TEMPLATE.md nao sao specs datadas de funcionalidade.
  const totalSpecs = Number(run('bash', ['-c',
    "ls SPEC/ | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}-.*\\.md$' | wc -l || true"]).trim());
  // Funcionalidade = commit que altera codigo de produto (apps/).
  // Todo commit de codigo precisa citar uma SPEC datada no trailer Spec:.
  const codigo = run('bash', ['-c',
    "git log --format='%H' d0a6caf..HEAD | while read h; do git show --name-only --format='' $h | grep -q '^apps/' && echo $h; done"])
    .trim().split('\n').filter(Boolean);
  if (!codigo.length) {
    return resultado('specs datadas', `${totalSpecs} specs, nenhum commit de codigo ainda`, '>= 100%', true);
  }
  let comSpec = 0;
  const semSpec = [];
  for (const hash of codigo) {
    const corpo = run('git', ['log', '-1', '--format=%b', hash]);
    const cita = /Spec:\s*(SPEC\/\S+\.md)/.exec(corpo);
    if (cita && existsSync(join(ROOT, cita[1]))) comSpec += 1;
    else semSpec.push(hash.slice(0, 7));
  }
  const percentage = (comSpec / codigo.length) * 100;
  return resultado('specs datadas', `${comSpec}/${codigo.length} commits de codigo (${percentage.toFixed(0)}%), ${totalSpecs} specs datadas em SPEC/`, '>= 100%', percentage >= 100,
    semSpec.length ? `sem spec valida: ${semSpec.join(', ')}` : '');
};

METRICAS.commits = () => {
  heading('Commits com agente — trailers Agent: e Spec:');
  const hashes = run('bash', ['-c', "git log --format='%H' d0a6caf..HEAD"]).trim().split('\n').filter(Boolean);
  if (!hashes.length) {
    console.log('commits com agente: nenhum commit no periodo -> NAO CONFORME');
    return false;
  }
  let comTrailers = 0;
  for (const hash of hashes) {
    const corpo = run('git', ['log', '-1', '--format=%b', hash]);
    if (/Agent:\s*\S/.test(corpo) && /Spec:\s*\S/.test(corpo)) comTrailers += 1;
  }
  const percentual = (comTrailers / hashes.length) * 100;
  return resultado('commits com trailers', `${comTrailers}/${hashes.length} (${percentual.toFixed(0)}%)`, '>= 80%', percentual >= 80);
};

METRICAS.frequencia = () => {
  heading('Frequencia — dias distintos com commit');
  const dias = run('bash', ['-c', "git log --format='%ad' --date=short d0a6caf..HEAD | sort -u | wc -l"]).trim();
  const totalDias = Number(dias);
  const conformidadeDias = totalDias >= MIN_DIAS_COMMIT;
  resultado('dias distintos com commit', totalDias, `>= ${MIN_DIAS_COMMIT}`, conformidadeDias);

  const tamanhos = run('bash', ['-c',
    "git log --format='%H' d0a6caf..HEAD | while read h; do git show --shortstat --format='' $h | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+'; done"])
    .trim().split('\n').filter(Boolean).map(Number).sort((a, b) => a - b);
  if (!tamanhos.length) {
    console.log('tamanho mediano de commit: sem dados -> NAO CONFORME');
    return false;
  }
  const medio = Math.floor(tamanhos.length / 2);
  const mediano = tamanhos.length % 2 ? tamanhos[medio] : Math.round((tamanhos[medio - 1] + tamanhos[medio]) / 2);
  const conformidadeMediana = mediano < MAX_COMMIT_MEDIANO;
  return resultado('tamanho mediano de commit', `${mediano} linhas`, `< ${MAX_COMMIT_MEDIANO}`, conformidadeMediana,
    `tamanhos: ${tamanhos.join(', ')}`);
};

METRICAS.sessoes = () => {
  heading('Sessoes — prompts/sessoes por dia com commit de agente');
  const dias = run('bash', ['-c',
    "git log --format='%ad' --date=short d0a6caf..HEAD --author='yurisawaki' | sort -u"]).trim().split('\n').filter(Boolean);
  if (!dias.length) {
    console.log('sessoes: nenhum dia com commit de agente -> NAO CONFORME');
    return false;
  }
  let cobertos = 0;
  const faltantes = [];
  for (const dia of dias) {
    const existe = run('bash', ['-c', `ls prompts/sessoes/ | grep -c '^${dia}' || true`]).trim();
    if (Number(existe) > 0) cobertos += 1;
    else faltantes.push(dia);
  }
  const percentual = (cobertos / dias.length) * 100;
  return resultado('sessoes por dia de commit', `${cobertos}/${dias.length} (${percentual.toFixed(0)}%)`, '>= 100%', percentual >= 100,
    faltantes.length ? `faltando: ${faltantes.join(', ')}` : '');
};

METRICAS.autoria = () => {
  heading('Autoria — 30% dos commits por integrante');
  const autores = run('bash', ['-c',
    "git log --format='%aN' d0a6caf..HEAD | sort | uniq -c | sort -rn"]).trim().split('\n').filter(Boolean);
  const total = autores.reduce((soma, linha) => soma + Number(linha.trim().split(/\s+/)[0]), 0);
  if (!total) {
    console.log('autoria: nenhum commit no periodo -> NAO CONFORME');
    return false;
  }
  let todosOk = true;
  for (const linha of autores) {
    const [quantidade, ...resto] = linha.trim().split(/\s+/);
    const percentual = (Number(quantidade) / total) * 100;
    const ok = percentual >= MIN_AUTORIA;
    if (!ok) todosOk = false;
    console.log(`  ${resto.join(' ')}: ${quantidade} commits (${percentual.toFixed(0)}%) -> ${ok ? 'CONFORME' : 'NAO CONFORME'}`);
  }
  // A metrica exige 30% para CADA integrante da dupla: com um unico autor
  // nao ha como distribuir a parcela, mesmo que ele Concentre 100%.
  const integrantes = autores.length;
  if (integrantes < 2) {
    console.log(`autoria: ${integrantes} integrante(s) no periodo; a metrica exige >= 2 com 30% cada -> NAO CONFORME`);
    return false;
  }
  console.log(`autoria: ${total} commits, ${integrantes} integrantes, minimo ${MIN_AUTORIA}% cada -> ${todosOk ? 'CONFORME' : 'NAO CONFORME'}`);
  return todosOk;
};

METRICAS.seguranca = () => {
  heading('Seguranca — segredos no historico e alertas de dependencia');
  // A varredura olha apenas os diffs (--format='' descarta as mensagens de
  // commit, que citam as palavras do padrao ao explicar a correcao) e
  // descarta as linhas que definem o proprio padrao, para que o script e o
  // historico das versoes anteriores dele nao sejam confundidos com um
  // segredo real. A checagem autoritativa continua sendo o gitleaks do CI.
  const padrao = ['(BEGIN [A-Z ]*PRIVATE KEY|aws', '_secret_access_key|ghp_', '[A-Za-z0-9]{20,}|sk-', '[A-Za-z0-9]{20,})'].join('');
  const segredos = run('bash', ['-c',
    `P=${JSON.stringify(padrao)}; git log -p --format='' --all | grep -inE "$P" | grep -v "PRIVATE KEY|aws" | wc -l`]).trim();
  const conformidadeSegredos = Number(segredos) === 0;
  resultado('segredos reais no historico', segredos, '= 0', conformidadeSegredos);

  let auditoria;
  try {
    auditoria = run('npm', ['audit', '--omit=dev', '--json']);
  } catch {
    console.log('alertas criticos de dependencia: nao foi possivel rodar npm audit -> NAO CONFORME');
    return false;
  }
  let criticos = 0;
  try {
    const dados = JSON.parse(auditoria);
    criticos = dados.metadata?.vulnerabilities?.critical ?? 0;
  } catch {
    console.log('alertas criticos de dependencia: saida do npm audit ilegivel -> NAO CONFORME');
    return false;
  }
  return resultado('alertas criticos de dependencia', criticos, '= 0', criticos === 0);
};

METRICAS.url = async () => {
  heading('Producao — URL publica no ar');
  const url = (process.env.PUBLIC_URL || 'https://dsai-ap1-sigrestaurant.vercel.app/').trim();
  let status = 0;
  try {
    const resposta = await fetch(url, { redirect: 'follow' });
    status = resposta.status;
  } catch (erro) {
    console.log(`url publica: requisicao falhou (${erro.message}) -> NAO CONFORME`);
    return false;
  }
  return resultado('url publica', `HTTP ${status} em ${url}`, 'HTTP 2xx', status >= 200 && status < 300);
};

const ORDEM = ['volume', 'duplicacao', 'cobertura', 'specs', 'commits', 'frequencia', 'sessoes', 'autoria', 'seguranca', 'url'];

const pedidos = process.argv.slice(2);
const selecionadas = pedidos.length ? ORDEM.filter((nome) => pedidos.includes(nome)) : ORDEM;
if (!selecionadas.length) {
  console.error(`Metricas invalidas. Disponiveis: ${ORDEM.join(', ')}`);
  process.exit(2);
}

const resultados = {};
for (const nome of selecionadas) {
  try {
    resultados[nome] = await METRICAS[nome]();
  } catch (erro) {
    console.log(`\n${nome}: erro na medicao (${erro.message}) -> NAO CONFORME`);
    resultados[nome] = false;
  }
}

const conformes = Object.values(resultados).filter(Boolean).length;
const total = Object.keys(resultados).length;
console.log(`\n${'='.repeat(50)}`);
console.log(`RESUMO: ${conformes}/${total} metricas conformes`);
process.exit(conformes === total ? 0 : 1);
