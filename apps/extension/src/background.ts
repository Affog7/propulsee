// Un clic sur l'icône de l'extension ouvre directement le panneau latéral.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => console.error('[propulsee] setPanelBehavior', err));
