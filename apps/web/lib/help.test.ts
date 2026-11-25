import { describe, expect, it } from 'vitest';
import {
  CRITICAL_TOPIC_IDS, HELP_TOPICS, contextualTopics, criticalTopics, normalize, searchTopics, topicById,
} from './help';

// SPEC/2026-11-25-assistente-de-ajuda.md (RN-01 a RN-06).
describe('catálogo da ajuda', () => {
  it('tem ids únicos, passos, fonte e seção em todos os tópicos', () => {
    const ids = HELP_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of HELP_TOPICS) {
      expect(topic.steps.length).toBeGreaterThan(0);
      expect(topic.source).toMatch(/SPEC\/|README/);
      expect(topic.section).toBeTruthy();
      expect(topic.title).toBeTruthy();
    }
  });

  it('cobre os quatro tópicos críticos', () => {
    expect(criticalTopics().map((topic) => topic.id)).toEqual([...CRITICAL_TOPIC_IDS]);
    for (const id of CRITICAL_TOPIC_IDS) expect(topicById(id)).toBeTruthy();
  });

  it('sugere o tópico da seção atual e completa com o fluxo crítico', () => {
    const caixa = contextualTopics('caixa').map((topic) => topic.id);
    expect(caixa[0]).toBe('receber');
    expect(caixa).toContain('fechar-conta');
    expect(new Set(caixa).size).toBe(caixa.length);

    const operacao = contextualTopics('operacao').map((topic) => topic.id);
    expect(operacao).toEqual(expect.arrayContaining(['abrir-mesa', 'lancar-item', 'fechar-conta', 'receber']));
  });
});

describe('busca local', () => {
  it('ignora maiúsculas, acentos e pontuação', () => {
    expect(normalize('FECHAR  Contá!')).toBe('fechar conta');
    expect(searchTopics('FECHAR CONTÁ')[0]?.id).toBe('fechar-conta');
    expect(searchTopics('fechar conta')[0]?.id).toBe('fechar-conta');
  });

  it('encontra por palavra-chave e por passo', () => {
    expect(searchTopics('cozinha')[0]?.id).toBe('cozinha');
    expect(searchTopics('item pausado')[0]?.id).toBe('problemas');
    expect(searchTopics('pix')[0]?.id).toBe('fechar-conta');
  });

  it('devolve vazio quando não encontra e limita a cinco resultados', () => {
    expect(searchTopics('xyzabc')).toEqual([]);
    expect(searchTopics('mesa').length).toBeLessThanOrEqual(5);
  });
});
