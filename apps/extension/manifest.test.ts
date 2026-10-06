import { describe, expect, it } from 'vitest';
import { LLM_PROVIDERS, LLM_PROVIDER_INFO } from '@propulsee/shared';
import { LLM_ORIGINS, buildManifest } from './manifest';
import { FORM_SITES } from './src/lib/autofill-tab';

describe('buildManifest', () => {
  it("autorise l'origine de l'API configurée", () => {
    const manifest = buildManifest('https://api.propulsee.example/v1');
    expect(manifest.host_permissions).toContain('https://api.propulsee.example/*');
  });

  it('autorise les fournisseurs de LLM et le stockage des paramètres', () => {
    const manifest = buildManifest('http://localhost:3000');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        'https://api.anthropic.com/*',
        'https://api.openai.com/*',
        'http://localhost:11434/*',
      ]),
    );
  });

  it('autorise exactement les fournisseurs déclarés dans @propulsee/shared', () => {
    const origins = LLM_PROVIDERS.map((p) => new URL(LLM_PROVIDER_INFO[p].baseUrl).origin);
    expect(LLM_ORIGINS).toEqual(origins);
  });

  it("lit les offres des sites d'emploi reconnus", () => {
    const manifest = buildManifest('http://localhost:3000');
    expect(manifest.permissions).toContain('scripting');
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining(['https://*.linkedin.com/*', 'https://*.indeed.com/*']),
    );
  });

  it('ne demande l’accès aux formulaires des autres sites qu’au premier remplissage', () => {
    const manifest = buildManifest('http://localhost:3000');
    expect(manifest.optional_host_permissions).toEqual(FORM_SITES);
    expect(manifest.host_permissions).not.toContain('https://*/*');
  });

  it('ouvre le panneau latéral depuis sidepanel.html', () => {
    const manifest = buildManifest('http://localhost:3000');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.side_panel?.default_path).toBe('sidepanel.html');
    expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' });
  });
});
