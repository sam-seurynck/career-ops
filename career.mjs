import { runMode } from './lib/llm.mjs';
import { saveReport } from './lib/save-report.mjs';
import { existsSync } from 'fs';

const args = process.argv.slice(2);
const mode = args[0] || 'help';
const input = args.slice(1).join(' ');

const extraFiles = {
  'CV': 'cv.md',
  'Profile': 'config/profile.yml',
  'Shared Context': 'modes/_shared.md',
  'Personal Profile': 'modes/_profile.md',
  'Article Digest': 'article-digest.md',
};

const modeMap = {
  'evaluate': 'modes/oferta.md',
  'pdf':      'modes/pdf.md',
  'pipeline': 'modes/pipeline.md',
  'tracker':  'modes/tracker.md',
  'scan':     'modes/scan.md',
  'batch':    'modes/batch.md',
  'deep':     'modes/deep.md',
  'contact':  'modes/contacto.md',
  'apply':    'modes/apply.md',
  'training': 'modes/training.md',
  'project':  'modes/project.md',
  'patterns': 'modes/patterns.md',
  'followup': 'modes/followup.md',
  'compare':  'modes/ofertas.md',
};

if (mode === 'help' || !modeMap[mode]) {
  console.log(`
career-ops local — powered by LM Studio

Usage: node career.mjs <mode> <input>

Modes:
  evaluate  — Evaluate a job description (paste text or URL)
  pdf       — Generate ATS-optimized CV
  pipeline  — Process pending URLs from inbox
  tracker   — View application status
  scan      — Scan portals for new offers
  batch     — Batch process multiple offers
  deep      — Deep company research
  contact   — LinkedIn outreach message
  apply     — Live application assistant
  training  — Evaluate a course or certification
  project   — Evaluate a portfolio project
  patterns  — Analyze rejection patterns
  followup  — Follow-up cadence tracker
  compare   — Compare multiple offers

Example:
  node career.mjs evaluate "Senior Designer at Acme, requires 5 years..."
  `);
  process.exit(0);
}

const modePath = modeMap[mode];

if (!existsSync(modePath)) {
  console.error(`Mode file not found: ${modePath}`);
  process.exit(1);
}

if (!input) {
  console.error(`Please provide input. Example: node career.mjs ${mode} "your text here"`);
  process.exit(1);
}

console.log(`\nRunning mode: ${mode}\nThinking...\n`);

try {
  const result = await runMode(modePath, input, extraFiles);
  console.log(result);

  // Auto-save report for evaluate mode
  if (mode === 'evaluate') {
    const companyMatch = result.match(/\*\*Company:\*\*\s*(.+)/i) || 
                         result.match(/Company\s*\|\s*(.+)/i);
    const roleMatch = result.match(/\*\*Role:\*\*\s*(.+)/i) || 
                      result.match(/Role\s*\|\s*(.+)/i);
    
    const company = companyMatch?.[1]?.trim() || 'unknown-company';
    const role = roleMatch?.[1]?.trim() || 'unknown-role';
    
    saveReport(company, role, result);
  }

} catch (err) {
  console.error('Error connecting to LM Studio:', err.message);
  console.error('Make sure LM Studio is running with the local server enabled on port 1234.');
}
