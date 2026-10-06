import { LLM_PROVIDER_INFO, type LlmSettings } from '@propulsee/shared';

interface Props {
  llm: LlmSettings;
  onOwnKey: () => void;
  onUseSubscription: () => void;
  onClose: () => void;
}

/** Fin de l'offre de lancement : tout est gratuit jusque-là. */
export const LAUNCH_OFFER_END = '5 avril 2027';

/** Paramètres › Abonnement : l'offre en cours, et l'option « Utiliser ma propre clé ». */
export function SubscriptionView({ llm, onOwnKey, onUseSubscription, onClose }: Props) {
  const ownKey = llm.provider !== 'propulsee';
  const { label } = LLM_PROVIDER_INFO[llm.provider];

  return (
    <section className="settings">
      <div className="settings-header">
        <h2>Abonnement</h2>
        <button type="button" className="link" onClick={onClose}>
          Fermer
        </button>
      </div>

      {ownKey ? (
        <div className="card plan">
          <p className="cap">Votre propre clé · active</p>
          <b className="plan-title">{label}</b>
          <p className="plan-text">
            Sans abonnement : vos demandes partent directement chez {label}
            {llm.model ? ` (${llm.model})` : ''}.
          </p>
          <div className="plan-actions">
            <button type="button" className="item-action" onClick={onOwnKey}>
              Modifier ma clé
            </button>
            <button type="button" className="item-action" onClick={onUseSubscription}>
              Revenir à l’abonnement
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card plan">
            <p className="cap">Offre de lancement · active</p>
            <b className="plan-title">Tout est gratuit jusqu’au {LAUNCH_OFFER_END}</b>
            <p className="plan-text">Rien à régler : préparez vos candidatures dès maintenant.</p>
          </div>
          <button type="button" className="already" onClick={onOwnKey}>
            <span>
              Utiliser ma propre clé
              <small>
                Sans abonnement : branchez votre compte Claude, OpenAI ou un modèle local
              </small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </>
      )}
    </section>
  );
}
