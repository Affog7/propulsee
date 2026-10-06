/**
 * Lecture et remplissage des champs d'un formulaire de candidature. Ces deux fonctions sont
 * injectées dans l'onglet par `chrome.scripting.executeScript` : Chrome n'en transmet que le code
 * source, elles ne doivent donc rien utiliser de l'extérieur (types exceptés).
 */

export type FormFieldKind =
  'text' | 'email' | 'tel' | 'url' | 'number' | 'textarea' | 'select' | 'radio' | 'file';

/** Champ trouvé sur la page, décrit pour être reconnu (`autofill.ts`). */
export interface RawFormField {
  /** Numéro posé sur l'élément (attribut `data-propulsee-field`) pour le retrouver au remplissage. */
  index: number;
  kind: FormFieldKind;
  /** Libellé lisible : `<label>`, `aria-label`, texte voisin… */
  label: string;
  /** Indices techniques : `name`, `id`, `placeholder`. */
  hints: string;
  autocomplete: string;
  /** Choix d'une liste ou de boutons radio, dans l'ordre de la page. */
  options: string[];
  /** Types de fichiers acceptés (`accept`), pour un champ fichier. */
  accept: string;
  /** Limite de caractères (`maxlength`) d'un champ texte, `0` s'il n'y en a pas. */
  maxLength: number;
  /** Vide, ou encore tel que Propulsee l'a rempli : on peut l'écrire sans rien écraser. */
  writable: boolean;
}

export type FieldFill =
  | { index: number; kind: 'value'; value: string }
  | { index: number; kind: 'option'; option: number }
  | { index: number; kind: 'file'; name: string; base64: string };

/** Champs remplissables de la page (ou du cadre) courante. */
export function collectFormFields(): RawFormField[] {
  const FIELD = 'data-propulsee-field';
  const FILLED = 'data-propulsee-filled';
  const SKIPPED = [
    'hidden',
    'submit',
    'button',
    'reset',
    'image',
    'password',
    'search',
    'checkbox',
    'range',
    'color',
    'date',
    'datetime-local',
    'month',
    'week',
    'time',
  ];

  const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
  const textOf = (el: Element) => clean(el instanceof HTMLElement ? el.innerText : el.textContent);
  const visible = (el: HTMLElement) =>
    typeof el.checkVisibility !== 'function' || el.checkVisibility({ visibilityProperty: true });
  const byIds = (ids: string | null) =>
    clean(
      (ids ?? '')
        .split(/\s+/)
        .map((id) => (id ? (document.getElementById(id)?.textContent ?? '') : ''))
        .join(' '),
    );
  const ownLabel = (el: HTMLElement) => {
    const aria = byIds(el.getAttribute('aria-labelledby')) || clean(el.getAttribute('aria-label'));
    if (aria) return aria;
    const labels = (el as HTMLInputElement).labels;
    return clean(Array.from(labels ?? [], textOf).join(' '));
  };
  /** Texte du plus proche conteneur qui n'englobe que ces éléments : le libellé posé à côté. */
  const nearbyText = (elements: HTMLElement[]) => {
    const first = elements[0];
    let node = first?.parentElement ?? null;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      const inside = node.querySelectorAll('input, select, textarea');
      if (Array.from(inside).some((el) => !elements.includes(el as HTMLElement))) break;
      let text = textOf(node);
      // Une liste déroulante contient le texte de ses choix : on ne garde que le libellé.
      for (const el of elements)
        if (el instanceof HTMLSelectElement) text = text.replace(textOf(el), '');
      text = clean(text);
      if (text) return text.slice(0, 200);
    }
    return '';
  };

  const fields: RawFormField[] = [];
  const groups = new Set<string>();

  const add = (
    elements: HTMLElement[],
    field: Omit<RawFormField, 'index' | 'hints' | 'autocomplete' | 'label'>,
    label: string,
  ) => {
    const el = elements[0];
    if (!el) return;
    const index = fields.length;
    for (const e of elements) e.setAttribute(FIELD, String(index));
    fields.push({
      ...field,
      index,
      label: label || nearbyText(elements) || clean(el.getAttribute('placeholder')),
      hints: clean(
        [el.getAttribute('name'), el.id, el.getAttribute('placeholder')].filter(Boolean).join(' '),
      ),
      autocomplete: clean(el.getAttribute('autocomplete')).toLowerCase(),
    });
  };

  // Numéros d'une lecture précédente : la page a pu changer depuis.
  for (const el of Array.from(document.querySelectorAll(`[${FIELD}]`))) el.removeAttribute(FIELD);

  for (const el of Array.from(document.querySelectorAll('input, select, textarea'))) {
    if (!(el instanceof HTMLElement)) continue;

    if (el instanceof HTMLInputElement) {
      const type = el.type.toLowerCase();
      if (SKIPPED.includes(type) || el.disabled || el.readOnly) continue;
      // Les champs fichier sont souvent masqués derrière un bouton du site.
      if (type !== 'file' && !visible(el)) continue;

      if (type === 'radio') {
        const key =
          el.name || el.closest('fieldset, [role="radiogroup"]')?.id || `radio-${fields.length}`;
        if (groups.has(key)) continue;
        groups.add(key);
        const scope = el.form ?? document;
        const radios = el.name
          ? Array.from(
              scope.querySelectorAll<HTMLInputElement>(
                `input[type="radio"][name="${CSS.escape(el.name)}"]`,
              ),
            )
          : [el];
        const group = el.closest('fieldset, [role="radiogroup"]');
        const legend = group?.querySelector('legend');
        const groupLabel =
          (legend && textOf(legend)) ||
          (group &&
            (byIds(group.getAttribute('aria-labelledby')) ||
              clean(group.getAttribute('aria-label'))));
        const options = radios.map((r) => ownLabel(r) || clean(r.value));
        let label = groupLabel || '';
        if (!label) {
          label = nearbyText(radios);
          for (const option of options) label = label.replace(option, '');
          label = clean(label);
        }
        const checked = radios.find((r) => r.checked);
        add(
          radios,
          {
            kind: 'radio',
            options,
            accept: '',
            maxLength: 0,
            writable: !checked || checked.hasAttribute(FILLED),
          },
          label,
        );
        continue;
      }

      const kinds: Record<string, FormFieldKind> = {
        email: 'email',
        tel: 'tel',
        url: 'url',
        number: 'number',
        file: 'file',
      };
      const kind = kinds[type] ?? 'text';
      add(
        [el],
        {
          kind,
          options: [],
          accept: clean(el.accept).toLowerCase(),
          maxLength: Math.max(el.maxLength, 0),
          writable:
            kind === 'file'
              ? !el.files?.length || el.hasAttribute(FILLED)
              : el.value === '' || el.getAttribute(FILLED) === el.value,
        },
        ownLabel(el),
      );
    } else if (el instanceof HTMLSelectElement) {
      if (el.disabled || !visible(el)) continue;
      const selected = el.options[el.selectedIndex];
      add(
        [el],
        {
          kind: 'select',
          options: Array.from(el.options, (o) => clean(o.text)),
          accept: '',
          maxLength: 0,
          writable: !selected || selected.value === '' || el.getAttribute(FILLED) === el.value,
        },
        ownLabel(el),
      );
    } else if (el instanceof HTMLTextAreaElement) {
      if (el.disabled || el.readOnly || !visible(el)) continue;
      add(
        [el],
        {
          kind: 'textarea',
          options: [],
          accept: '',
          maxLength: Math.max(el.maxLength, 0),
          writable: el.value === '' || el.getAttribute(FILLED) === el.value,
        },
        ownLabel(el),
      );
    }
  }
  return fields;
}

