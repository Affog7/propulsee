import type { JobOffer } from '@propulsee/shared';
import type { RawJobPage } from './collect-job-page';

/** Au-delà, la description n'apporte plus rien à l'analyse et alourdit les prompts. */
export const JOB_DESCRIPTION_MAX_LENGTH = 20_000;

/** Offre structurée telle que publiée en JSON-LD (schema.org/JobPosting). */
interface JobPostingFields {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const value =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : +code.slice(1);
      return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
    }
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** Espaces normalisés, lignes conservées, au plus une ligne vide d'affilée. */
function normalizeText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Texte lisible d'un fragment HTML (descriptions JSON-LD), sans DOM. */
export function htmlToText(html: string): string {
  // Certains sites échappent deux fois le HTML de la description (`&lt;p&gt;`).
  const source = /&lt;\/?[a-z]/i.test(html) ? decodeEntities(html) : html;
  const text = source
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>|<\/(p|div|ul|ol|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return normalizeText(decodeEntities(text));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isJobPosting(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  return Array.isArray(type) ? type.includes('JobPosting') : type === 'JobPosting';
}

/** Premier JobPosting d'un document JSON-LD : objet, tableau ou `@graph`. */
function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const node = asRecord(value);
  if (!node) return null;
  if (isJobPosting(node)) return node;
  return node['@graph'] ? findJobPosting(node['@graph']) : null;
}

function placeName(place: unknown): string | undefined {
  const record = asRecord(place);
  if (!record) return asText(place);
  const address = asRecord(record.address);
  if (!address) return asText(record.address) ?? asText(record.name);
  const city = asText(address.addressLocality);
  const country = asRecord(address.addressCountry)
    ? asText(asRecord(address.addressCountry)?.name)
    : asText(address.addressCountry);
  return city ?? asText(address.addressRegion) ?? country;
}

function postingFields(posting: Record<string, unknown>): JobPostingFields {
  const places = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
  const locations = [...new Set(places.map(placeName).filter((name) => name !== undefined))];
  const remote = posting.jobLocationType === 'TELECOMMUTE' ? 'Télétravail' : undefined;
  const organization = asRecord(posting.hiringOrganization);
  const title = asText(posting.title);
  const description = asText(posting.description);
  return {
    title: title && decodeEntities(title),
    company: organization ? asText(organization.name) : asText(posting.hiringOrganization),
    location: locations.length ? locations.join(', ') : remote,
    description: description && htmlToText(description),
  };
}

/** Champs de la première offre JSON-LD lisible de la page. */
export function parseJobPosting(scripts: string[]): JobPostingFields | null {
  for (const script of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(script);
    } catch {
      continue;
    }
    const posting = findJobPosting(data);
    if (posting) return postingFields(posting);
  }
  return null;
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split('\n').find((l) => l.trim());
  return line ? normalizeText(line) : undefined;
}

/** Titre de la balise og:title, sans le nom du site (« Product Manager | LinkedIn »). */
function cleanOgTitle(title: string | undefined): string | undefined {
  return firstLine(title?.replace(/\s+[|–-]\s+[^|–-]+$/, ''));
}

/**
 * Offre à afficher, à partir de ce qu'on a lu sur la page : le JSON-LD est le plus propre pour
 * le titre et l'entreprise, le texte affiché est mieux mis en forme pour la description.
 * `null` si la page ne laisse même pas lire un titre (liste de résultats sans offre ouverte…).
 */
export function buildJobOffer(page: RawJobPage): JobOffer | null {
  const posting = parseJobPosting(page.jsonLd) ?? {};
  const title =
    firstLine(posting.title) ??
    firstLine(page.title) ??
    firstLine(page.heading) ??
    cleanOgTitle(page.ogTitle);
  if (!title) return null;

  const description = page.description ? normalizeText(page.description) : posting.description;
  const offer: JobOffer = { url: page.url, title };
  const company = firstLine(posting.company) ?? firstLine(page.company);
  const location = firstLine(posting.location) ?? firstLine(page.location);
  if (company) offer.company = company;
  if (location) offer.location = location;
  if (description) offer.description = description.slice(0, JOB_DESCRIPTION_MAX_LENGTH);
  return offer;
}
