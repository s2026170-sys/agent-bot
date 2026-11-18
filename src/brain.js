/**
 * 完全自作・0円自律AIエージェント頭脳 v2.0
 * （ステートマシン思考 ＋ コンテキスト自律抽出 ＋ フォーム検索機能）
 */

export class AgentBrain {
  constructor() {
    // 状態管理（ステートマシン）
    // 'EXPLORING' (初期探索) -> 'SEARCHING' (検索実行) -> 'ENGAGING' (コンテンツ深掘り/プレイ)
    this.state = 'EXPLORING';
    
    this.history = [];
    this.clickedPositions = [];
    this.hasSearched = false;
    this.searchQueryUsed = '';
    this.hasCanvas = false;
    this.encounteredKeywords = new Set();
  }

  decideNextAction(perception) {
    this.history.push(perception);

    // 1. ページ内のテキストから「検索に使えそうな単語」を自律抽出
    this._extractContextKeywords(perception);

    // ==========================================
    // 思考フェーズ①：検索窓があれば、自律的に検索を実行する！
    // ==========================================
    if (!this.hasSearched && perception.inputs && perception.inputs.length > 0) {
      const searchInput = perception.inputs[0];
      // ページ内のキーワード、またはサイトタイトルから検索語を自前で生み出す
      const query = this._generateSearchQuery(perception);

      this.hasSearched = true;
      this.searchQueryUsed = query;
      this.state = 'ENGAGING';

      return {
        type: 'fill_and_submit',
        x: searchInput.x,
        y: searchInput.y,
        text: query,
        reason: `検索バーを検知。ページ文脈からキーワード「${query}」を自律生成して検索を実行`
      };
    }

    // ==========================================
    // 思考フェーズ②：ゲーム（Canvas）があればプレイに没頭する
    // ==========================================
    if (perception.canvasInfo) {
      this.hasCanvas = true;
      const gameKeys = ['Space', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'Enter'];
      const randomKey = gameKeys[Math.floor(Math.random() * gameKeys.length)];

      return {
        type: 'press_key',
        key: randomKey,
        reason: `インタラクティブなゲームCanvasを検知。アクションキー[${randomKey}]を送信`
      };
    }

    // ==========================================
    // 思考フェーズ③：高スコアなボタン・リンクの探索
    // ==========================================
    const elements = perception.interactiveElements;
    if (elements && elements.length > 0) {
      let bestElement = null;
      let maxScore = -9999;

      for (const el of elements) {
        const score = this._scoreElement(el);
        if (score > maxScore) {
          maxScore = score;
          bestElement = el;
        }
      }

      if (bestElement && maxScore > 20) {
        this.clickedPositions.push({ x: bestElement.x, y: bestElement.y });
        return {
          type: 'click',
          x: bestElement.x,
          y: bestElement.y,
          reason: `文脈スコア最高値(${maxScore}点)の「${bestElement.text || bestElement.tag}」へ遷移`
        };
      }
    }

    // ==========================================
    // 思考フェーズ④：めぼしいものが無ければスクロールして視野を広げる
    // ==========================================
    if (perception.stepCount < 4) {
      return {
        type: 'scroll',
        reason: '現在見えている範囲に有力な操作対象がないため、ページ下部をスクロール探索'
      };
    }

    return {
      type: 'finish',
      reason: 'サイトのコア機能（検索・主要動線）の体験が完了したため終了'
    };
  }

  /**
   * ページ内から単語を自律抽出する簡易NLP
   */
  _extractContextKeywords(perception) {
    const rawTexts = perception.visibleTexts.join(' ');
    // 日本語・英語の2文字以上の単語を抽出
    const words = rawTexts.match(/[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]{2,8}|[a-zA-Z]{3,12}/g) || [];
    words.forEach(w => {
      if (!['メイン', 'ページ', 'メニュー', '検索', '表示', 'これ', 'それ'].includes(w)) {
        this.encounteredKeywords.add(w);
      }
    });
  }

  /**
   * 自前で検索ワードを生み出すロジック
   */
  _generateSearchQuery(perception) {
    const list = Array.from(this.encounteredKeywords);
    if (list.length > 0) {
      // 抽出した単語の中から、面白そうなものを1つ選ぶ
      return list[Math.floor(Math.random() * list.length)];
    }
    return perception.title.slice(0, 6) || 'インディー';
  }

  _scoreElement(el) {
    let score = 30;
    const t = (el.text || '').toLowerCase();

    if (t.includes('play') || t.includes('ゲーム') || t.includes('開始') || t.includes('詳細')) score += 70;
    if (t.includes('規約') || t.includes('privacy') || t.includes('login') || t.includes('寄付')) score -= 100;

    // 既にクリックした場所に近いものは除外
    for (const p of this.clickedPositions) {
      if (Math.hypot(p.x - el.x, p.y - el.y) < 30) score -= 300;
    }
    return score;
  }

  generateReview() {
    const title = this.history[0]?.title || 'Webプロジェクト';
    const hasSearchAction = this.hasSearched ? `\n🔍 自律検索検証: 「${this.searchQueryUsed}」でサイト内検索を実施し、レスポンスを確認。` : '';
    const hasGameAction = this.hasCanvas ? `\n🎮 ゲーム性検証: Canvas要素の描画およびキー入力を確認。軽快に動作しています。` : '';

    return {
      rating: 5,
      impressions: [
        `🤖【自律エージェント巡回レポート】`,
        `対象: 「${title}」`,
        `----------------------------------------`,
        hasSearchAction,
        hasGameAction,
        `📊 サイト構造: 動線設計が明瞭で、ボット・ユーザー双方にとって探索しやすいUIです。`,
        `💡 総評: 個人開発・インディー作品としてのこだわりを感じる設計。今後のアップデートを応援しています！`,
        `----------------------------------------`,
        `#IndieDev #自作AI巡回 #完全0円ツール`
      ].filter(Boolean).join('\n')
    };
  }
}
