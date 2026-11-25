'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, HelpCircle, Search, X } from 'lucide-react';
import { sectionLabels, type Section } from '@/lib/sections';
import { contextualTopics, criticalTopics, searchTopics, type HelpTopic } from '@/lib/help';

type Props = {
  section: Section;
  onNavigate: (section: Section) => void;
};

export function HelpAgent({ section, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<HelpTopic | null>(null);

  useEffect(() => {
    if (open) return;
    setQuery('');
    setSelected(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const results = query.trim() ? searchTopics(query) : contextualTopics(section);
  const fallback = query.trim() && !results.length ? criticalTopics() : [];

  return (
    <>
      <button className="help-trigger" type="button" aria-label="Abrir ajuda guiada" onClick={() => setOpen(true)}>
        <HelpCircle size={16} />
        <span>Ajuda</span>
      </button>
      {open && (
        <div
          className="modal-backdrop help-backdrop"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <div className="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <div className="help-heading">
              <div>
                <div className="eyebrow">AJUDA GUIADA · OFFLINE</div>
                <h2 id="help-title">Como podemos ajudar?</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar ajuda" autoFocus onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {selected ? (
              <div className="help-detail">
                <button className="help-back" type="button" onClick={() => setSelected(null)}>
                  <ArrowLeft size={16} />Voltar para sugestões
                </button>
                <h3>{selected.title}</h3>
                <p className="help-summary">{selected.summary}</p>
                <ol className="help-steps">
                  {selected.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
                <p className="help-source"><BookOpen size={14} />Fonte: {selected.source}</p>
                <button
                  className="button button-dark help-go"
                  type="button"
                  onClick={() => { onNavigate(selected.section); setOpen(false); }}
                >
                  Ir para {sectionLabels[selected.section]} <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <label className="help-search">
                  <Search size={16} />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Busque: fechar conta, abrir mesa…"
                    aria-label="Buscar na ajuda"
                  />
                </label>

                {results.length > 0 && (
                  <>
                    <p className="help-section-title">
                      {query.trim() ? 'Resultados' : `Sugestões para ${sectionLabels[section]}`}
                    </p>
                    <div className="help-topics">
                      {results.map((topic) => (
                        <button className="help-topic" type="button" key={topic.id} onClick={() => setSelected(topic)}>
                          <strong>{topic.title}</strong>
                          <span>{topic.summary}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {fallback.length > 0 && (
                  <>
                    <p className="help-empty" role="status">Não encontrei esse assunto. Tente um destes passos:</p>
                    <div className="help-topics">
                      {fallback.map((topic) => (
                        <button className="help-topic" type="button" key={topic.id} onClick={() => setSelected(topic)}>
                          <strong>{topic.title}</strong>
                          <span>{topic.summary}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <p className="help-foot">Ajuda local: nada é enviado para a internet.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
