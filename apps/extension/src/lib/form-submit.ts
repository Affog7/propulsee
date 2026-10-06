/**
 * Envoi du formulaire de candidature, au seul clic de l'utilisateur. Comme `form-fields.ts`, ces
 * fonctions sont injectées dans l'onglet par `chrome.scripting.executeScript` : elles ne doivent
 * rien utiliser de l'extérieur (types exceptés), d'où les petites aides répétées dans chacune.
 */

/** État du formulaire d'un cadre de l'onglet, avant ou après l'envoi. */
export interface FormSnapshot {
  /** Champs que Propulsee a remplis et encore présents : le formulaire est toujours là. */
  filled: number;
  /** Un bouton d'envoi est visible. */
  canSubmit: boolean;
  /** Cases obligatoires à cocher (déclarations sur l'honneur, conditions) : leur texte. */
  declarations: string[];
  /** Champs que le site signale en erreur (`aria-invalid`, contrainte non respectée). */
  invalid: string[];
}

export type SubmitOutcome =
  /** Le bouton d'envoi du site a été pressé. */
  | { status: 'clicked' }
  /** Des champs obligatoires sont vides : rien n'est envoyé, le premier est mis en avant. */
  | { status: 'missing'; fields: string[] }
  /** Pas de bouton d'envoi reconnu (formulaire en plusieurs pages, bouton atypique…). */
  | { status: 'no-button' };

/** Lit le formulaire du cadre : rien n'est modifié. */
export function inspectForm(): FormSnapshot {
  const FILLED = 'data-propulsee-filled';
  const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
  const visible = (el: Element) =>
    !(el instanceof HTMLElement) ||
    typeof el.checkVisibility !== 'function' ||
    el.checkVisibility({ visibilityProperty: true });
  const labelOf = (el: HTMLElement) => {
    const ids = el.getAttribute('aria-labelledby');
    const byIds = clean(
      (ids ?? '')
        .split(/\s+/)
        .map((id) => (id ? (document.getElementById(id)?.textContent ?? '') : ''))
        .join(' '),
    );
    const own =
      byIds ||
      clean(el.getAttribute('aria-label')) ||
      clean(Array.from((el as HTMLInputElement).labels ?? [], (l) => l.textContent).join(' '));
    return (own || clean(el.parentElement?.textContent) || clean(el.getAttribute('name'))).slice(
      0,
      240,
    );
  };
  const isRequired = (el: HTMLElement, label: string) =>
    (el as HTMLInputElement).required ||
    el.getAttribute('aria-required') === 'true' ||
    /\*\s*$/.test(label);

  const filled = Array.from(document.querySelectorAll(`[${FILLED}]`)).filter(
    (el) => el.isConnected && (visible(el) || (el as HTMLInputElement).type === 'file'),
  ).length;

  const declarations: string[] = [];
  for (const box of Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  )) {
    if (box.disabled || !visible(box)) continue;
    const label = labelOf(box);
    if (!isRequired(box, label) || (box.checked && !box.hasAttribute(FILLED))) continue;
    declarations.push(label.replace(/\s*\*+$/, ''));
  }

  const invalid: string[] = [];
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>('input, select, textarea, [aria-invalid="true"]'),
  )) {
    if (!visible(el) || (el as HTMLInputElement).type === 'checkbox') continue;
    const wrong =
      el.getAttribute('aria-invalid') === 'true' ||
      ((el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement) &&
        el.willValidate &&
        !el.validity.valid &&
        !el.validity.valueMissing);
    const label = wrong ? labelOf(el).replace(/\s*\*+$/, '') : '';
    if (label && !invalid.includes(label)) invalid.push(label);
  }

  /** Le bouton qui envoie la candidature, dans le formulaire que Propulsee a rempli. */
  const findSubmit = (): HTMLElement | null => {
    const SEND =
      /submit|apply|send|envoyer|postuler|soumettre|candidater|valider ma candidature|transmettre/i;
    const STEP = /next|suivant|continu|previous|pr[ée]c[ée]dent|back|retour|upload|attach|joindre/i;
    const anchor = document.querySelector(`[${FILLED}]`);
    const form = anchor?.closest('form') ?? null;
    const scope: ParentNode = form ?? document;
    const buttons = Array.from(
      scope.querySelectorAll<HTMLElement>(
        'button, input[type="submit"], input[type="button"], [role="button"]',
      ),
    ).filter((b) => visible(b) && !(b as HTMLButtonElement).disabled);
    const text = (b: HTMLElement) =>
      clean(
        b instanceof HTMLInputElement ? b.value : b.textContent || b.getAttribute('aria-label'),
      );
    const isSubmit = (b: HTMLElement) =>
      (b instanceof HTMLButtonElement && b.type === 'submit' && !!b.form) ||
      (b instanceof HTMLInputElement && b.type === 'submit');
    const candidates = buttons.filter((b) => {
      const t = text(b);
      if (STEP.test(t)) return false;
      return SEND.test(t) || (form !== null && isSubmit(b));
    });
    // Le bouton d'envoi est presque toujours le dernier du formulaire ; un libellé explicite
    // (« Envoyer ma candidature ») l'emporte sur un simple bouton de type `submit`.
    const named = candidates.filter((b) => SEND.test(text(b)));
    return (named.length > 0 ? named : candidates).at(-1) ?? null;
  };

  return { filled, canSubmit: findSubmit() !== null, declarations, invalid };
}

