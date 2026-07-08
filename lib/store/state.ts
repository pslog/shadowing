// The full local-first application state. This is the single serialized blob
// persisted to localStorage. Every collection mirrors a Supabase table so a
// future SupabaseRepository can populate the exact same shape.

import type {
  DailyMission,
  Lesson,
  LessonProgress,
  LessonSentence,
  Profile,
  SentenceAttempt,
  XpEvent,
} from "@/lib/types";

export interface AppState {
  profile: Profile | null;
  lessons: Lesson[];
  sentences: LessonSentence[];
  attempts: SentenceAttempt[];
  progress: LessonProgress[];
  missions: DailyMission[];
  xpEvents: XpEvent[];
}

export const STORAGE_KEY = "shadow-it-jp/v1";
export const SYSTEM_USER = "system";

export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Math.abs(hashString(String(performance.now()))).toString(36);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ------------------------------------------------------------------ //
//  Seed content - public sample lessons available to every user.      //
// ------------------------------------------------------------------ //

interface SeedSentence {
  ja: string;
  note: string;
}

interface SeedLesson {
  id: string;
  title: string;
  topic: string;
  level: string;
  source_url?: string;
  media_url?: string;
  sentences: SeedSentence[];
}

const INITIAL_VISIT_AUDIO_VIEW =
  "https://drive.google.com/file/d/1m3T0X7Dht_syp1MfaOfCj6Y20iDf1wcP/view";
const INITIAL_VISIT_AUDIO_DIRECT =
  "https://drive.google.com/uc?export=download&id=1m3T0X7Dht_syp1MfaOfCj6Y20iDf1wcP";

