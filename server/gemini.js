// The only file that talks to Google's Gemini API. Everything else calls askGemini(systemText, userText).
// It uses the generateContent REST method with Node's built-in fetch, so there is no extra dependency.
// (Google now recommends its newer "Interactions" API for new projects but says generateContent stays supported.
// If it is ever retired, only this file needs to change.)
//
// Settings (all in .env):
//   GEMINI_API_KEY   required, kept on the server only
//   GEMINI_MODEL     optional, a fast low-cost model is the default
//   GEMINI_API_URL   optional, only the automated tests change it (they point it at a fake Gemini)
//   AI_TIMEOUT_MS    optional, how long to wait for Gemini (default 8000)

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

// Turn any error into readable text for the log. Node's AggregateError has an empty message, so look inside it.
function describeError(err) {
  const nested = Array.isArray(err.errors) ? ' [' + err.errors.map((e) => e.message || e.code).join('; ') + ']' : '';
  return `${err.name}: ${err.message || err.code || 'no message'}${nested}`;
}

// Send one question and return Gemini's reply as text. Throws on any problem (the caller shows a friendly message).
async function askGemini(systemText, userText) {
  const base = (process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 8000;

  const res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,   // in a header, never in the address
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0,                       // same question, same answer
        maxOutputTokens: 1024,
        responseMimeType: 'application/json', // ask for JSON only (we still check it ourselves)
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    // Log what Google said (e.g. invalid key, quota used up) but never send it to the browser.
    const body = await res.json().catch(() => ({}));
    const e = new Error(`Gemini answered ${res.status}${body.error?.status ? ' ' + body.error.status : ''}: ${String(body.error?.message || '').slice(0, 200)}`);
    e.upstreamStatus = res.status;
    throw e;
  }
  const data = await res.json();
  // The reply text is in candidates[0].content.parts[*].text (skip any "thinking" parts).
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
  if (!text) throw new Error('Gemini returned no text' + (data.promptFeedback?.blockReason ? ` (blocked: ${data.promptFeedback.blockReason})` : ''));
  return text;
}

module.exports = { askGemini, isConfigured, describeError };
