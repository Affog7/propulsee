import type {
  ApplicationAnswers,
  JobOffer,
  SentAnswer,
  WorkAuthorization,
} from '@propulsee/shared';
import { useState, type FormEvent } from 'react';
import type { AnswerKey } from '../lib/autofill';
import { JobCard } from './OfferView';
import type { AutofillState } from './use-autofill';
import type { FreeAnswersState } from './use-free-answers';
import type { SubmitState } from './use-submit';
import { Item } from './VerifyView';

interface Props {
  offer: JobOffer | null;
  hasProfile: boolean;
  state: AutofillState;
  answers: ApplicationAnswers;
  /** Réponses données (ou corrigées) dans le panneau : le formulaire est rempli à nouveau. */
  onAnswer: (answers: Partial<ApplicationAnswers>) => void;
  free: FreeAnswersActions;
  submit: SubmitState;
  /** Réponse à « Votre candidature est-elle partie ? ». */
  onConfirmSent: (sent: boolean) => void;
  onRefill: () => void;
  onShowApplications: () => void;
}

/** Réponses proposées aux questions libres, et ce qu'on peut en faire. */
export interface FreeAnswersActions {
  state: FreeAnswersState;
  edit: (label: string, text: string) => void;
  rewrite: (label?: string) => void;
}

const AUTH_LABELS: Record<Exclude<WorkAuthorization, ''>, string> = { yes: 'Oui', no: 'Non' };

const SALARY_LABEL = 'Prétentions salariales';
const AUTH_LABEL = 'Autorisé·e à travailler dans le pays du poste';

/** Réponses sensibles parties avec le formulaire, telles que l'utilisateur les a confirmées. */
export function confirmedAnswers(used: AnswerKey[], answers: ApplicationAnswers): SentAnswer[] {
  const auth = answers.workAuthorization;
  return [
    ...(used.includes('salary') && answers.salary
      ? [{ question: SALARY_LABEL, answer: answers.salary }]
      : []),
    ...(used.includes('workAuthorization') && auth
      ? [{ question: AUTH_LABEL, answer: AUTH_LABELS[auth] }]
      : []),
  ];
}

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

/**
 * Ce que l'envoi engage : les réponses sensibles écrites dans le formulaire, et les
 * déclarations du site, cochées seulement au clic d'envoi. Un seul clic confirme et envoie.
 */
