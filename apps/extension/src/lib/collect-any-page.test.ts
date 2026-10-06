// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { collectAnyPage } from './collect-any-page';

describe('collectAnyPage', () => {
  it('lit la zone principale, le JSON-LD et le bouton « Postuler »', () => {
    const long = 'Vos missions : piloter la roadmap. '.repeat(10);
    document.head.innerHTML = `
      <meta property="og:title" content="Product Manager | Acme">
      <script type="application/ld+json">{"@type":"JobPosting"}</script>`;
    document.body.innerHTML = `
      <nav>Accueil · Blog</nav>
      <main><h1>Product Manager</h1><p>${long}</p><a href="#apply">Postuler</a></main>`;

    const page = collectAnyPage(30_000);
    expect(page.heading).toBe('Product Manager');
    expect(page.ogTitle).toBe('Product Manager | Acme');
    expect(page.jsonLd).toEqual(['{"@type":"JobPosting"}']);
    expect(page.applyAction).toBe(true);
    expect(page.text).toContain('Vos missions');
    expect(page.text).not.toContain('Blog');
  });

  it('lit toute la page sans zone principale, dans la limite donnée', () => {
    document.head.innerHTML = '';
    document.body.innerHTML = `<div>${'Texte de la page. '.repeat(100)}</div><button>Envoyer</button>`;

    const page = collectAnyPage(50);
    expect(page.text).toHaveLength(50);
    expect(page.applyAction).toBe(false);
    expect(page.heading).toBeUndefined();
  });
});
