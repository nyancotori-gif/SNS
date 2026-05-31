// GitHub Actions 用: 収集 → 分析 → 生成 → Slack通知 を1回実行して終了
const axios = require('axios');
const Groq = require('groq-sdk');
const Parser = require('rss-parser');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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

  const prompt = `以下は今日のAI関連ニュースの一覧です。

${articleList}

これらを分析して、以下をJSON形式で返してください（説明不要・JSONのみ）:
{
  "top_trend": "今日最も注目すべきAIトレンドのタイトル（20字以内）",
  "summary": "そのトレンドの背景・理由・影響を3〜4文で具体的に説明。数字・企業名・モデル名など固有名詞を必ず含める",
  "news_picks": [
    "注目ニュース1（1文で具体的に）",
    "注目ニュース2（1文で具体的に）",
    "注目ニュース3（1文で具体的に）"
  ],
  "post": "SNS投稿文（日本語・300字程度・具体的な数字や固有名詞を含む・ハッシュタグ3〜5個を末尾に）"
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500
  });
  const text = response.choices[0].message.content;

  // JSON ブロックを抽出（```json ... ``` や { ... } 形式に対応）
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
                    text.match(/```\s*([\s\S]*?)```/) ||
                    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    // JSON が見つからない場合はテキストをそのまま使う
    console.warn('⚠️ JSON形式で返ってきませんでした。テキストをそのまま使用します。');
    return { trend: 'AIトレンド', post: text.slice(0, 200) };
  }

  return JSON.parse(jsonMatch[1]);
}

// ============================================
// 3. Slack 通知
// ============================================

async function sendToSlack(result) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const newsPicks = (result.news_picks || []).map(n => `• ${n}`).join('\n');
  const today = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });

  if (!webhookUrl) {
    console.log('\n===== 生成された投稿 =====');
    console.log(`トレンド: ${result.top_trend}`);
    console.log(`\n概要:\n${result.summary}`);
    console.log(`\n注目ニュース:\n${newsPicks}`);
    console.log(`\n投稿文:\n${result.post}`);
    return;
  }

  await axios.post(webhookUrl, {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📰 AIトレンドレポート｜${today}` }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*本日のトレンド*\n*${result.top_trend}*` }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*概要*\n${result.summary}` }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*注目ニュース3選*\n${newsPicks}` }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*SNS投稿文*\n${result.post}` }
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
  await sendToSlack(result);
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
