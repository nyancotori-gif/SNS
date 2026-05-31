// ============================================
// SNS Automation Platform - Advanced Version
// Keyword Filtering + Custom Timing + Token Management
// ============================================

// src/advanced/index.js

const dotenv = require('dotenv');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const sqlite3 = require('sqlite3').verbose();
const schedule = require('node-schedule');
const Parser = require('rss-parser');

dotenv.config();

// ============================================
// 0. トークン使用量管理
// ============================================

class TokenCounter {
  constructor() {
    this.stats = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      api_calls: 0,
      estimated_cost: 0
    };
    this.startTime = new Date();
  }

  // Claude API のトークン使用量を記録
  recordUsage(inputTokens, outputTokens) {
    this.stats.input_tokens += inputTokens;
    this.stats.output_tokens += outputTokens;
    this.stats.total_tokens += inputTokens + outputTokens;
    this.stats.api_calls += 1;

    // Sonnet 4 の料金（2024年現在）
    // Input: $3 / 1M tokens
    // Output: $15 / 1M tokens
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    this.stats.estimated_cost += inputCost + outputCost;
  }

  // トークン推定関数
  static estimateTokens(text) {
    // 粗い推定: 約 4 文字 = 1 トークン（英語ベース）
    // 日本語は約 1 文字 = 1 トークン
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
    return Math.ceil(isJapanese ? text.length : text.length / 4);
  }

  // 単一のプロンプト実行の推定コスト
  static estimateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    return {
      input_cost: inputCost.toFixed(6),
      output_cost: outputCost.toFixed(6),
      total_cost: (inputCost + outputCost).toFixed(6)
    };
  }

  getStats() {
    return {
      ...this.stats,
      uptime: `${Math.floor((new Date() - this.startTime) / 1000)}s`,
      estimated_cost_usd: this.stats.estimated_cost.toFixed(4)
    };
  }

  printReport() {
    console.log('\n💰 ===== TOKEN & COST REPORT =====');
    console.log(`📊 Total API Calls: ${this.stats.api_calls}`);
    console.log(`📝 Input Tokens: ${this.stats.input_tokens.toLocaleString()}`);
    console.log(`📤 Output Tokens: ${this.stats.output_tokens.toLocaleString()}`);
    console.log(`📊 Total Tokens: ${this.stats.total_tokens.toLocaleString()}`);
    console.log(`💵 Estimated Cost: $${this.stats.estimated_cost_usd}`);
    console.log(`⏱️  Uptime: ${this.getStats().uptime}`);
    console.log('================================\n');
  }
}

const tokenCounter = new TokenCounter();

// ============================================
// 1. キーワード・時間設定の定義
// ============================================

class ConfigManager {
  constructor() {
    // 巡回設定：時間＆キーワード
    this.crawlConfig = {
      // NewsAPI（AIニュース記事）
      NewsAPI: {
        enabled: true,
        crawlTime: '06:00',
        timezone: 'Asia/Tokyo',
        searchQueries: [
          { keyword: 'AI', exclude: ['fake', 'spam'] },
          { keyword: 'ChatGPT', exclude: ['scam'] },
          { keyword: 'artificial intelligence', exclude: [] }
        ],
        maxResults: 20,
        lookbackHours: 12
      },

      // Reddit（AIコミュニティ）
      Reddit: {
        enabled: true,
        crawlTime: '12:00',
        timezone: 'Asia/Tokyo',
        subreddits: ['MachineLearning', 'artificial', 'ChatGPT', 'singularity'],
        searchQueries: [
          { keyword: 'AI', exclude: ['spam'] },
          { keyword: 'LLM', exclude: [] }
        ],
        maxResults: 25,
        lookbackHours: 12
      },

      // RSS（AIニュースサイト）
      RSS: {
        enabled: true,
        crawlTime: '18:00',
        timezone: 'Asia/Tokyo',
        feeds: [
          'https://techcrunch.com/tag/artificial-intelligence/feed/',
          'https://venturebeat.com/category/ai/feed/',
          'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'
        ],
        searchQueries: [
          { keyword: 'AI', exclude: ['fake', 'spam'] },
          { keyword: 'LLM', exclude: [] },
          { keyword: 'ChatGPT', exclude: [] }
        ],
        maxResults: 20,
        lookbackHours: 12
      }
    };

    // 投稿設定
    this.postingConfig = {
      schedules: [
        { platform: 'X', time: '09:00', frequency: 'daily' },
        { platform: 'Instagram', time: '12:00', frequency: 'daily' },
        { platform: 'Facebook', time: '15:00', frequency: 'daily' }
      ]
    };

    // トレンド分析の詳細設定
    this.analysisConfig = {
      minFrequency: 3, // キーワードが3回以上出現
      excludeStopwords: true,
      language: 'ja', // 日本語
      focusOnPastHours: 24,
      trendScoreThreshold: 0.5 // 0.5以上のスコアのみ
    };
  }

