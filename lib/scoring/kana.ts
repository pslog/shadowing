// Japanese reading (kana) extraction — SERVER ONLY.
//
// Pronunciation scoring must compare *how it sounds*, not *how it's written*.
// STT (Web Speech API) freely returns kanji or kana ("私" vs "わたし"), so a raw
// character comparison punishes a perfectly-pronounced utterance. We tokenize
// both the target sentence and the transcript with kuromoji and compare their
// katakana readings instead.
//
// Loads the kuromoji dictionary lazily and once. If the dictionary can't be
// loaded (e.g. not traced into a serverless bundle), toReading() returns null
// and the caller falls back to kana-folded character comparison — so scoring
// degrades gracefully and never crashes.

import path from "node:path";

interface Tokenizer {
  tokenize(text: string): Array<{ surface_form: string; reading?: string }>;
}

export interface ReadingToken {
  surface: string;
  reading: string;
}

let tokenizerPromise: Promise<Tokenizer | null> | null = null;

function dicPath(): string {
  // kuromoji is a direct dependency, so node_modules/kuromoji is a real entry
  // (pnpm creates the top-level symlink). The dictionary ships under /dict.
  return path.join(process.cwd(), "node_modules", "kuromoji", "dict");
}

function getTokenizer(): Promise<Tokenizer | null> {
  if (!tokenizerPromise) {
    tokenizerPromise = (async () => {
      try {
        const { default: kuromoji } = await import("kuromoji");
        return await new Promise<Tokenizer | null>((resolve) => {
          kuromoji.builder({ dicPath: dicPath() }).build((err, tokenizer) => {
            resolve(err ? null : (tokenizer as unknown as Tokenizer));
          });
        });
      } catch {
        return null;
      }
    })();
  }
  return tokenizerPromise;
}

function prepareForReading(text: string): string {
  return text
    // Kuromoji can misread a kanji immediately followed by katakana as one
    // compound token (e.g. 今アパート -> コンアパート). A soft script boundary
    // keeps common mixed-script phrases phonetically correct.
    .replace(/([\p{Script=Han}])(?=[\p{Script=Katakana}ー])/gu, "$1 ")
    .replace(/([\p{Script=Katakana}ー])(?=[\p{Script=Han}])/gu, "$1 ");
}

function comparableReading(text: string): string {
  return text
    .replace(/[\s　]/g, "")
    .replace(/[。、！？!?.,・「」『』（）()~〜－「」]/g, "")
    .trim();
}

/**
 * Returns the katakana reading of `text`, or null if the tokenizer is
 * unavailable (caller should fall back to raw-character comparison).
 * Empty input returns "".
 */
export async function toReading(text: string): Promise<string | null> {
  const tokens = await toReadingTokens(text);
  if (!tokens) return null;
  return tokens.map((tok) => tok.reading).join("");
}

export async function toReadingTokens(text: string): Promise<ReadingToken[] | null> {
  const t = (text ?? "").trim();
  if (!t) return [];
  const prepared = prepareForReading(t);
  const tokenizer = await getTokenizer();
  if (!tokenizer) return null;
  try {
    return tokenizer
      .tokenize(prepared)
      .map((tok) => {
        const reading =
          tok.reading && tok.reading !== "*" ? tok.reading : tok.surface_form;
        return {
          surface: tok.surface_form,
          reading: comparableReading(reading),
        };
      })
      .filter(
        (tok) =>
          tok.surface.trim().length > 0 && comparableReading(tok.reading).length > 0,
      );
  } catch {
    return null;
  }
}
