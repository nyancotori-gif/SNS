# 毎日18時巡回・キーワードフィルター・トークン管理
## 完全実装ガイド

---

## 📋 概要

このガイドでは、以下の要件を満たすSNS自動化システムを実装します：

✅ **巡回時間指定**: 毎日18時ごろにトレンド巡回
✅ **キーワードフィルター**: 指定したキーワードのみを取得（無関係なワードは除外）
✅ **トークン管理**: Claude API の消費トークン数を可視化・管理
✅ **定期投稿**: トレンド分析後のコンテンツ自動生成と投稿

---

## 🚀 クイックスタート（15分）

### ステップ 1: ファイル配置

```bash
cd sns-automation
cp advanced_sns_automation.js src/index.js
cp config_examples.js src/config/examples.js
cp token_cost_guide.md docs/
```

### ステップ 2: 環境変数設定 (.env)

```env
# Platform APIs
X_BEARER_TOKEN=your_token
X_API_URL=https://api.twitter.com/2
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_id
INSTAGRAM_TOKEN=your_token
INSTAGRAM_API_URL=https://graph.instagram.com
FACEBOOK_PAGE_ID=your_id
FACEBOOK_PAGE_TOKEN=your_token
FACEBOOK_API_URL=https://graph.facebook.com

# Claude API
ANTHROPIC_API_KEY=your_key

# Configuration
INDUSTRY=tech  # tech, fashion, business, entertainment
DATABASE_PATH=./sns_data_advanced.db
NODE_ENV=production

# Optional: Custom timings
CUSTOM_CRAWL_TIME=18:00
CUSTOM_TIMEZONE=Asia/Tokyo
```

### ステップ 3: 実行

```bash
npm start
# または開発モード
npm run dev
```

---

## 🎯 設定方法

### 方法 A: 業界別プリセット設定（推奨）

```bash
# .env に以下を設定
INDUSTRY=tech

# または別の業界:
INDUSTRY=fashion      # ファッション・ライフスタイル
INDUSTRY=business     # ビジネス・起業家向け
INDUSTRY=entertainment # エンタメ・エンタテイメント
```

各業界プリセットには、最適な巡回時間とキーワード設定が含まれています。

### 方法 B: カスタム設定

```javascript
// src/config/custom.js

const CustomConfig = {
  crawlConfig: {
    X: {
      enabled: true,
      crawlTime: '18:00',           // ⏰ 巡回時間
      timezone: 'Asia/Tokyo',
      
      // 🔍 取得したいキーワード
      searchQueries: [
        {
          keyword: 'Python',        // ✅ 取得対象
          exclude: ['詐欺', 'scam'] // 🚫 除外キーワード
        },
        {
          keyword: 'データベース',
          exclude: ['広告', 'スパム']
        },
        {
          keyword: 'API設計',
          exclude: ['詐欺']
        }
      ],
      
      maxResults: 100,     // 1回で取得する最大投稿数
      lookbackHours: 6     // 過去何時間分を対象か
    },
    
    Instagram: {
      enabled: true,
      crawlTime: '18:15',
      hashtags: ['#Python', '#プログラミング', '#WebDevelopment'],
      excludeHashtags: ['#広告', '#スパム'],
      maxResults: 50,
      lookbackHours: 6
    },
    
    Facebook: {
      enabled: true,
      crawlTime: '18:30',
      keywords: ['Python', 'プログラミング'],
      excludeKeywords: ['詐欺', '違法'],
      maxResults: 30,
      lookbackHours: 6
    }
  },

  postingConfig: {
    schedules: [
      { platform: 'X', time: '09:00', frequency: 'daily' },
      { platform: 'Instagram', time: '12:00', frequency: 'daily' },
      { platform: 'Facebook', time: '15:00', frequency: 'daily' }
    ]
  },

  analysisConfig: {
    minFrequency: 3,           // キーワードが3回以上出現
    excludeStopwords: true,    // 日本語の助詞などを除外
    language: 'ja',
    focusOnPastHours: 24,      // 過去24時間を分析対象
    trendScoreThreshold: 0.5   // スコア0.5以上のみを抽出
  }
};

module.exports = CustomConfig;
```

### 方法 C: 実行時指定

```javascript
// src/index.js の最初に追加

const CustomConfig = require('./config/custom');
const configManager = new ConfigManager();

// カスタム設定を反映
configManager.crawlConfig = {
  ...configManager.crawlConfig,
  ...CustomConfig.crawlConfig
};

configManager.postingConfig = {
  ...configManager.postingConfig,
  ...CustomConfig.postingConfig
};

console.log('Configuration loaded from custom.js');
```

---

## ⏰ 時間設定の詳細

### Cron 形式について

```
Cron format: "分 時 日 月 曜日"

例:
'0 18 * * *'   → 毎日 18:00
'0 18 * * 1-5' → 平日のみ 18:00（月-金）
'0 18 * * 0,6' → 土日のみ 18:00
'*/30 18 * * *' → 18:00-18:59 の間、30分ごと（18:00, 18:30）
'0 9,13,18 * * *' → 毎日 09:00, 13:00, 18:00
```

