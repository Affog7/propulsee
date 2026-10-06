// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { inspectForm, submitForm } from './form-submit';

function page(html: string) {
  document.body.innerHTML = html;
}

/** Formulaire tel que Propulsee le laisse : champs remplis marqués, déclarations non cochées. */
function filledForm(extra = '') {
  page(`
    <form>
      <label>Full name <input name="name" value="Camille Martin" data-propulsee-filled="Camille Martin" required></label>
      <label>Email <input type="email" value="camille@mail.fr" data-propulsee-filled="camille@mail.fr"></label>
      ${extra}
      <label><input type="checkbox" name="news"> Send me product news</label>
      <label><input type="checkbox" name="truth" required> I confirm that the information provided is accurate.</label>
      <button type="button">Upload resume</button>
      <button type="submit">Submit application</button>
    </form>`);
}

function submitted(): () => number {
  let count = 0;
  document.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    count++;
  });
  return () => count;
}

beforeEach(() => page(''));

describe('inspectForm', () => {
  it('relève les déclarations obligatoires, pas les cases facultatives', () => {
    filledForm();
    expect(inspectForm()).toEqual({
      filled: 2,
      canSubmit: true,
      declarations: ['I confirm that the information provided is accurate.'],
      invalid: [],
    });
  });

  it('reconnaît une déclaration à son astérisque', () => {
    page(`<label><input type="checkbox"> J’accepte les conditions *</label>`);
    expect(inspectForm().declarations).toEqual(['J’accepte les conditions']);
  });

  it('ne compte plus le formulaire une fois remplacé par la confirmation du site', () => {
    filledForm();
    page('<h1>Application received</h1>');
    expect(inspectForm()).toMatchObject({ filled: 0, canSubmit: false });
  });

  it('lit les champs que le site signale en erreur', () => {
    filledForm(`<label>Phone <input aria-invalid="true" value="06"></label>`);
    expect(inspectForm().invalid).toEqual(['Phone']);
  });
});

describe('submitForm', () => {
  it('coche les déclarations obligatoires puis presse le bouton d’envoi', () => {
    filledForm();
    const count = submitted();
    expect(submitForm()).toEqual({ status: 'clicked' });
    expect(count()).toBe(1);
    const box = (name: string) =>
      document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.checked;
    expect(box('truth')).toBe(true);
    expect(box('news')).toBe(false);
  });

  it('n’envoie rien tant qu’un champ obligatoire est vide', () => {
    filledForm(`<label>Expected salary * <input name="salary" required></label>`);
    const count = submitted();
    expect(submitForm()).toEqual({ status: 'missing', fields: ['Expected salary'] });
    expect(count()).toBe(0);
    expect(document.querySelector<HTMLInputElement>('input[name="truth"]')?.checked).toBe(false);
  });

  it('compte un groupe de boutons radio obligatoire sans choix', () => {
    filledForm(`
      <fieldset><legend>Authorized to work in France?</legend>
        <label><input type="radio" name="auth" value="1" required> Yes</label>
        <label><input type="radio" name="auth" value="0"> No</label>
      </fieldset>`);
    expect(submitForm()).toEqual({
      status: 'missing',
      fields: ['Authorized to work in France?'],
    });
  });

  it('ne presse pas « Suivant » : ce n’est pas l’envoi', () => {
    page(`
      <form>
        <input value="Camille" data-propulsee-filled="Camille">
        <button type="submit">Next</button>
      </form>`);
    const count = submitted();
    expect(submitForm()).toEqual({ status: 'no-button' });
    expect(count()).toBe(0);
  });

  it('trouve le bouton d’envoi hors balise <form>, à son libellé', () => {
    page(`
      <div>
        <input value="Camille" data-propulsee-filled="Camille">
        <button type="button" id="cancel">Cancel</button>
        <div role="button" id="go">Envoyer ma candidature</div>
      </div>`);
    let clicked = '';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, [role]'))) {
      el.addEventListener('click', () => (clicked = el.id));
    }
    expect(submitForm()).toEqual({ status: 'clicked' });
    expect(clicked).toBe('go');
  });
});
