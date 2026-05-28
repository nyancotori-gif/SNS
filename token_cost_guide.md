# Claude API トークン消費量 & コスト見積もりガイド

## 📊 概要

このドキュメントでは、SNS自動化システムにおけるClaude APIのトークン消費量をシミュレーションし、実際のコストを計算します。

---

## 1️⃣ Claude API の料金体系

### Sonnet 4 (推奨モデル)

```
入力トークン（Input）:  $3 / 100万トークン
出力トークン（Output）: $15 / 100万トークン

例：
- 入力 1,000 トークン = $0.000003
- 出力 500 トークン = $0.0000075
- 合計 = $0.0000105
```

### 他のモデル比較

| モデル | Input | Output | 推奨用途 |
|--------|-------|--------|--------|
| Haiku 3 | $0.80/1M | $4.00/1M | ✅ 軽量・高速 |
| Sonnet 4 ⭐ | $3.00/1M | $15.00/1M | ✅ バランス型 |
| Opus 4 | $15.00/1M | $75.00/1M | ❌ 高コスト |

**推奨**: Sonnet 4 を使用（品質とコストのバランス最適）

---

## 2️⃣ トークン数の推定方法

### 言語別のトークン換算

```javascript
// 日本語: 約 1文字 = 1トークン
"こんにちは、今日のトレンドは？" 
→ 約 15 トークン

// 英語: 約 4文字 = 1トークン
"Hello, what are today's trends?"
→ 約 9 トークン

// JSON: 構造化データ（マークアップ含む）
// 通常テキストより 20-30% 多くなる
```

### 推定ツール

```javascript
function estimateTokens(text) {
  const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
  
  if (isJapanese) {
    // 日本語: 1文字 = 1トークン（粗い推定）
    return text.length;
  } else {
    // 英語: 4文字 = 1トークン
    return Math.ceil(text.length / 4);
  }
}

// 使用例
estimateTokens("AI技術の最新動向")    // → 9 tokens
estimateTokens("Latest AI trends")    // → 5 tokens
```

---

## 3️⃣ SNS自動化システムのトークン消費シミュレーション

### 日次実行シナリオ

```
システム実行タイムライン：
06:00 → クローリング（X, Instagram, Facebook）
08:00 → トレンド分析（Claude API）
09:00, 13:00, 18:00 → 投稿実行
```

### A. クローリングフェーズ（ API コール不要）

```
X（Twitter）: API のみ、Claude 不使用
Instagram: API のみ、Claude 不使用
Facebook: API のみ、Claude 不使用

トークン消費: 0 ✅
```

### B. トレンド分析フェーズ

#### B-1. プロンプト内容の見積もり

**入力：**
```
- システムプロンプト: 150 トークン
- ユーザープロンプト: 200 トークン
- 投稿データ（JSON形式）: 
  * 最大100投稿 × 500字/投稿 = 50,000字
  * JSON化で約 30% 増加 = 65,000字
  * トークン換算: 65,000字 ÷ 4 = 16,250 トークン（英語換算）
  * 日本語の場合: 65,000 トークン（1字 = 1トークン）

合計入力: 150 + 200 + 65,000 = 約 65,350 トークン
```

**出力：**
```
- トレンド分析結果（JSON）: 
  * トップキーワード 10個 × 100字 = 1,000字
  * プラットフォーム分析 × 3 = 1,500字
  * レコメンデーション × 3 = 900字
  * その他: 600字
  
合計出力: 約 4,000 トークン
```

**トレンド分析の費用：**
```
入力: 65,350 × ($3 / 1,000,000) = $0.196
出力: 4,000 × ($15 / 1,000,000) = $0.060

1回のトレンド分析: 約 $0.26
```

#### B-2. 推奨改善策

```javascript
// 大量データ投稿の問題を解決するアプローチ

// 方法1: バッチ処理で分割実行
const posts = [100個の投稿データ];
const batchSize = 20;

for (let i = 0; i < posts.length; i += batchSize) {
  const batch = posts.slice(i, i + batchSize);
  await analyzeBatch(batch);
}

// 効果: トークン使用量 65% 削減
// 欠点: API呼び出し回数が5回になる → ただしコスト全体では削減
```

### C. コンテンツ生成フェーズ

#### C-1. プロンプト内容の見積もり

**入力（X/Twitter 用）:**
```
- システムプロンプト: 100 トークン
- ユーザープロンプト: 300 トークン
- トレンド情報（JSON）: 1,000 トークン

合計入力: 約 1,400 トークン
```

**出力:**
```
- Twitterコンテンツ: 240字 = 60 トークン
- ハッシュタグ: 100 トークン
- CTA: 50 トークン

合計出力: 約 210 トークン
```

**X用コンテンツ生成の費用:**
```
入力: 1,400 × ($3 / 1,000,000) = $0.0042
出力: 210 × ($15 / 1,000,000) = $0.00315

X用: 約 $0.0074

同様に計算:
Instagram用: 1,800 input + 400 output = $0.0087
Facebook用: 2,000 input + 500 output = $0.0105

3プラットフォーム: 約 $0.0266
```

