import {
  COVER_LETTER_FORMAT_LABELS,
  countWords,
  type JobOffer,
  type TailoredCv,
} from '@propulsee/shared';
import type { ReactNode } from 'react';
import { JobCard } from './OfferView';
import type { LetterState } from './use-cover-letter';
import type { CvState } from './use-tailored-cv';

interface Props {
  offer: JobOffer | null;
  cv: CvState;
  letter: LetterState;
  hasProfile: boolean;
  downloading: boolean;
  downloadError: string | null;
  letterCopied: boolean;
  onRetryCv: () => void;
  onPreviewCv: () => void;
  onDownloadCv: (tailored: TailoredCv) => void;
  onRetryLetter: () => void;
  onOpenLetter: () => void;
  onCopyLetter: (text: string) => void;
}

export function changesLabel(count: number): string {
  if (count === 0) return 'Identique à votre profil';
  return `Adapté · ${count} changement${count > 1 ? 's' : ''}`;
}

type ItemStatus = 'working' | 'done' | 'error';

export function Item({
  status,
  title,
  detail,
  children,
}: {
  status: ItemStatus;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <li className={status === 'error' ? 'item item--error' : 'item'}>
      {status === 'done' ? (
        <span className="tick" aria-hidden="true">
          ✓
        </span>
      ) : status === 'error' ? (
        <span className="tick tick--error" aria-hidden="true">
          !
        </span>
      ) : (
        <span className="spinner" aria-hidden="true" />
      )}
      <span className="item-text">
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      {children}
    </li>
  );
}

function CvItem({
  cv,
  downloading,
  onRetryCv,
  onPreviewCv,
  onDownloadCv,
}: Pick<Props, 'cv' | 'downloading' | 'onRetryCv' | 'onPreviewCv' | 'onDownloadCv'>) {
  switch (cv.status) {
    case 'done':
      return (
        <Item status="done" title="CV" detail={changesLabel(cv.tailored.changes.length)}>
          <button type="button" className="item-action" onClick={onPreviewCv}>
            Aperçu
          </button>
          <button
            type="button"
            className="item-action"
            disabled={downloading}
            onClick={() => onDownloadCv(cv.tailored)}
          >
            {downloading ? 'PDF…' : 'PDF'}
          </button>
        </Item>
      );
    case 'error':
      return (
        <Item status="error" title="CV" detail={cv.error}>
          <button type="button" className="item-action" onClick={onRetryCv}>
            Réessayer
          </button>
        </Item>
      );
    default:
      return <Item status="working" title="CV" detail="J’adapte votre CV à l’offre…" />;
  }
}

function LetterItem({
  letter,
  letterCopied,
  onRetryLetter,
  onOpenLetter,
  onCopyLetter,
}: Pick<Props, 'letter' | 'letterCopied' | 'onRetryLetter' | 'onOpenLetter' | 'onCopyLetter'>) {
  switch (letter.status) {
    case 'done': {
      const { format, text } = letter.letter;
      const title = format === 'message' ? 'Message recruteur' : 'Lettre';
      const detail =
        format === 'message'
          ? `${countWords(text)} mots`
          : `${COVER_LETTER_FORMAT_LABELS[format]} · ${countWords(text)} mots`;
      return (
        <Item status="done" title={title} detail={detail}>
          <button type="button" className="item-action" onClick={onOpenLetter}>
            Aperçu
          </button>
          <button type="button" className="item-action" onClick={() => onCopyLetter(text)}>
            {letterCopied ? 'Copié ✓' : 'Copier'}
          </button>
        </Item>
      );
    }
    case 'error':
      return (
        <Item status="error" title="Lettre" detail={letter.error}>
          <button type="button" className="item-action" onClick={onRetryLetter}>
            Réessayer
          </button>
        </Item>
      );
    case 'idle':
    case 'unavailable':
      return null;
    default:
      return <Item status="working" title="Lettre" detail="J’écris votre lettre…" />;
  }
}

/** Étape « Vérifier » : ce qui a été préparé pour l'offre, à relire, copier ou télécharger. */
export function VerifyView({ offer, cv, letter, hasProfile, downloadError, ...actions }: Props) {
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
            ? 'Lancez la préparation : j’analyse l’offre, puis j’adapte votre CV et votre lettre.'
            : 'Créez d’abord votre profil : j’en tire un CV et une lettre adaptés à chaque offre.'}
        </p>
      </section>
    );
  }

  const statuses = [cv.status, letter.status];
  const ready = statuses.every((s) => s === 'done' || s === 'idle');
  const working = statuses.some((s) => s === 'loading' || s === 'tailoring' || s === 'writing');
  return (
    <section className="onboard" aria-busy={working}>
      {ready && (
        <span className="big-tick" aria-hidden="true">
          <span>✓</span>
        </span>
      )}
      <div>
        <div className="eyebrow">✦ {[offer.title, offer.company].filter(Boolean).join(' · ')}</div>
        <h2 className="title">
          {ready
            ? 'J’ai préparé votre candidature.'
            : working
              ? 'Je prépare votre candidature…'
              : 'Votre candidature'}
        </h2>
      </div>
      <ul className="items" aria-live="polite">
        <CvItem cv={cv} {...actions} />
        <LetterItem letter={letter} {...actions} />
      </ul>
      {downloadError && (
        <p className="form-error" role="alert">
          {downloadError}
        </p>
      )}
      {ready && <p className="hint">Aucun ajout : tout vient de votre profil et de l’offre.</p>}
    </section>
  );
}
