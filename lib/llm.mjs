import OpenAI from 'openai';
import { readFileSync, existsSync } from 'fs';

const client = new OpenAI({
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: 'lm-studio',
});

const ENGLISH_ONLY = `YOU MUST RESPOND IN ENGLISH ONLY. THIS IS MANDATORY. Every word of your response must be in English. Do not write in Spanish. Do not mix languages. If the instructions are in Spanish, follow them but respond in English only.\n\n`;

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
