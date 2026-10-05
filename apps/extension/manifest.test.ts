import { describe, expect, it } from 'vitest';
import { buildManifest } from './manifest';

describe('buildManifest', () => {
  it("autorise l'origine de l'API configurée", () => {
    const manifest = buildManifest('https://api.propulsee.example/v1');
    expect(manifest.host_permissions).toEqual(['https://api.propulsee.example/*']);
  });

  it('ouvre le panneau latéral depuis sidepanel.html', () => {
    const manifest = buildManifest('http://localhost:3000');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.side_panel?.default_path).toBe('sidepanel.html');
    expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' });
  });
});
