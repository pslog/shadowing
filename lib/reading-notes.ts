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
};

export function readingNoteForLesson(
  slug: string | null | undefined,
  locale: Locale,
): ReadingNote | null {
  if (!slug) return null;
  return NOTES[slug]?.[locale] ?? NOTES[slug]?.ja ?? null;
}
