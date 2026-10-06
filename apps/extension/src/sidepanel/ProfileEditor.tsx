import {
  emptyEducation,
  emptyExperience,
  profileInitials,
  type MasterProfile,
  type ProfileEducation,
  type ProfileExperience,
  type WorkAuthorization,
} from '@propulsee/shared';
import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';

interface Props {
  profile: MasterProfile;
  onChange: (profile: MasterProfile) => void;
}

/** Profil maître éditable sur place : chaque champ se corrige directement, sans mode édition. */
export function ProfileEditor({ profile, onChange }: Props) {
  function set<K extends keyof MasterProfile>(key: K, value: MasterProfile[K]) {
    onChange({ ...profile, [key]: value });
  }

  function setExperience(index: number, patch: Partial<ProfileExperience>) {
    set(
      'experiences',
      profile.experiences.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }

  function setEducation(index: number, patch: Partial<ProfileEducation>) {
    set(
      'education',
      profile.education.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }

  return (
    <div className="profile">
      <section className="card">
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {profileInitials(profile.fullName) || '✦'}
          </span>
          <div className="who-text">
            <input
              className="qi qi-name"
              aria-label="Nom complet"
              placeholder="Prénom Nom"
              value={profile.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
            <input
              className="qi qi-muted"
              aria-label="Titre"
              placeholder="Titre, ex. Product Manager · SaaS"
              value={profile.headline}
              onChange={(e) => set('headline', e.target.value)}
            />
          </div>
        </div>
        <div className="contact">
          <QuietField
            label="E-mail"
            type="email"
            value={profile.email}
            onChange={(v) => set('email', v)}
          />
          <QuietField
            label="Téléphone"
            type="tel"
            value={profile.phone}
            onChange={(v) => set('phone', v)}
          />
          <QuietField label="Ville" value={profile.location} onChange={(v) => set('location', v)} />
        </div>
        <TagInput
          label="Liens"
          placeholder="Ajouter LinkedIn, GitHub, portfolio…"
          values={profile.links}
          onChange={(v) => set('links', v)}
        />
      </section>

      <section className="card">
        <h3 className="cap">Accroche</h3>
        <textarea
          className="qi qi-area"
          aria-label="Accroche"
          placeholder="Deux ou trois phrases qui résument votre parcours."
          value={profile.summary}
          onChange={(e) => set('summary', e.target.value)}
        />
      </section>

      <section className="card">
        <h3 className="cap">Expériences</h3>
        {profile.experiences.map((xp, i) => (
          <div className="entry" key={i}>
            <div className="entry-head">
              <input
                className="qi qi-strong"
                aria-label="Intitulé du poste"
                placeholder="Intitulé du poste"
                value={xp.title}
                onChange={(e) => setExperience(i, { title: e.target.value })}
              />
              <RemoveButton
                label="Supprimer cette expérience"
                onClick={() =>
                  set(
                    'experiences',
                    profile.experiences.filter((_, j) => j !== i),
                  )
                }
              />
            </div>
            <div className="entry-row">
              <input
                className="qi"
                aria-label="Entreprise"
                placeholder="Entreprise"
                value={xp.company}
                onChange={(e) => setExperience(i, { company: e.target.value })}
              />
              <Dates start={xp.start} end={xp.end} onChange={(patch) => setExperience(i, patch)} />
            </div>
            <textarea
              className="qi qi-area qi-small"
              aria-label="Réalisations"
              placeholder="Réalisations, une par ligne"
              value={xp.highlights.join('\n')}
              onChange={(e) => setExperience(i, { highlights: e.target.value.split('\n') })}
            />
          </div>
        ))}
        <button
          type="button"
          className="add"
          onClick={() => set('experiences', [...profile.experiences, emptyExperience()])}
        >
          + Ajouter une expérience
        </button>
      </section>

      <section className="card">
        <h3 className="cap">Compétences</h3>
        <TagInput
          label="Compétences"
          placeholder="Ajouter une compétence"
          values={profile.skills}
          onChange={(v) => set('skills', v)}
        />
        <h3 className="cap">Langues</h3>
        <TagInput
          label="Langues"
          placeholder="Ajouter, ex. Anglais (C1)"
          values={profile.languages}
          onChange={(v) => set('languages', v)}
        />
      </section>

      <section className="card">
        <h3 className="cap">Formation</h3>
        {profile.education.map((ed, i) => (
          <div className="entry" key={i}>
            <div className="entry-head">
              <input
                className="qi qi-strong"
                aria-label="Diplôme"
                placeholder="Diplôme"
                value={ed.degree}
                onChange={(e) => setEducation(i, { degree: e.target.value })}
              />
              <RemoveButton
                label="Supprimer cette formation"
                onClick={() =>
                  set(
                    'education',
                    profile.education.filter((_, j) => j !== i),
                  )
                }
              />
            </div>
            <div className="entry-row">
              <input
                className="qi"
                aria-label="École"
                placeholder="École"
                value={ed.school}
                onChange={(e) => setEducation(i, { school: e.target.value })}
              />
              <Dates start={ed.start} end={ed.end} onChange={(patch) => setEducation(i, patch)} />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="add"
          onClick={() => set('education', [...profile.education, emptyEducation()])}
        >
          + Ajouter une formation
        </button>
      </section>

      <section className="card">
        <h3 className="cap">Candidatures</h3>
        <div className="contact contact--answers">
          <QuietField
            label="Prétentions salariales"
            value={profile.answers.salary}
            onChange={(v) => set('answers', { ...profile.answers, salary: v })}
          />
          <label className="qfield">
            <span>Autorisé·e à travailler</span>
            <select
              className="qi"
              value={profile.answers.workAuthorization}
              onChange={(e) =>
                set('answers', {
                  ...profile.answers,
                  workAuthorization: e.target.value as WorkAuthorization,
                })
              }
            >
              <option value="">—</option>
              <option value="yes">Oui</option>
              <option value="no">Non</option>
            </select>
          </label>
        </div>
        <p className="hint">
          Je vous les demande au premier formulaire qui en a besoin, puis je les réutilise.
        </p>
      </section>
    </div>
  );
}

function QuietField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="qfield">
      <span>{label}</span>
      <input
        className="qi"
        type={type}
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Dates({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (patch: { start?: string; end?: string }) => void;
}) {
  return (
    <span className="dates">
      <input
        className="qi"
        aria-label="Début"
        placeholder="Début"
        value={start}
        onChange={(e) => onChange({ start: e.target.value })}
      />
      <span aria-hidden="true">–</span>
      <input
        className="qi"
        aria-label="Fin"
        placeholder="Fin"
        value={end}
        onChange={(e) => onChange({ end: e.target.value })}
      />
    </span>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      ×
    </button>
  );
}

/** Liste de pastilles : Entrée ou virgule ajoute, coller une liste ajoute tout d'un coup. */
function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const known = new Set(values.map((v) => v.toLowerCase()));
    const added: string[] = [];
    for (const item of raw.split(/[,;\n]/)) {
      const value = item.trim();
      if (value && !known.has(value.toLowerCase())) {
        known.add(value.toLowerCase());
        added.push(value);
      }
    }
    if (added.length > 0) onChange([...values, ...added]);
    setDraft('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (/[,;\n]/.test(text)) {
      event.preventDefault();
      add(draft + text);
    }
  }

  return (
    <div className="tags" role="group" aria-label={label}>
      {values.map((value) => (
        <span className="tag" key={value}>
          {value}
          <button
            type="button"
            aria-label={`Retirer ${value}`}
            onClick={() => onChange(values.filter((v) => v !== value))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        aria-label={`${label} : ajouter`}
        placeholder={values.length === 0 ? placeholder : 'Ajouter…'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => add(draft)}
      />
    </div>
  );
}