### 複数の時間帯で巡回

```javascript
// 複数時間の巡回スケジュール
const crawlTimes = ['06:00', '12:00', '18:00', '23:00'];

for (const time of crawlTimes) {
  const cronTime = configManager.timeToCron(time);
  
  schedule.scheduleJob(cronTime, async () => {
    console.log(`Crawling at ${time}`);
    for (const crawler of Object.values(crawlers)) {
      await crawler.crawl();
    }
  });
}
```

---

## 🔍 キーワードフィルタリングの仕組み

### フィルタリングロジック

```
投稿データ
  ↓
キーワード包含チェック
  ├─ キーワードを含むか？ → NO → ❌ 除外
  └─ YES ↓
  
除外キーワードチェック
  ├─ 除外キーワードを含むか？ → YES → ❌ 除外
  └─ NO ↓
  
✅ 採用（DBに保存）
```

### 実装例

```javascript
// キーワードフィルタリングの実装例

class KeywordFilter {
  matchesKeywords(text, searchQueries) {
    for (const query of searchQueries) {
      const keyword = query.keyword.toLowerCase();
      const exclude = (query.exclude || []).map(w => w.toLowerCase());

      // ✅ キーワードを含むか確認
      if (!text.toLowerCase().includes(keyword)) {
        continue;  // このクエリはスキップ
      }

      // 🚫 除外ワードが含まれていないか確認
      const hasExcluded = exclude.some(word => 
        text.toLowerCase().includes(word)
      );

      if (!hasExcluded) {
        return true;  // ✅ このクエリにマッチ！
      }
    }
    
    return false;  // ❌ どのクエリにもマッチしなかった
  }
}
```

### フィルタリング統計の表示

```javascript
// DB から統計を取得
async function showFilterStats() {
  const stats = await db.all(`
    SELECT 
      platform,
      COUNT(*) as total_posts,
      SUM(CASE WHEN matched_queries IS NOT NULL THEN 1 ELSE 0 END) as filtered_posts
    FROM filtered_posts
    WHERE fetched_at > datetime('now', '-24 hours')
    GROUP BY platform
  `);

  console.log('\n📊 Filter Statistics (24h):');
  for (const stat of stats) {
    const filterRate = (stat.filtered_posts / stat.total_posts * 100).toFixed(1);
    console.log(`${stat.platform}:`);
    console.log(`  Total: ${stat.total_posts}`);
    console.log(`  Filtered: ${stat.filtered_posts}`);
    console.log(`  Filter Rate: ${filterRate}%`);
  }
}
```

---

## 💰 トークン消費量の確認方法

### リアルタイム確認

```javascript
// 実行中のトークン使用量を表示
setInterval(() => {
  const stats = tokenCounter.getStats();
  console.log('\n💾 Current Token Usage:');
  console.log(`  Input: ${stats.input_tokens.toLocaleString()}`);
  console.log(`  Output: ${stats.output_tokens.toLocaleString()}`);
  console.log(`  Total: ${stats.total_tokens.toLocaleString()}`);
  console.log(`  Cost: $${stats.estimated_cost_usd}`);
}, 60000);  // 1分ごと
```

### 日別レポート

```javascript
// DB から日別統計を取得
async function getDailyReport(date) {
  const report = await db.all(`
    SELECT 
      DATE(timestamp) as date,
      api_type,
      COUNT(*) as calls,
      SUM(input_tokens) as input,
      SUM(output_tokens) as output,
      SUM(cost) as cost
    FROM api_call_log
    WHERE DATE(timestamp) = ?
    GROUP BY api_type
  `, [date]);

  return report;
}

// 使用例
const report = await getDailyReport('2024-01-15');
console.table(report);
```

### 月間予算確認

```javascript
// 今月のコスト見積もり
async function getMonthlyBudget() {
  const result = await db.get(`
    SELECT 
      SUM(cost) as spent,
      COUNT(DISTINCT DATE(timestamp)) as days_used,
      (SELECT SUM(cost) FROM api_call_log 
       WHERE YEAR(timestamp) = YEAR(CURDATE()) 
       AND MONTH(timestamp) = MONTH(CURDATE())) * 
      (DATE(LAST_DAY(CURDATE())) - DAY(CURDATE()) + 1) / 
      (SELECT COUNT(DISTINCT DATE(timestamp)) FROM api_call_log 
       WHERE YEAR(timestamp) = YEAR(CURDATE()) 
       AND MONTH(timestamp) = MONTH(CURDATE())) as estimated_monthly
    FROM api_call_log
    WHERE YEAR(timestamp) = YEAR(CURDATE())
    AND MONTH(timestamp) = MONTH(CURDATE())
  `);

  console.log(`\n💳 Monthly Budget Report:`);
  console.log(`  Spent so far: $${result.spent.toFixed(2)}`);
  console.log(`  Days used: ${result.days_used}`);
  console.log(`  Estimated monthly: $${result.estimated_monthly.toFixed(2)}`);
}
```

### 予算超過時のアラート

