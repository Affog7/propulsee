import { emptyProfile, type MasterProfile } from '@propulsee/shared';
import { describe, expect, it } from 'vitest';
import {
  fieldPurpose,
  isFreeQuestion,
  matchingOption,
  planAutofill,
  salaryNumber,
  yesNoOption,
  type AutofillSources,
  type FormField,
} from './autofill';

let next = 0;
function field(patch: Partial<FormField>): FormField {
  return {
    index: next++,
    frameId: 0,
    kind: 'text',
    label: '',
    hints: '',
    autocomplete: '',
    options: [],
    accept: '',
    maxLength: 0,
    writable: true,
    ...patch,
  };
}

const profile: MasterProfile = {
  ...emptyProfile(),
  fullName: 'Camille Martin',
  headline: 'Product Manager · SaaS & IA',
  email: 'camille.martin@mail.fr',
  phone: '+33 6 12 34 56 78',
  location: 'Paris, France',
  links: ['https://linkedin.com/in/camillemartin', 'https://camille.design'],
  experiences: [
    {
      title: 'Lead Product Manager',
      company: 'Orbis',
      location: 'Paris',
      start: '2022',
      end: "Aujourd'hui",
      highlights: [],
    },
  ],
};

const cv = { name: 'Camille-Martin-CV-Acme.pdf', base64: 'Q1Y=' };
const letter = { name: 'Camille-Martin-Lettre-Acme.pdf', base64: 'TA==', text: 'Bonjour,' };
const sources: AutofillSources = { profile, cv, letter };

function valueOf(plan: ReturnType<typeof planAutofill>, target: FormField) {
  return plan.fills.find((f) => f.fill.index === target.index)?.fill;
}

describe('fieldPurpose', () => {
  it.each([
    ['First Name *', 'firstName'],
    ['Prénom', 'firstName'],
    ['Last name', 'lastName'],
    ['Nom de famille', 'lastName'],
    ['Full name', 'name'],
    ['Email address', 'email'],
    ['Téléphone portable', 'phone'],
    ['LinkedIn Profile URL', 'linkedin'],
    ['Portfolio / Website', 'website'],
    ['Current company', 'currentCompany'],
    ['Ville', 'city'],
    ['Location (City)', 'city'],
    ['Expected salary (EUR)', 'salary'],
    ['Prétentions salariales', 'salary'],
    ['Are you legally authorized to work in France?', 'workAuthorization'],
    ['Êtes-vous autorisé à travailler en France ?', 'workAuthorization'],
    ['Will you now or in the future require visa sponsorship?', 'sponsorship'],
  ])('« %s » → %s', (label, purpose) => {
    expect(fieldPurpose(field({ label }))).toBe(purpose);
  });

  it('se fie au libellé avant les attributs techniques', () => {
    expect(fieldPurpose(field({ label: 'Prénom', hints: 'answers[0][text]' }))).toBe('firstName');
    expect(fieldPurpose(field({ hints: 'first_name' }))).toBe('firstName');
    expect(fieldPurpose(field({ hints: 'lastName' }))).toBe('lastName');
  });

  it("utilise l'attribut autocomplete quand il est là", () => {
    expect(fieldPurpose(field({ label: 'Votre nom', autocomplete: 'family-name' }))).toBe(
      'lastName',
    );
    expect(fieldPurpose(field({ autocomplete: 'section-1 email' }))).toBe('email');
  });

  it('reconnaît le CV et la lettre parmi les fichiers', () => {
    expect(fieldPurpose(field({ kind: 'file', label: 'Resume/CV' }))).toBe('resume');
    expect(fieldPurpose(field({ kind: 'file', label: 'Lettre de motivation' }))).toBe(
      'coverLetterFile',
    );
    expect(fieldPurpose(field({ kind: 'file', hints: 'cover_letter' }))).toBe('coverLetterFile');
  });

  it('colle la lettre dans un champ texte « lettre de motivation »', () => {
    expect(fieldPurpose(field({ kind: 'textarea', label: 'Cover letter' }))).toBe(
      'coverLetterText',
    );
  });

  it('laisse les questions libres de côté', () => {
    expect(fieldPurpose(field({ kind: 'textarea', label: 'Why do you want to join Acme?' }))).toBe(
      null,
    );
    expect(fieldPurpose(field({ label: 'How did you hear about us?' }))).toBe(null);
  });
});

