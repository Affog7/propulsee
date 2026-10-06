import type { ApplicationAnswers, FreeQuestion, MasterProfile } from '@propulsee/shared';
import type { FieldFill, RawFormField } from './form-fields';

/** Ce qu'un champ du formulaire demande. */
export type FieldPurpose =
  | 'fullName'
  /** « Nom » seul : le nom de famille si le formulaire demande aussi le prénom. */
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'city'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'website'
  | 'currentCompany'
  | 'currentTitle'
  | 'resume'
  | 'coverLetterFile'
  | 'coverLetterText'
  | 'salary'
  | 'workAuthorization'
  | 'sponsorship';

/** Champ d'un cadre de l'onglet (le formulaire est parfois dans une iframe). */
export interface FormField extends RawFormField {
  frameId: number;
}

export interface FrameFill {
  frameId: number;
  fill: FieldFill;
}

/** Document prêt à joindre, en base64 (seul format que `executeScript` transmet). */
export interface AttachedFile {
  name: string;
  base64: string;
}

export interface AutofillSources {
  profile: MasterProfile;
  cv: AttachedFile | null;
  letter: (AttachedFile & { text: string }) | null;
}

export type AnswerKey = keyof ApplicationAnswers;

/** Question libre repérée dans le formulaire, à laquelle le panneau propose une réponse. */
export interface FreeQuestionField extends FreeQuestion {
  frameId: number;
  index: number;
}

export interface AutofillPlan {
  fills: FrameFill[];
  /** Champs remplis (fichiers exceptés). */
  fields: number;
  cv: boolean;
  letter: boolean;
  /** Réponses du profil utilisées : l'utilisateur les confirme avant d'envoyer. */
  used: AnswerKey[];
  /** Questions du formulaire auxquelles le profil ne sait pas encore répondre. */
  missing: AnswerKey[];
  /** Questions libres laissées vides : le panneau en rédige les réponses, puis les insère. */
  questions: FreeQuestionField[];
}

/** Minuscules, sans accents ni ponctuation : `first_name` → `first name`. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-[\]().:*?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const AUTOCOMPLETE: Record<string, FieldPurpose> = {
  name: 'fullName',
  'given-name': 'firstName',
  'family-name': 'lastName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'address-level2': 'city',
  organization: 'currentCompany',
  'organization-title': 'currentTitle',
  url: 'website',
};

/** Du plus précis au plus général : « LinkedIn URL » est un lien LinkedIn avant d'être un site. */
const RULES: [RegExp, FieldPurpose][] = [
  [/sponsor|visa|parrainage/, 'sponsorship'],
  [
    /authori[sz]|eligib|right to work|work permit|permis de travail|droit de travail|autorise?e? a travailler|autorisation de travail/,
    'workAuthorization',
  ],
  [/salar|remuneration|compensation|pretention|expected pay|desired pay|\bpackage\b/, 'salary'],
  [/linkedin/, 'linkedin'],
  [/github/, 'github'],
  [/portfolio|website|site web|site internet|personal site|\bblog\b|\burls?\b/, 'website'],
  [/e ?mail|courriel/, 'email'],
  [/phone|telephone|mobile|portable|\btel\b/, 'phone'],
  [/first name|given name|prenom|\bfname\b|forename/, 'firstName'],
  [/last name|surname|family name|nom de famille|\blname\b/, 'lastName'],
  [
    /(current|present|recent) (company|employer)|(entreprise|employeur|societe) actuel|^(company|organi[sz]ation)( name)?$|^org$|employeur/,
    'currentCompany',
  ],
  [
    /(current|present) (job )?(title|role|position)|job title|poste actuel|fonction actuelle/,
    'currentTitle',
  ],
  [/\bcity\b|\bville\b|\btown\b/, 'city'],
  [/\blocation|localisation|address|adresse|where are you based|lieu de residence/, 'location'],
  [/full name|nom complet|your name|nom et prenom|nom prenom|^name$|^nom$/, 'name'],
];

function ruleFor(text: string): FieldPurpose | null {
  const t = normalize(text);
  if (!t) return null;
  return RULES.find(([pattern]) => pattern.test(t))?.[1] ?? null;
}

