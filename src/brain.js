/**
 * 完全自作・純粋JavaScriptによる強化学習（Q-Learning）頭脳
 */
export class GameBrain {
  constructor() {
    // Qテーブル（脳のシナプス）：Stateごとの各Actionの価値を記憶
    // key: State文字列, value: [何もしないの価値, ジャンプの価値]
    this.qTable = {};

    // ハイパーパラメータ（機械学習の学習設定）
    this.learningRate = 0.2;  // 学習率 (α): 新しい経験をどれくらい重視するか
    this.discountFactor = 0.9; // 割引率 (γ): 将来の報酬をどれくらい重視するか
    this.epsilon = 0.3;       // 探索率 (ε): 30%の確率で新しい動きを試し、70%は学習結果を使う

    // 前回の状態と行動を記録（経験から学ぶため）
    this.lastState = null;
    this.lastAction = null;
    this.totalReward = 0;
    this.episodeCount = 1;
  }

  /**
   * 1. 画面データから「State（状態）」を抽象化して切り出す
   */
  getState(gameState) {
    // 障害物があるかどうかを「STATE_CLEAR」か「STATE_DANGER」として認識
    return gameState.hasObstacle ? 'DANGER' : 'CLEAR';
  }

  /**
   * 2. Q学習に基づき、次の行動を決定する（ε-greedy法）
   */
  decideGameAction(gameState) {
    const currentState = this.getState(gameState);

    // まだ知らないStateならQテーブルを初期化（[何もしない: 0, ジャンプ: 0]）
    if (!this.qTable[currentState]) {
      this.qTable[currentState] = [0.0, 0.0];
    }

    let actionIndex;

    // 【探索 vs 活用】
    // 一定確率（epsilon）でランダムに行動（新しい可能性の模索）
    if (Math.random() < this.epsilon) {
      actionIndex = Math.random() < 0.5 ? 0 : 1;
    } else {
      // 学習済みのQ値が高い方の行動を選択（知識の活用）
      const qValues = this.qTable[currentState];
      actionIndex = qValues[0] >= qValues[1] ? 0 : 1;
    }

    // 1フレーム生き延びたので報酬 +1
    const reward = 1.0;
    this.totalReward += reward;

    // 【Q値の更新（ベルマン方程式）】
    // 前回の行動の結果を振り返って脳を強化する！
    if (this.lastState !== null && this.lastAction !== null) {
      this.updateQValue(this.lastState, this.lastAction, reward, currentState);
    }

    this.lastState = currentState;
    this.lastAction = actionIndex;

    return actionIndex === 1 ? { type: 'jump' } : { type: 'none' };
  }

  /**
   * 3. 機械学習の心臓部：Q値の数学的更新
   * Q(s, a) = Q(s, a) + α * [ R + γ * max(Q(s')) - Q(s, a) ]
   */
  updateQValue(state, action, reward, nextState) {
    if (!this.qTable[nextState]) {
      this.qTable[nextState] = [0.0, 0.0];
    }

    const currentQ = this.qTable[state][action];
    const maxNextQ = Math.max(...this.qTable[nextState]);

    // 公式どおりに脳の数値を書き換える
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    this.qTable[state][action] = Number(newQ.toFixed(4));
  }

  /**
   * ゲームオーバー時にペナルティを与えて反省させる
   */
  learnFromDeath() {
    if (this.lastState !== null && this.lastAction !== null) {
      // 死亡時は強烈なマイナス報酬（-50）を与えて「その行動はダメだった」と学習
      this.updateQValue(this.lastState, this.lastAction, -50.0, 'DEAD');
    }
    console.log(`🧠 [学習完了 Episode ${this.episodeCount}] 累計報酬スコア: ${this.totalReward}`);
    console.log(`📊 [学習済みのQテーブル(脳内)]:`, JSON.stringify(this.qTable));

    this.episodeCount++;
    this.totalReward = 0;
    this.lastState = null;
    this.lastAction = null;
  }
}
