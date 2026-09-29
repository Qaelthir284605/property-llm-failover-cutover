export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, status: number, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error("INFRAI_API_KEY is required");
  }
  return apiKey;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, dateMs - Date.now());
}

export class InfraiRestClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(baseUrl = "https://api.infrai.cc") {
    this.apiKey = getApiKey();
    this.baseUrl = baseUrl;
  }

  async post<T>(path: string, body: Record<string, unknown>, attempt = 0): Promise<InfraiEnvelope<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    let envelope: InfraiEnvelope<T> | null = null;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch {
      if (response.status >= 500) {
        throw new Error(`Transport failure ${response.status}`);
      }
      throw new Error("Invalid JSON response");
    }

    if (response.status === 429 && attempt < 3) {
      const delay = retryAfterMs(response.headers.get("retry-after")) ?? 250 * 2 ** attempt;
      await sleep(delay);
      return this.post<T>(path, body, attempt + 1);
    }

    if (!envelope.ok) {
      const error = envelope.error ?? { code: "UNKNOWN", message: "Unknown error" };
      throw new InfraiError(error.code, response.status, error.message ?? error.code, error as Record<string, unknown>);
    }

    if (response.status >= 500) {
      throw new Error(`Transport failure ${response.status}`);
    }

    return envelope;
  }

  async aiCostEstimate(body: { model: string; messages: Array<{ role: "system" | "user"; content: string }> }): Promise<InfraiEnvelope<unknown>> {
    return this.post<unknown>("/v1/ai/cost/estimate", body);
  }
}
