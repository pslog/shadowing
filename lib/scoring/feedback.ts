// Short, encouraging feedback. One message only to avoid overwhelming users.

export interface FeedbackScores {
  pronunciation: number;
  speed: number;
  coverage: number;
  /** null when intonation could not be measured — excluded from the advice. */
  intonation: number | null;
  total: number;
  hasTranscript?: boolean;
}

const MIN_PRONUNCIATION_FOR_PASS = 91;

export function generateFeedback({
  pronunciation,
  speed,
  coverage,
  intonation,
  total,
  hasTranscript = true,
}: FeedbackScores): string {
  if (!hasTranscript)
    return "音声を認識できませんでした。静かな場所でもう一度録音してみましょう。";
  if (coverage < 80)
    return "文の一部が抜けています。短く区切って、最後まで声に出してみましょう。";
  if (pronunciation < MIN_PRONUNCIATION_FOR_PASS)
    return "発音がPass基準に届いていません。音を聞いてから、同じ順番でよりはっきりまねてください。";
  if (total >= 90) return "とても良いです。この文は自然に聞こえます。";
  if (total >= 80)
    return "Passです。もう少し練習すると、さらに自然に話せます。";

  // Only coach on dimensions we actually measured.
  const dims: Array<{ key: "pron" | "speed" | "inton"; value: number }> = [
    { key: "pron", value: pronunciation },
    { key: "speed", value: speed },
  ];
  if (intonation != null) dims.push({ key: "inton", value: intonation });
  const lowest = dims.reduce((a, b) => (b.value < a.value ? b : a));

  if (lowest.key === "pron")
    return "一番の課題は発音です。原文をもう一度聞いて、音をはっきり出してみましょう。";
  if (lowest.key === "speed")
    return "一番の課題は速度です。原文と比べて速すぎる、または遅すぎる可能性があります。";
  return "一番の課題はイントネーションです。文の区切りと上がり下がりに注意しましょう。";
}

/** Extra nudge shown under the score when the user is close but failed. */
export function almostFeedback(
  total: number,
  passScore: number,
  pronunciation?: number,
): string {
  if (
    typeof pronunciation === "number" &&
    pronunciation < MIN_PRONUNCIATION_FOR_PASS
  ) {
    return "発音が91点以上になるまで、もう一度試してみましょう。";
  }
  const gap = passScore - total;
  return `Passまであと${gap}点です。もう一度試してみましょう。`;
}
