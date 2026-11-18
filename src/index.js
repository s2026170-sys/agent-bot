import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTraining() {
  const localGamePath = 'file://' + path.join(__dirname, 'game.html');
  console.log(`🤖 [Vision-Agent] 汎用動体検知AI 起動: ${localGamePath}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 800, height: 400 },
    recordVideo: { dir: 'videos/', size: { width: 800, height: 400 } }
  });

  const page = await context.newPage();
  await page.goto(localGamePath);
  await page.waitForTimeout(1000);

  // ★ AIがSpaceキーを押してゲームを開始！
  console.log('🚀 [AI] Spaceキーを入力してゲームスタート！');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);

  console.log('⚡ 汎用動体トラッキング・プレイループ開始！');

  let prevImageData = null;

  for (let frame = 0; frame < 200; frame++) {
    const detection = await page.evaluate((prevPixels) => {
      const canvas = document.getElementById('game');
      if (!canvas) return { jump: false, gameOver: false, currentPixels: null };

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      
      const imgData = ctx.getImageData(0, 130, width, 50);
      const currentPixels = Array.from(imgData.data);

      if (!prevPixels) {
        return { jump: false, gameOver: false, currentPixels };
      }

      // 自機の前方（X: 80〜170）に迫ってくる動体をピクセル差分で監視
      let dangerDetected = false;
      let motionCount = 0;

      for (let x = 80; x < 170; x++) {
        for (let y = 0; y < 50; y++) {
          const index = (y * width + x) * 4;
          const r = currentPixels[index];
          const prevR = prevPixels[index];

          if (Math.abs(r - prevR) > 30 && r < 200) {
            motionCount++;
          }
        }
      }

      if (motionCount > 5) {
        dangerDetected = true;
      }

      const centerData = ctx.getImageData(250, 90, 20, 20).data;
      let isGameOver = false;
      for (let i = 0; i < centerData.length; i += 4) {
        if (centerData[i] > 180 && centerData[i+1] < 100) {
          isGameOver = true;
          break;
        }
      }

      return { jump: dangerDetected, gameOver: isGameOver, currentPixels };
    }, prevImageData);

    if (detection.gameOver) {
      console.log(`💥 [Frame ${frame}] GAME OVER！AIがぶつかりました。`);
      break;
    }

    if (detection.jump) {
      console.log(`🦘 [Frame ${frame}] 接近する動体を差分検知！ジャンプ！！ (Space)`);
      await page.keyboard.press('Space');
    }

    prevImageData = detection.currentPixels;
    await page.waitForTimeout(50);
  }

  await page.close();
  await context.close();
  await browser.close();

  console.log('\n🎥 録画完了！videosフォルダの最新動画を再生してみてください！');
}

runTraining().catch(console.error);
