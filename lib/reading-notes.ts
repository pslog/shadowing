import type { Locale } from "@/lib/i18n";

interface ReadingNote {
  keyword: string;
  body: string;
}

const NOTES: Record<string, Record<Locale, ReadingNote>> = {
  "kanji-shiawase-dokuhon-yasashii": {
    vi: {
      keyword: "憂 + 人 = 優しい",
      body: "Khi buồn khổ, người ở bên cạnh mình chính là người thật sự dịu dàng.",
    },
    ja: {
      keyword: "憂 + 人 = 優しい",
      body: "悲しいとき、そばにいてくれる人こそ本当に優しい人。",
    },
  },
  "kanji-shiawase-dokuhon-daijoubu": {
    vi: {
      keyword: "大丈夫 = 3 chữ có 人",
      body: "Dù gặp chuyện gì, quanh bạn vẫn có người nâng đỡ. Mùa xuân rồi sẽ đến.",
    },
    ja: {
      keyword: "大丈夫 = 3つの人",
      body: "どんなときも支えてくれる人がいる。だから春は必ずやってくる。",
    },
  },
  "kanji-shiawase-dokuhon-renai": {
    vi: {
      keyword: "恋 = 下心 / 愛 = 真心",
      body: "Tình yêu thật sự là chấp nhận trọn vẹn con người vốn có của đối phương.",
    },
    ja: {
      keyword: "恋 = 下心 / 愛 = 真心",
      body: "恋は落ちるもの、愛は深めるもの。相手をまるごと受け止めること。",
    },
  },
  "kanji-shiawase-dokuhon-iki": {
    vi: {
      keyword: "粋 = 九十 / 米 = 八十八",
      body: "Biết đủ với hạnh phúc nhỏ bé, không cần đạt 100 vẫn sống đẹp và biết ơn.",
    },
    ja: {
      keyword: "粋 = 九十 / 米 = 八十八",
      body: "百までいかなくても、足るを知り小さなしあわせに感謝する生き方。",
    },
  },
  "kanji-shiawase-dokuhon-asa": {
    vi: {
      keyword: "朝 = 十月十日",
      body: "Dù đêm có nặng nề, mỗi buổi sáng vẫn là một lần được sinh ra lại để bắt đầu tiếp.",
    },
    ja: {
      keyword: "朝 = 十月十日",
      body: "つらい夜のあとにも朝は来る。毎朝、もう一度生まれ変わるように始められる。",
    },
  },
  "kanji-shiawase-dokuhon-toki": {
    vi: {
      keyword: "時 = 一日 + 十 + 一 + 寸",
      body: "Trong một ngày có cả plus và minus, nhưng chuyện buồn chỉ là một phần nhỏ, cứ để thời gian dẫn mình đi.",
    },
    ja: {
      keyword: "時 = 一日 + 十 + 一 + 寸",
      body: "一日の中にはプラスもマイナスもある。でもマイナスは少しだけ、時に任せて進めばいい。",
    },
  },
};

export function readingNoteForLesson(
  slug: string | null | undefined,
  locale: Locale,
): ReadingNote | null {
  if (!slug) return null;
  return NOTES[slug]?.[locale] ?? NOTES[slug]?.ja ?? null;
}
