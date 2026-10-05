"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "recording"
  | "processing"
  | "done"
  | "error";

export interface RecordResult {
  attemptId: string;
  recognitionComplete: boolean;
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
  const attemptIdRef = useRef("");
  const recognitionCompleteRef = useRef(true);
  const stoppingRef = useRef(false);
  const startingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const urlsRef = useRef(new Set<string>());

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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setStatus("done");
    p.resolve({
      attemptId: attemptIdRef.current,
      recognitionComplete: recognitionCompleteRef.current,
      audioUrl: p.audioUrl,
      durationSeconds: p.duration,
      transcript: finalTranscriptRef.current.trim(),
    });
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || recorderRef.current?.state === "recording" || pendingRef.current) return;
    startingRef.current = true;
    stoppingRef.current = false;
    attemptIdRef.current = crypto.randomUUID();
    recognitionCompleteRef.current = true;
    setError(null);
    setInterim("");
    finalTranscriptRef.current = "";
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      startingRef.current = false;
      setError("マイクにアクセスできません。このページにマイク権限を許可してください。");
      setStatus("error");
      return;
    }
    streamRef.current = stream;
    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      startingRef.current = false;
      return;
    }

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
        urlsRef.current.add(url);
        const p = pendingRef.current;
        if (p) {
          p.audioUrl = url;
          p.audioReady = true;
          tryResolve();
        } else {
          URL.revokeObjectURL(url);
          urlsRef.current.delete(url);
        }
      };
      rec.start();
    } catch {
      startingRef.current = false;
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
        let final = "";
        for (let i = 0; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res[0]?.transcript ?? "";
          if (res.isFinal) final += text;
          else live += text;
        }
        finalTranscriptRef.current = final;
        setInterim(`${finalTranscriptRef.current}${live}`.trim());
      };
      recog.onerror = () => {
        recognitionCompleteRef.current = false;
        // Non-fatal: fall back to no-transcript scoring.
        const p = pendingRef.current;
        if (p) {
          p.sttReady = true;
          tryResolve();
        }
      };
      recog.onend = () => {
        if (!stoppingRef.current) recognitionCompleteRef.current = false;
        const p = pendingRef.current;
        if (p) {
          p.sttReady = true;
          tryResolve();
        }
      };
      try {
        recog.start();
      } catch {
        recognitionCompleteRef.current = false;
        recognitionRef.current = null;
      }
    }
    startingRef.current = false;

    startTimeRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;
    setStatus("recording");
  }, [tryResolve]);

  const stop = useCallback((): Promise<RecordResult> => {
    stoppingRef.current = true;
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
        timeoutRef.current = setTimeout(() => {
          const p = pendingRef.current;
          if (p && !p.sttReady) {
            recognitionCompleteRef.current = false;
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
      urlsRef.current.clear();
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
