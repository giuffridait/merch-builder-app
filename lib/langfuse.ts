type LangfuseConfig = {
  host: string;
  publicKey: string;
  secretKey: string;
};

type LangfuseTraceInput = {
  name: string;
  userId?: string;
  sessionId?: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  model?: string;
};

function getConfig(): LangfuseConfig | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) return null;
  const host = (process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com').replace(/\/+$/, '');
  return { host, publicKey, secretKey };
}

function authHeader(cfg: LangfuseConfig) {
  const token = Buffer.from(`${cfg.publicKey}:${cfg.secretKey}`).toString('base64');
  return `Basic ${token}`;
}

export async function logLangfuseTrace(payload: LangfuseTraceInput) {
  const cfg = getConfig();
  if (!cfg) return;

  const traceId = `trace_${crypto.randomUUID()}`;
  const genId = `gen_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const batch = [
    {
      id: `evt_${crypto.randomUUID()}`,
      timestamp: now,
      type: 'trace-create',
      body: {
        id: traceId,
        name: payload.name,
        user_id: payload.userId,
        session_id: payload.sessionId,
        input: payload.input,
        output: payload.output,
        metadata: payload.metadata
      }
    },
    {
      id: `evt_${crypto.randomUUID()}`,
      timestamp: now,
      type: 'generation-create',
      body: {
        id: genId,
        trace_id: traceId,
        name: payload.name,
        model: payload.model,
        input: payload.input,
        output: payload.output
      }
    }
  ];

  try {
    await fetch(`${cfg.host}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(cfg)
      },
      body: JSON.stringify({ batch })
    });
  } catch {
    // Swallow errors to avoid breaking the user flow.
  }
}
