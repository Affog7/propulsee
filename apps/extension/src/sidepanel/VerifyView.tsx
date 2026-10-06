import type { JobOffer, TailoredCv } from '@propulsee/shared';
import { JobCard } from './OfferView';
import type { CvState } from './use-tailored-cv';

interface Props {
  offer: JobOffer | null;
  cv: CvState;
  hasProfile: boolean;
  downloading: boolean;
  downloadError: string | null;
  onRetry: () => void;
  onPreview: () => void;
  onDownload: (tailored: TailoredCv) => void;
}

export function changesLabel(count: number): string {
  if (count === 0) return 'Identique à votre profil';
  return `Adapté · ${count} changement${count > 1 ? 's' : ''}`;
}

function CvItem({
  cv,
  downloading,
  onRetry,
  onPreview,
  onDownload,
}: Pick<Props, 'cv' | 'downloading' | 'onRetry' | 'onPreview' | 'onDownload'>) {
  switch (cv.status) {
    case 'done':
      return (
        <li className="item">
          <span className="tick" aria-hidden="true">
            ✓
          </span>
          <span className="item-text">
            <b>CV</b>
            <small>{changesLabel(cv.tailored.changes.length)}</small>
          </span>
          <button type="button" className="item-action" onClick={onPreview}>
            Aperçu
          </button>
          <button
            type="button"
            className="item-action"
            disabled={downloading}
            onClick={() => onDownload(cv.tailored)}
          >
            {downloading ? 'PDF…' : 'PDF'}
          </button>
        </li>
      );
    case 'error':
      return (
        <li className="item item--error">
          <span className="tick tick--error" aria-hidden="true">
            !
          </span>
          <span className="item-text">
            <b>CV</b>
            <small>{cv.error}</small>
          </span>
          <button type="button" className="item-action" onClick={onRetry}>
            Réessayer
          </button>
        </li>
      );
    default:
      return (
        <li className="item">
          <span className="spinner" aria-hidden="true" />
          <span className="item-text">
            <b>CV</b>
            <small>J’adapte votre CV à l’offre…</small>
          </span>
        </li>
      );
  }
}

/** Étape « Vérifier » : ce qui a été préparé pour l'offre, à relire ou télécharger. */
export function VerifyView({ offer, cv, hasProfile, downloadError, ...actions }: Props) {
  if (!offer) {
    return (
      <section className="onboard">
        <div>
          <div className="eyebrow">✦ Vérifier</div>
          <h2 className="title">Ouvrez une offre d’emploi</h2>
        </div>
        <p className="lead">J’y prépare votre candidature, puis vous la vérifiez ici.</p>
      </section>
    );
  }

  if (cv.status === 'unavailable') {
    return (
      <section className="onboard">
        <div>
          <div className="eyebrow">✦ Vérifier</div>
          <h2 className="title">Rien à vérifier pour l’instant</h2>
        </div>
        <JobCard offer={offer} />
        <p className="lead">
          {hasProfile
            ? 'Lancez la préparation : j’analyse l’offre, puis j’adapte votre CV.'
            : 'Créez d’abord votre profil : j’en tire un CV adapté à chaque offre.'}
        </p>
      </section>
    );
  }

  const ready = cv.status === 'done';
  return (
    <section className="onboard" aria-busy={!ready && cv.status !== 'error'}>
      {ready ? (
        <span className="big-tick" aria-hidden="true">
          <span>✓</span>
        </span>
      ) : null}
      <div>
        <div className="eyebrow">✦ {[offer.title, offer.company].filter(Boolean).join(' · ')}</div>
        <h2 className="title">
          {ready
            ? 'J’ai adapté votre CV.'
            : cv.status === 'error'
              ? 'Votre candidature'
              : 'J’adapte votre CV…'}
        </h2>
      </div>
      <ul className="items" aria-live="polite">
        <CvItem cv={cv} {...actions} />
      </ul>
      {downloadError && (
        <p className="form-error" role="alert">
          {downloadError}
        </p>
      )}
      {ready && <p className="hint">Aucun ajout : chaque ligne vient de votre profil.</p>}
    </section>
  );
}
