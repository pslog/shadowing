"use client";

// Reference-audio playback. When a lesson has no uploaded media we synthesize
// the Japanese sentence with the browser's SpeechSynthesis (ja-JP) so the
// normal and slow playback buttons work out of the box.

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let jaVoice: SpeechSynthesisVoice | null = null;

function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  if (jaVoice) return jaVoice;
  const voices = window.speechSynthesis.getVoices();
  jaVoice =
    voices.find((v) => v.lang === "ja-JP") ??
    voices.find((v) => v.lang.startsWith("ja")) ??
    null;
  return jaVoice;
}

export function speakJa(text: string, rate = 1): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported()) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = rate;
    const v = pickJapaneseVoice();
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function cancelSpeech() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
