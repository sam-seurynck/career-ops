import { chromium } from 'playwright';

export async function fetchJobContent(url) {
  console.log('Fetching job posting...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait a moment for dynamic content to load
    await page.waitForTimeout(2000);
    
    // Extract the main text content
    const content = await page.evaluate(() => {
      // Remove nav, header, footer, scripts, styles
      const unwanted = document.querySelectorAll('nav, header, footer, script, style, iframe');
      unwanted.forEach(el => el.remove());
      
      // Try to find the main job content area
      const selectors = [
        '[class*="job-description"]',
        '[class*="job-details"]',
        '[class*="posting"]',
        '[class*="description"]',
        'main',
        'article',
        '#content',
        '.content',
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length > 200) {
          return el.innerText;
        }
      }
      
      // Fall back to full body text
      return document.body.innerText;
    });
    
    await browser.close();
    return content.slice(0, 8000); // Cap at 8000 chars to stay within context
    
  } catch (err) {
    await browser.close();
    throw new Error('Failed to fetch job posting: ' + err.message);
  }
}
