import { chromium } from 'playwright';
import { GameBrain } from './brain.js';

async function runTraining(targetUrl) {
  console.log(`🤖 [RL-Agent] 強化学習＆プレイ録画スタート: ${targetUrl}`);

  const browser = await chromium.launch({ headless: true });

  // ★ ここで「画面の丸ごと動画録画」を設定！
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    recordVideo: {
      dir: 'videos/', // videos フォルダに動画を保存
      size: { width: 800, height: 600 }
    }
  });

  const page = await context.newPage();

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const brain = new GameBrain();
  const TOTAL_EPISODES = 2; // 2回プレイして録画

  for (let episode = 1; episode <= TOTAL_EPISODES; episode++) {
    console.log(`\n================== 🎮 エピソード ${episode} プレイ中 ==================`);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    for (let frame = 0; frame < 100; frame++) {
      const gameState = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { hasCanvas: false, hasObstacle: false };

        let hasObstacle = false;
        try {
          const ctx = canvas.getContext('2d');
          const imgData = ctx.getImageData(100, 100, 80, 40);
          for (let i = 0; i < imgData.data.length; i += 4) {
            if (imgData.data[i] < 200) {
              hasObstacle = true;
              break;
            }
          }
        } catch (e) {}

        return { hasCanvas: true, hasObstacle };
      });

      const action = brain.decideGameAction(gameState);

      if (action.type === 'jump') {
        console.log(`🦘 [Episode ${episode} / Frame ${frame}] ジャンプ！`);
        await page.keyboard.press('Space');
      }

      await page.waitForTimeout(100);
    }

    brain.learnFromDeath();
  }

  // 動画を保存するためブラウザを閉じる
  await page.close();
  await context.close();
  await browser.close();

  console.log('\n🎥 プレイ動画の保存が完了しました！');
  console.log('左側の「videos」フォルダの中を確認してください！');
}

runTraining('https://elgoog.im/t-rex/').catch(console.error);
