import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';

export function getNextReportNum() {
  const trackerPath = 'data/applications.md';
  if (!existsSync(trackerPath)) return '001';

  const content = readFileSync(trackerPath, 'utf8');
  const lines = content.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Date'));
  const nums = lines
    .map(l => parseInt(l.split('|')[1]?.trim()))
    .filter(n => !isNaN(n));

  if (nums.length === 0) return '001';
  const next = Math.max(...nums) + 1;
  return String(next).padStart(3, '0');
}

export function saveReport(company, role, score, content) {
  if (!existsSync('reports')) mkdirSync('reports');

  const num = getNextReportNum();
  const date = new Date().toISOString().split('T')[0];
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `reports/${num}-${slug}-${date}.md`;

  const header = `# Evaluation: ${company} — ${role}\n\n**Date:** ${date}\n**Score:** ${score}/5\n**Report:** ${num}\n\n---\n\n`;
  writeFileSync(filename, header + content);

  const trackerLine = `| ${num} | ${date} | ${company} | ${role} | ${score}/5 | Evaluated | ❌ | [${num}](${filename}) | |\n`;
  appendFileSync('data/applications.md', trackerLine);

  console.log('\n✅ Report saved: ' + filename);
  console.log('✅ Tracker updated: data/applications.md');
  return filename;
}