/** Reconnaît ce que demande un champ, ou `null` s'il n'est pas pour nous (question libre…). */
export function fieldPurpose(field: RawFormField): FieldPurpose | null {
  if (field.kind === 'file') {
    const t = normalize(`${field.label} ${field.hints.replace(/([a-z])([A-Z])/g, '$1 $2')}`);
    if (/cover|lettre|motivation|letter/.test(t)) return 'coverLetterFile';
    if (/resume|\bcv\b|curriculum/.test(t)) return 'resume';
    return null;
  }
  const byAutocomplete = AUTOCOMPLETE[field.autocomplete.split(/\s+/).at(-1) ?? ''];
  if (byAutocomplete) return byAutocomplete;
  if (field.kind === 'textarea') {
    const t = normalize(`${field.label} ${field.hints}`);
    if (/cover letter|lettre|motivation|message/.test(t)) return 'coverLetterText';
  }
  // Le libellé d'abord : les `name` techniques (« answers[0] ») trompent plus qu'ils n'aident.
  // `firstName` → `first Name` : seulement pour les attributs, « LinkedIn » reste un mot.
  const purpose = ruleFor(field.label) ?? ruleFor(field.hints.replace(/([a-z])([A-Z])/g, '$1 $2'));
  if (field.kind === 'email') return 'email';
  if (field.kind === 'tel') return 'phone';
  return purpose;
}

/**
 * Question libre : une zone de texte, ou un champ d'une ligne dont le libellé est une vraie
 * question (« How did you hear about us? »). Un champ sans libellé ne se devine pas.
 */
export function isFreeQuestion(field: RawFormField): boolean {
  const label = field.label.trim();
  if (label.length < 6) return false;
  if (field.kind === 'textarea') return true;
  if (field.kind !== 'text') return false;
  return label.includes('?') || normalize(label).split(' ').length >= 6;
}

function isFrench(text: string): boolean {
  return /\b(vous|votre|etes|travail\w*|autorise\w*|pays|besoin)\b/.test(normalize(text));
}

/** Le choix « oui » ou « non » d'une liste, ou `-1`. */
export function yesNoOption(options: string[], yes: boolean): number {
  const pattern = yes ? /^(yes|oui)\b/ : /^(no|non)\b/;
  return options.findIndex((o) => pattern.test(normalize(o)));
}

/** Le choix qui correspond à `value` (« Paris » dans « Paris, France »), ou `-1`. */
export function matchingOption(options: string[], value: string): number {
  const v = normalize(value);
  if (!v) return -1;
  const exact = options.findIndex((o) => normalize(o) === v);
  if (exact !== -1) return exact;
  return options.findIndex((o) => {
    const n = normalize(o);
    return n.length > 1 && (n.includes(v) || v.includes(n));
  });
}

