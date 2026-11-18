export class AgentBrain {
  constructor() {
    this.history = [];
    this.clickedPositions = [];
    this.encounteredTexts = new Set();
    this.hasCanvas = false;
    this.gamePlaySteps = 0;

    this.POSITIVE_KEYWORDS = [
      'start', 'play', '開始', 'スタート', 'ゲーム', 'game', 
      'はじめる', '遊ぶ', '次へ', 'next', 'click', 'enter', 'open'
    ];
    this.NEGATIVE_KEYWORDS = [
      '利用規約', 'terms', 'privacy', 'プライバシー', 'お問い合わせ', 
      'contact', 'share', 'ツイート', 'tweet', 'login', 'ログイン', 'sign up'
    ];
  }

  decideNextAction(perception) {
    this.history.push(perception);

    perception.visibleTexts.forEach(t => {
      if (t.length > 2 && t.length < 50) this.encounteredTexts.add(t);
    });

    if (perception.canvasInfo) {
      this.hasCanvas = true;
      if (this.gamePlaySteps < 3) {
        this.gamePlaySteps++;
        const keys = ['Space', 'ArrowRight', 'ArrowUp', 'Enter'];
        const chosenKey = keys[this.gamePlaySteps % keys.length];

        if (this.gamePlaySteps === 1) {
          const cx = perception.canvasInfo.x + Math.round(perception.canvasInfo.width / 2);
          const cy = perception.canvasInfo.y + Math.round(perception.canvasInfo.height / 2);
          return {
            type: 'click',
            x: cx,
            y: cy,
            reason: 'ゲーム画面(Canvas)を検知。フォーカスを当てるため中央をクリック'
          };
        }

        return {
          type: 'press_key',
          key: chosenKey,
          reason: `ゲームを操作中: [${chosenKey}] キーを押下`
        };
      }
    }

    const elements = perception.interactiveElements;
    if (elements && elements.length > 0) {
      let bestElement = null;
      let maxScore = -9999;

      for (const el of elements) {
        const score = this._calculateElementScore(el);
        if (score > maxScore) {
          maxScore = score;
          bestElement = el;
        }
      }

      if (bestElement && maxScore > 0) {
        this.clickedPositions.push({ x: bestElement.x, y: bestElement.y });
        return {
          type: 'click',
          x: bestElement.x,
          y: bestElement.y,
          reason: `最も優先度の高い要素「${bestElement.text || bestElement.tag}」を選択 (Score: ${maxScore})`
        };
      }
    }

    return {
      type: 'finish',
      reason: '探索対象を十分に見届けたため完了'
    };
  }

  _calculateElementScore(element) {
    let score = 50;
    const text = (element.text || '').toLowerCase();

    for (const kw of this.POSITIVE_KEYWORDS) {
      if (text.includes(kw)) score += 60;
    }
    for (const kw of this.NEGATIVE_KEYWORDS) {
      if (text.includes(kw)) score -= 80;
    }

    const area = element.width * element.height;
    if (area > 2000 && area < 100000) score += 20;

    for (const pos of this.clickedPositions) {
      const distance = Math.hypot(pos.x - element.x, pos.y - element.y);
      if (distance < 30) score -= 200;
    }

    return score;
  }

  generateReview() {
    const textArray = Array.from(this.encounteredTexts);
    const title = this.history[0]?.title || 'インディー作品';
    const totalSteps = this.history.length;

    const pickedWords = textArray
      .filter(t => !t.includes('http') && t.length > 3)
      .slice(0, 3);

    let rating = 4;
    let category = 'Webサイト';
    let impressionCore = '';

    if (this.hasCanvas) {
      category = 'ブラウザゲーム';
      rating = 5;
      impressionCore = `Canvasを用いた軽快な動作が印象的でした！操作キーへの反応もスムーズで、インディーならではの熱量を感じます。`;
    } else if (this.clickedPositions.length > 2) {
      rating = 4;
      impressionCore = `導線がしっかり整理されており、ページ遷移やインタラクションのレスポンスが気持ちいい設計でした。`;
    } else {
      rating = 4;
      impressionCore = `シンプルで無駄のないミニマルな作り。今後の拡張やアップデートがとても楽しみなプロジェクトです！`;
    }

    const reviewText = [
      `🤖【AI巡回レビュー】`,
      `「${title}」を探索しました！(${category})`,
      ``,
      impressionCore,
      pickedWords.length > 0 ? `注目キーワード: 「${pickedWords.join(' / ')}」` : '',
      ``,
      `応援度: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)`,
      `#IndieGameDev #インディーゲーム #個人開発 #Webサイト巡回`
    ].filter(line => line !== '').join('\n');

    return {
      rating,
      summary: `${category}「${title}」の探索完了（${totalSteps}ステップ実施）`,
      impressions: reviewText,
      tags: ['#IndieGameDev', '#個人開発', '#Webサイト巡回']
    };
  }
}
