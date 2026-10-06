import { CV_SECTION_TITLES, type CvChange, type TailoredCv } from '@propulsee/shared';
import type { ReactNode } from 'react';
import { displayLink } from '../lib/cv-layout';

interface Props {
  tailored: TailoredCv;
  downloading: boolean;
  downloadError: string | null;
  onDownload: () => void;
  onRetailor: () => void;
  onClose: () => void;
}

/** Repère numéroté d'un changement, dans la liste et sur le CV. */
function Marker({ n }: { n: number }) {
  return (
    <span className="cv-marker" aria-label={`Changement ${n}`}>
      {n}
    </span>
  );
}

/** Passage modifié : surligné et précédé de son numéro. */
function Changed({ n, children }: { n: number | undefined; children: ReactNode }) {
  if (n === undefined) return <>{children}</>;
  return (
    <span className="cv-changed">
      <Marker n={n} />
      {children}
    </span>
  );
}

function dates(start: string, end: string): string {
  return [start, end].filter(Boolean).join(' – ');
}

/** Le CV tel qu'il sera exporté, avec les changements repérés. */
function CvPaper({ tailored }: { tailored: TailoredCv }) {
  const { cv, lang, changes } = tailored;
  const titles = CV_SECTION_TITLES[lang];
  const numberOf = (match: (c: CvChange) => boolean) => {
    const index = changes.findIndex(match);
    return index === -1 ? undefined : index + 1;
  };
  const contact = [cv.location, cv.email, cv.phone, ...cv.links.map(displayLink)]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="paper" aria-label="Aperçu du CV">
      <header>
        <div className="paper-name">{cv.fullName}</div>
        {cv.headline && <div className="paper-role">{cv.headline}</div>}
        {contact && <div className="paper-contact">{contact}</div>}
      </header>

      {cv.summary && (
        <>
          <h4>{titles.summary}</h4>
          <p>
            <Changed n={numberOf((c) => c.kind === 'summary')}>{cv.summary}</Changed>
          </p>
        </>
      )}

      {cv.experiences.length > 0 && (
        <>
          <h4>{titles.experience}</h4>
          {cv.experiences.map((e, i) => {
            const n = numberOf((c) => c.kind === 'experience' && c.experienceIndex === i);
            return (
              <div key={i} className="paper-entry">
                <div className="paper-row">
                  <b>
                    <Changed n={n}>{[e.title, e.company].filter(Boolean).join(' — ')}</Changed>
                  </b>
                  <span>{[dates(e.start, e.end), e.location].filter(Boolean).join(' · ')}</span>
                </div>
                {e.highlights.length > 0 && (
                  <ul>
                    {e.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}

      {cv.skills.length > 0 && (
        <>
          <h4>{titles.skills}</h4>
          <p>
            <Changed n={numberOf((c) => c.kind === 'skills')}>{cv.skills.join(' · ')}</Changed>
          </p>
        </>
      )}

      {cv.education.length > 0 && (
        <>
          <h4>{titles.education}</h4>
          {cv.education.map((e, i) => (
            <div key={i} className="paper-row">
              <b>{[e.degree, e.school].filter(Boolean).join(' — ')}</b>
              <span>{dates(e.start, e.end)}</span>
            </div>
          ))}
        </>
      )}

      {cv.languages.length > 0 && (
        <>
          <h4>{titles.languages}</h4>
          <p>{cv.languages.join(' · ')}</p>
        </>
      )}
    </article>
  );
}

/** Aperçu du CV adapté : les changements expliqués, puis le CV lui-même. */
export function CvPreview({
  tailored,
  downloading,
  downloadError,
  onDownload,
  onRetailor,
  onClose,
}: Props) {
  const { changes } = tailored;
  return (
    <div className="onboard">
      <div>
        <div className="settings-header">
          <button type="button" className="link back" onClick={onClose}>
            ‹ Retour
          </button>
          <button type="button" className="link" onClick={onRetailor}>
            Régénérer
          </button>
        </div>
        <h2 className="title">Votre CV adapté</h2>
      </div>

      {changes.length > 0 ? (
        <>
          <p className="hint">
            {changes.length} changement{changes.length > 1 ? 's' : ''} · tous issus de votre profil
          </p>
          <ol className="changes">
            {changes.map((change, i) => (
              <li key={`${change.kind}-${i}`}>
                <Marker n={i + 1} />
                <div>
                  <b>{change.title}</b>
                  {change.detail && <span>{change.detail}</span>}
                  {change.before && <s>{change.before}</s>}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="lead">Votre profil correspond déjà à cette offre : je n’ai rien changé.</p>
      )}
      <p className="note">🛡 Aucun ajout. Chaque ligne vient de votre profil.</p>

      <CvPaper tailored={tailored} />

      <div className="sticky-footer">
        {downloadError && (
          <p className="form-error" role="alert">
            {downloadError}
          </p>
        )}
        <button type="button" className="primary" disabled={downloading} onClick={onDownload}>
          {downloading ? 'Création du PDF…' : 'Télécharger le PDF'}
        </button>
      </div>
    </div>
  );
}