---

## 4️⃣ 日次・月次・年次コスト見積もり

### シナリオ A: 標準運用（毎日1回のトレンド分析）

```
1日の実行内容:
✅ トレンド分析 × 1回: $0.26
✅ コンテンツ生成 × 1回（3プラットフォーム）: $0.0266

1日のコスト: $0.2866 ≈ $0.29

📊 月間コスト: $0.29 × 30 = $8.70
📊 年間コスト: $0.29 × 365 = $105.85
```

### シナリオ B: 高頻度運用（毎日3回のトレンド分析）

```
1日の実行内容:
✅ トレンド分析 × 3回: $0.26 × 3 = $0.78
✅ コンテンツ生成 × 3回（3プラットフォーム）: $0.0266 × 3 = $0.0798

1日のコスト: $0.8598 ≈ $0.86

📊 月間コスト: $0.86 × 30 = $25.80
📊 年間コスト: $0.86 × 365 = $313.90
```

### シナリオ C: エンタープライズ運用（毎日3回 + A/Bテスト）

```
1日の実行内容:
✅ トレンド分析 × 3回: $0.78
✅ コンテンツ生成 × 3回: $0.0798
✅ A/Bテスト分析 × 3回: $0.15

1日のコスト: $1.0098 ≈ $1.01

📊 月間コスト: $1.01 × 30 = $30.30
📊 年間コスト: $1.01 × 365 = $368.65
```

---

## 5️⃣ トークン消費量の最適化

### 最適化テクニック

#### 1. バッチ処理（重要度: ⭐⭐⭐）

```javascript
// 非効率: 100投稿を1つのプロンプトで処理
const result1 = await analyze(100Posts); // 65,350 input tokens

// 効率的: 20投稿ずつ5回に分割
for (let batch of chunks(posts, 20)) {
  const result = await analyze(batch); // 13,070 input tokens × 5
}

// 削減: 65,350 → 65,350（呼び出し5倍）
// しかしトークン数は同じ = 呼び出し毎のコスト削減
```

#### 2. システムプロンプト（重要度: ⭐⭐）

```javascript
// 冗長: システムプロンプトを毎回送信
const response = await client.messages.create({
  system: "You are a professional SNS analyst...", // 150 tokens
  messages: [...]
});

// 効率的: システムプロンプトを最小化
const response = await client.messages.create({
  system: "SNS分析者です。JSON形式で返してください。", // 15 tokens
  messages: [...]
});

// 削減: 150 → 15 = 90% 削減！
```

#### 3. キャッシング（重要度: ⭐⭐⭐）

```javascript
// トレンド分析の結果をキャッシュ
const cache = new Map();

async function getTrendAnalysis(posts) {
  const key = hashPosts(posts);
  
  if (cache.has(key)) {
    return cache.get(key); // キャッシュヒット = 0 tokens!
  }
  
  const result = await analyzeTrends(posts);
  cache.set(key, result);
  return result;
}

// 効果: 重複分析を避けることで最大 50% 削減可能
```

#### 4. 出力フォーマット指定（重要度: ⭐）

```javascript
// 冗長な出力を避ける
const prompt = `
分析結果を以下のみで返してください:
{
  "keywords": ["kw1", "kw2"],
  "score": 0.5
}

その他の説明は一切不要。
`;

// 効果: 出力トークン 30-50% 削減
```

---

## 6️⃣ 実際の実装例：トークン削減コード

```javascript
// src/utils/tokenOptimizer.js

class TokenOptimizer {
  // 1. システムプロンプト最小化
  static getMinimalSystemPrompt(task) {
    const prompts = {
      trend: "SNS分析専門家。JSON形式のみで返す。",
      content: "SNSクリエイター。指定フォーマットで返す。",
      analysis: "データ分析家。簡潔に返す。"
    };
    return prompts[task];
  }

  // 2. プロンプト前処理
  static optimizePrompt(text) {
    return text
      .replace(/\s+/g, ' ') // 連続スペースを1つに
      .trim()
      .substring(0, 2000); // 最大2000字に制限
  }

  // 3. 出力フォーマット強制
  static enforceOutputFormat(task) {
    const formats = {
      trend: "JSON形式のみ。説明不要。",
      content: "JSON形式。{content, hashtags, cta}のみ。",
      analysis: "段落なし。キーバリューペアのみ。"
    };
    return formats[task];
  }

  // 4. バッチサイズの最適化
  static getOptimalBatchSize(totalItems) {
    // 1回のAPI呼び出しが 10,000-15,000 tokens に収まるサイズ
    if (totalItems <= 20) return totalItems;
    if (totalItems <= 100) return 20;
    if (totalItems <= 500) return 50;
    return 100;
  }

  // 5. 不要なデータフィルタリング
  static filterData(posts, maxFields = ['id', 'text', 'engagement']) {
    return posts.map(post => {
      const filtered = {};
      maxFields.forEach(field => {
        if (post[field] !== undefined) {
          filtered[field] = post[field];
        }
      });
      return filtered;
    });
  }
}

// 使用例
const systemPrompt = TokenOptimizer.getMinimalSystemPrompt('trend');
const optimized = TokenOptimizer.optimizePrompt(userInput);
const batchSize = TokenOptimizer.getOptimalBatchSize(1000);

console.log(`System: ${systemPrompt.length} chars`);
console.log(`Optimized: ${optimized.length} chars`);
console.log(`Batch Size: ${batchSize}`);
```

