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

export async function extractMetadata(evaluationText, originalInput) {
  const inputContext = originalInput
    ? `The original job input was: "${originalInput.slice(0, 500)}"\n\n`
    : '';

  const evalSnippet = evaluationText.slice(0, 1500);

  const response = await client.chat.completions.create({
    model: 'qwen2.5-14b-instruct-1m',
    messages: [
      {
        role: 'system',
        content: 'You are a precise data extractor. You respond ONLY with a valid JSON object containing exactly 5 fields. No explanation, no markdown, no code blocks. Just raw JSON.'
      },
      {
        role: 'user',
        content: `${inputContext}Extract these 5 fields from the job evaluation and return ONLY a JSON object:
- company: the employer company name (string)
- role: the job title (string)
- score: global score out of 5 (number, e.g. 4.2)
- archetype: detected archetype (string)
- legitimacy: one of "High Confidence", "Proceed with Caution", or "Suspicious" (string)

Supporting evaluation text:
${evalSnippet}

Return ONLY the JSON object with all 5 fields. Example format:
{"company":"Acme Corp","role":"Senior Designer","score":4.2,"archetype":"Creative Technologist","legitimacy":"High Confidence"}`
      }
    ],
    temperature: 0.1,
  });

  try {
    const raw = response.choices[0].message.content.trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    // Extract just the JSON object if there's surrounding text
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found');
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Metadata extraction failed:', e.message);
    console.error('Raw response:', response.choices[0].message.content.slice(0, 200));
    return null;
  }
}
