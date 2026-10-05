/** Réponse de `GET /health`. */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
}
