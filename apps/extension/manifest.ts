import pkg from './package.json';
import { jobSiteMatches } from './src/lib/job-sites';

/**
 * Origines des fournisseurs de LLM (voir `LLM_PROVIDER_INFO` dans @propulsee/shared).
 * Recopiées ici car vite.config.ts charge ce fichier sous Node, qui ne lit pas le TypeScript
 * de @propulsee/shared ; un test vérifie que les deux listes restent alignées.
 */
export const LLM_ORIGINS = [
  'https://api.anthropic.com',
  'https://api.openai.com',
  'http://localhost:11434',
];

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
    // `scripting` : lire l'offre ouverte dans l'onglet (titre, entreprise, description).
    permissions: ['sidePanel', 'storage', 'scripting'],
    // Une page d'extension avec host_permissions n'est pas soumise au CORS.
    // Les LLM sont appelés directement depuis l'extension : la clé ne transite pas par l'API.
    host_permissions: [
      `${new URL(apiUrl).origin}/*`,
      ...LLM_ORIGINS.map((origin) => `${origin}/*`),
      // Sites d'offres : détecter l'offre et la lire, sans autre accès aux autres sites.
      ...jobSiteMatches(),
    ],
  };
}
