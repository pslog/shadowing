// Short, encouraging feedback. One message only to avoid overwhelming users.

export interface FeedbackScores {
  pronunciation: number;
  speed: number;
  intonation: number;
  total: number;
}

export function generateFeedback({
  pronunciation,
  speed,
  intonation,
  total,
}: FeedbackScores): string {
  if (total >= 90) return "とても良いです。この文は自然に聞こえます。";
  if (total >= 80)
    return "Passです。もう少し練習すると、さらに自然に話せます。";

  const lowest = Math.min(pronunciation, speed, intonation);
  if (lowest === pronunciation)
    return "一番の課題は発音です。原文をもう一度聞いて、音をはっきり出してみましょう。";
  if (lowest === speed)
    return "一番の課題は速度です。原文と比べて速すぎる、または遅すぎる可能性があります。";
  return "一番の課題はイントネーションです。文の区切りと上がり下がりに注意しましょう。";
}

/** Extra nudge shown under the score when the user is close but failed. */
export function almostFeedback(total: number, passScore: number): string {
  const gap = passScore - total;
  return `Passまであと${gap}点です。もう一度試してみましょう。`;
}
