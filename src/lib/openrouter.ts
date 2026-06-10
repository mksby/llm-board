import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * OpenRouter speaks the OpenAI API. We point AI SDK's generic
 * OpenAI-compatible client at it; that way the choice of provider is
 * fully data-driven (a string slug like `anthropic/claude-opus-4`).
 */
function buildClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.',
    );
  }
  return createOpenAICompatible({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    name: 'openrouter',
    headers: {
      // Optional: helps OpenRouter route and surfaces in their dashboard.
      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_TITLE ?? 'llm-board',
    },
  });
}

let cached: ReturnType<typeof buildClient> | null = null;

export function openrouter() {
  if (!cached) {
    cached = buildClient();
  }
  return cached;
}

export function modelFor(slug: string) {
  return openrouter()(slug);
}