  // 実際の時刻に基づいてスケジュール時刻を計算
  calculateNextCrawlTime(platform) {
    const config = this.crawlConfig[platform];
    const [hours, minutes] = config.crawlTime.split(':').map(Number);

    let nextTime = new Date();
    nextTime.setHours(hours, minutes, 0, 0);

    // 既に過ぎている場合は明日のその時刻
    if (nextTime < new Date()) {
      nextTime.setDate(nextTime.getDate() + 1);
    }

    return nextTime;
  }

  // Cronスケジュール表記に変換
  timeToCron(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return `${minutes} ${hours} * * *`;
  }

  printConfig() {
    console.log('\n⚙️  ===== CRAWL CONFIGURATION =====');
    for (const [platform, config] of Object.entries(this.crawlConfig)) {
      console.log(`\n📱 ${platform}:`);
      console.log(`   ⏰ Crawl Time: ${config.crawlTime}`);
      console.log(`   🔍 Keywords: ${JSON.stringify(config.searchQueries || config.hashtags || config.keywords)}`);
      console.log(`   🚫 Exclude: ${JSON.stringify(config.exclude || config.excludeHashtags || config.excludeKeywords)}`);
      console.log(`   📊 Max Results: ${config.maxResults}`);
      console.log(`   ⌛ Lookback: ${config.lookbackHours} hours`);
    }
    console.log('\n================================\n');
  }
}

const configManager = new ConfigManager();

// ============================================
// 2. キーワードフィルター
// ============================================

class KeywordFilter {
  constructor() {
    // 共通の除外ワード
    this.commonExcludeWords = [
      '広告', 'スパム', 'bot', 'fake', 'プロモ',
      'リンク', 'フォロー', '拡散', 'いいね'
    ];

    // 言語別のストップワード
    this.stopwords = {
      ja: ['は', 'を', 'に', 'の', 'で', 'から', 'まで', 'など'],
      en: ['the', 'is', 'at', 'which', 'on', 'a', 'and', 'or']
    };
  }

  // テキストがキーワードフィルターを通すか判定
  matchesKeywords(text, searchQueries) {
    for (const query of searchQueries) {
      const keyword = query.keyword.toLowerCase();
      const exclude = (query.exclude || []).map(w => w.toLowerCase());

      // キーワードを含むか
      if (!text.toLowerCase().includes(keyword)) {
        continue;
      }

      // 除外ワードを含まないか
      const hasExcluded = exclude.some(word => 
        text.toLowerCase().includes(word)
      );

      if (!hasExcluded) {
        return true;
      }
    }
    return false;
  }

