"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type TimingLine = { sp: string; ja: string; start: number; end: number };
type TimingData = {
  exam: string;
  lesson: string;
  title: string;
  question: string;
  duration: number;
  audioUrl: string;
  hookUrl: string;
  hookDuration: number;
  backgroundUrl: string | null;
  source: "clip" | "reviewed";
  lines: TimingLine[];
};

const fmt = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  return `${mins}:${(seconds - mins * 60).toFixed(2).padStart(5, "0")}`;
};

function speakerTone(speaker: string) {
  return speaker.startsWith("女") ? "border-orange-400 bg-orange-50 text-orange-800" : "border-blue-400 bg-blue-50 text-blue-800";
}

export default function SocialTimingPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hookRef = useRef<HTMLAudioElement>(null);
  const stopAtRef = useRef<number | null>(null);
  const continueAfterHookRef = useRef(false);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [exam, setExam] = useState("");
  const [lesson, setLesson] = useState("");
  const [data, setData] = useState<TimingData | null>(null);
  const [lines, setLines] = useState<TimingLine[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewPhase, setPreviewPhase] = useState<"hook" | "lesson">("lesson");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [videoOutput, setVideoOutput] = useState<{ url: string; path: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeIndex = useMemo(() => {
    const current = lines.findIndex((line) => currentTime >= line.start && currentTime < line.end);
    return current >= 0 ? current : selectedIndex;
  }, [currentTime, lines, selectedIndex]);
  const activeLine = lines[activeIndex];
  const selectedLine = lines[selectedIndex];
  const dirty = data ? JSON.stringify(lines) !== JSON.stringify(data.lines) : false;

  async function loadTiming() {
    if (!exam || !lesson) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/social-timing?exam=${encodeURIComponent(exam)}&lesson=${encodeURIComponent(lesson)}`, { cache: "no-store" });
      const payload = (await response.json()) as TimingData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Không tải được timing.");
      setData(payload);
      setLines(payload.lines);
      setCurrentTime(0);
      setSelectedIndex(0);
      setVideoOutput(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được timing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadLatestTiming() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/social-timing?latest=1", { cache: "no-store" });
        const payload = (await response.json()) as TimingData & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Không tải được lesson mới nhất.");
        setExam(payload.exam);
        setLesson(payload.lesson);
        setData(payload);
        setLines(payload.lines);
        setCurrentTime(0);
        setSelectedIndex(0);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Không tải được lesson mới nhất.");
      } finally {
        setLoading(false);
      }
    }
    void loadLatestTiming();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      if (event.code === "Space") {
        event.preventDefault();
        void toggleSelectedPlayback();
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seek(currentTime - 0.1);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        seek(currentTime + 0.1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentTime, selectedIndex, lines]);

  function seek(time: number) {
    const next = Math.max(0, Math.min(data?.duration ?? 0, time));
    setCurrentTime(next);
    if (audioRef.current) audioRef.current.currentTime = next;
  }

  function playLine(index: number) {
    const audio = audioRef.current;
    const line = lines[index];
    if (!audio || !line) return;
    hookRef.current?.pause();
    setPreviewPhase("lesson");
    setSelectedIndex(index);
    stopAtRef.current = line.end;
    setCurrentTime(line.start);
    audio.currentTime = line.start;
    void audio.play().catch(() => undefined);
  }

  function playSelected() {
    playLine(selectedIndex);
  }

  function toggleSelectedPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      stopAtRef.current = null;
      return;
    }
    playSelected();
  }

  function playHook(continueToLesson = false) {
    const hook = hookRef.current;
    if (!hook) return;
    audioRef.current?.pause();
    continueAfterHookRef.current = continueToLesson;
    setPreviewPhase("hook");
    hook.currentTime = 0;
    void hook.play().catch(() => undefined);
  }

  function reviewFromHook() {
    playHook(true);
  }

  function changeBoundary(lineIndex: number, field: "start" | "end", raw: number) {
    if (!data) return;
    setLines((current) => current.map((line, index) => {
      if (index !== lineIndex) return line;
      const value = Math.round(Math.max(0, Math.min(data.duration, raw)) * 100) / 100;
      return field === "start"
        ? { ...line, start: Math.min(value, line.end - 0.05) }
        : { ...line, end: Math.max(value, line.start + 0.05) };
    }));
  }

  function changeLineText(index: number, ja: string) {
    setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ja } : line));
  }

  async function persist(action: "save" | "render" | "reset") {
    if (!data) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/social-timing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, exam: data.exam, lesson: data.lesson, lines }),
      });
      const payload = (await response.json()) as TimingData & { error?: string; rendered?: boolean; videoUrl?: string | null; videoPath?: string | null };
      if (!response.ok) throw new Error(payload.error ?? "Không thể lưu timing.");
      if (action === "reset") {
        setData(payload);
        setLines(payload.lines);
        setSelectedIndex(0);
        setNotice("Đã bỏ mốc đã sửa và quay về clip timing.");
      } else {
        setData((current) => current ? { ...current, lines, source: "reviewed" } : current);
        if (action === "render" && payload.videoUrl && payload.videoPath) {
          setVideoOutput({ url: payload.videoUrl, path: payload.videoPath });
        }
        setNotice(action === "render" ? "Đã render video bằng timing vừa duyệt." : "Đã lưu timing đã duyệt.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu timing.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadBackground(file: File | undefined) {
    if (!file || !data) return;
    setUploadingBackground(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("exam", data.exam);
      form.set("lesson", data.lesson);
      form.set("image", file);
      const response = await fetch("/api/social-timing/background", { method: "POST", body: form });
      const payload = (await response.json()) as { backgroundUrl?: string; error?: string };
      if (!response.ok || !payload.backgroundUrl) throw new Error(payload.error ?? "Không thể cập nhật ảnh nền.");
      setData((current) => current ? { ...current, backgroundUrl: payload.backgroundUrl! } : current);
      setNotice("Đã cập nhật ảnh nền cho lesson này.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Không thể cập nhật ảnh nền.");
    } finally {
      setUploadingBackground(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = "";
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1320px] pb-16">
        <div className="mb-5 flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
          <div>
            <Link href="/" className="text-sm font-semibold text-muted hover:text-fg">Trang chủ</Link>
            <h1 className="mt-1 text-2xl font-bold text-fg">Duyệt timing video</h1>
          </div>
          <div className="flex items-center gap-2">
            {data && <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${data.source === "reviewed" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>{data.source === "reviewed" ? "Đã duyệt" : "Clip timing"}</span>}
            {dirty && <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-800">Chưa lưu</span>}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-[var(--shadow-sm)]">
          <label className="grid min-w-40 gap-1 text-xs font-bold text-muted">Đề<input value={exam} onChange={(event) => setExam(event.target.value)} className="focus-ring h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-fg outline-none" /></label>
          <label className="grid w-28 gap-1 text-xs font-bold text-muted">Lesson<input value={lesson} onChange={(event) => setLesson(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadTiming(); }} className="focus-ring h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-fg outline-none" /></label>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadTiming()} disabled={loading}>{loading ? "Đang nạp..." : "Nạp"}</Button>
          <div className="ml-auto flex flex-wrap gap-2"><input ref={backgroundInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadBackground(event.target.files?.[0])} /><Button type="button" variant="outline" size="sm" onClick={() => backgroundInputRef.current?.click()} disabled={!data || uploadingBackground}>{uploadingBackground ? "Đang tải ảnh..." : data?.backgroundUrl ? "Đổi ảnh nền" : "Thêm ảnh nền"}</Button><Button type="button" variant="outline" size="sm" onClick={() => void persist("reset")} disabled={!data || saving}>Mốc gốc</Button><Button type="button" size="sm" onClick={() => void persist("render")} disabled={!data || saving}>{saving ? "Đang xử lý..." : "Render video"}</Button></div>
        </div>
        {(error || notice) && <div className={`mb-5 rounded-lg border px-3 py-2 text-sm ${error ? "border-danger/30 bg-danger/10 text-danger" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}><p>{error ?? notice}</p>{videoOutput && <div className="mt-2 flex flex-wrap items-center gap-3 text-xs"><a href={videoOutput.url} target="_blank" rel="noreferrer" className="font-bold underline">Mở video</a><code className="break-all rounded bg-white/70 px-2 py-1 text-slate-700">{videoOutput.path}</code></div>}</div>}

        {data && (
          <div className="grid gap-5 lg:grid-cols-[410px_minmax(0,1fr)]">
            <section className="lg:sticky lg:top-5 lg:self-start">
              <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-[var(--shadow-md)]">
                <div className="relative mx-auto aspect-[9/16] w-full max-w-[410px] overflow-hidden">
                  {data.backgroundUrl ? <img src={data.backgroundUrl} alt="Lesson background" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-slate-800" />}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-transparent to-slate-950/80" />
                  {previewPhase === "hook" ? <div className="absolute inset-x-0 top-[18%] px-6 text-center"><p className="text-xs font-bold tracking-[0.22em] text-orange-200">N2 聴解</p><h2 className="mt-3 text-3xl font-black leading-tight text-white drop-shadow">{data.title}</h2><p className="mt-8 text-lg font-bold leading-relaxed text-white drop-shadow">{data.question}</p><p className="mt-7 text-sm font-bold text-orange-100">答えを聞き取る</p></div> : <><div className="absolute inset-x-0 top-0 px-5 pt-6 text-center"><p className="text-[10px] font-bold tracking-[0.18em] text-orange-200">N2 LISTENING</p><h2 className="mt-1 text-lg font-black leading-tight text-white drop-shadow">{data.title}</h2></div>{activeLine && <div className="absolute inset-x-4 bottom-5 border border-white/50 bg-white/95 px-3 py-3 shadow-lg"><div className="flex items-start gap-2"><span className={`min-w-9 border px-1.5 py-1 text-center text-sm font-black ${speakerTone(activeLine.sp)}`}>{activeLine.sp || "会話"}</span><p className="pt-0.5 text-base font-bold leading-relaxed text-slate-900">{activeLine.ja}</p></div></div>}</>}
                  <div className="absolute right-3 top-3 rounded bg-black/50 px-2 py-1 font-mono text-[11px] text-white">{fmt(currentTime)}</div>
                </div>
                <div className="border-t border-white/10 bg-slate-900 px-4 py-4">
                  <audio ref={hookRef} src={data.hookUrl} onEnded={() => { const shouldContinue = continueAfterHookRef.current; continueAfterHookRef.current = false; if (shouldContinue) { setPreviewPhase("lesson"); const lessonAudio = audioRef.current; if (lessonAudio) { lessonAudio.currentTime = 0; void lessonAudio.play().catch(() => undefined); } } }} />
                  <div className="mb-3 grid grid-cols-2 gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => playHook()}><Icon name="play" size={14} />Nghe hook</Button><Button type="button" size="sm" onClick={reviewFromHook}><Icon name="play" size={14} />Review hook → lesson</Button></div>
                  <audio ref={audioRef} src={data.audioUrl} controls className="w-full" onPlay={() => setPreviewPhase("lesson")} onTimeUpdate={(event) => {
                    const time = event.currentTarget.currentTime;
                    setCurrentTime(time);
                    if (stopAtRef.current !== null && time >= stopAtRef.current) {
                      event.currentTarget.pause();
                      event.currentTarget.currentTime = stopAtRef.current;
                      stopAtRef.current = null;
                    }
                  }} onPause={() => { stopAtRef.current = null; }} />
                  <input aria-label="Timeline" type="range" min="0" max={data.duration} step="0.01" value={currentTime} onChange={(event) => seek(Number(event.target.value))} className="mt-4 h-1.5 w-full cursor-pointer accent-orange-400" />
                  <div className="mt-1 flex justify-between font-mono text-xs text-slate-400"><span>{fmt(currentTime)}</span><span>{fmt(data.duration)}</span></div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Chỉnh trực tiếp từng câu</p><h2 className="mt-1 text-lg font-bold text-fg">{lines.length} câu thoại</h2></div>
                <div className="flex items-center gap-3"><span className="font-mono text-xs text-muted">Con trỏ {fmt(currentTime)}</span><Button type="button" size="sm" onClick={() => void persist("save")} disabled={!dirty || saving}><Icon name="save" size={15} />Lưu timing</Button></div>
              </div>
              <div className="border-b border-border bg-surface/60 px-5 py-3 text-xs text-muted">Nhấn <strong className="text-fg">Nghe</strong> để nghe riêng câu đó. Nhập trực tiếp mốc thời gian hoặc lấy mốc từ con trỏ audio.</div>
              <div className="space-y-3 p-3 sm:p-4">
                <div className={`flex items-center gap-3 rounded-md border px-3 py-2.5 ${previewPhase === "hook" ? "border-orange-300 bg-orange-50" : "border-border bg-surface/50"}`}>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-[10px] font-black text-white">H</span><span className="border border-orange-300 bg-orange-50 px-1.5 py-1 text-center text-[10px] font-black text-orange-800">HOOK</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{data.title}</span><Button type="button" variant="secondary" size="sm" onClick={() => playHook()}><Icon name="play" size={14} />Nghe</Button>
                </div>
                {lines.map((line, index) => {
                  const playing = index === activeIndex && currentTime >= line.start && currentTime < line.end;
                  return <article key={`${line.sp}-${index}`} className={`rounded-md border p-3 transition-colors ${playing ? "border-orange-300 bg-orange-50/70 shadow-[var(--shadow-sm)]" : "border-border bg-white"}`}>
                    <div className="grid gap-3 lg:grid-cols-[34px_52px_minmax(0,1fr)_auto] lg:items-start">
                      <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${playing ? "bg-orange-500 text-white" : "bg-surface text-muted"}`}>{index + 1}</span>
                      <span className={`w-fit border px-2 py-1.5 text-center text-sm font-black ${speakerTone(line.sp)}`}>{line.sp || "会話"}</span>
                      <textarea value={line.ja} rows={Math.max(2, Math.ceil(line.ja.length / 42))} onFocus={() => setSelectedIndex(index)} onChange={(event) => changeLineText(index, event.target.value)} className="focus-ring min-h-16 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-base font-semibold leading-relaxed text-slate-800 outline-none" />
                      <Button type="button" size="sm" onClick={() => playLine(index)}><Icon name="play" size={14} />Nghe</Button>
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                      <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">Start
                        <div className="flex items-center gap-2"><input aria-label={`Mốc bắt đầu câu ${index + 1}`} type="number" min="0" max={Math.max(0.05, line.end - 0.05)} step="0.01" value={line.start.toFixed(2)} onFocus={() => setSelectedIndex(index)} onChange={(event) => changeBoundary(index, "start", Number(event.target.value))} className="focus-ring h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-sm text-fg outline-none" /><Button type="button" variant="outline" size="sm" onClick={() => changeBoundary(index, "start", currentTime)}>Lấy mốc</Button></div>
                      </label>
                      <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">Stop
                        <div className="flex items-center gap-2"><input aria-label={`Mốc kết thúc câu ${index + 1}`} type="number" min={Math.min(data.duration, line.start + 0.05)} max={data.duration} step="0.01" value={line.end.toFixed(2)} onFocus={() => setSelectedIndex(index)} onChange={(event) => changeBoundary(index, "end", Number(event.target.value))} className="focus-ring h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-sm text-fg outline-none" /><Button type="button" variant="outline" size="sm" onClick={() => changeBoundary(index, "end", currentTime)}>Lấy mốc</Button></div>
                      </label>
                      <p className="font-mono text-xs text-muted xl:pb-2">{Math.max(0, line.end - line.start).toFixed(2)}s</p>
                    </div>
                  </article>;
                })}
              </div>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
