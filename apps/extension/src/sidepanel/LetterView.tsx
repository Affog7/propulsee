import {
  COVER_LETTER_FORMATS,
  COVER_LETTER_FORMAT_LABELS,
  countWords,
  type CoverLetterFormat,
} from '@propulsee/shared';
import type { LetterState } from './use-cover-letter';

interface Props {
  state: LetterState;
  format: CoverLetterFormat;
  copied: boolean;
  downloading: boolean;
  downloadError: string | null;
  onFormat: (format: CoverLetterFormat) => void;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  onCopy: (text: string) => void;
  onDownload: () => void;
  onClose: () => void;
}

/** Libellés des onglets, assez courts pour tenir sur une ligne. */
const TABS: Record<CoverLetterFormat, string> = {
  ...COVER_LETTER_FORMAT_LABELS,
  message: 'Message',
};

const TITLES: Record<CoverLetterFormat, string> = {
  short: 'Lettre de motivation',
  classic: 'Lettre de motivation',
  message: 'Message recruteur',
};

function WritingPaper() {
  return (
    <div className="letter-paper" aria-hidden="true">
      {[90, 100, 96, 70, 0, 100, 94, 98, 60, 0, 85, 40].map((width, i) =>
        width ? (
          <span key={i} className="skeleton skeleton-line" style={{ width: `${width}%` }} />
        ) : (
          <span key={i} className="letter-gap" />
        ),
      )}
    </div>
  );
}

/** Lettre ou message recruteur : format, texte modifiable sur place, raisons, export. */
export function LetterView({
  state,
  format,
  copied,
  downloading,
  downloadError,
  onFormat,
  onEdit,
  onRegenerate,
  onCopy,
  onDownload,
  onClose,
}: Props) {
  const letter = state.status === 'done' ? state.letter : null;
  const isMessage = format === 'message';

  return (
    <div className="onboard">
      <div>
        <div className="settings-header">
          <button type="button" className="link back" onClick={onClose}>
            ‹ Retour
          </button>
          {state.status !== 'writing' && (
            <button type="button" className="link" onClick={onRegenerate}>
              Régénérer
            </button>
          )}
        </div>
        <h2 className="title">{TITLES[format]}</h2>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Format">
        {COVER_LETTER_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            className="segment"
            aria-checked={f === format}
            onClick={() => onFormat(f)}
          >
            {TABS[f]}
          </button>
        ))}
      </div>

      {state.status === 'error' && (
        <p className="form-error" role="alert">
          {state.error}{' '}
          <button type="button" className="link" onClick={onRegenerate}>
            Réessayer
          </button>
        </p>
      )}

      {letter ? (
        <>
          <label className="letter-paper">
            <span className="visually-hidden">
              Texte {isMessage ? 'du message' : 'de la lettre'}
            </span>
            <textarea
              className="letter-text"
              value={letter.text}
              spellCheck
              lang={letter.lang}
              onChange={(e) => onEdit(e.target.value)}
            />
          </label>
          <p className="hint">
            {countWords(letter.text)} mots ·{' '}
            {letter.edited ? 'modifiée par vous' : 'modifiable sur place'}
          </p>
          {letter.why.length > 0 && !letter.edited && (
            <>
              <h3 className="cap">Pourquoi {isMessage ? 'il' : 'elle'} fonctionne</h3>
              <ul className="why">
                {letter.why.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        state.status !== 'error' && (
          <>
            <WritingPaper />
            <p className="hint" aria-live="polite">
              J’écris {isMessage ? 'votre message' : 'votre lettre'} à partir de votre profil et de
              l’offre…
            </p>
          </>
        )
      )}

      <div className="sticky-footer">
        {downloadError && (
          <p className="form-error" role="alert">
            {downloadError}
          </p>
        )}
        {letter && isMessage && (
          <button type="button" className="primary" onClick={() => onCopy(letter.text)}>
            {copied ? 'Copié ✓' : 'Copier le message'}
          </button>
        )}
        {letter && !isMessage && (
          <>
            <button type="button" className="primary" disabled={downloading} onClick={onDownload}>
              {downloading ? 'Création du PDF…' : 'Télécharger le PDF'}
            </button>
            <button type="button" className="link footer-link" onClick={() => onCopy(letter.text)}>
              {copied ? 'Texte copié ✓' : 'Copier le texte'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
