"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useData, type CreateLessonInput } from "@/lib/store/DataProvider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { LessonWithSentences } from "@/lib/types";

const TOPICS = [
  "朝会",
  "コードレビュー",
  "バグ報告",
  "API会議",
  "データベース",
  "デプロイ",
  "ブリッジSE",
  "面接",
  "敬語",
  "キックオフ",
];
const LEVELS = ["N5", "N4", "N4-N3", "N3", "N3-N2", "N2", "N1"];

const field =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-ring";

export function CreateLessonForm() {
  const { createLesson } = useData();
  const router = useRouter();

  return (
    <LessonEditorForm
      submitLabel="レッスンを保存"
      onSave={(input) => {
        const lesson = createLesson(input);
        router.push(`/lessons/${lesson.id}`);
      }}
    />
  );
}

export function EditLessonForm({ lesson }: { lesson: LessonWithSentences }) {
  const { updateLesson } = useData();
  const router = useRouter();

  return (
    <LessonEditorForm
      lesson={lesson}
      submitLabel="変更を保存"
      onSave={(input) => {
        const updated = updateLesson({ ...input, id: lesson.id });
        router.push(`/lessons/${updated.id}`);
      }}
    />
  );
}

function LessonEditorForm({
  lesson,
  submitLabel,
  onSave,
}: {
  lesson?: LessonWithSentences;
  submitLabel: string;
  onSave: (input: CreateLessonInput) => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [topic, setTopic] = useState(lesson?.topic ?? TOPICS[0]);
  const [level, setLevel] = useState(lesson?.level ?? "N3-N2");
  const [sourceUrl, setSourceUrl] = useState(lesson?.source_url ?? "");
  const [script, setScript] = useState(
    lesson?.sentences.map((sentence) => sentence.ja_text).join("\n") ?? "",
  );
  const [translation, setTranslation] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      lesson?.sentences.map((sentence, i) => [i, sentence.vi_translation ?? ""]) ?? [],
    ),
  );
  const [mediaUrl, setMediaUrl] = useState<string | null>(lesson?.media_url ?? null);
  const [duration, setDuration] = useState<number | null>(
    lesson?.duration_seconds ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const lines = useMemo(
    () =>
      script
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    [script],
  );

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local-first: object URL for immediate playback. A Supabase Storage upload
    // would replace this with a persistent public URL.
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(Math.round(audio.duration));
    };
    audioRef.current = audio;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("レッスンタイトルを入力してください。");
    if (lines.length === 0)
      return setError("少なくとも1つの日本語文を入力してください。1行が1文です。");

    onSave({
      title: title.trim(),
      topic,
      level,
      source_url: sourceUrl.trim() || null,
      media_url: mediaUrl,
      duration_seconds: duration,
      sentences: lines.map((ja, i) => ({
        ja_text: ja,
        vi_translation: translation[i]?.trim() || null,
      })),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">タイトル *</label>
          <input
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: APIレビュー会議"
            lang="ja"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">トピック</label>
            <select
              className={field}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              {TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">レベル</label>
            <select
              className={field}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            YouTube URL（任意）
          </label>
          <input
            className={field}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://youtube.com/..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            音声ファイル（任意）
          </label>
          <input
            type="file"
            accept="audio/*"
            onChange={onFile}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm"
          />
          {duration != null && (
            <p className="mt-1 text-xs text-muted">長さ: 約{duration}秒</p>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>日本語スクリプト - 1行につき1文</CardTitle>
        <textarea
          className={`${field} min-h-32 font-[var(--font-jp)]`}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={"昨日はAPIのエラーハンドリングを修正しました。\n本番環境でエラーが発生しています。"}
          lang="ja"
        />
        {lines.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              {lines.length}文 - メモまたは意味（任意）:
            </p>
            {lines.map((ja, i) => (
              <div
                key={i}
                className="grid gap-1 rounded-xl border border-border p-2 sm:grid-cols-2 sm:gap-3"
              >
                <p lang="ja" className="text-sm">
                  <span className="mr-1 text-muted">{i + 1}.</span>
                  {ja}
                </p>
                <input
                  className={field}
                  value={translation[i] ?? ""}
                  onChange={(e) =>
                    setTranslation((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  placeholder="メモまたは意味（任意）"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
