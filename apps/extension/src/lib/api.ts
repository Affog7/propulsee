import type { HealthResponse } from '@propulsee/shared';

/** État de l'API, ou `null` si elle est injoignable. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${__API_URL__}/health`, { signal });
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}
