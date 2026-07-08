// Minimal Web Speech API typings (not in the standard TS DOM lib).

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  onstart: ((ev: Event) => void) | null;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}
interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

// Minimal kuromoji typings (package ships no types).
declare module "kuromoji" {
  interface KuromojiToken {
    surface_form: string;
    reading?: string;
    pronunciation?: string;
  }
  interface Tokenizer {
    tokenize(text: string): KuromojiToken[];
  }
  interface Builder {
    build(cb: (err: Error | null, tokenizer: Tokenizer) => void): void;
  }
  const kuromoji: {
    builder(opts: { dicPath: string }): Builder;
  };
  export default kuromoji;
}
