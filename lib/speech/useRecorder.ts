"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "recording"
  | "processing"
  | "done"
  | "error";

export interface RecordResult {
  /** Object URL of the recorded audio (for local playback). */
  audioUrl: string | null;
  /** Recording length in seconds. */
  durationSeconds: number;
  /** Japanese transcript from Web Speech API ("" if unsupported/empty). */
  transcript: string;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Records the mic with MediaRecorder (for playback) while simultaneously
 * running Web Speech API recognition (ja-JP) for a real transcript. stop()
 * resolves once both the audio blob and the transcript are ready.
 */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sttSupported = useRef(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const startTimeRef = useRef(0);
  const finalTranscriptRef = useRef("");

  // Coordination for stop(): resolve only when audio + STT are both done.
  const pendingRef = useRef<{
    resolve: (r: RecordResult) => void;
    audioReady: boolean;
    sttReady: boolean;
    audioUrl: string | null;
    duration: number;
  } | null>(null);

  useEffect(() => {
    sttSupported.current = isSpeechRecognitionSupported();
  }, []);

  const tryResolve = useCallback(() => {
    const p = pendingRef.current;
    if (!p || !p.audioReady || !p.sttReady) return;
    pendingRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("done");
    p.resolve({
      audioUrl: p.audioUrl,
      durationSeconds: p.duration,
      transcript: finalTranscriptRef.current.trim(),
    });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setInterim("");
    finalTranscriptRef.current = "";
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("マイクにアクセスできません。このページにマイク権限を許可してください。");
      setStatus("error");
      return;
    }
    streamRef.current = stream;

    // --- MediaRecorder (playback) ---
    try {
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        const p = pendingRef.current;
        if (p) {
          p.audioUrl = url;
          p.audioReady = true;
          tryResolve();
        }
      };
      rec.start();
    } catch {
      setError("このブラウザは録音（MediaRecorder）に対応していません。");
      setStatus("error");
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    // --- Web Speech API (transcript) ---
    const Ctor =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (Ctor) {
      const recog = new Ctor();
      recognitionRef.current = recog;
      recog.lang = "ja-JP";
      recog.continuous = true;
      recog.interimResults = true;
      recog.maxAlternatives = 1;
      recog.onresult = (ev) => {
        let live = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res[0]?.transcript ?? "";
          if (res.isFinal) finalTranscriptRef.current += text;
          else live += text;
        }
        setInterim(live);
      };
      recog.onerror = () => {
        // Non-fatal: fall back to no-transcript scoring.
        const p = pendingRef.current;
        if (p) {
          p.sttReady = true;
          tryResolve();
        }
      };
      recog.onend = () => {
        const p = pendingRef.current;
        if (p) {
          p.sttReady = true;
          tryResolve();
        }
      };
      try {
        recog.start();
      } catch {
        recognitionRef.current = null;
      }
    }

    startTimeRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;
    setStatus("recording");
  }, [tryResolve]);

  const stop = useCallback((): Promise<RecordResult> => {
    return new Promise<RecordResult>((resolve) => {
      const now =
        typeof performance !== "undefined" ? performance.now() : 0;
      const duration = Math.max(0, (now - startTimeRef.current) / 1000);
      const hasStt = Boolean(recognitionRef.current);

      pendingRef.current = {
        resolve,
        audioReady: false,
        sttReady: !hasStt, // if no STT, that half is already "ready"
        audioUrl: null,
        duration,
      };
      setStatus("processing");

      try {
        recorderRef.current?.stop();
      } catch {
        const p = pendingRef.current;
        if (p) {
          p.audioReady = true;
          tryResolve();
        }
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }

      // Safety net: recognition sometimes never fires onend.
      if (hasStt) {
        setTimeout(() => {
          const p = pendingRef.current;
          if (p && !p.sttReady) {
            p.sttReady = true;
            tryResolve();
          }
        }, 1500);
      }
    });
  }, [tryResolve]);

  const reset = useCallback(() => {
    setInterim("");
    setError(null);
    finalTranscriptRef.current = "";
    setStatus("idle");
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.state === "recording" &&
          recorderRef.current.stop();
      } catch {
        /* ignore */
      }
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    status,
    interim,
    error,
    sttSupported: sttSupported.current,
    start,
    stop,
    reset,
  };
}
