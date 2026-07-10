import type { LessonSentence } from "@/lib/types";

type Token = [string] | [string, string];

/**
 * Renders a sentence with furigana ruby over kanji. `sentence.furigana` is a
 * JSON array of tokens ([surface] or [surface, reading]); falls back to plain
 * ja_text when absent/invalid. Style <rt> via the parent (e.g. Tailwind
 * `[&_rt]:text-[0.55em]`).
 */
export function Furigana({ sentence }: { sentence: LessonSentence }) {
  let tokens: Token[] | null = null;
  if (sentence.furigana) {
    try {
      tokens = JSON.parse(sentence.furigana) as Token[];
    } catch {
      tokens = null;
    }
  }
  if (!tokens || tokens.length === 0) return <>{sentence.ja_text}</>;

  return (
    <>
      {tokens.map((t, i) =>
        t.length > 1 ? (
          <ruby key={i}>
            {t[0]}
            <rt>{t[1]}</rt>
          </ruby>
        ) : (
          <span key={i}>{t[0]}</span>
        ),
      )}
    </>
  );
}