/** Premier montant d'un texte : « 65 000 – 75 000 € » → « 65000 », « 70k » → « 70000 ». */
export function salaryNumber(salary: string): string {
  const match = /(\d[\d\s.,']*)(k\b)?/i.exec(salary);
  if (!match?.[1]) return '';
  const digits = match[1].replace(/[\s.,']/g, '');
  return match[2] ? String(Number(digits) * 1000) : digits;
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

function profileLinks(profile: MasterProfile) {
  const find = (pattern: RegExp) => profile.links.find((l) => pattern.test(l)) ?? '';
  const linkedin = find(/linkedin\.com/i);
  const github = find(/github\.com/i);
  const other = profile.links.find((l) => l !== linkedin && l !== github) ?? '';
  return { linkedin, github, website: other || github || linkedin };
}

function acceptsPdf(accept: string): boolean {
  return !accept || /pdf|\*/.test(accept);
}

/** Valeur texte du profil pour un champ, `''` si le profil ne la connaît pas. */
function textValue(purpose: FieldPurpose, field: RawFormField, profile: MasterProfile): string {
  const { first, last } = splitName(profile.fullName);
  const links = profileLinks(profile);
  const [current] = profile.experiences;
  const auth = profile.answers.workAuthorization;
  const yesNo = (yes: boolean) => {
    const fr = isFrench(field.label);
    if (yes) return fr ? 'Oui' : 'Yes';
    return fr ? 'Non' : 'No';
  };
  switch (purpose) {
    case 'fullName':
    case 'name':
      return profile.fullName;
    case 'firstName':
      return first;
    case 'lastName':
      return last;
    case 'email':
      return profile.email;
    case 'phone':
      return profile.phone;
    case 'city':
      return profile.location.split(',')[0]?.trim() ?? '';
    case 'location':
      return profile.location;
    case 'linkedin':
      return links.linkedin;
    case 'github':
      return links.github;
    case 'website':
      return links.website;
    case 'currentCompany':
      return current?.company ?? '';
    case 'currentTitle':
      return current?.title || profile.headline;
    case 'salary':
      return field.kind === 'number'
        ? salaryNumber(profile.answers.salary)
        : profile.answers.salary;
    case 'workAuthorization':
      return auth ? yesNo(auth === 'yes') : '';
    case 'sponsorship':
      return auth ? yesNo(auth === 'no') : '';
    default:
      return '';
  }
}

/**
 * Ce qu'on écrit dans chaque champ. Les questions libres sont seulement relevées : leurs
 * réponses sont rédigées dans le panneau (`use-free-answers.ts`). On ne touche pas aux cases à
 * cocher : les déclarations obligatoires ne sont cochées qu'au clic d'envoi (`form-submit.ts`).
 */
export function planAutofill(fields: FormField[], sources: AutofillSources): AutofillPlan {
  const { profile, cv, letter } = sources;
  const purposes = fields.map(fieldPurpose);
  const asksFirstName = purposes.includes('firstName');
  const hasResumeField = purposes.includes('resume');
  // Un seul champ fichier sans libellé clair : c'est le CV.
  const files = fields.filter((f) => f.kind === 'file');
  const plan: AutofillPlan = {
    fills: [],
    fields: 0,
    cv: false,
    letter: false,
    used: [],
    missing: [],
    questions: [],
  };
  const flag = (list: AnswerKey[], key: AnswerKey) => {
    if (!list.includes(key)) list.push(key);
  };

  fields.forEach((field, i) => {
    let purpose = purposes[i] ?? null;
    if (!purpose && field.kind === 'file' && !hasResumeField && files[0] === field) {
      purpose = 'resume';
    }
    if (purpose === 'name' && asksFirstName) purpose = 'lastName';
    if (!purpose) {
      if (field.writable && isFreeQuestion(field)) {
        const { frameId, index, maxLength } = field;
        // « Pourquoi nous ? * » : l'astérisque des champs obligatoires n'apporte rien ici.
        const label = field.label.replace(/\s*\*+$/, '');
        plan.questions.push({ frameId, index, label, maxLength });
      }
      return;
    }

    const answer: AnswerKey | null =
      purpose === 'salary'
        ? 'salary'
        : purpose === 'workAuthorization' || purpose === 'sponsorship'
          ? 'workAuthorization'
          : null;
    if (answer && !profile.answers[answer]) {
      // Le site a déjà la réponse (champ prérempli) : rien à demander.
      if (field.writable) flag(plan.missing, answer);
      return;
    }
    if (!field.writable) return;

    const push = (fill: FieldFill) => plan.fills.push({ frameId: field.frameId, fill });

    if (purpose === 'resume' || purpose === 'coverLetterFile') {
      const file = purpose === 'resume' ? cv : letter;
      if (!file || !acceptsPdf(field.accept)) return;
      push({ index: field.index, kind: 'file', name: file.name, base64: file.base64 });
      if (purpose === 'resume') plan.cv = true;
      else plan.letter = true;
      return;
    }

    if (purpose === 'coverLetterText') {
      if (!letter?.text) return;
      push({ index: field.index, kind: 'value', value: letter.text });
      plan.letter = true;
      plan.fields++;
      return;
    }

    const value = textValue(purpose, field, profile);
    if (!value) return;
    if (field.kind === 'select' || field.kind === 'radio') {
      const auth = profile.answers.workAuthorization;
      const option =
        purpose === 'workAuthorization'
          ? yesNoOption(field.options, auth === 'yes')
          : purpose === 'sponsorship'
            ? yesNoOption(field.options, auth === 'no')
            : matchingOption(field.options, value);
      if (option === -1) return;
      push({ index: field.index, kind: 'option', option });
    } else {
      push({ index: field.index, kind: 'value', value });
    }
    plan.fields++;
    if (answer) flag(plan.used, answer);
  });

  return plan;
}
