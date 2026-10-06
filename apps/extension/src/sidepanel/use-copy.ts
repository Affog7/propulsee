import { useEffect, useState } from 'react';

/** Durée du « Copié ✓ » affiché après une copie. */
const COPIED_MS = 1800;

/** Copie dans le presse-papiers, avec un retour visuel bref. */
export function useCopy(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  function copy(text: string) {
    void navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  return { copied, copy };
}
