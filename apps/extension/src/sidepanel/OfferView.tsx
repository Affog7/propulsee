import type { JobAnalysis, JobOffer } from '@propulsee/shared';
import { JOB_SITES, JOB_SITE_INFO } from '../lib/job-sites';
import type { ActiveJobOffer } from './use-active-job-offer';
import type { OfferAnalysis } from './use-offer-analysis';

interface Props {
  state: ActiveJobOffer;
  analysis: OfferAnalysis;
  /** Sans profil, on ne dit pas ce qui manque au profil. */
  hasProfile: boolean;
}

function initial(text: string | undefined): string {
  return text?.trim().charAt(0).toUpperCase() || '✦';
}

export function JobCard({ offer }: { offer: JobOffer }) {
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

function AnalysisProgress() {
  return (
    <ul className="readlist" aria-live="polite">
      <li>
        <span className="read-text">
          <b>Offre lue</b>
          <small>Description complète</small>
        </span>
        <span className="tick" aria-hidden="true">
          ✓
        </span>
      </li>
      <li>
        <span className="read-text">
          <b>Analyse de l’offre</b>
          <small>Missions, compétences clés, attentes</small>
        </span>
        <span className="spinner" aria-hidden="true" />
      </li>
    </ul>
  );
}

function AnalysisCard({ analysis, hasProfile }: { analysis: JobAnalysis; hasProfile: boolean }) {
  const missing = hasProfile ? analysis.skills.filter((s) => !s.inProfile) : [];
  return (
    <div className="card analysis">
      {analysis.summary && <p className="analysis-summary">{analysis.summary}</p>}
      {analysis.missions.length > 0 && (
        <>
          <h3 className="cap">Missions</h3>
          <ul className="bullets">
            {analysis.missions.map((mission) => (
              <li key={mission}>{mission}</li>
            ))}
          </ul>
        </>
      )}
      {analysis.skills.length > 0 && (
        <>
          <h3 className="cap">Compétences clés</h3>
          <ul className="skills">
            {analysis.skills.map((skill) => (
              <li
                key={skill.name}
                className={hasProfile && skill.inProfile ? 'skill skill--match' : 'skill'}
                title={hasProfile && skill.inProfile ? 'Dans votre profil' : undefined}
              >
                {hasProfile && skill.inProfile && <span aria-hidden="true">✓ </span>}
                {skill.name}
              </li>
            ))}
          </ul>
          {missing.length > 0 && (
            <p className="note">Pas dans votre profil : {missing.map((s) => s.name).join(', ')}.</p>
          )}
        </>
      )}
      {analysis.expectations.length > 0 && (
        <>
          <h3 className="cap">Attentes</h3>
          <ul className="bullets">
            {analysis.expectations.map((expectation) => (
              <li key={expectation}>{expectation}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function FoundOffer({
  offer,
  siteLabel,
  analysis,
  hasProfile,
}: {
  offer: JobOffer;
  siteLabel: string;
  analysis: OfferAnalysis;
  hasProfile: boolean;
}) {
  switch (analysis.status) {
    case 'analyzing':
      return (
        <section className="onboard" aria-busy="true">
          <div>
            <div className="eyebrow">✦ Préparation</div>
            <h2 className="title">J’analyse l’offre…</h2>
          </div>
          <JobCard offer={offer} />
          <AnalysisProgress />
        </section>
      );

    case 'done':
      return (
        <section className="onboard">
          <div>
            <div className="eyebrow">✦ Offre analysée</div>
            <h2 className="title">L’essentiel de l’offre</h2>
          </div>
          <JobCard offer={offer} />
          <AnalysisCard analysis={analysis.analysis} hasProfile={hasProfile} />
        </section>
      );

    case 'idle':
    case 'error':
      return (
        <section className="onboard">
          <div>
            <div className="eyebrow">✦ Offre détectée sur {siteLabel}</div>
            <h2 className="title">J’ai trouvé une offre</h2>
          </div>
          <JobCard offer={offer} />
          {analysis.status === 'error' && (
            <p className="form-error" role="alert">
              {analysis.error}
            </p>
          )}
        </section>
      );
  }
}

/** Étape « Préparer » : l'offre de l'onglet actif et son analyse, ou comment en ouvrir une. */
export function OfferView({ state, analysis, hasProfile }: Props) {
  switch (state.status) {
    case 'found':
      return (
        <FoundOffer
          key={state.offer.url}
          offer={state.offer}
          siteLabel={JOB_SITE_INFO[state.site].label}
          analysis={analysis}
          hasProfile={hasProfile}
        />
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
