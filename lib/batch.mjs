import { readFileSync, writeFileSync } from 'fs';
import { runMode, extractMetadata } from './llm.mjs';
import { saveReport } from './save-report.mjs';
import { fetchJobContent } from './fetch-job.mjs';

const extraFiles = {
  'CV': 'cv.md',
  'Profile': 'config/profile.yml',
  'Shared Context': 'modes/_shared.md',
  'Personal Profile': 'modes/_profile.md',
  'Article Digest': 'article-digest.md',
};

function extractFromText(text) {
  const atMatch = text.match(/^([A-Za-z\s\/]+)\s+at\s+([A-Za-z\s]+?)[\.\,]/);
  if (atMatch) {
    return { role: atMatch[1].trim(), company: atMatch[2].trim() };
  }
  return null;
}

function loadPipeline() {
  const content = readFileSync('data/pipeline.md', 'utf8');
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => {
      if (!l) return false;
      if (l.startsWith('#')) return false;
      if (l.startsWith('DONE:')) return false;
      if (l.startsWith('ERROR:')) return false;
      // Only process lines that are URLs or look like job descriptions
      // (must start with http or be at least 30 chars of actual content)
      if (l.startsWith('http')) return true;
      if (l.length >= 30 && /[A-Z]/.test(l)) return true;
      return false;
    });
}

function markDone(url) {
  const content = readFileSync('data/pipeline.md', 'utf8');
  const updated = content.replace(url, 'DONE: ' + url);
  writeFileSync('data/pipeline.md', updated);
}

function markError(url, error) {
  const content = readFileSync('data/pipeline.md', 'utf8');
  const updated = content.replace(url, 'ERROR: ' + url + ' — ' + error);
  writeFileSync('data/pipeline.md', updated);
}

export async function runBatch() {
  const urls = loadPipeline();

  if (urls.length === 0) {
    console.log('No pending URLs in data/pipeline.md');
    console.log('Add job URLs or descriptions, one per line.');
    return;
  }

  console.log(`\nFound ${urls.length} pending job(s) to evaluate.\n`);
  console.log('Estimated time: ' + (urls.length * 4) + '-' + (urls.length * 6) + ' minutes.\n');

  const results = { completed: 0, failed: 0 };

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n[${i + 1}/${urls.length}] Processing: ${url.slice(0, 80)}`);
    console.log('─'.repeat(60));

    try {
      const isUrl = url.startsWith('http');
      let jobContent = url;

      if (isUrl) {
        try {
          console.log('Fetching job posting...');
          jobContent = await fetchJobContent(url);
          console.log('Fetched ' + jobContent.length + ' chars');
        } catch (err) {
          console.log('Could not fetch URL: ' + err.message);
        }
      }

      console.log('Evaluating...');
      const result = await runMode('modes/oferta.md', jobContent, extraFiles);

      const localExtract = isUrl ? null : extractFromText(url);
      const meta = await extractMetadata(result, jobContent);

      const company = localExtract?.company || meta?.company || 'unknown-company';
      const role = localExtract?.role || meta?.role || 'unknown-role';
      const score = meta?.score || '—';

      console.log('Company: ' + company);
      console.log('Role: ' + role);
      console.log('Score: ' + score);

      saveReport(company, role, score, result);
      markDone(url);
      results.completed++;

    } catch (err) {
      console.error('Failed: ' + err.message);
      markError(url, err.message);
      results.failed++;
    }

    if (i < urls.length - 1) {
      console.log('\nPausing 3 seconds before next job...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Batch complete!');
  console.log('✅ Completed: ' + results.completed);
  if (results.failed > 0) console.log('❌ Failed: ' + results.failed);
  console.log('Check data/applications.md for the full tracker.');
}
