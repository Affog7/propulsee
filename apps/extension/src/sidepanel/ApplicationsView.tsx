import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  applicationsSummary,
  countWords,
  sentDateLabel,
  type ApplicationStatus,
  type SentApplication,
} from '@propulsee/shared';
import { useState } from 'react';
import { downloadSentFile } from '../lib/applications';

interface Props {
  list: SentApplication[];
  /** Candidature à ouvrir d'office (celle de l'offre affichée). */
  focus: string | null;
  copied: boolean;
  onCopy: (text: string) => void;
  onStatus: (url: string, status: ApplicationStatus) => void;
  onForget: (url: string) => void;
  onClose: () => void;
}

function initial(text: string | undefined): string {
  return text?.trim().charAt(0).toUpperCase() || '✦';
}

export function StatusChip({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`status-chip status-chip--${status}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

/** Ce qui est parti pour une candidature : de quoi répondre le jour où le recruteur rappelle. */
function Sent({
  application,
  copied,
  onCopy,
  onStatus,
  onForget,
}: Omit<Props, 'list' | 'focus' | 'onClose'> & { application: SentApplication }) {
  const { offer, cv, letter, answers, confirmed, declarations, fields } = application;
  return (
    <div className="sent">
      <div className="segmented" role="radiogroup" aria-label="Statut de la candidature">
        {APPLICATION_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={application.status === status}
            className="segment"
            onClick={() => onStatus(offer.url, status)}
          >
            {APPLICATION_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <h3 className="cap">Ce que vous avez envoyé{offer.company ? ` à ${offer.company}` : ''}</h3>
      <ul className="sent-files">
        {cv && (
          <li>
            <span className="item-text">
              <b>CV</b>
              <small>{cv.name}</small>
            </span>
            <button type="button" className="item-action" onClick={() => downloadSentFile(cv)}>
              PDF
            </button>
          </li>
        )}
        {letter && (
          <li>
            <span className="item-text">
              <b>Lettre</b>
              <small>{countWords(letter.text)} mots</small>
            </span>
            {letter.text && (
              <button type="button" className="item-action" onClick={() => onCopy(letter.text)}>
                {copied ? 'Copié ✓' : 'Copier'}
              </button>
            )}
            <button type="button" className="item-action" onClick={() => downloadSentFile(letter)}>
              PDF
            </button>
          </li>
        )}
        {fields > 0 && (
          <li>
            <span className="item-text">
              <b>Formulaire</b>
              <small>
                {fields} champ{fields > 1 ? 's' : ''} rempli{fields > 1 ? 's' : ''}
              </small>
            </span>
          </li>
        )}
      </ul>

      {[...confirmed, ...answers].length > 0 && (
        <dl className="sent-answers">
          {[...confirmed, ...answers].map(({ question, answer }, i) => (
            <div key={i}>
              <dt>{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      )}
      {declarations.length > 0 && (
        <p className="hint">
          {declarations.length > 1
            ? `${declarations.length} déclarations du site acceptées.`
            : 'Déclaration du site acceptée.'}
        </p>
      )}

      {offer.description && (
        <details className="sent-offer">
          <summary>Copie de l’offre</summary>
          <p>{offer.description}</p>
        </details>
      )}

      <div className="sent-links">
        <a className="link" href={offer.url} target="_blank" rel="noreferrer">
          Ouvrir l’offre ↗
        </a>
        <button type="button" className="link back" onClick={() => onForget(offer.url)}>
          Retirer de la liste
        </button>
      </div>
    </div>
  );
}

/**
 * Mes candidatures : une liste, pas un tableau de bord. À qui ai-je postulé, et qu'est-ce que je
 * leur ai envoyé ? Tout s'y ajoute seul à l'envoi ; le statut se change d'un geste.
 */
export function ApplicationsView({ list, focus, onClose, ...actions }: Props) {
  const [open, setOpen] = useState<string | null>(focus);
  return (
    <div className="onboard">
      <div>
        <div className="settings-header">
          <button type="button" className="link back" onClick={onClose}>
            ‹ Retour
          </button>
        </div>
        <h2 className="title">Mes candidatures</h2>
        <p className="hint applications-summary">{applicationsSummary(list)}</p>
      </div>

      {list.length === 0 ? (
        <p className="lead">
          Chaque candidature envoyée s’ajoute ici toute seule, avec le CV, la lettre et les réponses
          qui sont partis.
        </p>
      ) : (
        <ul className="applications">
          {list.map((application) => {
            const { offer } = application;
            const expanded = open === offer.url;
            const details = [offer.company, sentDateLabel(application.sentAt)]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={offer.url} className="application" data-open={expanded || undefined}>
                <button
                  type="button"
                  className="application-row"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : offer.url)}
                >
                  <span className="company-logo" aria-hidden="true">
                    {initial(offer.company ?? offer.title)}
                  </span>
                  <span className="jobcard-text">
                    <b title={offer.title}>{offer.title}</b>
                    <small>{details}</small>
                  </span>
                  <StatusChip status={application.status} />
                </button>
                {expanded && <Sent application={application} {...actions} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
