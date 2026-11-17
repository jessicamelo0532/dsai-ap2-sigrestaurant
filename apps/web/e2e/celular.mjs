// Verificação do uso no celular (SPEC/2026-11-16-app-no-celular.md).
// Abre o app numa tela de 375 px e confere, em cada seção e nos formulários principais:
// sem rolagem lateral, texto visível de pelo menos 14 px, alvos de toque de pelo menos 44 px
// e campos de digitação com 16 px ou mais (abaixo disso o celular amplia a tela ao tocar).
// Uso: BASE_URL=http://localhost:3000 CHROME_PATH=/usr/bin/google-chrome node e2e/celular.mjs
import { chromium } from 'playwright-core';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const VIEWPORT = { width: 375, height: 812 };
export const LIMITS = { minFont: 14, minTarget: 44, minInputFont: 16 };

// Roda no navegador: devolve o que está fora dos limites na tela atual.
function inspect(limits) {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
      && !element.closest('[aria-hidden="true"]');
  };
  const label = (element) => `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? '.' + element.className.trim().split(/\s+/).join('.') : ''} "${(element.textContent || element.getAttribute('aria-label') || element.getAttribute('placeholder') || '').trim().slice(0, 30)}"`;
  const problems = [];
  if (document.documentElement.scrollWidth > window.innerWidth) {
    problems.push(`rolagem lateral: página com ${document.documentElement.scrollWidth}px em tela de ${window.innerWidth}px`);
  }
  for (const element of document.querySelectorAll('body *')) {
    if (!visible(element)) continue;
    const hasText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    const size = parseFloat(getComputedStyle(element).fontSize);
    if (hasText && size < limits.minFont) problems.push(`texto de ${size}px: ${label(element)}`);
  }
  for (const element of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
    if (!visible(element)) continue;
    const box = element.getBoundingClientRect();
    const isField = element.matches('input:not([type="checkbox"]):not([type="radio"]), select, textarea');
    if (box.height < limits.minTarget || (!isField && box.width < limits.minTarget)) {
      problems.push(`alvo de ${Math.round(box.width)}x${Math.round(box.height)}px: ${label(element)}`);
    }
    if (isField && parseFloat(getComputedStyle(element).fontSize) < limits.minInputFont) {
      problems.push(`campo com fonte de ${getComputedStyle(element).fontSize}: ${label(element)}`);
    }
  }
  return [...new Set(problems)];
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const report = {};
  const check = async (name) => { report[name] = await page.evaluate(inspect, LIMITS); };
  const go = async (section) => { await page.getByRole('button', { name: section, exact: true }).first().click(); await page.waitForTimeout(300); };
  const closeModal = async () => { await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click(); await page.locator('.modal-backdrop').waitFor({ state: 'detached' }); };

  await page.goto(BASE_URL);
  await page.waitForSelector('.table-card');
  await check('Visão geral');

  // Lançar pedido sem ampliar a tela: escolher mesa, adicionar item, abrir o fechamento.
  await page.locator('.table-card').nth(1).click();
  await page.locator('.quick-item').first().click();
  await page.waitForTimeout(300);
  await check('Visão geral com comanda');
  await page.getByRole('button', { name: /Fechar conta/ }).click();
  await check('Fechar conta');
  await closeModal();
  await page.getByRole('button', { name: /Adicionar mesa/ }).first().click();
  await check('Adicionar mesa');
  await closeModal();

  await go('Salão');
  await check('Salão');
  await go('Cozinha');
  await check('Cozinha');
  await go('Cardápio');
  await check('Cardápio');
  await page.getByRole('button', { name: /Adicionar item/ }).click();
  await check('Novo item do cardápio');
  await closeModal();
  await page.getByRole('button', { name: /^Categorias/ }).click();
  await page.waitForTimeout(300);
  await check('Categorias do cardápio');
  await go('Financeiro');
  await check('Financeiro');
  await page.getByRole('button', { name: /Registrar despesa/ }).click();
  await check('Registrar despesa');
  await closeModal();

  await browser.close();
  let failures = 0;
  for (const [screen, problems] of Object.entries(report)) {
    console.log(`${problems.length ? 'FALHOU' : 'ok    '} ${screen}${problems.length ? ` (${problems.length})` : ''}`);
    for (const problem of problems) console.log(`         ${problem}`);
    failures += problems.length;
  }
  if (failures) {
    console.log(`\n${failures} problema(s) de uso no celular.`);
    process.exit(1);
  }
  console.log('\nUso no celular: todas as telas dentro dos limites.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
