// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { collectFormFields, fillFormFields } from './form-fields';

function page(html: string) {
  document.body.innerHTML = html;
}

function byLabel(label: string) {
  const field = collectFormFields().find((f) => f.label === label);
  if (!field) throw new Error(`Champ introuvable : ${label}`);
  return field;
}

beforeEach(() => page(''));

describe('collectFormFields', () => {
  it('lit les libellés, quelle que soit la façon dont le site les pose', () => {
    page(`
      <form>
        <label for="fn">Prénom *</label><input id="fn" name="first_name">
        <label>E-mail <input type="email" name="email"></label>
        <input aria-label="Téléphone" type="tel">
        <span id="city-label">Ville</span><input aria-labelledby="city-label">
        <div class="field"><div>Lien LinkedIn</div><div><input type="url"></div></div>
        <input placeholder="Site web">
      </form>`);
    expect(collectFormFields().map((f) => [f.kind, f.label])).toEqual([
      ['text', 'Prénom *'],
      ['email', 'E-mail'],
      ['tel', 'Téléphone'],
      ['text', 'Ville'],
      ['url', 'Lien LinkedIn'],
      ['text', 'Site web'],
    ]);
    expect(byLabel('Prénom *').hints).toBe('first_name fn');
  });

  it('ignore les champs cachés, désactivés, mots de passe et cases à cocher', () => {
    page(`
      <input type="hidden" name="token">
      <input type="password" aria-label="Mot de passe">
      <input type="checkbox" aria-label="J'accepte">
      <input disabled aria-label="Désactivé">
      <input aria-label="Nom">`);
    expect(collectFormFields().map((f) => f.label)).toEqual(['Nom']);
  });

  it('regroupe les boutons radio en une seule question', () => {
    page(`
      <fieldset>
        <legend>Authorized to work in France?</legend>
        <label><input type="radio" name="auth" value="1"> Yes</label>
        <label><input type="radio" name="auth" value="0"> No</label>
      </fieldset>`);
    const [field] = collectFormFields();
    expect(field).toMatchObject({
      kind: 'radio',
      label: 'Authorized to work in France?',
      options: ['Yes', 'No'],
      writable: true,
    });
  });

  it('donne les choix d’une liste sans les mêler au libellé', () => {
    page(`
      <div><span>Pays</span><select><option value="">Choisir</option><option>France</option></select></div>`);
    expect(collectFormFields()[0]).toMatchObject({
      kind: 'select',
      label: 'Pays',
      options: ['Choisir', 'France'],
      writable: true,
    });
  });

  it("ne propose pas d'écraser une saisie existante", () => {
    page(`<input aria-label="Email" value="moi@exemple.fr">`);
    expect(byLabel('Email').writable).toBe(false);
  });

  it('garde les champs fichier, même masqués derrière un bouton', () => {
    page(`<label>Resume <input type="file" accept=".pdf" style="display:none"></label>`);
    expect(collectFormFields()[0]).toMatchObject({ kind: 'file', accept: '.pdf' });
  });
});

describe('fillFormFields', () => {
  it('remplit les champs et prévient le site comme une vraie saisie', () => {
    page(`<input aria-label="Prénom"><textarea aria-label="Lettre"></textarea>`);
    const [first, letter] = collectFormFields();
    const events: string[] = [];
    document.querySelector('input')?.addEventListener('input', () => events.push('input'));
    document.querySelector('input')?.addEventListener('change', () => events.push('change'));

    const done = fillFormFields([
      { index: first!.index, kind: 'value', value: 'Camille' },
      { index: letter!.index, kind: 'value', value: 'Bonjour,' },
    ]);
    expect(done).toEqual([0, 1]);
    expect(document.querySelector('input')?.value).toBe('Camille');
    expect(document.querySelector('textarea')?.value).toBe('Bonjour,');
    expect(events).toEqual(['input', 'change']);
  });

  it('peut réécrire ce que Propulsee a rempli, pas ce que l’utilisateur a corrigé', () => {
    page(`<input aria-label="Ville">`);
    fillFormFields([{ index: 0, kind: 'value', value: 'Paris' }]);
    expect(byLabel('Ville').writable).toBe(true);
    document.querySelector('input')!.value = 'Lyon';
    expect(byLabel('Ville').writable).toBe(false);
  });

  it('choisit une option et coche un bouton radio', () => {
    page(`
      <select aria-label="Pays"><option value="">—</option><option value="fr">France</option></select>
      <fieldset><legend>Oui ou non</legend>
        <label><input type="radio" name="q" value="y"> Oui</label>
        <label><input type="radio" name="q" value="n"> Non</label>
      </fieldset>`);
    const [country, question] = collectFormFields();
    fillFormFields([
      { index: country!.index, kind: 'option', option: 1 },
      { index: question!.index, kind: 'option', option: 1 },
    ]);
    expect(document.querySelector('select')?.value).toBe('fr');
    expect(document.querySelector<HTMLInputElement>('input[value="n"]')?.checked).toBe(true);
    expect(byLabel('Oui ou non').writable).toBe(true);
  });

  it('ignore un champ disparu entre la lecture et le remplissage', () => {
    page(`<input aria-label="Nom">`);
    collectFormFields();
    page('');
    expect(fillFormFields([{ index: 0, kind: 'value', value: 'Camille' }])).toEqual([]);
  });
});