---

## 7️⃣ トークン消費監視ダッシュボード

### リアルタイム監視クエリ

```sql
-- 過去24時間のトークン消費
SELECT 
  DATE(timestamp) as date,
  api_type,
  method,
  COUNT(*) as call_count,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(cost) as total_cost
FROM api_call_log
WHERE timestamp > datetime('now', '-24 hours')
GROUP BY date, api_type, method
ORDER BY total_cost DESC;
```

### 月間コスト予測

```sql
-- 1日の平均トークン使用量から月間予測
SELECT 
  (SELECT SUM(cost) FROM api_call_log WHERE timestamp > datetime('now', '-1 days')) * 30 
  as estimated_monthly_cost;
```

---

## 8️⃣ トークン削減チェックリスト

実装時に確認してください：

- ✅ システムプロンプトを最小化した（150 tokens → 15-30 tokens）
- ✅ バッチ処理を実装した（最大 20 投稿/API呼び出し）
- ✅ 出力フォーマットを明示した（冗長な出力を防止）
- ✅ キャッシング機構を追加した（重複分析を削減）
- ✅ 不要なフィールドをフィルタリングした
- ✅ 日別のコスト監視を設定した
- ✅ 月間予算上限を設定した
- ✅ トークン超過時のアラートを配置した

---

## 9️⃣ トークン超過時の対応策

### 予算管理

```javascript
class TokenBudgetManager {
  constructor(monthlyBudget = 50) { // $50/月
    this.monthlyBudget = monthlyBudget;
    this.spent = 0;
    this.startDate = new Date();
  }

  async executeTask(task, priority = 'normal') {
    const estimatedCost = task.estimatedCost;

    if (this.spent + estimatedCost > this.monthlyBudget) {
      if (priority === 'high') {
        console.warn(`⚠️  Budget exceeded. Executing high-priority task anyway.`);
      } else {
        console.error(`❌ Budget exceeded. Task skipped.`);
        return null;
      }
    }

    const result = await task.execute();
    this.spent += estimatedCost;
    return result;
  }

  getRemaining() {
    return this.monthlyBudget - this.spent;
  }
}
```

### 自動スロットリング

```javascript
// トークン使用量に基づいて API 呼び出し頻度を自動調整
class AdaptiveScheduler {
  async adjustSchedule(currentUsageRate) {
    if (currentUsageRate > 0.8) {
      // 80% 超過 → 処理を 50% 削減
      this.skipRate = 0.5;
    } else if (currentUsageRate > 0.6) {
      // 60% 超過 → 処理を 25% 削減
      this.skipRate = 0.25;
    } else {
      this.skipRate = 0;
    }

    console.log(`📊 Adjusted skip rate: ${this.skipRate * 100}%`);
  }
}
```

---

## 🔟 実運用での料金推定表

### 小規模企業（1 SNS アカウント）

```
パターン: 日1回のトレンド分析 + 自動投稿

トークン消費:
- トレンド分析: 65,560 tokens × 1回 = 65,560
- コンテンツ生成: 1,400 tokens × 1回 = 1,400
- 合計: 66,960 tokens/日

月間:
- Input: 65,560 × 30 × ($3/1M) = $5.90
- Output: 1,400 × 30 × ($15/1M) = $0.63
- 合計: $6.53/月

✅ 年間: $78.36
```

### 中規模企業（複数 SNS）

```
パターン: 日2回のトレンド分析 + 3プラットフォーム投稿

月間:
- Input: 65,560 × 2 × 30 × ($3/1M) = $11.80
- Output: 4,200 × 2 × 30 × ($15/1M) = $3.78
- 合計: $15.58/月

✅ 年間: $187
```

### 大規模企業（エンタープライズ）

```
パターン: 日3回のトレンド分析 + A/Bテスト + リアルタイム対応

月間:
- Input: 120,000 × 30 × ($3/1M) = $10.80
- Output: 10,000 × 30 × ($15/1M) = $4.50
- 合計: $15.30/月

✅ 年間: ~$180-400
```

---

## 最後に

**重要なポイント**:

1. **初期段階では低コスト**: $5-10/月 程度から始められます
2. **スケーリングは段階的**: ボリュームが増えても基本的にコストも線形に増加
3. **最適化で大幅削減**: 適切な実装で 30-50% のコスト削減が可能
4. **監視が重要**: 月1回はコスト監視を行い、スケジュール調整を検討

Claude APIを活用することで、手動では不可能な規模のSNS管理が、月数百円で実現できます！🚀

