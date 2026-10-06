/**
 * Sites d'offres d'emploi reconnus. Ce fichier est aussi chargé par manifest.ts (sous Node) :
 * il ne doit importer que des types.
 */
export const JOB_SITES = ['linkedin', 'indeed', 'wttj'] as const;

export type JobSite = (typeof JOB_SITES)[number];

/** Sélecteurs CSS des champs d'une offre, du plus fiable au plus générique. */
export interface JobSiteSelectors {
  title: string[];
  company: string[];
  location: string[];
  description: string[];
}

interface JobSiteInfo {
  label: string;
  /** Domaine racine : le site et tous ses sous-domaines (fr.indeed.com…). */
  domain: string;
  /** Vrai si l'URL (déjà reconnue comme appartenant au site) affiche une offre. */
  isOffer: (url: URL) => boolean;
  selectors: JobSiteSelectors;
}

export const JOB_SITE_INFO: Record<JobSite, JobSiteInfo> = {
  linkedin: {
    label: 'LinkedIn',
    domain: 'linkedin.com',
    // Page d'une offre, ou liste de résultats avec une offre ouverte à droite.
    isOffer: (url) =>
      /^\/jobs\/view\/[^/]+/.test(url.pathname) ||
      (url.pathname.startsWith('/jobs/') && url.searchParams.has('currentJobId')),
    selectors: {
      title: [
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card__job-title',
        '.top-card-layout__title',
      ],
      company: [
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name',
        '.topcard__org-name-link',
      ],
      location: [
        '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
        '.job-details-jobs-unified-top-card__bullet',
        '.topcard__flavor--bullet',
      ],
      description: [
        '#job-details',
        '.jobs-description__content',
        '.show-more-less-html__markup',
        '.description__text',
      ],
    },
  },
  indeed: {
    label: 'Indeed',
    domain: 'indeed.com',
    // Page d'une offre (`jk`), ou résultats de recherche avec une offre ouverte (`vjk`).
    isOffer: (url) => url.searchParams.has('jk') || url.searchParams.has('vjk'),
    selectors: {
      title: ['[data-testid="jobsearch-JobInfoHeader-title"]', '.jobsearch-JobInfoHeader-title'],
      company: ['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]'],
      location: ['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]'],
      description: ['#jobDescriptionText'],
    },
  },
  wttj: {
    label: 'Welcome to the Jungle',
    domain: 'welcometothejungle.com',
    // /fr/companies/<entreprise>/jobs/<offre>
    isOffer: (url) => /^\/[a-z]{2}\/companies\/[^/]+\/jobs\/[^/]+/.test(url.pathname),
    selectors: {
      title: ['[data-testid="job-metadata-block"] h2', '[data-testid="job-header-title"]'],
      company: ['[data-testid="job-metadata-block"] a[href*="/companies/"] span'],
      location: ['[data-testid="job-metadata-block"] [name="location"] + span'],
      description: ['[data-testid="job-section-description"]'],
    },
  },
};

/** Site du domaine `hostname`, qu'il affiche une offre ou non. */
function siteOf(hostname: string): JobSite | null {
  return (
    JOB_SITES.find((site) => {
      const { domain } = JOB_SITE_INFO[site];
      return hostname === domain || hostname.endsWith(`.${domain}`);
    }) ?? null
  );
}

/** Site d'offres de `url` si la page affiche une offre, `null` sinon. */
export function detectJobSite(url: string | undefined): JobSite | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const site = siteOf(parsed.hostname);
  return site && JOB_SITE_INFO[site].isOffer(parsed) ? site : null;
}

/** Motifs `host_permissions` des sites d'offres, pour lire la page de l'offre. */
export function jobSiteMatches(): string[] {
  return JOB_SITES.map((site) => `https://*.${JOB_SITE_INFO[site].domain}/*`);
}

/** Vrai si `url` est sur un site d'offres connu, qu'elle affiche une offre ou non. */
export function isJobSiteUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return siteOf(new URL(url).hostname) !== null;
  } catch {
    return false;
  }
}
