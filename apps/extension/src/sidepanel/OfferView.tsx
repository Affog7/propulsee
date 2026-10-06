import type { JobOffer } from '@propulsee/shared';
import { JOB_SITES, JOB_SITE_INFO } from '../lib/job-sites';
import type { ActiveJobOffer } from './use-active-job-offer';

interface Props {
  state: ActiveJobOffer;
}

function initial(text: string | undefined): string {
  return text?.trim().charAt(0).toUpperCase() || '✦';
}

function JobCard({ offer }: { offer: JobOffer }) {
  const details = [offer.company, offer.location].filter(Boolean).join(' · ');
  return (
    <div className="jobcard">
      <span className="company-logo" aria-hidden="true">
        {initial(offer.company ?? offer.title)}
      </span>
      <div className="jobcard-text">
        <b title={offer.title}>{offer.title}</b>
        {details && <small>{details}</small>}
      </div>
    </div>
  );
}

function JobCardSkeleton() {
  return (
    <div className="jobcard" aria-hidden="true">
      <span className="company-logo skeleton" />
      <div className="jobcard-text">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line skeleton-line--short" />
      </div>
    </div>
  );
}

/** Étape « Préparer » : l'offre de l'onglet actif, ou comment en ouvrir une. */
export function OfferView({ state }: Props) {
  switch (state.status) {
    case 'found':
      return (
        <section className="onboard" key={state.offer.url}>
          <div>
            <div className="eyebrow">✦ Offre détectée sur {JOB_SITE_INFO[state.site].label}</div>
            <h2 className="title">J’ai trouvé une offre</h2>
          </div>
          <JobCard offer={state.offer} />
        </section>
      );

    case 'reading':
      return (
        <section className="onboard" aria-busy="true">
          <div>
            <div className="eyebrow">✦ {JOB_SITE_INFO[state.site].label}</div>
            <h2 className="title">Je lis l’offre…</h2>
          </div>
          <JobCardSkeleton />
        </section>
      );

    case 'missing':
      return (
        <section className="onboard">
          <div>
            <div className="eyebrow">✦ {JOB_SITE_INFO[state.site].label}</div>
            <h2 className="title">Ouvrez une offre</h2>
          </div>
          <p className="lead">
            Je ne vois pas d’offre sur cette page. Ouvrez-en une, je la lis dès qu’elle s’affiche.
          </p>
        </section>
      );

    case 'none':
      return (
        <section className="onboard">
          <div>
            <div className="eyebrow">✦ En attente d’une offre</div>
            <h2 className="title">Ouvrez une offre d’emploi</h2>
          </div>
          <p className="lead">
            Je la détecte toute seule sur ces sites, puis je prépare votre candidature.
          </p>
          <ul className="sites">
            {JOB_SITES.map((site) => (
              <li key={site}>
                <span className={`company-logo company-logo--${site}`} aria-hidden="true">
                  {initial(JOB_SITE_INFO[site].label)}
                </span>
                {JOB_SITE_INFO[site].label}
              </li>
            ))}
          </ul>
          <p className="hint">Gardez ce panneau ouvert : il suit vos onglets.</p>
        </section>
      );
  }
}
