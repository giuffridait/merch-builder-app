import { logLangfuseTrace } from './langfuse';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type LLMConfig = {
  provider: 'ollama' | 'openai' | 'groq';
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
    if (!apiKey) throw new Error('QWEN_API_KEY is missing');
    return { provider: 'openai', model, baseUrl, apiKey };
  }

  if (provider === 'groq') {
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const baseUrl = process.env.GROQ_API_BASE || 'https://api.groq.com/openai/v1';
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is missing');
    return { provider: 'groq', model, baseUrl, apiKey };
  }

  // Default to Ollama, but check for production environment
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !process.env.OLLAMA_HOST) {
    throw new Error('LLM_PROVIDER not set in production. Please set LLM_PROVIDER=groq (or openai) and provide API keys.');
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

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { responseFormat?: 'json' }
): Promise<string> {
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
            stream: false,
            ...(options?.responseFormat === 'json' ? { format: 'json' } : {})
          })
        }, timeoutMs);

        if (forceGenerate || res.status === 404) {
          res = await fetchWithTimeout(`${config.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: config.model,
              prompt: messagesToPrompt(messages),
              stream: false,
              ...(options?.responseFormat === 'json' ? { format: 'json' } : {})
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
        const content = data?.message?.content || data?.response || '';
        await logLangfuseTrace({
          name: 'chatCompletion',
          model: config.model,
          input: messages,
          output: content,
          metadata: { provider: config.provider, responseFormat: options?.responseFormat }
        });
        return content;
      }

      if (!config.baseUrl || !config.apiKey) {
        throw new Error('API base URL and API key are required for OpenAI-compatible providers.');
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
          temperature: 0.4,
          ...(options?.responseFormat === 'json'
            ? { response_format: { type: 'json_object' } }
            : {})
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
      const content = data?.choices?.[0]?.message?.content || '';
      await logLangfuseTrace({
        name: 'chatCompletion',
        model: config.model,
        input: messages,
        output: content,
        metadata: { provider: config.provider, responseFormat: options?.responseFormat }
      });
      return content;
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

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'done'; fullContent: string };

export async function* streamChatCompletion(
  messages: ChatMessage[],
  options?: { responseFormat?: 'json' }
): AsyncGenerator<StreamEvent> {
  const config = getConfig();
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10);

  if (config.provider === 'ollama') {
    const res = await fetchWithTimeout(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        ...(options?.responseFormat === 'json' ? { format: 'json' } : {})
      })
    }, timeoutMs);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama stream error: ${res.status} ${text}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          const token = chunk?.message?.content || '';
          if (token) {
            fullContent += token;
            yield { type: 'token', content: token };
          }
        } catch { /* skip malformed lines */ }
      }
    }

    await logLangfuseTrace({
      name: 'streamChatCompletion',
      model: config.model,
      input: messages,
      output: fullContent,
      metadata: { provider: config.provider, responseFormat: options?.responseFormat }
    });
    yield { type: 'done', fullContent };
    return;
  }

  // OpenAI / Groq compatible streaming
  if (!config.baseUrl || !config.apiKey) {
    throw new Error('API base URL and API key are required for streaming.');
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
      temperature: 0.4,
      stream: true,
      ...(options?.responseFormat === 'json'
        ? { response_format: { type: 'json_object' } }
        : {})
    })
  }, timeoutMs);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stream error: ${res.status} ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data);
        const token = chunk?.choices?.[0]?.delta?.content || '';
        if (token) {
          fullContent += token;
          yield { type: 'token', content: token };
        }
      } catch { /* skip malformed SSE lines */ }
    }
  }

  await logLangfuseTrace({
    name: 'streamChatCompletion',
    model: config.model,
    input: messages,
    output: fullContent,
    metadata: { provider: config.provider, responseFormat: options?.responseFormat }
  });
  yield { type: 'done', fullContent };
}
