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

  console.log('⚡ 汎用動体トラッキング・プレイループ開始！');

  let prevImageData = null;

  for (let frame = 0; frame < 200; frame++) {
    // 画面全体のピクセル差分（オプティカルフロー）を計算して敵の接近を感知
    const detection = await page.evaluate((prevPixels) => {
      const canvas = document.getElementById('game');
      if (!canvas) return { jump: false, gameOver: false, currentPixels: null };

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      // 地面付近の高さ（Y: 130〜180）を全幅スキャン
      const imgData = ctx.getImageData(0, 130, width, 50);
      const currentPixels = Array.from(imgData.data);

      if (!prevPixels) {
        return { jump: false, gameOver: false, currentPixels };
      }

      // 自機の前方警戒エリア（自機のX座標50の少し先: X=80〜180）に
      // 「動いている黒・暗い物体」があるかを差分から検知
      let dangerDetected = false;
      let motionCount = 0;

      for (let x = 80; x < 180; x++) {
        for (let y = 0; y < 50; y++) {
          const index = (y * width + x) * 4;
          const r = currentPixels[index];
          const prevR = prevPixels[index];

          // ピクセルが変化した（何かが動いた）かつ 背景の白じゃない物体
          if (Math.abs(r - prevR) > 30 && r < 200) {
            motionCount++;
          }
        }
      }

      // 動体が一定以上の大きさで警戒ゾーンに突入したらジャンプ指示！
      if (motionCount > 5) {
        dangerDetected = true;
      }

      // GAME OVER文字（画面中央の赤文字）の有無を検知
      const centerData = ctx.getImageData(250, 90, 20, 20).data;
      let isGameOver = false;
      for (let i = 0; i < centerData.length; i += 4) {
        if (centerData[i] > 180 && centerData[i+1] < 100) { // 赤文字
          isGameOver = true;
          break;
        }
      }

      return { jump: dangerDetected, gameOver: isGameOver, currentPixels };
    }, prevImageData);

    if (detection.gameOver) {
      console.log(`💥 [Frame ${frame}] GAME OVERを検知！AIが散りました。`);
      break;
    }

    if (detection.jump) {
      console.log(`🦘 [Frame ${frame}] 接近する動体を差分検知！ジャンプ発動！！ (Space)`);
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
