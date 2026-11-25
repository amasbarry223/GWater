/** Petits utilitaires HTTP pour les fonctions Vercel (signature Web Request/Response). */

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Enveloppe un handler : convertit les HttpError (et erreurs inattendues) en réponses JSON. */
export function handler(fn: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await fn(request);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message, code: err.code, details: err.details }, err.status);
      }
      console.error('[api] erreur inattendue', err);
      return json({ error: 'Erreur interne du serveur' }, 500);
    }
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Corps JSON invalide');
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new HttpError(503, `Configuration manquante : variable ${name}`, 'CONFIG_MISSING');
  return v;
}

