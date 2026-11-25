import { HttpError, requireEnv } from './http.js';

/**
 * Abstraction du fournisseur WhatsApp. L'implémentation actuelle cible OpenWA ;
 * une implémentation Meta Cloud API pourra la remplacer sans toucher au reste.
 */
export interface WhatsappProvider {
  checkNumber(phone: string): Promise<{ exists: boolean; chatId: string | null }>;
  sendText(chatId: string, text: string, idempotencyKey?: string): Promise<{ messageId: string }>;
  sendDocument(opts: {
    chatId: string; base64: string; mimetype: string; filename: string; caption?: string; idempotencyKey?: string;
  }): Promise<{ messageId: string }>;
  sendBulk(items: { chatId: string; text: string }[], batchId: string): Promise<{ batchId: string }>;
  sessionStatus(): Promise<{ status: string; phone?: string; raw: unknown }>;
}

class OpenWaProvider implements WhatsappProvider {
  constructor(private baseUrl: string, private apiKey: string, private sessionId: string) {}

  private async call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const url = `${this.baseUrl}/api/sessions/${encodeURIComponent(this.sessionId)}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { 'X-API-Key': this.apiKey, 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new HttpError(502, 'Passerelle WhatsApp injoignable', 'OPENWA_UNREACHABLE', String(err));
    }
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || data?.error || res.statusText;
      const code = res.status === 429 ? 'OPENWA_RATE_LIMITED'
        : res.status === 400 && /not active|not started|not ready/i.test(String(msg)) ? 'OPENWA_SESSION_DOWN'
        : 'OPENWA_ERROR';
      throw new HttpError(res.status >= 500 || res.status === 429 ? 503 : 502, `WhatsApp : ${msg}`, code, data);
    }
    return data as T;
  }

  async checkNumber(phone: string) {
    const r = await this.call<{ exists: boolean; whatsappId: string | null }>(
      'GET', `/contacts/check/${encodeURIComponent(phone)}`);
    return { exists: !!r?.exists, chatId: r?.whatsappId ?? null };
  }

  async sendText(chatId: string, text: string, idempotencyKey?: string) {
    const r = await this.call<{ messageId: string }>(
      'POST', '/messages/send-text', { chatId, text, linkPreview: false },
      idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {});
    return { messageId: r.messageId };
  }

  async sendDocument(opts: {
    chatId: string; base64: string; mimetype: string; filename: string; caption?: string; idempotencyKey?: string;
  }) {
    const r = await this.call<{ messageId: string }>(
      'POST', '/messages/send-document',
      { chatId: opts.chatId, base64: opts.base64, mimetype: opts.mimetype, filename: opts.filename, caption: opts.caption },
      opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {});
    return { messageId: r.messageId };
  }

  async sendBulk(items: { chatId: string; text: string }[], batchId: string) {
    const r = await this.call<{ batchId: string }>('POST', '/messages/send-bulk', {
      batchId,
      messages: items.map(i => ({ chatId: i.chatId, type: 'text', content: { text: i.text } })),
      // Rythme prudent pour limiter le risque de blocage du numéro
      options: { delayBetweenMessages: 5000, randomizeDelay: true, stopOnError: false },
    });
    return { batchId: r.batchId };
  }

  async sessionStatus() {
    const r = await this.call<any>('GET', '');
    return { status: String(r?.status || 'unknown'), phone: r?.phone || r?.phoneNumber, raw: r };
  }
}

export function getProvider(): WhatsappProvider {
  const base = requireEnv('OPENWA_URL').replace(/\/+$/, '');
  return new OpenWaProvider(base, requireEnv('OPENWA_API_KEY'), requireEnv('OPENWA_SESSION_ID'));
}

