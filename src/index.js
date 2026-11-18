import { chromium } from 'playwright';
import { AgentBrain } from './brain.js';

const AD_BLOCK_DOMAINS = [
  'googlesyndication.com',
  'doubleclick.net',
  'googleads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
  'adnxs.com',
  'amazon-adsystem.com',
  'adservice.google.com'
];

async function runAgent(targetUrl) {
  console.log(`[System] エージェント起動: ${targetUrl}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IndieSiteSupporterAgent/1.0'
  });

  const page = await context.newPage();

  await page.route('**/*', (route) => {
    const url = route.request().url();
    const isAd = AD_BLOCK_DOMAINS.some(domain => url.includes(domain));
    if (isAd) {
      return route.abort();
    }
    route.continue();
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const brain = new AgentBrain();
  const MAX_STEPS = 5;

  for (let step = 0; step < MAX_STEPS; step++) {
    console.log(`\n--- [Step ${step + 1}/${MAX_STEPS}] 知覚データの収集中 ---`);

    const perception = await page.evaluate((stepCount) => {
      const elements = Array.from(document.querySelectorAll('a, button, input[type="button"], [role="button"]'));
      
      const interactiveElements = elements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        return {
          id: `elem_${index}`,
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.value || '').trim().slice(0, 50),
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          isVisible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden'
        };
      }).filter(el => el.isVisible);

      const visibleTexts = Array.from(document.querySelectorAll('h1, h2, h3, p'))
        .map(el => el.innerText.trim())
        .filter(t => t.length > 0)
        .slice(0, 20);

      const canvas = document.querySelector('canvas');
      let canvasInfo = null;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        canvasInfo = {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          x: Math.round(rect.x),
          y: Math.round(rect.y)
        };
      }

      return {
        url: window.location.href,
        title: document.title,
        interactiveElements,
        visibleTexts,
        canvasInfo,
        stepCount
      };
    }, step);

    const action = brain.decideNextAction(perception);
    console.log(`[Brainの判断]: ${action.type} (理由: ${action.reason})`);

    if (action.type === 'click') {
      await page.mouse.click(action.x, action.y);
      await page.waitForTimeout(1500);
    } else if (action.type === 'press_key') {
      await page.keyboard.press(action.key);
      await page.waitForTimeout(500);
    } else if (action.type === 'wait') {
      await page.waitForTimeout(action.durationMs || 1000);
    } else if (action.type === 'finish') {
      console.log('[System] エージェントが探索完了を宣言しました。');
      break;
    }
  }

  const review = brain.generateReview();
  console.log('\n================ 生成されたレビュー ================');
  console.log(`スコア: ${review.rating} / 5`);
  console.log(`概要: ${review.summary}`);
  console.log(`投稿文:\n${review.impressions}`);
  console.log('====================================================');

  await browser.close();
  return review;
}

const testUrl = process.argv[2] || 'https://example.com';
runAgent(testUrl).catch(console.error);
