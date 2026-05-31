// GitHub Actions 用: 収集 → 分析 → 生成 → Slack通知 を1回実行して終了
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const Parser = require('rss-parser');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const rssParser = new Parser();

// ============================================
// 1. データ収集
// ============================================

async function fetchNewsAPI(keyword) {
  try {
    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: keyword,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: process.env.NEWS_API_KEY
      }
    });
    return (res.data.articles || []).map(a => `${a.title}: ${a.description || ''}`);
  } catch (e) {
    console.error('NewsAPI error:', e.message);
    return [];
  }
}

async function fetchHackerNews(keyword) {
  try {
    const res = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: { query: keyword, tags: 'story', hitsPerPage: 10 }
    });
    return (res.data.hits || []).map(h => h.title);
  } catch (e) {
    console.error('HackerNews error:', e.message);
    return [];
  }
}

async function fetchRSS() {
  const feeds = [
    'https://techcrunch.com/tag/artificial-intelligence/feed/',
    'https://venturebeat.com/category/ai/feed/'
  ];
  const titles = [];
  for (const url of feeds) {
    try {
      const feed = await rssParser.parseURL(url);
      feed.items.slice(0, 8).forEach(item => titles.push(item.title));
    } catch (e) {
      console.error(`RSS error (${url}):`, e.message);
    }
  }
  return titles;
}

// ============================================
// 2. Claude でトレンド分析 & 投稿文生成
// ============================================

async function analyzeAndGenerate(articles) {
  const articleList = articles.slice(0, 40).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `以下は今日のAI関連ニュースの一覧です。

${articleList}

これらを読んで、以下をJSON形式で返してください（説明不要・JSONのみ）:
{
  "trend": "今日最も注目すべきAIトレンドを1文で",
  "post": "そのトレンドをもとにしたSNS投稿文（日本語・200字以内・ハッシュタグ3つ含む）"
}`
    }]
  });

  return JSON.parse(response.content[0].text);
}

// ============================================
// 3. Slack 通知
// ============================================

async function sendToSlack(trend, post) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('SLACK_WEBHOOK_URL が未設定です。コンソール出力のみ行います。');
    console.log('\n===== 生成された投稿 =====');
    console.log(`トレンド: ${trend}`);
    console.log(`\n投稿文:\n${post}`);
    return;
  }

  await axios.post(webhookUrl, {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '今日のAIトレンド投稿' }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*トレンド*\n${trend}` }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*生成された投稿文*\n${post}` }
      }
    ]
  });

  console.log('✅ Slack に送信しました');
}

// ============================================
// 4. メイン実行
// ============================================

async function main() {
  console.log('=== AI Trend Bot 起動 ===');

  // 収集
  console.log('📡 ニュースを収集中...');
  const [newsArticles, hnPosts, rssArticles] = await Promise.all([
    fetchNewsAPI('AI OR LLM OR ChatGPT'),
    fetchHackerNews('AI'),
    fetchRSS()
  ]);

  const allArticles = [...newsArticles, ...hnPosts, ...rssArticles];
  console.log(`✅ 合計 ${allArticles.length} 件収集`);

  if (allArticles.length === 0) {
    console.error('記事が0件のため終了します');
    process.exit(1);
  }

  // 分析 & 生成
  console.log('🤖 Claude で分析・投稿文生成中...');
  const result = await analyzeAndGenerate(allArticles);
  console.log(`✅ 生成完了`);

  // Slack 送信
  await sendToSlack(result.trend, result.post);
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
