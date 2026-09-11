import { describe, expect, it, vi } from 'vitest';
import { callGeminiJson, GeminiApiError } from './client';

const SCHEMA = { type: 'OBJECT', properties: { answer: { type: 'STRING' } }, required: ['answer'] };

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('callGeminiJson', () => {
  it('parses the JSON text out of candidates[0].content.parts[0].text', async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"answer":"hello"}' }] }, finishReason: 'STOP' }],
      }),
    });

    const result = await callGeminiJson('key', 'gemini-3.1-flash-lite', 'system', 'question', SCHEMA);

    expect(result).toEqual({ answer: 'hello' });
  });

  it('sends the request to the generateContent endpoint for the given model, with the API key as a query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"answer":"x"}' }] } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await callGeminiJson('my-key', 'gemini-3.8-flash', 'sys', 'msg', SCHEMA);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('models/gemini-3.8-flash:generateContent?key=my-key');
    const body = JSON.parse(options.body as string);
    expect(body.system_instruction).toEqual({ parts: { text: 'sys' } });
    expect(body.contents).toEqual([{ parts: [{ text: 'msg' }] }]);
    expect(body.generationConfig.response_mime_type).toBe('application/json');
    expect(body.generationConfig.response_schema).toEqual(SCHEMA);
  });

  it('throws GeminiApiError on a non-ok response', async () => {
    mockFetchOnce({ ok: false, status: 429 });

    await expect(
      callGeminiJson('key', 'gemini-3.1-flash-lite', 'sys', 'msg', SCHEMA),
    ).rejects.toThrow(GeminiApiError);
  });

  it('throws GeminiApiError with statusCode 0 on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(
      callGeminiJson('key', 'gemini-3.1-flash-lite', 'sys', 'msg', SCHEMA),
    ).rejects.toMatchObject({ statusCode: 0 });
  });

  it('throws GeminiApiError when the response has no candidates text', async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ candidates: [] }) });

    await expect(
      callGeminiJson('key', 'gemini-3.1-flash-lite', 'sys', 'msg', SCHEMA),
    ).rejects.toThrow(GeminiApiError);
  });

  it('throws GeminiApiError when the model text is not valid JSON', async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }),
    });

    await expect(
      callGeminiJson('key', 'gemini-3.1-flash-lite', 'sys', 'msg', SCHEMA),
    ).rejects.toThrow(GeminiApiError);
  });
});