describe('planAutofill', () => {
  it('remplit les coordonnées et joint le CV et la lettre', () => {
    const first = field({ label: 'Prénom' });
    const last = field({ label: 'Nom' });
    const email = field({ kind: 'email', label: 'E-mail' });
    const linkedin = field({ kind: 'url', label: 'LinkedIn' });
    const resume = field({ kind: 'file', label: 'CV', accept: '.pdf,.doc' });
    const cover = field({ kind: 'file', label: 'Lettre de motivation' });
    const why = field({ kind: 'textarea', label: 'Pourquoi nous ?' });
    const plan = planAutofill([first, last, email, linkedin, resume, cover, why], sources);

    expect(valueOf(plan, first)).toMatchObject({ value: 'Camille' });
    // « Nom » à côté de « Prénom » : le nom de famille.
    expect(valueOf(plan, last)).toMatchObject({ value: 'Martin' });
    expect(valueOf(plan, email)).toMatchObject({ value: 'camille.martin@mail.fr' });
    expect(valueOf(plan, linkedin)).toMatchObject({
      value: 'https://linkedin.com/in/camillemartin',
    });
    expect(valueOf(plan, resume)).toEqual({ index: resume.index, kind: 'file', ...cv });
    expect(valueOf(plan, cover)).toMatchObject({ kind: 'file', name: letter.name });
    expect(valueOf(plan, why)).toBeUndefined();
    expect(plan).toMatchObject({ fields: 4, cv: true, letter: true, used: [], missing: [] });
  });

  it('met le nom complet dans un champ « Nom » seul', () => {
    const name = field({ label: 'Nom' });
    expect(valueOf(planAutofill([name], sources), name)).toMatchObject({
      value: 'Camille Martin',
    });
  });

  it('joint le CV au seul champ fichier du formulaire, même sans libellé', () => {
    const upload = field({ kind: 'file', label: 'Attach' });
    const plan = planAutofill([upload], sources);
    expect(valueOf(plan, upload)).toMatchObject({ name: cv.name });
    expect(plan.cv).toBe(true);
  });

  it("ne joint pas de PDF là où le site n'en accepte pas", () => {
    const resume = field({ kind: 'file', label: 'Resume', accept: '.doc,.docx' });
    expect(planAutofill([resume], sources).fills).toEqual([]);
  });

  it("n'écrase pas ce que l'utilisateur ou le site a déjà saisi", () => {
    const email = field({ kind: 'email', label: 'Email', writable: false });
    expect(planAutofill([email], sources).fills).toEqual([]);
  });

  it('remplit le formulaire sans les documents encore en préparation', () => {
    const resume = field({ kind: 'file', label: 'Resume' });
    const email = field({ kind: 'email', label: 'Email' });
    const plan = planAutofill([resume, email], { profile, cv: null, letter: null });
    expect(plan.fills.map((f) => f.fill.index)).toEqual([email.index]);
    expect(plan.cv).toBe(false);
  });

  it('demande le salaire et l’autorisation de travail que le profil ne connaît pas', () => {
    const salary = field({ label: 'Expected salary' });
    const auth = field({
      kind: 'select',
      label: 'Authorized to work in France?',
      options: ['Select…', 'Yes', 'No'],
    });
    const plan = planAutofill([salary, auth], sources);
    expect(plan.fills).toEqual([]);
    expect(plan.missing).toEqual(['salary', 'workAuthorization']);
  });

  it('ne demande rien quand le site a déjà la réponse', () => {
    const salary = field({ label: 'Expected salary', writable: false });
    expect(planAutofill([salary], sources).missing).toEqual([]);
  });

  it('réutilise les réponses du profil, à confirmer par l’utilisateur', () => {
    const known: MasterProfile = {
      ...profile,
      answers: { salary: '65 000 – 75 000 €', workAuthorization: 'yes' },
    };
    const salary = field({ kind: 'number', label: 'Expected salary (EUR)' });
    const auth = field({
      kind: 'radio',
      label: 'Authorized to work in France?',
      options: ['Yes', 'No'],
    });
    const sponsor = field({
      kind: 'select',
      label: 'Need visa sponsorship?',
      options: ['', 'Yes', 'No'],
    });
    const autorise = field({ label: 'Êtes-vous autorisé à travailler en France ?' });
    const plan = planAutofill([salary, auth, sponsor, autorise], { ...sources, profile: known });

    expect(valueOf(plan, salary)).toMatchObject({ value: '65000' });
    expect(valueOf(plan, auth)).toMatchObject({ kind: 'option', option: 0 });
    expect(valueOf(plan, sponsor)).toMatchObject({ kind: 'option', option: 2 });
    expect(valueOf(plan, autorise)).toMatchObject({ value: 'Oui' });
    expect(plan.used).toEqual(['salary', 'workAuthorization']);
    expect(plan.missing).toEqual([]);
  });

  it('colle la lettre dans un champ texte prévu pour elle', () => {
    const cover = field({ kind: 'textarea', label: 'Cover letter' });
    const plan = planAutofill([cover], sources);
    expect(valueOf(plan, cover)).toMatchObject({ value: 'Bonjour,' });
    expect(plan.letter).toBe(true);
  });

  it('choisit la ville dans une liste', () => {
    const city = field({ kind: 'select', label: 'City', options: ['—', 'Lyon', 'Paris'] });
    expect(valueOf(planAutofill([city], sources), city)).toMatchObject({ option: 2 });
  });

  it('relève les questions libres sans y écrire', () => {
    const why = field({
      kind: 'textarea',
      label: 'Why do you want to join Acme? *',
      maxLength: 800,
    });
    const heard = field({ label: 'How did you hear about us?', frameId: 3 });
    const plan = planAutofill([why, heard], sources);
    expect(plan.fills).toEqual([]);
    expect(plan.questions).toEqual([
      { frameId: 0, index: why.index, label: 'Why do you want to join Acme?', maxLength: 800 },
      { frameId: 3, index: heard.index, label: 'How did you hear about us?', maxLength: 0 },
    ]);
  });

  it('ne relève pas une question à laquelle l’utilisateur a déjà répondu', () => {
    const why = field({ kind: 'textarea', label: 'Pourquoi nous ?', writable: false });
    expect(planAutofill([why], sources).questions).toEqual([]);
  });

  it('remplit chaque cadre de la page séparément', () => {
    const email = field({ kind: 'email', label: 'Email', frameId: 7 });
    expect(planAutofill([email], sources).fills[0]?.frameId).toBe(7);
  });
});

