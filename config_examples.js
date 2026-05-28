// ============================================
// Configuration Examples & Customization Guide
// キーワード・時間設定の実装例
// ============================================

// src/config/examples.js

/**
 * ============================================
 * 例1: テック業界向け設定
 * ============================================
 * 
 * 特性:
 * - 毎日18時にAI・Web3・クラウド関連のキーワード巡回
 * - スパム・詐欺関連の投稿は除外
 * - 1日3回のトレンド分析
 */

const TechIndustryConfig = {
  crawlConfig: {
    X: {
      enabled: true,
      crawlTime: '18:00',
      timezone: 'Asia/Tokyo',
      searchQueries: [
        {
          keyword: 'AI',
          exclude: ['詐欺', 'scam', 'fake']
        },
        {
          keyword: 'ChatGPT',
          exclude: ['スパム', 'botnet']
        },
        {
          keyword: 'Web3',
          exclude: ['詐欺', 'rug pull']
        },
        {
          keyword: 'クラウド',
          exclude: ['詐欺', '違法']
        }
      ],
      maxResults: 100,
      lookbackHours: 6
    },
    
    Instagram: {
      enabled: true,
      crawlTime: '18:15',
      timezone: 'Asia/Tokyo',
      hashtags: ['#AI', '#テック', '#イノベーション', '#ChatGPT'],
      excludeHashtags: ['#詐欺', '#スパム'],
      maxResults: 50,
      lookbackHours: 6
    },
    
    Facebook: {
      enabled: true,
      crawlTime: '18:30',
      timezone: 'Asia/Tokyo',
      keywords: ['AI', 'テクノロジー', 'デジタル化'],
      excludeKeywords: ['詐欺', '違法'],
      maxResults: 30,
      lookbackHours: 6
    }
  },
  
  postingConfig: {
    schedules: [
      { platform: 'X', time: '09:00', frequency: 'daily' },
      { platform: 'X', time: '13:00', frequency: 'daily' },
      { platform: 'X', time: '18:00', frequency: 'daily' },
      { platform: 'Instagram', time: '12:00', frequency: 'daily' },
      { platform: 'Facebook', time: '15:00', frequency: 'daily' }
    ]
  },
  
  analysisConfig: {
    minFrequency: 3,
    excludeStopwords: true,
    language: 'ja',
    focusOnPastHours: 24,
    trendScoreThreshold: 0.5,
    analysisSchedule: [
      { time: '09:30', frequency: 'daily' },
      { time: '14:00', frequency: 'daily' },
      { time: '19:00', frequency: 'daily' }
    ]
  }
};

/**
 * ============================================
 * 例2: ファッション・ライフスタイル向け設定
 * ============================================
 * 
 * 特性:
 * - 毎日19時にファッション・トレンド巡回
 * - ビジュアルコンテンツ重視（Instagram優先）
 * - 季節トレンドに対応
 */

