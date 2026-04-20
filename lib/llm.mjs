import OpenAI from 'openai';
import { readFileSync, existsSync } from 'fs';

const client = new OpenAI({
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: 'lm-studio',
});

const ENGLISH_ONLY = `YOU MUST RESPOND IN ENGLISH ONLY. THIS IS MANDATORY. Every word of your response must be in English. Do not use Spanish or any other language anywhere in your response, including headers, labels, and table content.\n\n`;

export async function runMode(modePath, userMessage, extraFiles = {}) {
  const systemPrompt = readFileSync(modePath, 'utf8');

  let context = '';
  for (const [label, filePath] of Object.entries(extraFiles)) {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      context += `\n\n--- ${label} ---\n${content}`;
    }
  }

  const response = await client.chat.completions.create({
    model: 'qwen2.5-14b-instruct-1m',
    messages: [
      { role: 'system', content: ENGLISH_ONLY + systemPrompt + context },
      { role: 'user', content: `RESPOND IN ENGLISH ONLY.\n\n${userMessage}` },
      { role: 'assistant', content: 'I will respond entirely in English. Here is my evaluation:\n\n' }
    ],
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}

export async function extractMetadata(evaluationText, inputUrl) {
  // Build a clean summary for the extractor to work with
  // Pull just the first 1500 chars which contains the role summary and key signals
  const snippet = evaluationText.slice(0, 1500);

  // Also try to get company from URL if available
  let urlHint = '';
  if (inputUrl) {
    try {
      const u = new URL(inputUrl);
      const host = u.hostname.replace('www.', '').split('.')[0];
      const path = u.pathname.split('/').filter(Boolean).pop() || '';
      urlHint = `URL hints: hostname="${host}", path="${path}"\n\n`;
    } catch {}
  }

  const response = await client.chat.completions.create({
    model: 'qwen2.5-14b-instruct-1m',
    messages: [
      {
        role: 'system',
        content: 'You are a precise data extractor. You respond ONLY with a valid JSON object. No explanation, no markdown, no code blocks. Just raw JSON.'
      },
      {
        role: 'user',
        content: `${urlHint}Extract these fields from the job evaluation below and return ONLY a JSON object:
- company: the employer company name (string)
- role: the job title (string)
- score: global score out of 5 (number)
- archetype: detected archetype (string)
- legitimacy: one of "High Confidence", "Proceed with Caution", or "Suspicious" (string)

Evaluation:
${snippet}`
      },
      {
        role: 'assistant',
        content: '{'
      }
    ],
    temperature: 0.1,
  });

  try {
    const raw = '{' + response.choices[0].message.content.trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    // Handle incomplete JSON by closing it if needed
    const closed = clean.endsWith('}') ? clean : clean + '}';
    return JSON.parse(closed);
  } catch (e) {
    console.error('Metadata extraction failed:', e.message);
    return null;
  }
}
