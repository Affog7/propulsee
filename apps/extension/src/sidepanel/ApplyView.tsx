import type { ApplicationAnswers, JobOffer, WorkAuthorization } from '@propulsee/shared';
import { useState, type FormEvent } from 'react';
import type { AnswerKey } from '../lib/autofill';
import { JobCard } from './OfferView';
import type { AutofillState } from './use-autofill';
import { Item } from './VerifyView';

interface Props {
  offer: JobOffer | null;
  hasProfile: boolean;
  state: AutofillState;
  answers: ApplicationAnswers;
  /** Réponses données (ou corrigées) dans le panneau : le formulaire est rempli à nouveau. */
  onAnswer: (answers: Partial<ApplicationAnswers>) => void;
}

const AUTH_LABELS: Record<Exclude<WorkAuthorization, ''>, string> = { yes: 'Oui', no: 'Non' };

function fieldsLabel(count: number): string {
  if (count === 0) return 'Aucun champ à remplir';
  return `${count} champ${count > 1 ? 's' : ''} rempli${count > 1 ? 's' : ''}`;
}

/**
 * Questions que le formulaire pose et que le profil ne sait pas encore : posées une seule fois,
 * puis gardées dans le profil. Seule l'autorisation de travail ? Un clic sur Oui ou Non suffit.
 */