describe('isFreeQuestion', () => {
  it.each([
    ['textarea', 'Tell us about a project you are proud of', true],
    ['textarea', 'Motivations', true],
    ['text', 'How did you hear about us?', true],
    ['text', 'Quel est votre plus grand accomplissement professionnel', true],
    ['text', 'Code postal', false],
    ['textarea', '', false],
    ['select', 'Why do you want to join Acme?', false],
  ] as const)('%s « %s » → %s', (kind, label, expected) => {
    expect(isFreeQuestion(field({ kind, label }))).toBe(expected);
  });
});

describe('outils de correspondance', () => {
  it('trouve oui et non dans les deux langues', () => {
    expect(yesNoOption(['Sélectionner', 'Oui', 'Non'], true)).toBe(1);
    expect(yesNoOption(['Yes, I am', 'No, I am not'], false)).toBe(1);
    expect(yesNoOption(['Peut-être'], true)).toBe(-1);
  });

  it('trouve un choix sans tenir compte des accents ni de la casse', () => {
    expect(matchingOption(['Montréal', 'Paris'], 'montreal')).toBe(0);
    expect(matchingOption(['Paris, France'], 'Paris')).toBe(0);
    expect(matchingOption(['Lyon'], 'Paris')).toBe(-1);
  });

  it('extrait le premier montant du salaire', () => {
    expect(salaryNumber('65 000 – 75 000 €')).toBe('65000');
    expect(salaryNumber('70k€')).toBe('70000');
    expect(salaryNumber('à discuter')).toBe('');
  });
});
