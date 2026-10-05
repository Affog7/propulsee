import pkg from './package.json';

/** Manifest Chrome MV3, généré au build pour autoriser l'URL de l'API configurée. */
export function buildManifest(apiUrl: string): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: 'Propulsee',
    description: 'Application Copilot : préparer, vérifier et postuler en quelques clics.',
    version: pkg.version,
    action: { default_title: 'Ouvrir Propulsee' },
    side_panel: { default_path: 'sidepanel.html' },
    background: { service_worker: 'background.js', type: 'module' },
    permissions: ['sidePanel'],
    // Une page d'extension avec host_permissions n'est pas soumise au CORS.
    host_permissions: [`${new URL(apiUrl).origin}/*`],
  };
}
