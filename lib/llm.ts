type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type LLMConfig = {
  provider: 'ollama' | 'openai';
  model: string;
  baseUrl?: string;
  apiKey?: string;
};

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 400;
const DEFAULT_TIMEOUT_MS = 30000;

function getConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();

  if (provider === 'openai') {
    const model = process.env.QWEN_MODEL || 'qwen2.5-14b-instruct';
    const baseUrl = process.env.QWEN_API_BASE;
    const apiKey = process.env.QWEN_API_KEY;
    return { provider: 'openai', model, baseUrl, apiKey };
  }

  const model = process.env.OLLAMA_MODEL || 'qwen2.5:14b';
  const baseUrl = process.env.OLLAMA_HOST || DEFAULT_OLLAMA_URL;
  return { provider: 'ollama', model, baseUrl };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(status?: number) {
  if (!status) return true;
  return status === 429 || status >= 500;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

function messagesToPrompt(messages: ChatMessage[]) {
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n') + '\nASSISTANT:';
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const config = getConfig();
  const maxRetries = parseInt(process.env.LLM_MAX_RETRIES || `${DEFAULT_MAX_RETRIES}`, 10);
  const retryDelay = parseInt(process.env.LLM_RETRY_DELAY_MS || `${DEFAULT_RETRY_DELAY_MS}`, 10);
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10);
  const forceGenerate = (process.env.OLLAMA_FORCE_GENERATE || '').toLowerCase() === 'true';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (config.provider === 'ollama') {
        let res = await fetchWithTimeout(`${config.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            messages,
            stream: false
          })
        }, timeoutMs);

        if (forceGenerate || res.status === 404) {
          res = await fetchWithTimeout(`${config.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: config.model,
              prompt: messagesToPrompt(messages),
              stream: false
            })
          }, timeoutMs);
        }

        if (!res.ok) {
          const text = await res.text();
          if (shouldRetry(res.status) && attempt < maxRetries) {
            await sleep(retryDelay * (attempt + 1));
            continue;
          }
          throw new Error(`Ollama error: ${res.status} ${text}`);
        }

        const data = await res.json();
        if (data?.message?.content) return data.message.content;
        return data?.response || '';
      }

      if (!config.baseUrl || !config.apiKey) {
        throw new Error('QWEN_API_BASE and QWEN_API_KEY are required for openai provider.');
      }

      const res = await fetchWithTimeout(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.4
        })
      }, timeoutMs);

      if (!res.ok) {
        const text = await res.text();
        if (shouldRetry(res.status) && attempt < maxRetries) {
          await sleep(retryDelay * (attempt + 1));
          continue;
        }
        throw new Error(`OpenAI-compatible error: ${res.status} ${text}`);
      }

      const data = await res.json();
      return data?.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (attempt < maxRetries && (err?.name === 'AbortError' || err?.name === 'TypeError')) {
        await sleep(retryDelay * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw new Error('LLM request failed after retries.');
}
