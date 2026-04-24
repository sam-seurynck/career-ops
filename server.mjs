import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { runMode, extractMetadata } from './lib/llm.mjs';
import { saveReport } from './lib/save-report.mjs';
import { fetchJobContent } from './lib/fetch-job.mjs';
import { runBatch } from './lib/batch.mjs';

const app = express();
app.use(express.json());
app.use(express.static('ui'));

const extraFiles = {
  'CV': 'cv.md',
  'Profile': 'config/profile.yml',
  'Shared Context': 'modes/_shared.md',
  'Personal Profile': 'modes/_profile.md',
  'Article Digest': 'article-digest.md',
};

const modeMap = {
  'evaluate': 'modes/oferta.md',
  'deep':     'modes/deep.md',
  'contact':  'modes/contacto.md',
  'apply':    'modes/apply.md',
  'training': 'modes/training.md',
  'project':  'modes/project.md',
  'patterns': 'modes/patterns.md',
  'followup': 'modes/followup.md',
  'compare':  'modes/ofertas.md',
  'tracker':  'modes/tracker.md',
};

function extractFromText(text) {
  const atMatch = text.match(/^([A-Za-z\s\/]+)\s+at\s+([A-Za-z\s]+?)[\.\,]/);
  if (atMatch) {
    return { role: atMatch[1].trim(), company: atMatch[2].trim() };
  }
  return null;
}

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'ui' });
});

app.get('/api/tracker', (req, res) => {
  try {
    const content = readFileSync('data/applications.md', 'utf8');
    res.json({ content });
  } catch {
    res.json({ content: '' });
  }
});

app.get('/api/pipeline', (req, res) => {
  try {
    const content = readFileSync('data/pipeline.md', 'utf8');
    res.json({ content });
  } catch {
    res.json({ content: '' });
  }
});

app.post('/api/pipeline', (req, res) => {
  try {
    const { content } = req.body;
    writeFileSync('data/pipeline.md', content);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/evaluate', async (req, res) => {
  const { input, mode = 'evaluate' } = req.query;

  if (!input) {
    res.status(400).json({ error: 'No input provided' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    const isUrl = input.startsWith('http');
    let jobContent = input;

    if (isUrl && mode === 'evaluate') {
      send('status', 'Fetching job posting...');
      try {
        jobContent = await fetchJobContent(input);
        send('status', 'Fetched ' + jobContent.length + ' chars. Evaluating...');
      } catch (err) {
        send('status', 'Could not fetch URL, evaluating as-is...');
      }
    } else {
      send('status', 'Evaluating...');
    }

    const modePath = modeMap[mode];
    if (!modePath || !existsSync(modePath)) {
      send('error', 'Mode not found: ' + mode);
      res.end();
      return;
    }

    const result = await runMode(modePath, jobContent, extraFiles);
    send('result', result);

    if (mode === 'evaluate') {
      send('status', 'Extracting metadata...');
      const localExtract = isUrl ? null : extractFromText(input);
      const meta = await extractMetadata(result, jobContent);

      const company = localExtract?.company || meta?.company || 'unknown-company';
      const role = localExtract?.role || meta?.role || 'unknown-role';
      const score = meta?.score || '—';

      send('status', 'Saving report...');
      const filename = saveReport(company, role, score, result);

      send('meta', { company, role, score, filename });
      send('status', 'Done!');
    }

  } catch (err) {
    send('error', err.message);
  }

  res.end();
});

app.get('/api/batch', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    send('status', 'Starting batch processing...');
    await runBatch((message) => send('status', message));
    send('status', 'Batch complete!');
  } catch (err) {
    send('error', err.message);
  }

  res.end();
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log('\n✅ Career-ops UI running at http://localhost:3000');
  console.log('Open that URL in your browser to get started.\n');
});