const SEED: SeedLesson[] = [
  {
    id: "seed-kickoff-purpose-overview",
    title: "第2課 – キックオフミーティング　プロジェクトの目的と概要",
    topic: "キックオフ",
    level: "N3-N2",
    sentences: [
      {
        ja: "では、プロジェクトのキックオフミーティングを始めたいと思います。よろしくお願いいたします。",
        note: "Tôi xin phép được bắt đầu buổi meeting kickoff.",
      },
      {
        ja: "はい、よろしくお願いいたします。",
        note: "Vâng, xin nhờ anh.",
      },
      {
        ja: "まず、本日のアジェンダについて説明いたします。最初に、SES様にプロジェクトの目的を説明していただきます。次に、弊社がキックオフ資料を説明いたします。そして、最後にQ&Aと相談をします。この順番で進めたいと思いますが、よろしいでしょうか。",
        note: "Trước tiên tôi xin phép giải thích về agenda cuộc họp hôm nay. Đầu tiên phía SES sẽ trình bày về mục đích của dự án. Tiếp đó phía công ty chúng tôi sẽ giải thích tài liệu kickoff. Và cuối cùng là phần thảo luận và Q&A. Trình tự như vậy anh/chị thấy ok chứ ạ?",
      },
      {
        ja: "はい。そうしましょう。ではまず、私から目的についてお話しします。今回はデジタル教科書のWebアプリケーションを開発します。動きのあるUIにすることで、生徒たちが楽しく学べるようにしたいと思っています。",
        note: "Vâng, cùng tiến hành như vậy nhé. Đầu tiên tôi xin nói về mục đích. Lần này, chúng tôi sẽ phát triển một ứng dụng web cho sách giáo khoa điện tử. Bằng cách tạo UI động, chúng tôi muốn tạo niềm vui học tập cho học sinh.",
      },
      {
        ja: "ご説明ありがとうございます。それでは、私からキックオフ資料を説明いたします。",
        note: "Cảm ơn chị đã giải thích. Tiếp theo tôi xin giải thích về tài liệu kickoff.",
      },
      {
        ja: "こちらをご覧ください。キックオフ資料の内容は、プロジェクトの概要、体制、開発手法、スケジュール、コミュニケーションプラン、リスクと課題です。では、順を追って説明いたします。",
        note: "Xin hãy quan sát vào đây. Nội dung của tài liệu kickoff gồm overview về dự án, cấu trúc, phương pháp phát triển, schedule, kế hoạch giao tiếp, các rủi ro và vấn đề. Tôi xin được giải thích từng bước.",
      },
      {
        ja: "はい。お願いします。",
        note: "Vâng, xin nhờ anh.",
      },
      {
        ja: "まず、プロジェクト概要についてです。今回のE-Learningプロジェクトは、Webアプリを開発するプロジェクトです。既存システムをベースに、WebGLを取り入れて機能追加と変更をします。",
        note: "Đầu tiên là về overview dự án. Dự án E-Learning lần này là một dự án phát triển web-app. Dựa trên hệ thống hiện có, chúng tôi kết hợp WebGL để update và bổ sung thêm chức năng.",
      },
    ],
  },
  {
    id: "seed-initial-visit-greeting",
    title: "初回訪問のあいさつ",
    topic: "敬語",
    level: "N3-N2",
    source_url: INITIAL_VISIT_AUDIO_VIEW,
    media_url: INITIAL_VISIT_AUDIO_DIRECT,
    sentences: [
      {
        ja: "私は、E-LearningプロジェクトのPMのアンと申します。どうぞよろしくお願いいたします。",
        note: "Tôi là An, PM của dự án E-Learning. Rất mong nhận được sự giúp đỡ.",
      },
      {
        ja: "今回のプロジェクト責任者の小巻と申します。どうぞよろしくお願いいたします。",
        note: "Tôi là Komaki, người chịu trách nhiệm dự án lần này. Rất mong nhận được sự giúp đỡ.",
      },
      {
        ja: "この度は、ご来社くださり、まことにありがとうございます。日本企業向けシステム開発部門長をしております、ホアンと申します。どうぞよろしくお願いいたします。",
        note: "Cảm ơn quý anh/chị lần này đã ghé thăm công ty. Tôi là Hoàn, trưởng phòng phát triển hệ thống khối doanh nghiệp Nhật.",
      },
      {
        ja: "私は、SESのIT部門でIT関連のプロジェクトを管理しています、小巻と申します。どうぞよろしくお願いいたします。",
        note: "Tên tôi là Komaki, quản lý các dự án liên quan đến IT tại bộ phận IT của SES. Cảm ơn quý anh/chị rất nhiều.",
      },
      {
        ja: "よろしくお願いいたします。私は日本のお客様向けのシステム開発プロジェクトを主に担当しております。今回のプロジェクトのPMをつとめることになりました、アンと申します。どうぞよろしくお願いいたします。",
        note: "Cảm ơn quý anh/chị. Tôi phụ trách chính các dự án phát triển hệ thống cho khách hàng Nhật Bản. Tôi là An, PM cho dự án này. Rất mong nhận được sự giúp đỡ.",
      },
      {
        ja: "今回は、皆さんとベトナムでプロジェクトのキックオフをするために参りましたので、2日間どうぞよろしくお願いします。前回訪問した黒田もぜひよろしくと申しておりました。",
        note: "Lần này tôi đến Việt Nam để khởi động dự án cùng mọi người, nên rất mong nhận được sự giúp đỡ trong 2 ngày tới. Anh Kuroda, người đã đến thăm lần trước, cũng gửi lời chào.",
      },
      {
        ja: "はい。弊社も対面でキックオフができ、光栄です。帰国されたあとに、SEのリーが要件定義の工程からオンサイトすることになっております。その際もよろしくお願いいたします。",
        note: "Vâng. Chúng tôi cũng rất vinh dự khi có thể trực tiếp họp kickoff. Sau khi quý anh/chị trở về Nhật Bản, anh Ly, SE của chúng tôi, sẽ onsite từ giai đoạn xác định yêu cầu. Khi đó cũng rất mong được giúp đỡ.",
      },
    ],
  },
  {
    id: "seed-api-review",
    title: "APIレビュー会議",
    topic: "API会議",
    level: "N3-N2",
    sentences: [
      {
        ja: "昨日はAPIのエラーハンドリングを修正しました。",
        note: "昨日の作業内容を報告する文です。",
      },
      {
        ja: "本番環境でエラーが発生しています。",
        note: "障害や不具合の状況説明で使います。",
      },
      {
        ja: "原因を調査して、午後までに報告します。",
        note: "次のアクションと期限を伝える文です。",
      },
      {
        ja: "このエンドポイントには認証が必要です。",
        note: "API仕様や実装条件を説明する文です。",
      },
      {
        ja: "レスポンスの形式をもう一度確認してください。",
        note: "レビューや確認依頼で使う文です。",
      },
    ],
  },
  {
    id: "seed-standup",
    title: "朝会（デイリースタンドアップ）",
    topic: "朝会",
    level: "N4-N3",
    sentences: [
      {
        ja: "昨日はログイン画面の実装を終わらせました。",
        note: "昨日完了した作業を報告する文です。",
      },
      {
        ja: "今日はコードレビューの対応をします。",
        note: "今日の予定を簡潔に伝える文です。",
      },
      {
        ja: "特にブロッカーはありません。",
        note: "進行を妨げる問題がないことを伝えます。",
      },
      {
        ja: "テスト環境へのデプロイで少し詰まっています。",
        note: "困っている点を共有する文です。",
      },
      {
        ja: "午後にペアプロで一緒に確認しましょう。",
        note: "共同作業を提案する文です。",
      },
    ],
  },
];

/** Build the seed lessons + sentences (public, owned by SYSTEM_USER). */
export function buildSeed(nowIso: string): {
  lessons: Lesson[];
  sentences: LessonSentence[];
} {
  const lessons: Lesson[] = [];
  const sentences: LessonSentence[] = [];

  for (const s of SEED) {
    lessons.push({
      id: s.id,
      user_id: SYSTEM_USER,
      title: s.title,
      topic: s.topic,
      level: s.level,
      duration_seconds: null,
      source_type: "upload",
      source_url: s.source_url ?? null,
      media_url: s.media_url ?? null,
      is_public: true,
      created_at: nowIso,
    });
    s.sentences.forEach((sent, i) => {
      sentences.push({
        id: `${s.id}-s${i + 1}`,
        lesson_id: s.id,
        order_index: i,
        ja_text: sent.ja,
        vi_translation: sent.note,
        audio_url: null,
        audio_start: null,
        audio_end: null,
        pass_score: 80,
        created_at: nowIso,
      });
    });
  }
  return { lessons, sentences };
}

export function emptyState(nowIso: string): AppState {
  const seed = buildSeed(nowIso);
  return {
    profile: null,
    lessons: seed.lessons,
    sentences: seed.sentences,
    attempts: [],
    progress: [],
    missions: [],
    xpEvents: [],
  };
}
