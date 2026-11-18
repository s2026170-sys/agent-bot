import { chromium } from 'playwright';

// ★ ゲーム画面とAIを1ファイルに完全統合（ズレが絶対に起きない設計）
const GAME_HTML = `
<!DOCTYPE html>
<html>
<body style="margin:0; background:#222; display:flex; justify-content:center; align-items:center; height:100vh;">
  <canvas id="game" width="600" height="200" style="background:#fff;"></canvas>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let isStarted = false, dinoY = 150, dinoVY = 0, isJumping = false;
    let obstacleX = 600, speed = 6, score = 0, isGameOver = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (!isStarted || isGameOver) {
          isStarted = true; isGameOver = false;
          dinoY = 150; dinoVY = 0; obstacleX = 600; score = 0;
        } else if (!isJumping) {
          dinoVY = -12; isJumping = true;
        }
      }
    });

    function loop() {
      if (isStarted && !isGameOver) {
        dinoY += dinoVY; dinoVY += 0.8;
        if (dinoY >= 150) { dinoY = 150; dinoVY = 0; isJumping = false; }
        obstacleX -= speed;
        if (obstacleX < -20) { obstacleX = 600; score += 10; }

        // 衝突判定
        if (obstacleX < 80 && obstacleX + 20 > 50 && dinoY + 30 > 150) {
          isGameOver = true;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666'; ctx.fillRect(0, 180, 600, 2); // 地面
      ctx.fillStyle = '#2ea44f'; ctx.fillRect(50, dinoY, 30, 30); // 自機
      ctx.fillStyle = '#000'; ctx.fillRect(obstacleX, 150, 20, 30); // 敵(サボテン)
      ctx.fillStyle = '#333'; ctx.font = '16px monospace';
      ctx.fillText('SCORE: ' + score, 20, 30);

      if (!isStarted) {
        ctx.fillText('STANDBY', 250, 100);
      } else if (isGameOver) {
        ctx.fillStyle = '#d73a49'; ctx.font = 'bold 30px monospace';
        ctx.fillText('GAME OVER', 220, 100);
      }
      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>
`;

async function run() {
  console.log('🤖 [Vision-Agent] 汎用動体検知AI 起動！');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 800, height: 400 },
    recordVideo: { dir: 'videos/', size: { width: 800, height: 400 } }
  });

  const page = await context.newPage();
  // ゲームを直接ブラウザに流し込む
  await page.setContent(GAME_HTML);
  await page.waitForTimeout(500);

  // AIがSpaceキーを押してゲームを開始！
  console.log('🚀 [AI] Spaceキーを押してゲームスタート！');
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);

  console.log('⚡ 汎用動体トラッキング・プレイループ開始！');

  let prevImageData = null;

  for (let frame = 0; frame < 150; frame++) {
    const detection = await page.evaluate((prevPixels) => {
      const canvas = document.getElementById('game');
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

      // GAME OVERの赤文字検知
      const centerData = ctx.getImageData(220, 80, 20, 20).data;
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
      console.log(`💥 [Frame ${frame}] GAME OVER！AIが散りました。`);
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

  console.log('\n🎉 完璧なプレイ動画が保存されました！videosフォルダを確認してください！');
}

run().catch(console.error);