function AnswersCard({
  asked,
  answers,
  title,
  onAnswer,
}: {
  asked: AnswerKey[];
  answers: ApplicationAnswers;
  title: string;
  onAnswer: Props['onAnswer'];
}) {
  const [salary, setSalary] = useState(answers.salary);
  const [auth, setAuth] = useState<WorkAuthorization>(answers.workAuthorization);
  const asksSalary = asked.includes('salary');
  const asksAuth = asked.includes('workAuthorization');
  const complete = (!asksSalary || salary.trim() !== '') && (!asksAuth || auth !== '');

  function answer(next: { salary: string; workAuthorization: WorkAuthorization }) {
    const given: Partial<ApplicationAnswers> = {};
    if (asksSalary) given.salary = next.salary.trim();
    if (asksAuth) given.workAuthorization = next.workAuthorization;
    onAnswer(given);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (complete) answer({ salary, workAuthorization: auth });
  }

  return (
    <form className="card ask" onSubmit={submit}>
      <h3 className="cap">{title}</h3>
      {asksSalary && (
        <label className="field">
          <span>Prétentions salariales</span>
          <input
            type="text"
            placeholder="ex. 65 000 – 75 000 € brut annuel"
            value={salary}
            autoFocus
            onChange={(e) => setSalary(e.target.value)}
          />
        </label>
      )}
      {asksAuth && (
        <div className="field">
          <span id="ask-auth">Autorisé·e à travailler dans le pays du poste ?</span>
          <div className="segmented" role="radiogroup" aria-labelledby="ask-auth">
            {(['yes', 'no'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={auth === value}
                className="segment"
                onClick={() => {
                  setAuth(value);
                  // Seule question posée : la réponse suffit, pas de bouton de plus.
                  if (!asksSalary) answer({ salary, workAuthorization: value });
                }}
              >
                {AUTH_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      )}
      {asksSalary && (
        <button type="submit" className="primary" disabled={!complete}>
          Compléter le formulaire
        </button>
      )}
      <p className="hint">Je m’en souviens pour vos prochaines candidatures.</p>
    </form>
  );
}

/** Réponses du profil écrites dans le formulaire : sensibles, l'utilisateur les relit. */
function ConfirmCard({
  used,
  answers,
  onEdit,
}: {
  used: AnswerKey[];
  answers: ApplicationAnswers;
  onEdit: () => void;
}) {
  const auth = answers.workAuthorization;
  return (
    <div className="confirm">
      <h3 className="confirm-title">À vous de confirmer</h3>
      {used.includes('salary') && (
        <div className="confirm-row">
          <span>
            Prétentions salariales
            <small>{answers.salary}</small>
          </span>
          <button type="button" className="item-action" onClick={onEdit}>
            Modifier
          </button>
        </div>
      )}
      {used.includes('workAuthorization') && auth && (
        <div className="confirm-row">
          <span>
            Autorisé·e à travailler dans le pays du poste
            <small>{AUTH_LABELS[auth]}</small>
          </span>
          <button type="button" className="item-action" onClick={onEdit}>
            Modifier
          </button>
        </div>
      )}
    </div>
  );
}

function Filled({
  state,
  answers,
  onAnswer,
}: {
  state: Extract<AutofillState, { status: 'done' }>;
  answers: ApplicationAnswers;
  onAnswer: Props['onAnswer'];
}) {
  const [editing, setEditing] = useState(false);
  const { result, cvName, letterName } = state;
  const asking = result.missing.length > 0;
  return (
    <section className="onboard">
      {!asking && (
        <span className="big-tick" aria-hidden="true">
          <span>✓</span>
        </span>
      )}
      <div>
        <div className="eyebrow">✦ {asking ? 'Presque prêt' : 'Prêt à envoyer'}</div>
        <h2 className="title">
          {asking
            ? result.missing.length > 1
              ? 'Deux réponses et c’est prêt'
              : 'Une dernière réponse'
            : 'Formulaire rempli, à vous de l’envoyer'}
        </h2>
      </div>
      <ul className="items">
        {result.cv && cvName && <Item status="done" title="CV joint" detail={cvName} />}
        {result.letter && (
          <Item status="done" title="Lettre jointe" detail={letterName ?? 'Lettre de motivation'} />
        )}
        <Item
          status={result.fields > 0 ? 'done' : 'error'}
          title="Formulaire"
          detail={fieldsLabel(result.fields)}
        />
      </ul>
      {asking || editing ? (
        <AnswersCard
          // Une nouvelle série de questions repart des réponses du profil.
          key={result.missing.join() || 'edit'}
          asked={asking ? result.missing : result.used}
          answers={answers}
          title={asking ? 'Le formulaire demande' : 'Corriger mes réponses'}
          onAnswer={(given) => {
            setEditing(false);
            onAnswer(given);
          }}
        />
      ) : (
        result.used.length > 0 && (
          <ConfirmCard used={result.used} answers={answers} onEdit={() => setEditing(true)} />
        )
      )}
      <p className="hint">
        Relisez le formulaire, puis envoyez-le vous-même : je n’envoie jamais rien sans vous.
      </p>
    </section>
  );
}

/** Étape « Postuler » : le formulaire de candidature rempli en un clic, jamais envoyé seul. */
export function ApplyView({ offer, hasProfile, state, answers, onAnswer }: Props) {
  if (!offer) {
    return (
      <section className="onboard">
        <div>
          <div className="eyebrow">✦ Postuler</div>
          <h2 className="title">Ouvrez une offre d’emploi</h2>
        </div>
        <p className="lead">J’y prépare votre candidature, puis je remplis le formulaire.</p>
      </section>
    );
  }

  switch (state.status) {
    case 'done':
      return <Filled state={state} answers={answers} onAnswer={onAnswer} />;

    case 'filling':
      return (
        <section className="onboard" aria-busy="true">
          <div>
            <div className="eyebrow">✦ Postuler</div>
            <h2 className="title">Je remplis le formulaire…</h2>
          </div>
          <JobCard offer={offer} />
          <ul className="items" aria-live="polite">
            <Item status="working" title="Formulaire" detail="Coordonnées, CV et lettre" />
          </ul>
        </section>
      );

    case 'empty':
      return (
        <section className="onboard">
          <div>
            <div className="eyebrow">✦ Postuler</div>
            <h2 className="title">Je ne vois pas de formulaire</h2>
          </div>
          <JobCard offer={offer} />
          <p className="lead">
            Cliquez sur « Postuler » sur le site pour ouvrir le formulaire, puis à nouveau sur «
            Remplir le formulaire ».
          </p>
        </section>
      );

    case 'idle':
    case 'error':
      return (
        <section className="onboard">
          <div>
            <div className="eyebrow">✦ Postuler</div>
            <h2 className="title">Je remplis le formulaire pour vous</h2>
          </div>
          <JobCard offer={offer} />
          <p className="lead">
            {hasProfile
              ? 'Ouvrez le formulaire de candidature du site : en un clic, j’y mets vos coordonnées, votre CV et votre lettre.'
              : 'Créez d’abord votre profil : j’en tire vos coordonnées, votre CV et votre lettre.'}
          </p>
          {state.status === 'error' && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
          <p className="hint">Rien ne part sans vous : vous relisez, puis vous envoyez.</p>
        </section>
      );
  }
}
