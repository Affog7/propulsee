/** Offre d'emploi détectée sur la page courante. */
export interface JobOffer {
  url: string;
  title: string;
  company?: string;
  location?: string;
  description?: string;
}
