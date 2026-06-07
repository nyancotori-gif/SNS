// GitHub Actions 用: 収集 → 分析 → 生成 → Slack通知 を1回実行して終了
const axios = require('axios');
const Groq = require('groq-sdk');
const Parser = require('rss-parser');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const rssParser = new Parser();

// ============================================
// 1. データ収集（URLと概要を保持）
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
    return (res.data.articles || []).map(a => ({
      title: a.title || '',
      description: a.description || '',
      url: a.url || ''
    }));
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
    return (res.data.hits || []).map(h => ({
      title: h.title || '',
      description: h.story_text ? h.story_text.slice(0, 200) : '',
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`
    }));
  } catch (e) {
    console.error('HackerNews error:', e.message);
    return [];
  }
}

async function fetchRSS() {
  const feeds = [
    // 日本語メディア
    { url: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml',        lang: 'ja' },
    { url: 'https://www.itmedia.co.jp/news/rss/2.0/',              lang: 'ja' },
    { url: 'https://gigazine.net/news/rss_2.0/',                   lang: 'ja' },
    { url: 'https://ascii.jp/rss.xml',                             lang: 'ja' },
    // 英語メディア（補完用）
    { url: 'https://techcrunch.com/tag/artificial-intelligence/feed/', lang: 'en' },
    { url: 'https://venturebeat.com/category/ai/feed/',            lang: 'en' }
  ];

  const jaArticles = [];
  const enArticles = [];

  for (const { url: feedUrl, lang } of feeds) {
    try {
      const feed = await rssParser.parseURL(feedUrl);
      feed.items.slice(0, 8).forEach(item => {
        const article = {
          title: item.title || '',
          description: item.contentSnippet ? item.contentSnippet.slice(0, 200) : '',
          url: item.link || '',
          lang
        };
        lang === 'ja' ? jaArticles.push(article) : enArticles.push(article);
      });
    } catch (e) {
      console.error(`RSS error (${feedUrl}):`, e.message);
    }
  }

  // 日本語記事を優先して返す
  return [...jaArticles, ...enArticles];
}

// ============================================
// 2. Groq でトレンド分析 & 投稿文生成
// ============================================

async function analyzeAndGenerate(articles) {
  // 日本語記事を優先し、残りを英語記事で補完
  const jaArticles = articles.filter(a => a.lang === 'ja');
  const enArticles = articles.filter(a => a.lang !== 'ja');
  const sorted = [...jaArticles, ...enArticles].slice(0, 35);

  const articleList = sorted.map((a, i) =>
    `[${i + 1}][${a.lang === 'ja' ? '日本語' : '英語'}] ${a.title}\n    概要: ${a.description || '(なし)'}\n    URL: ${a.url}`
  ).join('\n\n');

  const prompt = `以下は今日のAI関連ニュース一覧です（番号・タイトル・概要・URL付き）。

${articleList}

上記を分析して、以下をJSON形式で返してください（説明不要・JSONのみ）:
{
  "top_trend": "今日最も注目すべきAIトレンドのタイトル（25字以内）",
  "summary": "そのトレンドの背景・理由・影響を4〜5文で具体的に説明。数字・企業名・モデル名などの固有名詞を必ず含める",
  "news_picks": [
    { "text": "注目ニュース1の説明（2〜3文で具体的に）", "url": "参照した記事のURL" },
    { "text": "注目ニュース2の説明（2〜3文で具体的に）", "url": "参照した記事のURL" },
    { "text": "注目ニュース3の説明（2〜3文で具体的に）", "url": "参照した記事のURL" }
  ],
  "posts": [
    "投稿文1（日本語・80〜120字・ニュースの要点を一言でまとめる・ハッシュタグなし）",
    "投稿文2（日本語・80〜120字・別のニュースの要点・ハッシュタグなし）",
    "投稿文3（日本語・80〜120字・まとめや一言コメント・末尾にハッシュタグ2〜3個）"
  ]
}

ルール:
- 日本語記事がある場合は日本語記事を優先してまとめる
- 英語記事は日本語記事を補完する用途で使い、投稿文には日本語で内容を反映させる
- news_picks の url は必ず上記一覧に実際に存在するURLを使う
- 各投稿文は対応するニュースの内容を正確に反映させる（創作・憶測を入れない）
- 投稿文は80〜120字を目安にする（要点だけを簡潔に）
- 投稿文はすべて日本語で書く
- 内容に応じて投稿文は2〜4件に調整してよい`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000
  });
  const text = response.choices[0].message.content;

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
                    text.match(/```\s*([\s\S]*?)```/) ||
                    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    console.warn('⚠️ JSON形式で返ってきませんでした');
    return { top_trend: 'AIトレンド', summary: text.slice(0, 300), news_picks: [], posts: [] };
  }

  // 制御文字（タブ・改行以外）を除去してからパース
  const sanitized = jsonMatch[1].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return JSON.parse(sanitized);
}

// ============================================
// 3. Slack 通知
// ============================================

async function sendToSlack(result) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const today = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
  const picks = result.news_picks || [];
  const posts = result.posts || [];

  if (!webhookUrl) {
    console.log('\n===== 生成された投稿 =====');
    console.log(`トレンド: ${result.top_trend}`);
    console.log(`\n概要:\n${result.summary}`);
    picks.forEach((p, i) => console.log(`\n注目ニュース[${i + 1}]:\n${p.text}\n${p.url}`));
    posts.forEach((post, i) => console.log(`\n投稿文[${i + 1}]:\n${post}`));
    return;
  }

  // 注目ニュースのブロック（URLリンク付き）
  const newsBlocks = picks.map((p, i) => ({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${i + 1}.* ${p.text}\n<${p.url}|記事を読む>`
    }
  }));

  // 投稿文のブロック
  const postBlocks = posts.map((post, i) => ({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*[${i + 1}/${posts.length}]*\n${post}`
    }
  }));

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
        text: { type: 'mrkdwn', text: `*注目ニュース${picks.length}選*` }
      },
      ...newsBlocks,
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*SNS投稿文（${posts.length}件）*` }
      },
      ...postBlocks
    ]
  });

  console.log('✅ Slack に送信しました');
}

// ============================================
// 4. メイン実行
// ============================================

async function main() {
  console.log('=== AI Trend Bot 起動 ===');

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

  console.log('🤖 Groq で分析・投稿文生成中...');
  const result = await analyzeAndGenerate(allArticles);
  console.log('✅ 生成完了');

  await sendToSlack(result);
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
