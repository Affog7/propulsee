/** Morceau de texte d'une page PDF, tel que le renvoie pdf.js (`getTextContent`). */
export interface PdfTextPart {
  str?: string;
  hasEOL?: boolean;
}

/** Recompose le texte d'une page : retours à la ligne conservés, espaces superflus retirés. */
export function joinTextParts(parts: PdfTextPart[]): string {
  let text = '';
  for (const part of parts) {
    if (part.str === undefined) continue;
    text += part.str;
    text += part.hasEOL ? '\n' : ' ';
  }
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