const FashionLifestyleConfig = {
  crawlConfig: {
    X: {
      enabled: true,
      crawlTime: '19:00',
      timezone: 'Asia/Tokyo',
      searchQueries: [
        {
          keyword: 'ファッション',
          exclude: ['詐欺', 'fake']
        },
        {
          keyword: 'コーディネート',
          exclude: ['スパム']
        },
        {
          keyword: 'トレンド',
          exclude: ['詐欺']
        },
        {
          keyword: '春コーデ',  // 季節限定
          exclude: []
        }
      ],
      maxResults: 80,
      lookbackHours: 8
    },
    
    Instagram: {
      enabled: true,
      crawlTime: '19:15',
      timezone: 'Asia/Tokyo',
      hashtags: [
        '#ファッション',
        '#コーディネート',
        '#ファッションブロガー',
        '#トレンドファッション',
        '#春ファッション'
      ],
      excludeHashtags: ['#広告', '#スパム'],
      maxResults: 100,  // Instagram重視
      lookbackHours: 8
    },
    
    Facebook: {
      enabled: true,
      crawlTime: '19:30',
      timezone: 'Asia/Tokyo',
      keywords: ['ファッション', 'スタイリング', 'トレンド'],
      excludeKeywords: ['詐欺', '違法'],
      maxResults: 30,
      lookbackHours: 8
    }
  },
  
  postingConfig: {
    schedules: [
      { platform: 'Instagram', time: '08:00', frequency: 'daily' },  // 早朝
      { platform: 'Instagram', time: '12:00', frequency: 'daily' },  // 昼
      { platform: 'Instagram', time: '19:00', frequency: 'daily' },  // 夜
      { platform: 'X', time: '10:00', frequency: 'daily' },
      { platform: 'Facebook', time: '14:00', frequency: 'daily' }
    ]
  },
  
  analysisConfig: {
    minFrequency: 2,  // ファッション系は低めに（多様性を重視）
    excludeStopwords: true,
    language: 'ja',
    focusOnPastHours: 48,  // 2日間のトレンド追跡
    trendScoreThreshold: 0.3  // 広めに抽出
  }
};

/**
 * ============================================
 * 例3: ビジネス・起業家向け設定
 * ============================================
 * 
 * 特性:
 * - 毎日18時にビジネス関連キーワード巡回
 * - LinkedIn 的な真面目なコンテンツ重視
 * - 高度なフィルタリング
 */

const BusinessStartupConfig = {
  crawlConfig: {
    X: {
      enabled: true,
      crawlTime: '18:00',
      timezone: 'Asia/Tokyo',
      searchQueries: [
        {
          keyword: '起業',
          exclude: ['詐欺', '怪しい', 'scam']
        },
        {
          keyword: '経営',
          exclude: ['詐欺', '違法']
        },
        {
          keyword: 'マーケティング',
          exclude: ['spam', '詐欺']
        },
        {
          keyword: '資金調達',
          exclude: ['詐欺', '違法']
        },
        {
          keyword: 'スタートアップ',
          exclude: ['詐欺', 'fake']
        }
      ],
      maxResults: 100,
      lookbackHours: 12  // より長期間の分析
    },
    
    Instagram: {
      enabled: false  // ビジネス向けなので Instagram は不要
    },
    
    Facebook: {
      enabled: true,
      crawlTime: '18:30',
      timezone: 'Asia/Tokyo',
      keywords: ['起業', '経営', 'ビジネス', '資金調達'],
      excludeKeywords: ['詐欺', '違法', 'MLM'],
      maxResults: 50,
      lookbackHours: 12
    }
  },
  
  postingConfig: {
    schedules: [
      { platform: 'X', time: '08:00', frequency: 'daily' },
      { platform: 'X', time: '12:00', frequency: 'daily' },
      { platform: 'X', time: '17:00', frequency: 'daily' },
      { platform: 'Facebook', time: '10:00', frequency: 'daily' },
      { platform: 'Facebook', time: '15:00', frequency: 'daily' }
    ]
  },
  
  analysisConfig: {
    minFrequency: 5,  // ビジネス系は高め（質重視）
    excludeStopwords: true,
    language: 'ja',
    focusOnPastHours: 36,
    trendScoreThreshold: 0.6  // 高めのスコア基準
  }
};

/**
 * ============================================
 * 例4: エンタメ・エンタテイメント向け設定
 * ============================================
 * 
 * 特性:
 * - 毎日20時に娯楽・エンタメ関連巡回
 * - 複数の巡回時間帯
 * - リアルタイムトレンドに素早く対応
 */