function ConfirmCard({
  used,
  declarations,
  answers,
  onEdit,
}: {
  used: AnswerKey[];
  declarations: string[];
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
            {SALARY_LABEL}
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
            {AUTH_LABEL}
            <small>{AUTH_LABELS[auth]}</small>
          </span>
          <button type="button" className="item-action" onClick={onEdit}>
            Modifier
          </button>
        </div>
      )}
      {declarations.map((text) => (
        <div key={text} className="confirm-row">
          <span>
            Déclaration du site
            <small className="confirm-quote">« {text} »</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function AnswerSkeleton() {
  return (
    <div className="qa-skeleton" aria-hidden="true">
      {[100, 94, 62].map((width) => (
        <span key={width} className="skeleton skeleton-line" style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}

/**
 * Questions libres du formulaire : une réponse proposée pour chacune, à partir du profil et de
 * l'offre, déjà insérée et modifiable sur place. Une retouche part avec l'envoi.
 */
function FreeAnswersCard({ free }: { free: FreeAnswersActions }) {
  const { items, error, pending } = free.state;
  const writing = items.some((item) => item.writing);
  return (
    <section className="card ask qa-card" aria-busy={writing || undefined}>
      <h3 className="cap">
        {items.length > 1 ? `${items.length} questions du formulaire` : 'Question du formulaire'}
      </h3>
      {items.map(({ question, text, writing: busy, inserted }) => {
        const over = question.maxLength > 0 && text.length > question.maxLength;
        return (
          <div key={question.label} className="qa">
            <div className="qa-head">
              <span className="qa-question" id={`qa-${question.index}`}>
                {question.label}
                {inserted && (
                  <span className="qa-inserted" title="Insérée dans le formulaire">
                    {' '}
                    ✓
                  </span>
                )}
              </span>
              {!busy && (
                <button
                  type="button"
                  className="link qa-rewrite"
                  onClick={() => free.rewrite(question.label)}
                >
                  {text ? 'Réécrire' : 'Proposer'}
                </button>
              )}
            </div>
            {busy ? (
              <AnswerSkeleton />
            ) : (
              <textarea
                className="qa-text"
                aria-labelledby={`qa-${question.index}`}
                value={text}
                spellCheck
                placeholder="Rien dans votre profil pour y répondre : à vous de l’écrire."
                onChange={(e) => free.edit(question.label, e.target.value)}
              />
            )}
            {!busy && question.maxLength > 0 && (
              <small className={over ? 'qa-count qa-count--over' : 'qa-count'}>
                {text.length} / {question.maxLength}
              </small>
            )}
          </div>
        );
      })}
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          {!writing && items.some((item) => !item.text) && (
            <button type="button" className="link" onClick={() => free.rewrite()}>
              Réessayer
            </button>
          )}
        </p>
      )}
      <p className="hint">
        {writing
          ? 'Tirées de votre profil et de l’offre. Je les insère dès qu’elles sont prêtes.'
          : pending > 0
            ? 'Vos retouches partiront dans le formulaire avec l’envoi.'
            : 'Déjà dans le formulaire. Retouchez-les ici si besoin.'}
      </p>
    </section>
  );
}

/** Ce que l'envoi a donné, quand il n'est pas (encore) parti : quoi faire ensuite. */
function SubmitNotice({
  submit,
  onConfirmSent,
}: {
  submit: SubmitState;
  onConfirmSent: Props['onConfirmSent'];
}) {
  switch (submit.status) {
    case 'missing':
    case 'rejected':
      return (
        <div className="notice" role="alert">
          <b>
            {submit.status === 'missing' ? 'Le site attend un champ' : 'Le site refuse l’envoi'}
          </b>
          <p>
            {submit.status === 'missing' ? 'À compléter : ' : 'Il signale : '}
            {submit.fields.join(', ')}.{' '}
            {submit.status === 'missing'
              ? 'Je vous ai placé sur le premier champ : complétez-le, puis renvoyez.'
              : 'Corrigez sur la page, puis renvoyez.'}
          </p>
        </div>
      );
    case 'unsure':
      return (
        <div className="notice" role="alert">
          <b>Votre candidature est-elle partie ?</b>
          <p>
            {submit.pressed
              ? 'J’ai cliqué sur le bouton d’envoi du site, mais je ne vois pas de confirmation.'
              : 'Je ne trouve pas le bouton d’envoi : envoyez-la depuis la page, puis dites-le-moi.'}
          </p>
          <div className="notice-actions">
            <button type="button" className="secondary" onClick={() => onConfirmSent(false)}>
              Pas encore
            </button>
            <button type="button" className="secondary" onClick={() => onConfirmSent(true)}>
              Oui, envoyée
            </button>
          </div>
        </div>
      );
    default:
      return null;
  }
}

/**
 * Revue finale : tout ce qui va partir sur un seul écran (pièces jointes, champs remplis,
 * réponses aux questions, ce que l'envoi engage). Le bouton du bas confirme et envoie.
 */
function Review({
  state,
  answers,
  onAnswer,
  free,
  submit,
  onConfirmSent,
  onRefill,
}: Omit<Props, 'offer' | 'hasProfile' | 'state'> & {
  state: Extract<AutofillState, { status: 'done' }>;
}) {
  const [editing, setEditing] = useState(false);
  const { result, cvName, letterName, declarations } = state;
  const asking = result.missing.length > 0;
  const questions = free.state.items.length;
  const writing = free.state.items.some((item) => item.writing);
  // Envoi arrêté ou incertain : on le dit en haut, là où l'utilisateur regarde.
  const stopped = ['missing', 'rejected', 'unsure'].includes(submit.status);
  const ready = !asking && !writing && !stopped;
  const inserted = free.state.insertedCount;
  return (
    <section className="onboard">
      {ready && (
        <span className="big-tick" aria-hidden="true">
          <span>✓</span>
        </span>
      )}
      <div>
        <div className="eyebrow">
          ✦ {ready ? 'Prêt à envoyer' : stopped ? 'Pas encore envoyée' : 'Presque prêt'}
        </div>
        <h2 className="title">
          {asking
            ? result.missing.length > 1
              ? 'Deux réponses et c’est prêt'
              : 'Une dernière réponse'
            : writing
              ? questions > 1
                ? 'J’écris vos réponses aux questions…'
                : 'J’écris votre réponse à la question…'
              : stopped
                ? 'Il reste un détail'
                : 'Tout est prêt'}
        </h2>
        {ready && <p className="lead">Vérifiez une dernière fois, puis envoyez.</p>}
      </div>
      <SubmitNotice submit={submit} onConfirmSent={onConfirmSent} />
      <ul className="items">
        {result.cv && cvName && <Item status="done" title="CV joint" detail={cvName} />}
        {result.letter && (
          <Item status="done" title="Lettre jointe" detail={letterName ?? 'Lettre de motivation'} />
        )}
        {(result.fields > 0 || questions === 0) && (
          <Item
            status={result.fields > 0 ? 'done' : 'error'}
            title="Formulaire"
            detail={fieldsLabel(result.fields)}
          />
        )}
        {questions > 0 && (
          <Item
            status={writing ? 'working' : inserted > 0 ? 'done' : 'error'}
            title="Réponses aux questions"
            detail={
              writing
                ? 'Rédaction en cours…'
                : inserted > 1
                  ? `${inserted} insérées`
                  : inserted === 1
                    ? '1 insérée'
                    : 'À écrire'
            }
          />
        )}
      </ul>
      {questions > 0 && <FreeAnswersCard free={free} />}
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
        (result.used.length > 0 || declarations.length > 0) && (
          <ConfirmCard
            used={result.used}
            declarations={declarations}
            answers={answers}
            onEdit={() => setEditing(true)}
          />
        )
      )}
      <p className="hint">
        Je n’envoie rien sans votre clic.{' '}
        <button type="button" className="link" onClick={onRefill}>
          Remplir à nouveau
        </button>
      </p>
    </section>
  );
}

/** Candidature envoyée : c'est fait, place à l'offre suivante. La copie est déjà gardée. */
function Sent({ offer, onShowApplications }: { offer: JobOffer; onShowApplications: () => void }) {
  return (
    <section className="onboard">
      <span className="big-tick" aria-hidden="true">
        <span>✓</span>
      </span>
      <div>
        <div className="eyebrow">✦ Candidature envoyée</div>
        <h2 className="title">C’est fait.</h2>
      </div>
      <JobCard offer={offer} />
      <p className="lead">Ouvrez votre prochaine offre : je prépare la candidature suivante.</p>
      <p className="hint">
        J’ai gardé une copie de ce qui est parti.{' '}
        <button type="button" className="link" onClick={onShowApplications}>
          Voir mes candidatures
        </button>
      </p>
    </section>
  );
}

/** Étape « Postuler » : le formulaire rempli en un clic, puis envoyé au seul clic de l'utilisateur. */
export function ApplyView({ offer, hasProfile, state, ...review }: Props) {
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
      return review.submit.status === 'sent' ? (
        <Sent offer={offer} onShowApplications={review.onShowApplications} />
      ) : (
        <Review state={state} {...review} />
      );

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