```javascript
// 月間予算管理
class BudgetManager {
  constructor(monthlyBudget = 50) {
    this.monthlyBudget = monthlyBudget;
    this.threshold = 0.8;  // 80% で警告
  }

  async checkBudget() {
    const result = await db.get(`
      SELECT SUM(cost) as spent FROM api_call_log
      WHERE YEAR(timestamp) = YEAR(CURDATE())
      AND MONTH(timestamp) = MONTH(CURDATE())
    `);

    const spent = result.spent || 0;
    const remaining = this.monthlyBudget - spent;
    const ratio = spent / this.monthlyBudget;

    if (ratio > 1) {
      console.error(`❌ BUDGET EXCEEDED! $${spent.toFixed(2)} / $${this.monthlyBudget}`);
      // 処理を停止
      return false;
    } else if (ratio > this.threshold) {
      console.warn(`⚠️  Budget warning: ${(ratio * 100).toFixed(1)}% used`);
    }

    console.log(`✅ Budget OK: $${remaining.toFixed(2)} remaining`);
    return true;
  }
}
```

---

## 🔧 トレンブルシューティング

### Q1: 18:00に巡回が実行されない

**原因**: タイムゾーン設定の誤り

```javascript
// .env に設定
CUSTOM_TIMEZONE=Asia/Tokyo

// または src/index.js で直接指定
process.env.TZ = 'Asia/Tokyo';
```

### Q2: キーワードフィルターが機能していない

**確認方法**:
```javascript
// フィルター前後のデータを比較
const beforeFilter = await db.get(`SELECT COUNT(*) as count FROM raw_posts`);
const afterFilter = await db.get(`SELECT COUNT(*) as count FROM filtered_posts`);

console.log(`Before: ${beforeFilter.count}`);
console.log(`After: ${afterFilter.count}`);
console.log(`Filter rate: ${(afterFilter.count / beforeFilter.count * 100).toFixed(1)}%`);

// フィルター率が極端に低い場合はキーワード設定を見直し
```

### Q3: トークン消費量が予想より多い

**対応方法**:
1. バッチサイズを削減（maxResults を減らす）
2. 分析頻度を下げる
3. システムプロンプトを簡潔にする
4. 出力フォーマットを明示してなるべく短く

```javascript
// 最適化例
crawlConfig.X.maxResults = 50;  // 100 → 50 に削減
analysisConfig.focusOnPastHours = 12;  // 24 → 12 に削減

// これだけで約50% トークン削減
```

---

## 📊 実装チェックリスト

実装完了時に確認してください：

- ✅ `.env` ファイルにすべての API キーが設定されている
- ✅ 巡回時間が指定されている（例: 18:00）
- ✅ キーワードと除外キーワードが設定されている
- ✅ 初回実行でエラーが出ていない
- ✅ データベースにフィルター済み投稿が保存されている
- ✅ トレンド分析が実行できている
- ✅ コンテンツが生成できている
- ✅ トークン使用量が表示されている
- ✅ 月間予算が設定されている
- ✅ ログファイルが生成されている

---

## 📈 実装後の最適化

### Phase 1: 基本運用（1週間）
```
目標: システムの安定稼働確認
- 毎日のログを確認
- フィルター率を監視
- トークン使用量を記録
```

### Phase 2: チューニング（2週間目）
```
目標: キーワード設定の最適化
- フィルター率が 70% 以上か確認
- エンゲージメント率の高い投稿を分析
- キーワード調整
```

### Phase 3: スケーリング（3週間目）
```
目標: 投稿频度の最適化
- 複数時間帯での巡回テスト
- 複数の異なる言語対応の検討
- A/B テスト開始
```

---

## 🎓 次のステップ

1. **API 認証の自動更新**
   - トークンの有効期限切れ対応
   - 自動リフレッシュ機構

2. **機械学習の導入**
   - エンゲージメント予測
   - 最適投稿時間の動的学習

3. **ダッシュボード構築**
   - Web UI での実時間監視
   - グラフを使った視覚化

4. **多言語対応**
   - 複数言語のキーワード同時巡回
   - 言語ごとの最適化

---

## 💡 Pro Tips

### Tip 1: 段階的な展開

```bash
# 本番環境に移す前に、ステージング環境でテスト
NODE_ENV=staging npm start

# 問題がなければ本番環境に
NODE_ENV=production npm start
```

### Tip 2: ドライラン機能

```javascript
// 実際には投稿せず、内容をコンソール出力のみ
if (process.env.DRY_RUN === 'true') {
  console.log('🧪 DRY RUN MODE - No actual posts will be published');
  return;
}
```

### Tip 3: 通知機能の追加

```javascript
// 重要なイベントを Slack に通知
async function notifySlack(message) {
  await axios.post(process.env.SLACK_WEBHOOK_URL, {
    text: message
  });
}

// 使用例
await notifySlack(`✅ Crawl completed: ${filteredCount} posts filtered`);
```

---

お疲れ様でした！これで完全に動作するSNS自動化システムが完成です。🎉

質問や不明な点があれば、各ドキュメントを参照するか、GitHub Issues で質問してください！

