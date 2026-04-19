import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';

function getNextReportNum() {
  const trackerPath = 'data/applications.md';
  if (!existsSync(trackerPath)) return '001';
  
  const content = readFileSync(trackerPath, 'utf8');
  const lines = content.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('# '));
  const nums = lines
    .map(l => parseInt(l.split('|')[1]?.trim()))
    .filter(n => !isNaN(n));
  
  if (nums.length === 0) return '001';
  const next = Math.max(...nums) + 1;
  return String(next).padStart(3, '0');
}

export function saveReport(company, role, content) {
  if (!existsSync('reports')) mkdirSync('reports');
  
  const num = getNextReportNum();
  const date = new Date().toISOString().split('T')[0];
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = `reports/${num}-${slug}-${date}.md`;

  const header = `# Evaluation: ${company} — ${role}\n\n**Date:** ${date}\n**Report:** ${num}\n\n---\n\n`;
  writeFileSync(filename, header + content);
  
  console.log(`\n✅ Report saved: ${filename}`);
  return filename;
}
