import { chromium } from 'playwright';
import { AgentBrain } from './brain.js';

const AD_BLOCK_DOMAINS = [
  'googlesyndication.com', 'doubleclick.net', 'googleads.g.doubleclick.net',
  'pagead2.googlesyndication.com', 'adnxs.com', 'amazon-adsystem.com', 'adservice.google.com'
];

async function runAgent(targetUrl) {
  console.log(`[System] 自律AIエージェント起動: ${targetUrl}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IndieSiteSupporterAgent/1.0'
  });

  const page = await context.newPage();

  // 広告ブロック
  await page.route('**/*', (route) => {
    const isAd = AD_BLOCK_DOMAINS.some(domain => route.request().url().includes(domain));
    if (isAd) return route.abort();
    route.continue();
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'step-0-start.png' });

  const brain = new AgentBrain();
  const MAX_STEPS = 6;

  for (let step = 0; step < MAX_STEPS; step++) {
    console.log(`\n================ [Step ${step + 1}/${MAX_STEPS}] 知覚＆思考 ================`);

    // 画面の「入力欄」「ボタン」「テキスト」「Canvas」を総点検
    const perception = await page.evaluate((stepCount) => {
      // 1. 入力フォーム（検索バーなど）
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea'))
        .map((el, i) => {
          const rect = el.getBoundingClientRect();
          return {
            id: `input_${i}`,
            placeholder: el.placeholder || '',
            name: el.name || '',
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            isVisible: rect.width > 0 && rect.height > 0
          };
        }).filter(i => i.isVisible);

      // 2. クリック可能な要素
      const elements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"], [role="button"]'))
        .map((el, i) => {
          const rect = el.getBoundingClientRect();
          return {
            id: `btn_${i}`,
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.value || '').trim().slice(0, 50),
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            isVisible: rect.width > 0 && rect.height > 0
          };
        }).filter(el => el.isVisible);

      // 3. ページ内の重要テキスト
      const visibleTexts = Array.from(document.querySelectorAll('h1, h2, h3, p, li'))
        .map(el => el.innerText.trim())
        .filter(t => t.length > 2 && t.length < 80)
        .slice(0, 30);

      // 4. Canvas
      const canvas = document.querySelector('canvas');
      const canvasInfo = canvas ? {
        x: Math.round(canvas.getBoundingClientRect().x),
        y: Math.round(canvas.getBoundingClientRect().y),
        width: Math.round(canvas.getBoundingClientRect().width),
        height: Math.round(canvas.getBoundingClientRect().height)
      } : null;

      return {
        url: window.location.href,
        title: document.title,
        inputs,
        interactiveElements: elements,
        visibleTexts,
        canvasInfo,
        stepCount
      };
    }, step);

    // ★ 自作頭脳に判断を仰ぐ
    const action = brain.decideNextAction(perception);
    console.log(`[AIの思考・判断]: ${action.type.toUpperCase()} -> ${action.reason}`);

    // ★ アクション実行（新機能：文字入力＆検索、スクロール対応）
    if (action.type === 'fill_and_submit') {
      console.log(`⌨️ 検索窓に「${action.text}」を入力して検索を実行します！`);
      await page.mouse.click(action.x, action.y);
      await page.keyboard.type(action.text, { delay: 100 }); // 人間らしくタイピング
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `step-${step + 1}-after-search.png` });
    } else if (action.type === 'click') {
      console.log(`👉 座標 (x: ${action.x}, y: ${action.y}) をタップします！`);
      await page.mouse.click(action.x, action.y);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `step-${step + 1}-after-click.png` });
    } else if (action.type === 'scroll') {
      console.log(`📜 ページを下にスクロールして探索範囲を広げます！`);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `step-${step + 1}-after-scroll.png` });
    } else if (action.type === 'press_key') {
      console.log(`🎮 ゲームキー [${action.key}] を入力！`);
      await page.keyboard.press(action.key);
      await page.waitForTimeout(800);
    } else if (action.type === 'finish') {
      console.log('[System] エージェントが探索目的を達成しました。');
      break;
    }
  }

  const review = brain.generateReview();
  console.log('\n================ 生成された商用レビュー ================');
  console.log(review.impressions);
  console.log('========================================================');

  await browser.close();
}

const testUrl = process.argv[2] || 'https://example.com';
runAgent(testUrl).catch(console.error);
