import {
  LLM_PROVIDER_INFO,
  emptyProfile,
  type LlmSettings,
  type MasterProfile,
} from '@propulsee/shared';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { extractPdfText } from '../lib/pdf';
import { extractProfile, saveProfile } from '../lib/profile';
import { ProfileEditor } from './ProfileEditor';

interface Props {
  llm: LlmSettings;
  /** Profil existant : on l'ouvre en édition. Sinon on commence par l'import du CV. */
  initial: MasterProfile | null;
  onSaved: (profile: MasterProfile) => void;
  onClose: () => void;
}

type Stage =
  | { kind: 'import'; error?: string }
  | { kind: 'reading'; file: File; pages?: number }
  | { kind: 'edit'; fresh: boolean };

/** Délai avant l'enregistrement automatique d'une correction. */
const AUTOSAVE_DELAY_MS = 400;

export function ProfileView({ llm, initial, onSaved, onClose }: Props) {
  const [stage, setStage] = useState<Stage>(
    initial ? { kind: 'edit', fresh: false } : { kind: 'import' },
  );
  const [profile, setProfile] = useState<MasterProfile | null>(initial);
  const [dirty, setDirty] = useState(false);
  const reading = useRef<AbortController | null>(null);
  const llmLabel = LLM_PROVIDER_INFO[llm.provider].label;

  // Chaque correction est enregistrée toute seule : pas de bouton « Enregistrer ».
  useEffect(() => {
    if (!dirty || !profile) return;
    const timer = setTimeout(() => {
      void saveProfile(profile).then(onSaved);
      setDirty(false);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, profile, onSaved]);

  useEffect(() => () => reading.current?.abort(), []);

  async function importCv(file: File) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setStage({ kind: 'import', error: 'Choisissez un CV au format PDF.' });
      return;
    }
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    setStage({ kind: 'reading', file });

    let pdf;
    try {
      pdf = await extractPdfText(file);
    } catch {
      if (!controller.signal.aborted) {
        setStage({ kind: 'import', error: 'Ce fichier PDF est illisible.' });
      }
      return;
    }
    if (controller.signal.aborted) return;
    if (pdf.text.length < 50) {
      setStage({
        kind: 'import',
        error: 'Ce PDF ne contient pas de texte (CV scanné ?). Exportez-le depuis votre éditeur.',
      });
      return;
    }
    setStage({ kind: 'reading', file, pages: pdf.pages });

    const result = await extractProfile(llm, pdf.text, controller.signal);
    if (controller.signal.aborted) return;
    if (!result.ok) {
      setStage({ kind: 'import', error: result.error });
      return;
    }
    // Enregistré tout de suite : fermer le panneau ne fait rien perdre.
    const saved = await saveProfile(result.value);
    setProfile(saved);
    onSaved(saved);
    setStage({ kind: 'edit', fresh: true });
  }

  function cancelReading() {
    reading.current?.abort();
    setStage({ kind: 'import' });
  }

  function fillByHand() {
    setProfile(emptyProfile());
    setDirty(true);
    setStage({ kind: 'edit', fresh: false });
  }

  async function done() {
    if (profile) onSaved(await saveProfile(profile));
    setDirty(false);
    onClose();
  }

  if (stage.kind === 'import') {
    return (
      <ImportStage
        error={stage.error}
        llmLabel={llmLabel}
        canClose={profile !== null}
        onFile={(f) => void importCv(f)}
        onFillByHand={fillByHand}
        onClose={() => setStage({ kind: 'edit', fresh: false })}
      />
    );
  }

  if (stage.kind === 'reading') {
    return (
      <div className="onboard">
        <h2 className="title">Je lis votre parcours…</h2>
        <div className="file">
          <span className="file-badge">PDF</span>
          <span className="file-name">{stage.file.name}</span>
          <span className="file-size">{formatSize(stage.file.size)}</span>
        </div>
        <ul className="readlist">
          <ReadRow
            done={stage.pages !== undefined}
            title="Lecture du PDF"
            detail={stage.pages ? `${stage.pages} page${stage.pages > 1 ? 's' : ''}` : '…'}
          />
          <ReadRow
            done={false}
            pending={stage.pages === undefined}
            title={`Analyse par ${llmLabel}`}
            detail="Identité, expériences, compétences, formation"
          />
        </ul>
        <p className="hint">
          Quelques secondes…{' '}
          <button type="button" className="link" onClick={cancelReading}>
            Annuler
          </button>
        </p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="onboard">
      <div>
        <div className="settings-header">
          <div className="eyebrow">✦ Profil maître</div>
          <button type="button" className="link" onClick={() => setStage({ kind: 'import' })}>
            Remplacer le CV
          </button>
        </div>
        <h2 className="title">{stage.fresh ? 'Voici ce que j’ai compris.' : 'Mon profil'}</h2>
      </div>
      <p className="lead">
        {stage.fresh
          ? 'Corrigez si besoin, c’est enregistré au fur et à mesure.'
          : 'Toute correction est enregistrée au fur et à mesure.'}
      </p>

      <ProfileEditor
        profile={profile}
        onChange={(next) => {
          setProfile(next);
          setDirty(true);
        }}
      />

      <div className="sticky-footer">
        <button type="button" className="primary" onClick={() => void done()}>
          Mon profil est prêt
        </button>
        <p className="hint">
          Salaire, disponibilité, permis : je vous les demanderai quand un formulaire en aura
          besoin.
        </p>
      </div>
    </div>
  );
}

function ImportStage({
  error,
  llmLabel,
  canClose,
  onFile,
  onFillByHand,
  onClose,
}: {
  error?: string;
  llmLabel: string;
  canClose: boolean;
  onFile: (file: File) => void;
  onFillByHand: () => void;
  onClose: () => void;
}) {
  const [over, setOver] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div className="onboard">
      <div className="settings-header">
        <div className="eyebrow">✦ Profil maître</div>
        {canClose && (
          <button type="button" className="link" onClick={onClose}>
            Annuler
          </button>
        )}
      </div>
      <h2 className="title">Commençons par votre parcours.</h2>
      <p className="lead">
        Importez votre CV. Je construis votre profil une seule fois, puis je l’adapte à chaque
        offre.
      </p>

      <label
        className="drop"
        data-over={over || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onFile(file);
          }}
        />
        <span className="drop-icon" aria-hidden="true">
          ↑
        </span>
        <b>Déposez votre CV ici</b>
        <span>ou cliquez pour choisir un PDF</span>
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <p className="hint">
        Pas de CV sous la main ?{' '}
        <button type="button" className="link" onClick={onFillByHand}>
          Remplir à la main
        </button>
      </p>
      <p className="hint">Le texte du CV est envoyé uniquement à votre LLM ({llmLabel}).</p>
    </div>
  );
}

function ReadRow({
  done,
  pending,
  title,
  detail,
}: {
  done: boolean;
  pending?: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li className={pending ? 'is-pending' : undefined}>
      <span className="read-text">
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      {done ? (
        <span className="tick" aria-label="Terminé">
          ✓
        </span>
      ) : pending ? (
        <span className="tick tick--todo" aria-label="À venir" />
      ) : (
        <span className="spinner" aria-label="En cours" />
      )}
    </li>
  );
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} Ko`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}
