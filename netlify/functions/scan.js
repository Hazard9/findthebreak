exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const content = body.content;

    if (!content) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No content provided' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const SYSTEM_PROMPT = `You are the DOD System — a forensic break point detector for content. Your job is to find the single moment where a reader loses momentum and stops.

Respond ONLY with valid JSON. No markdown, no explanation, no preamble.

Analyze the submitted content and return:
{
  "breakLine": "<exact verbatim quote from the content — the single sentence or phrase where momentum dies. Must be word-for-word from the text, under 100 chars if possible>",
  "breakLocation": "<where in the content this occurs, e.g. Opening line, Second sentence, Mid-content, Final ask>",
  "failureType": "<one of: HOOK COLLAPSE | CLARITY FAILURE | PROMISE GAP | HESITATION SPIKE | OVERLOAD ZONE | CTA COLLAPSE>",
  "consequence": "<what happens to the reader at this exact moment — one brutal sentence, specific to what you found>",
  "accountabilityLine": "<one line that places ownership on the writer — specific to what you found. Not generic.>",
  "clarityScore": 32,
  "riskScore": 71,
  "fix1": "<the single most important correction — specific to this content, actionable, one sentence>",
  "fix2": "<second correction — specific to this content>",
  "fix3": "<third correction — specific to this content>",
  "deeperPattern": "<one sentence describing the underlying habit or pattern causing this break>"
}

Rules:
- breakLine must be verbatim from the submitted text
- Every field must be specific to what you actually found
- clarityScore must be an integer between 15 and 58
- riskScore must be an integer between 55 and 94
- No generic advice — everything must reference this specific content`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'Analyze this content:\n\n' + content }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Anthropic API error', detail: errText })
      };
    }

    const data = await response.json();
    const raw = (data.content || []).map(function(b) { return b.text || ''; }).join('');
    const cleaned = raw.replace(/```json|```/g, '').trim();

    JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: cleaned
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};