  // ハッシュタグフィルター
  matchesHashtags(text, includeHashtags, excludeHashtags = []) {
    const extractedHashtags = (text.match(/#\w+/g) || []).map(h => h.toLowerCase());

    // 対象ハッシュタグを含むか
    const hasIncluded = includeHashtags.some(tag => 
      extractedHashtags.includes(tag.toLowerCase())
    );

    if (!hasIncluded) {
      return false;
    }

    // 除外ハッシュタグを含まないか
    const hasExcluded = excludeHashtags.some(tag =>
      extractedHashtags.includes(tag.toLowerCase())
    );

    return !hasExcluded;
  }

  // テキストをクリーニング＆キーワード抽出
  extractKeywords(text, language = 'ja') {
    let words = text.toLowerCase()
      .replace(/[^\w\s#]/g, '') // 特殊文字を除去
      .split(/\s+/)
      .filter(w => w.length > 1); // 1文字以下は除外

    // ストップワードを除外
    const stops = this.stopwords[language] || [];
    words = words.filter(w => !stops.includes(w));

    // 重複を除去
    return [...new Set(words)];
  }
}

const keywordFilter = new KeywordFilter();

// ============================================
// 3. データベース（拡張版）
// ============================================

class AdvancedDatabase {
  constructor(dbPath = './sns_data_advanced.db') {
    this.db = new sqlite3.Database(dbPath);
    this.db.configure('busyTimeout', 5000);
    this.init();
  }

  init() {
    this.db.serialize(() => {
      // 投稿データテーブル（フィルター結果を記録）
      this.db.run(`
        CREATE TABLE IF NOT EXISTS filtered_posts (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          content TEXT NOT NULL,
          hashtags TEXT,
          keywords TEXT,
          engagement_score REAL,
          matched_queries TEXT,
          created_at DATETIME,
          fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // トレンドテーブル
      this.db.run(`
        CREATE TABLE IF NOT EXISTS trends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          keyword TEXT,
          platform TEXT,
          frequency INTEGER,
          trend_score REAL,
          detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          analysis_date DATE
        )
      `);

      // 生成済みコンテンツ
      this.db.run(`
        CREATE TABLE IF NOT EXISTS generated_content (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT,
          content TEXT,
          status TEXT DEFAULT 'scheduled',
          scheduled_time DATETIME,
          posted_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // クローリング履歴（トークン使用量を含む）
      this.db.run(`
        CREATE TABLE IF NOT EXISTS crawl_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT,
          crawl_time DATETIME,
          posts_found INTEGER,
          posts_filtered INTEGER,
          tokens_used INTEGER,
          estimated_cost REAL,
          error_message TEXT
        )
      `);

      // API呼び出し履歴（詳細トークン追跡）
      this.db.run(`
        CREATE TABLE IF NOT EXISTS api_call_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          api_type TEXT,
          method TEXT,
          input_tokens INTEGER,
          output_tokens INTEGER,
          total_tokens INTEGER,
          cost REAL,
          response_time_ms INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async recordCrawl(platform, postsFound, postsFiltered, tokensUsed, cost) {
    await this.run(
      `INSERT INTO crawl_history (platform, crawl_time, posts_found, posts_filtered, tokens_used, estimated_cost)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [platform, new Date().toISOString(), postsFound, postsFiltered, tokensUsed, cost]
    );
  }

  async recordAPICall(apiType, method, inputTokens, outputTokens, responseTime) {
    const totalTokens = inputTokens + outputTokens;
    const cost = TokenCounter.estimateCost(inputTokens, outputTokens).total_cost;

    await this.run(
      `INSERT INTO api_call_log (api_type, method, input_tokens, output_tokens, total_tokens, cost, response_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [apiType, method, inputTokens, outputTokens, totalTokens, parseFloat(cost), responseTime]
    );
  }
}

const db = new AdvancedDatabase();

// ============================================
// 4. 改良版クローラー（キーワードフィルター付き）
// ============================================

class AdvancedSNSCrawler {
  constructor(platform, configManager, db) {
    this.platform = platform;
    this.config = configManager.crawlConfig[platform];
    this.db = db;
    this.tokenUsage = { input: 0, output: 0 };
  }

  // NewsAPI クローラー（無料・AIニュース記事）
  async crawlNewsAPI() {
    console.log(`\n🔍 Crawling NewsAPI with keywords: ${JSON.stringify(this.config.searchQueries)}`);
    const startTime = Date.now();

    try {
      const posts = [];

      for (const query of this.config.searchQueries) {
        const response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: query.keyword,
            language: 'en',
            sortBy: 'publishedAt',
            pageSize: Math.ceil(this.config.maxResults / this.config.searchQueries.length),
            apiKey: process.env.NEWS_API_KEY
          }
        });

        if (response.data.articles) {
          for (const article of response.data.articles) {
            const text = `${article.title} ${article.description || ''}`;
            if (keywordFilter.matchesKeywords(text, [query])) {
              posts.push({
                id: article.url,
                content: `${article.title}\n${article.description || ''}\n${article.url}`,
                hashtags: [],
                engagement: 0,
                created_at: article.publishedAt,
                matched_query: query.keyword
              });
            }
          }
        }
      }

      for (const post of posts) {
        await this.db.run(
          `INSERT OR IGNORE INTO filtered_posts
           (id, platform, content, hashtags, matched_queries, engagement_score, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [post.id, 'NewsAPI', post.content, '[]', post.matched_query, post.engagement, post.created_at]
        );
      }

      console.log(`✅ NewsAPI: ${posts.length} articles collected`);
      await this.db.recordCrawl('NewsAPI', posts.length, posts.length, 0, 0);
      return posts;
    } catch (error) {
      console.error(`❌ NewsAPI crawl error:`, error.message);
      await this.db.run(
        `INSERT INTO crawl_history (platform, crawl_time, error_message) VALUES (?, ?, ?)`,
        ['NewsAPI', new Date().toISOString(), error.message]
      );
      return [];
    }
  }

  // Reddit クローラー（無料・AIコミュニティ）
  async crawlReddit() {
    console.log(`\n🔍 Crawling Reddit subreddits: ${JSON.stringify(this.config.subreddits)}`);
    const startTime = Date.now();

    try {
      const posts = [];

      for (const subreddit of this.config.subreddits) {
        const response = await axios.get(
          `https://www.reddit.com/r/${subreddit}/new.json`,
          {
            params: { limit: Math.ceil(this.config.maxResults / this.config.subreddits.length) },
            headers: { 'User-Agent': 'ai-trend-bot/1.0' }
          }
        );

        if (response.data.data?.children) {
          for (const child of response.data.data.children) {
            const post = child.data;
            const text = `${post.title} ${post.selftext || ''}`;
            if (keywordFilter.matchesKeywords(text, this.config.searchQueries)) {
              posts.push({
                id: post.id,
                content: `${post.title}\n${post.selftext || ''}\nhttps://reddit.com${post.permalink}`,
                hashtags: [],
                engagement: post.score + post.num_comments,
                created_at: new Date(post.created_utc * 1000).toISOString(),
                matched_query: subreddit
              });
            }
          }
        }
      }

      for (const post of posts) {
        await this.db.run(
          `INSERT OR IGNORE INTO filtered_posts
           (id, platform, content, hashtags, matched_queries, engagement_score, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [post.id, 'Reddit', post.content, '[]', post.matched_query, post.engagement, post.created_at]
        );
      }

      console.log(`✅ Reddit: ${posts.length} posts collected`);
      await this.db.recordCrawl('Reddit', posts.length, posts.length, 0, 0);
      return posts;
    } catch (error) {
      console.error(`❌ Reddit crawl error:`, error.message);
      await this.db.run(
        `INSERT INTO crawl_history (platform, crawl_time, error_message) VALUES (?, ?, ?)`,
        ['Reddit', new Date().toISOString(), error.message]
      );
      return [];
    }
  }

  // RSS クローラー（完全無料・AIニュースサイト）
  async crawlRSS() {
    console.log(`\n🔍 Crawling RSS feeds: ${this.config.feeds.length} feeds`);
    const parser = new Parser();

    try {
      const posts = [];

      for (const feedUrl of this.config.feeds) {
        try {
          const feed = await parser.parseURL(feedUrl);
          for (const item of feed.items.slice(0, Math.ceil(this.config.maxResults / this.config.feeds.length))) {
            const text = `${item.title || ''} ${item.contentSnippet || item.content || ''}`;
            if (keywordFilter.matchesKeywords(text, this.config.searchQueries)) {
              posts.push({
                id: item.link || item.guid,
                content: `${item.title}\n${item.contentSnippet || ''}\n${item.link}`,
                hashtags: [],
                engagement: 0,
                created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                matched_query: feedUrl
              });
            }
          }
        } catch (feedError) {
          console.error(`❌ RSS feed error (${feedUrl}):`, feedError.message);
        }
      }

      for (const post of posts) {
        await this.db.run(
          `INSERT OR IGNORE INTO filtered_posts
           (id, platform, content, hashtags, matched_queries, engagement_score, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [post.id, 'RSS', post.content, '[]', post.matched_query, post.engagement, post.created_at]
        );
      }

      console.log(`✅ RSS: ${posts.length} articles collected`);
      await this.db.recordCrawl('RSS', posts.length, posts.length, 0, 0);
      return posts;
    } catch (error) {
      console.error(`❌ RSS crawl error:`, error.message);
      return [];
    }
  }

  async crawl() {
    switch (this.platform) {
      case 'NewsAPI':
        return await this.crawlNewsAPI();
      case 'Reddit':
        return await this.crawlReddit();
      case 'RSS':
        return await this.crawlRSS();
      default:
        throw new Error(`Unknown platform: ${this.platform}`);
    }
  }
}

// ============================================
// 5. 改良版トレンド分析（トークン管理付き）
// ============================================

class AdvancedTrendAnalyzer {
  constructor(db) {
    this.db = db;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async analyzeTrends() {
    console.log('\n📊 Analyzing trends with Claude API...');

    // 最新のフィルター済み投稿を取得
    const posts = await this.db.all(`
      SELECT * FROM filtered_posts 
      WHERE fetched_at > datetime('now', '-24 hours')
      ORDER BY fetched_at DESC
      LIMIT 500
    `);

    if (posts.length === 0) {
      console.log('⚠️  No filtered posts to analyze');
      return null;
    }

    // トレンド分析用プロンプト
    const analysisPrompt = `
あなたはSNS分析の専門家です。以下の投稿データを分析してください：

【投稿データ】
${JSON.stringify(posts.slice(0, 100), null, 2)}

【分析タスク】
1. 出現頻度の高いキーワード（TOP 5）を抽出
2. プラットフォーム別のトレンド傾向
3. エンゲージメント率が高い投稿パターン
4. ユーザー心理の分析

以下のJSON形式で結果を返してください：
{
  "topKeywords": [
    {"keyword": "キーワード", "frequency": 数値, "platforms": ["X", "Instagram"]}
  ],
  "platformTrends": {
    "X": "X独自のトレンド",
    "Instagram": "Instagram独自のトレンド",
    "Facebook": "Facebook独自のトレンド"
  },
  "engagementInsights": "エンゲージメント分析",
  "recommendations": ["推奨1", "推奨2"]
}
`;

    try {
      const startTime = Date.now();

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ]
      });

      // トークン使用量を記録
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const responseTime = Date.now() - startTime;

      tokenCounter.recordUsage(inputTokens, outputTokens);
      await this.db.recordAPICall('claude', 'trend_analysis', inputTokens, outputTokens, responseTime);

      // トークン情報を表示
      console.log(`\n💾 Token Usage for Trend Analysis:`);
      console.log(`   📝 Input Tokens: ${inputTokens.toLocaleString()}`);
      console.log(`   📤 Output Tokens: ${outputTokens.toLocaleString()}`);
      console.log(`   📊 Total: ${(inputTokens + outputTokens).toLocaleString()}`);
      console.log(`   💵 Estimated Cost: $${TokenCounter.estimateCost(inputTokens, outputTokens).total_cost}`);
      console.log(`   ⏱️  Response Time: ${responseTime}ms`);

      const analysisResult = JSON.parse(response.content[0].text);

      // トレンドをDBに保存
      for (const keyword of analysisResult.topKeywords) {
        await this.db.run(
          `INSERT INTO trends (keyword, platform, frequency, trend_score, analysis_date)
           VALUES (?, ?, ?, ?, date('now'))`,
          [keyword.keyword, 'multi', keyword.frequency, keyword.frequency / posts.length]
        );
      }

      console.log('✅ Trend analysis completed');
      return analysisResult;
    } catch (error) {
      console.error('❌ Error analyzing trends:', error.message);
      return null;
    }
  }
}

// ============================================
// 6. 改良版コンテンツジェネレーター（トークン管理付き）
// ============================================

class AdvancedContentGenerator {
  constructor(db) {
    this.db = db;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async generateContent(platform, trendData, brandVoice = 'フレンドリー、情報的') {
    console.log(`\n✍️  Generating content for ${platform}...`);

    const systemPrompt = `あなたはSNS専門のコンテンツクリエイターです。`;

    const userPrompt = `
プラットフォーム: ${platform}
ブランドトーン: ${brandVoice}
トレンドキーワード: ${JSON.stringify(trendData?.topKeywords || [])}

${platform === 'X' ? `
要件:
- 240字以内
- 絵文字を適度に使用
- ハッシュタグ: 3-5個
` : platform === 'Instagram' ? `
要件:
- キャプション: 150-300字
- 絵文字・顔文字を積極的に使用
- ハッシュタグ: 10-30個
- ストーリーテリング重視
` : `
要件:
- テキスト: 300-600字
- ハッシュタグ: 5-10個
- コミュニティ形成を意識
`}

JSON形式で以下を返してください：
{
  "content": "投稿テキスト",
  "hashtags": ["#tag1", "#tag2"],
  "cta": "コールトゥアクション"
}
`;

    try {
      const startTime = Date.now();

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      // トークン使用量を記録
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const responseTime = Date.now() - startTime;

      tokenCounter.recordUsage(inputTokens, outputTokens);
      await this.db.recordAPICall('claude', 'content_generation', inputTokens, outputTokens, responseTime);

      // トークン情報を表示
      console.log(`\n💾 Token Usage for Content Generation (${platform}):`);
      console.log(`   📝 Input Tokens: ${inputTokens.toLocaleString()}`);
      console.log(`   📤 Output Tokens: ${outputTokens.toLocaleString()}`);
      console.log(`   💵 Estimated Cost: $${TokenCounter.estimateCost(inputTokens, outputTokens).total_cost}`);
      console.log(`   ⏱️  Response Time: ${responseTime}ms`);

      const generatedContent = JSON.parse(response.content[0].text);

      // 生成されたコンテンツをDBに保存
      const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2時間後
      await this.db.run(
        `INSERT INTO generated_content (platform, content, status, scheduled_time)
         VALUES (?, ?, 'scheduled', ?)`,
        [platform, generatedContent.content, scheduledTime.toISOString()]
      );

      console.log(`✅ Content generated for ${platform}`);
      return generatedContent;
    } catch (error) {
      console.error(`❌ Error generating content:`, error.message);
      return null;
    }
  }
}

// ============================================
// 7. メインオーケストレーター
// ============================================

class AdvancedSNSOrchestrator {
  constructor() {
    this.configManager = configManager;
    this.crawlers = {};
    this.scheduler = new (require('node-schedule')).RecurrenceRule();
    this.trendAnalyzer = new AdvancedTrendAnalyzer(db);
    this.contentGenerator = new AdvancedContentGenerator(db);
    this.jobs = [];

    // 各ソース用クローラーを初期化
    for (const platform of ['NewsAPI', 'Reddit', 'RSS']) {
      this.crawlers[platform] = new AdvancedSNSCrawler(platform, configManager, db);
    }
  }

  async run() {
    console.log('\n🚀 Advanced SNS Automation Platform Started');
    configManager.printConfig();

    // 各プラットフォーム用のスケジュールを設定
    for (const [platform, crawler] of Object.entries(this.crawlers)) {
      const config = configManager.crawlConfig[platform];
      const cronTime = configManager.timeToCron(config.crawlTime);

      const job = require('node-schedule').scheduleJob(cronTime, async () => {
        console.log(`\n⏰ Scheduled crawl triggered for ${platform}`);
        await crawler.crawl();
      });

      this.jobs.push(job);
      console.log(`📅 ${platform} scheduled for ${config.crawlTime} (cron: ${cronTime})`);
    }

    // 毎日 19:00 にトレンド分析を実行
    const analyzeJob = require('node-schedule').scheduleJob('0 19 * * *', async () => {
      console.log('\n📊 Running trend analysis...');
      const trendData = await this.trendAnalyzer.analyzeTrends();

      // コンテンツ生成
      for (const platform of ['X', 'Instagram', 'Facebook']) {
        await this.contentGenerator.generateContent(platform, trendData);
      }
    });

    this.jobs.push(analyzeJob);

    // 初回実行
    console.log('\n🔄 Running initial crawl...');
    for (const [platform, crawler] of Object.entries(this.crawlers)) {
      if (configManager.crawlConfig[platform].enabled) {
        await crawler.crawl();
      }
    }

    console.log('\n✅ System initialized and ready!');
  }

  async generateReport() {
    console.log('\n\n📋 ===== DETAILED CRAWL REPORT =====');

    const crawlHistory = await db.all(`
      SELECT * FROM crawl_history 
      ORDER BY crawl_time DESC 
      LIMIT 10
    `);

    for (const record of crawlHistory) {
      console.log(`\n${record.platform}:`);
      console.log(`   Time: ${record.crawl_time}`);
      console.log(`   Posts Found: ${record.posts_found}`);
      console.log(`   Posts Filtered: ${record.posts_filtered}`);
      console.log(`   Filter Rate: ${((record.posts_filtered / (record.posts_found || 1)) * 100).toFixed(1)}%`);
    }

    // API呼び出し統計
    const apiStats = await db.all(`
      SELECT api_type, method, COUNT(*) as call_count, 
             SUM(input_tokens) as total_input, 
             SUM(output_tokens) as total_output,
             SUM(cost) as total_cost
      FROM api_call_log
      GROUP BY api_type, method
    `);

    console.log('\n\n📊 ===== API CALL STATISTICS =====');
    for (const stat of apiStats) {
      console.log(`\n${stat.api_type.toUpperCase()} - ${stat.method}:`);
      console.log(`   Calls: ${stat.call_count}`);
      console.log(`   Input Tokens: ${(stat.total_input || 0).toLocaleString()}`);
      console.log(`   Output Tokens: ${(stat.total_output || 0).toLocaleString()}`);
      console.log(`   Total Cost: $${(stat.total_cost || 0).toFixed(4)}`);
    }

    tokenCounter.printReport();
  }

  stop() {
    this.jobs.forEach(job => job.cancel());
    console.log('\n🛑 System stopped');
  }
}

// ============================================
// 8. エントリーポイント
// ============================================

if (require.main === module) {
  const orchestrator = new AdvancedSNSOrchestrator();

  orchestrator.run().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

  // 定期的にレポートを表示（1時間ごと）
  setInterval(() => {
    orchestrator.generateReport();
  }, 60 * 60 * 1000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    orchestrator.generateReport();
    orchestrator.stop();
    process.exit(0);
  });
}

module.exports = {
  AdvancedSNSOrchestrator,
  ConfigManager,
  KeywordFilter,
  AdvancedDatabase,
  AdvancedSNSCrawler,
  AdvancedTrendAnalyzer,
  AdvancedContentGenerator,
  TokenCounter
};
