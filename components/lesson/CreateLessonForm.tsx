"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useData, type CreateLessonInput } from "@/lib/store/DataProvider";
import { visibleCourses, lessonHref } from "@/lib/store/selectors";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { LessonWithSentences } from "@/lib/types";
import { useI18n } from "@/components/i18n/useI18n";

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
  const { dictionary, href } = useI18n();

  return (
    <LessonEditorForm
      submitLabel={dictionary.lessonForm.submitCreate}
      onSave={(input) => {
        const lesson = createLesson(input);
        router.push(href(lessonHref(lesson)));
      }}
    />
  );
}

export function EditLessonForm({ lesson }: { lesson: LessonWithSentences }) {
  const { updateLesson } = useData();
  const router = useRouter();
  const { dictionary, href } = useI18n();

  return (
    <LessonEditorForm
      lesson={lesson}
      submitLabel={dictionary.lessonForm.submitUpdate}
      onSave={(input) => {
        const updated = updateLesson({ ...input, id: lesson.id });
        router.push(href(lessonHref(updated)));
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
  const { state } = useData();
  const { dictionary } = useI18n();
  const t = dictionary.lessonForm;
  const courses = visibleCourses(state);
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [courseId, setCourseId] = useState<string>(lesson?.course_id ?? "");
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
  // 公開（承認済み）フラグ。既存レッスンは現在値、新規は既定で非公開。
  const [isPublic, setIsPublic] = useState<boolean>(lesson?.is_public ?? false);
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
    if (!title.trim()) return setError(t.errorTitle);
    if (lines.length === 0) return setError(t.errorScript);

    onSave({
      title: title.trim(),
      topic,
      level,
      course_id: courseId || null,
      source_url: sourceUrl.trim() || null,
      media_url: mediaUrl,
      duration_seconds: duration,
      is_public: isPublic,
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
          <label className="mb-1 block text-sm font-medium">{t.titleLabel}</label>
          <input
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.titlePlaceholder}
            lang="ja"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t.courseLabel}</label>
          <select
            className={field}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">{t.courseNone}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t.topicLabel}</label>
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
            <label className="mb-1 block text-sm font-medium">{t.levelLabel}</label>
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
          <label className="mb-1 block text-sm font-medium">{t.youtubeLabel}</label>
          <input
            className={field}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://youtube.com/..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t.audioLabel}</label>
          <input
            type="file"
            accept="audio/*"
            onChange={onFile}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm"
          />
          {duration != null && (
            <p className="mt-1 text-xs text-muted">{t.durationHint(duration)}</p>
          )}
        </div>
        <div className="rounded-xl border border-border p-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--accent)]"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">{t.publicLabel}</span>
              <span className="mt-0.5 block text-xs text-muted">{t.publicHint}</span>
            </span>
          </label>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t.scriptTitle}</CardTitle>
        <textarea
          className={`${field} min-h-32 font-[var(--font-jp)]`}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={"昨日はAPIのエラーハンドリングを修正しました。\n本番環境でエラーが発生しています。"}
          lang="ja"
        />
        {lines.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted">{t.notesHint(lines.length)}</p>
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
                  placeholder={t.notePlaceholder}
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