/**
 * Coche les déclarations obligatoires puis presse le bouton d'envoi du site, comme
 * l'utilisateur. Si un champ obligatoire est vide, rien n'est envoyé : le premier est montré.
 */
export function submitForm(): SubmitOutcome {
  const FILLED = 'data-propulsee-filled';
  const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
  const visible = (el: Element) =>
    !(el instanceof HTMLElement) ||
    typeof el.checkVisibility !== 'function' ||
    el.checkVisibility({ visibilityProperty: true });
  const labelOf = (el: HTMLElement) => {
    const ids = el.getAttribute('aria-labelledby');
    const byIds = clean(
      (ids ?? '')
        .split(/\s+/)
        .map((id) => (id ? (document.getElementById(id)?.textContent ?? '') : ''))
        .join(' '),
    );
    const own =
      byIds ||
      clean(el.getAttribute('aria-label')) ||
      clean(Array.from((el as HTMLInputElement).labels ?? [], (l) => l.textContent).join(' '));
    return (own || clean(el.parentElement?.textContent) || clean(el.getAttribute('name'))).slice(
      0,
      240,
    );
  };
  const isRequired = (el: HTMLElement, label: string) =>
    (el as HTMLInputElement).required ||
    el.getAttribute('aria-required') === 'true' ||
    /\*\s*$/.test(label);

  const anchor = document.querySelector(`[${FILLED}]`);
  const form = anchor?.closest('form') ?? null;
  const scope: ParentNode = form ?? document;

  // Champs obligatoires encore vides : seuls les attributs du site font foi, pas l'astérisque,
  // pour ne jamais bloquer l'envoi sur une supposition.
  const missing: HTMLElement[] = [];
  const radios = new Set<string>();
  for (const el of Array.from(
    scope.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, select, textarea',
    ),
  )) {
    if (el.disabled) continue;
    if (!el.required && el.getAttribute('aria-required') !== 'true') continue;
    const type = el instanceof HTMLInputElement ? el.type : '';
    if (type === 'checkbox' || type === 'hidden') continue;
    if (type !== 'file' && !visible(el)) continue;
    if (type === 'radio') {
      if (!el.name || radios.has(el.name)) continue;
      radios.add(el.name);
      const group = scope.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${CSS.escape(el.name)}"]`,
      );
      if (!Array.from(group).some((r) => r.checked)) missing.push(el);
      continue;
    }
    const empty =
      type === 'file' ? !(el as HTMLInputElement).files?.length : clean(el.value) === '';
    if (empty) missing.push(el);
  }
  if (missing.length > 0) {
    const first = missing[0];
    first?.scrollIntoView({ block: 'center' });
    first?.focus();
    const fields = missing.map((el) => {
      const group = el.closest('fieldset')?.querySelector('legend');
      return clean(group?.textContent) || labelOf(el).replace(/\s*\*+$/, '');
    });
    return { status: 'missing', fields: Array.from(new Set(fields)) };
  }

  const SEND =
    /submit|apply|send|envoyer|postuler|soumettre|candidater|valider ma candidature|transmettre/i;
  const STEP = /next|suivant|continu|previous|pr[ée]c[ée]dent|back|retour|upload|attach|joindre/i;
  const buttons = Array.from(
    scope.querySelectorAll<HTMLElement>(
      'button, input[type="submit"], input[type="button"], [role="button"]',
    ),
  ).filter((b) => visible(b) && !(b as HTMLButtonElement).disabled);
  const text = (b: HTMLElement) =>
    clean(b instanceof HTMLInputElement ? b.value : b.textContent || b.getAttribute('aria-label'));
  const isSubmit = (b: HTMLElement) =>
    (b instanceof HTMLButtonElement && b.type === 'submit' && !!b.form) ||
    (b instanceof HTMLInputElement && b.type === 'submit');
  const candidates = buttons.filter((b) => {
    const t = text(b);
    if (STEP.test(t)) return false;
    return SEND.test(t) || (form !== null && isSubmit(b));
  });
  const named = candidates.filter((b) => SEND.test(text(b)));
  const button = (named.length > 0 ? named : candidates).at(-1);
  if (!button) return { status: 'no-button' };

  // Les déclarations ne sont cochées qu'à ce clic, jamais avant.
  for (const box of Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  )) {
    if (box.disabled || box.checked || !visible(box)) continue;
    if (!isRequired(box, labelOf(box))) continue;
    box.click();
    box.setAttribute(FILLED, '');
  }
  button.click();
  return { status: 'clicked' };
}