const EntertainmentConfig = {
  crawlConfig: {
    X: {
      enabled: true,
      crawlTime: '20:00',  // ゴールデンタイム
      timezone: 'Asia/Tokyo',
      searchQueries: [
        {
          keyword: 'ドラマ',
          exclude: ['詐欺', 'fake']
        },
        {
          keyword: 'アニメ',
          exclude: ['詐欺']
        },
        {
          keyword: '映画',
          exclude: ['詐欺', '違法動画']
        },
        {
          keyword: '芸能ニュース',
          exclude: ['詐欺', '根拠なし']
        },
        {
          keyword: '推し活',
          exclude: ['詐欺']
        }
      ],
      maxResults: 150,  // エンタメは量重視
      lookbackHours: 4   // リアルタイム性重視
    },
    
    Instagram: {
      enabled: true,
      crawlTime: '20:15',
      timezone: 'Asia/Tokyo',
      hashtags: [
        '#ドラマ',
        '#アニメ',
        '#映画',
        '#推しの子',
        '#推し活',
        '#推し事'
      ],
      excludeHashtags: ['#詐欺', '#違法'],
      maxResults: 150,  // 大量のビジュアルコンテンツ
      lookbackHours: 4
    },
    
    Facebook: {
      enabled: true,
      crawlTime: '20:30',
      timezone: 'Asia/Tokyo',
      keywords: ['ドラマ', 'アニメ', '映画', '芸能'],
      excludeKeywords: ['詐欺', '違法'],
      maxResults: 50,
      lookbackHours: 4
    }
  },
  
  postingConfig: {
    schedules: [
      // 多頻度投稿（エンタメは量が命）
      { platform: 'X', time: '07:00', frequency: 'daily' },
      { platform: 'X', time: '10:00', frequency: 'daily' },
      { platform: 'X', time: '13:00', frequency: 'daily' },
      { platform: 'X', time: '16:00', frequency: 'daily' },
      { platform: 'X', time: '19:00', frequency: 'daily' },
      { platform: 'X', time: '21:00', frequency: 'daily' },
      { platform: 'Instagram', time: '08:00', frequency: 'daily' },
      { platform: 'Instagram', time: '14:00', frequency: 'daily' },
      { platform: 'Instagram', time: '20:00', frequency: 'daily' },
      { platform: 'Facebook', time: '12:00', frequency: 'daily' },
      { platform: 'Facebook', time: '18:00', frequency: 'daily' }
    ]
  },
  
  analysisConfig: {
    minFrequency: 1,  // エンタメは低め（多様なコンテンツ歓迎）
    excludeStopwords: true,
    language: 'ja',
    focusOnPastHours: 12,
    trendScoreThreshold: 0.2,  // 広めに抽出
    analysisSchedule: [
      { time: '07:00', frequency: 'daily' },
      { time: '13:00', frequency: 'daily' },
      { time: '19:00', frequency: 'daily' }  // 複数回分析
    ]
  }
};

/**
 * ============================================
 * 設定の動的切り替え実装例
 * ============================================
 */

class ConfigSelector {
  constructor() {
    this.configs = {
      tech: TechIndustryConfig,
      fashion: FashionLifestyleConfig,
      business: BusinessStartupConfig,
      entertainment: EntertainmentConfig
    };
  }

  selectConfig(industry) {
    const config = this.configs[industry];
    if (!config) {
      throw new Error(`Unknown industry: ${industry}`);
    }
    return config;
  }

  // 環境変数から自動選択
  static fromEnv() {
    const industry = process.env.INDUSTRY || 'tech';
    const selector = new ConfigSelector();
    return selector.selectConfig(industry);
  }

  // カスタム設定をマージ
  mergeCustom(baseConfig, customConfig) {
    return {
      crawlConfig: {
        ...baseConfig.crawlConfig,
        ...customConfig.crawlConfig
      },
      postingConfig: {
        ...baseConfig.postingConfig,
        ...customConfig.postingConfig
      },
      analysisConfig: {
        ...baseConfig.analysisConfig,
        ...customConfig.analysisConfig
      }
    };
  }
}

/**
 * ============================================
 * 時間帯別の最適設定ジェネレーター
 * ============================================
 */