/**
 * Remplit les champs repérés par `collectFormFields`, comme le ferait l'utilisateur : les sites
 * (React, Vue…) reçoivent les mêmes événements qu'à la frappe. Renvoie les numéros remplis.
 */
export function fillFormFields(fills: FieldFill[]): number[] {
  const FIELD = 'data-propulsee-field';
  const FILLED = 'data-propulsee-filled';
  const done: number[] = [];

  const notify = (el: HTMLElement) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur'));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  };

  for (const fill of fills) {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(`[${FIELD}="${fill.index}"]`),
    );
    const el = elements[0];
    if (!el) continue;
    try {
      if (fill.kind === 'file' && el instanceof HTMLInputElement) {
        const binary = atob(fill.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], fill.name, { type: 'application/pdf' }));
        el.files = transfer.files;
        el.setAttribute(FILLED, fill.name);
        notify(el);
      } else if (fill.kind === 'option' && el instanceof HTMLSelectElement) {
        el.selectedIndex = fill.option;
        el.setAttribute(FILLED, el.value);
        notify(el);
      } else if (fill.kind === 'option') {
        const radio = elements[fill.option];
        if (!(radio instanceof HTMLInputElement)) continue;
        for (const r of elements) r.removeAttribute(FILLED);
        // Un clic coche le bouton et prévient le site comme un vrai clic.
        if (!radio.checked) radio.click();
        radio.setAttribute(FILLED, '');
      } else if (
        fill.kind === 'value' &&
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      ) {
        // Le setter natif : les sites React ignorent une valeur posée autrement.
        const proto =
          el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, fill.value);
        else el.value = fill.value;
        el.setAttribute(FILLED, el.value);
        notify(el);
      } else continue;
      done.push(fill.index);
    } catch {
      // Champ qui refuse la valeur (fichier interdit…) : on passe au suivant.
    }
  }
  return done;
}
