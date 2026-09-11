export class GeminiApiError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

interface RawGeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export async function callGeminiJson(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userMessage: string,
  schema: Record<string, unknown>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: { text: systemInstruction } },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: schema,
          },
        }),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GeminiApiError(`Network error calling Gemini API: ${message}`, 0);
  }

  if (!response.ok) {
    throw new GeminiApiError(`Gemini API request failed with status ${response.status}`, response.status);
  }

  const body = (await response.json()) as RawGeminiResponse;
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== 'string') {
    throw new GeminiApiError('Gemini returned an unexpected response shape', response.status);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiApiError(
      'Gemini returned non-JSON text despite response_mime_type=application/json',
      response.status,
    );
  }
}