class OptimalTimeGenerator {
  // ターゲット地域のピークアクティブ時間
  static getPeakTimes(region) {
    const peakTimes = {
      'Japan': {
        morning: '07:00-09:00',
        afternoon: '12:00-14:00',
        evening: '19:00-21:00'
      },
      'USA': {
        morning: '08:00-10:00',
        afternoon: '12:00-14:00',
        evening: '18:00-20:00'
      },
      'Europe': {
        morning: '09:00-11:00',
        afternoon: '13:00-15:00',
        evening: '19:00-21:00'
      }
    };

    return peakTimes[region] || peakTimes['Japan'];
  }

  // 業界別の推奨巡回時間
  static getOptimalCrawlTime(industry) {
    const times = {
      tech: '18:00',        // 仕事終わり
      fashion: '19:00',     // 夜のショッピング時間
      business: '08:30',    // 朝の情報収集
      entertainment: '20:00', // ゴールデンタイム
      news: '06:00',        // 朝刊の時間
      sports: '21:00'       // スポーツ放送後
    };

    return times[industry] || '18:00';
  }

  // 複数の巡回スケジュール生成
  static generateMultipleSchedules(industry, frequency = 3) {
    const baseTime = this.getOptimalCrawlTime(industry);
    const [hours, minutes] = baseTime.split(':').map(Number);
    const schedules = [];

    for (let i = 0; i < frequency; i++) {
      const newHours = (hours + (i * 6)) % 24;  // 6時間ごと
      const timeStr = `${String(newHours).padStart(2, '0')}:${minutes}`;
      schedules.push(timeStr);
    }

    return schedules;
  }
}

/**
 * ============================================
 * 使用例
 * ============================================
 */

// 例1: 基本的な設定選択
function example1() {
  const config = ConfigSelector.fromEnv();
  console.log('Using config for:', process.env.INDUSTRY || 'tech');
  console.log('Crawl time (X):', config.crawlConfig.X.crawlTime);
}

// 例2: カスタム設定のマージ
function example2() {
  const selector = new ConfigSelector();
  const baseConfig = selector.selectConfig('tech');

  const customConfig = {
    crawlConfig: {
      X: {
        crawlTime: '17:00'  // 早い時間に変更
      }
    }
  };

  const merged = selector.mergeCustom(baseConfig, customConfig);
  console.log('Custom crawl time:', merged.crawlConfig.X.crawlTime);
}

// 例3: 最適時間の生成
function example3() {
  const peakTimes = OptimalTimeGenerator.getPeakTimes('Japan');
  console.log('Peak times in Japan:', peakTimes);

  const crawlTime = OptimalTimeGenerator.getOptimalCrawlTime('fashion');
  console.log('Optimal crawl time for fashion:', crawlTime);

  const schedules = OptimalTimeGenerator.generateMultipleSchedules('tech', 3);
  console.log('Generated schedules:', schedules);
}

// 例4: .env ファイルベースの動的設定
function example4() {
  // .env に以下を設定:
  // INDUSTRY=fashion
  // CUSTOM_CRAWL_TIME=17:00
  // POSTING_FREQUENCY=5

  const config = ConfigSelector.fromEnv();
  
  if (process.env.CUSTOM_CRAWL_TIME) {
    config.crawlConfig.X.crawlTime = process.env.CUSTOM_CRAWL_TIME;
  }

  console.log('Configuration loaded from .env');
  console.log('Industry:', process.env.INDUSTRY);
  console.log('Crawl time:', config.crawlConfig.X.crawlTime);
}

module.exports = {
  TechIndustryConfig,
  FashionLifestyleConfig,
  BusinessStartupConfig,
  EntertainmentConfig,
  ConfigSelector,
  OptimalTimeGenerator
};

// 簡単なテスト
if (require.main === module) {
  console.log('=== Configuration Examples ===\n');
  
  example1();
  console.log('---\n');
  
  example2();
  console.log('---\n');
  
  example3();
  console.log('---\n');
}
