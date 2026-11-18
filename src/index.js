import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameBrain } from './brain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTraining() {
  const localGamePath = 'file://' + path.join(__dirname, 'game.html');
  console.log(`🤖 [RL-Agent] 自前インディーゲーム起動: ${localGamePath}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 800, height: 400 },
    recordVideo: {
      dir: 'videos/',
      size: { width: 800, height: 400 }
    }
  });

  const page = await context.newPage();
  await page.goto(localGamePath);
  await page.waitForTimeout(1000);

  const brain = new GameBrain();
  console.log('🎮 プレイ＆録画開始！');

  for (let frame = 0; frame < 150; frame++) {
    // 恐竜の前方エリア（X: 70〜160, Y: 130〜180）に赤い障害物があるか検知
    const hasObstacle = await page.evaluate(() => {
      const canvas = document.getElementById('game');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(80, 140, 70, 40);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        // 赤い障害物（Rが高く、G/Bが低い）を検知！
        if (r > 150 && g < 100 && b < 100) return true;
      }
      return false;
    });

    const action = brain.decideGameAction({ hasObstacle });

    if (action.type === 'jump') {
      console.log(`🦘 [Frame ${frame}] 赤いサボテン接近！ジャンプ！！ (Space)`);
      await page.keyboard.press('Space');
    }

    await page.waitForTimeout(60);
  }

  await page.close();
  await context.close();
  await browser.close();

  console.log('\n🎉 神動画が完成しました！videosフォルダを確認してください！');
}

runTraining().catch(console.error);
