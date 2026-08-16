"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { lessonHref, visibleCourses } from "@/lib/store/selectors";
import type {
  LessonWithSentences,
  ReadingCheckQuestion,
  ReadingMeta,
  VocabEntry,
} from "@/lib/types";
import { useI18n } from "@/components/i18n/useI18n";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

const field =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-ring";
const textarea =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm leading-6 focus-ring";

function emptyVocab(): VocabEntry {
  return { word: "", reading: "", meaning: "", example_ja: "", example_vi: "" };
}

function emptyQuestion(): ReadingCheckQuestion {
  return {
    question: "",
    choices: ["", "", "", ""],
    answer: 0,
    explanation: "",
  };
}

function normalizeMeta(meta: ReadingMeta | null | undefined): Required<ReadingMeta> {
  return {
    watermark: meta?.watermark ?? "",
    memo: {
      ja: {
        keyword: meta?.memo?.ja?.keyword ?? "",
        body: meta?.memo?.ja?.body ?? "",
      },
      vi: {
        keyword: meta?.memo?.vi?.keyword ?? "",
        body: meta?.memo?.vi?.body ?? "",
      },
    },
    readingCheck:
      meta?.readingCheck?.length
        ? meta.readingCheck.map((item) => ({
            question: item.question ?? "",
            choices: [...item.choices, "", "", "", ""].slice(0, 4),
            answer: Number.isInteger(item.answer) ? item.answer : 0,
            explanation: item.explanation ?? "",
          }))
        : [emptyQuestion(), emptyQuestion(), emptyQuestion()],
  };
}

export function ReadingLessonEditForm({ lesson }: { lesson: LessonWithSentences }) {
  const { state, updateLesson } = useData();
  const { href } = useI18n();
  const router = useRouter();
  const courses = visibleCourses(state);
  const initialMeta = normalizeMeta(lesson.reading_meta);

  const [title, setTitle] = useState(lesson.title);
  const [courseId, setCourseId] = useState(lesson.course_id ?? "");
  const [level, setLevel] = useState(lesson.level ?? "N2-N1");
  const [isPublic, setIsPublic] = useState(lesson.is_public);
  const [body, setBody] = useState(
    lesson.sentences.map((sentence) => sentence.ja_text).join("\n"),
  );
  const [watermark, setWatermark] = useState(initialMeta.watermark);
  const [memoJaKeyword, setMemoJaKeyword] = useState(initialMeta.memo.ja?.keyword ?? "");
  const [memoJaBody, setMemoJaBody] = useState(initialMeta.memo.ja?.body ?? "");
  const [memoViKeyword, setMemoViKeyword] = useState(initialMeta.memo.vi?.keyword ?? "");
  const [memoViBody, setMemoViBody] = useState(initialMeta.memo.vi?.body ?? "");
  const [vocabulary, setVocabulary] = useState<VocabEntry[]>(
    lesson.vocabulary?.length ? lesson.vocabulary : [emptyVocab()],
  );
  const [questions, setQuestions] = useState<ReadingCheckQuestion[]>(
    initialMeta.readingCheck,
  );
  const [error, setError] = useState<string | null>(null);

  const bodyLines = useMemo(
    () =>
      body
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [body],
  );

  function updateVocab(index: number, patch: Partial<VocabEntry>) {
    setVocabulary((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function updateQuestion(index: number, patch: Partial<ReadingCheckQuestion>) {
    setQuestions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function updateChoice(questionIndex: number, choiceIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== questionIndex) return question;
        const choices = [...question.choices];
        choices[choiceIndex] = value;
        return { ...question, choices };
      }),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    if (bodyLines.length === 0) return setError("Body needs at least one paragraph.");

    const cleanVocabulary = vocabulary
      .map((item) => ({
        word: item.word.trim(),
        reading: item.reading.trim(),
        meaning: item.meaning.trim(),
        example_ja: item.example_ja.trim(),
        example_vi: item.example_vi?.trim() ?? "",
      }))
      .filter((item) => item.word || item.reading || item.meaning || item.example_ja);

    const cleanQuestions = questions
      .map((item) => ({
        question: item.question.trim(),
        choices: [...item.choices, "", "", "", ""].slice(0, 4).map((choice) => choice.trim()),
        answer: Math.min(Math.max(item.answer, 0), 3),
        explanation: item.explanation.trim(),
      }))
      .filter((item) => item.question || item.choices.some(Boolean) || item.explanation);

    const readingMeta: ReadingMeta = {
      watermark: watermark.trim() || title.trim().charAt(0),
      memo: {
        ja: { keyword: memoJaKeyword.trim(), body: memoJaBody.trim() },
        vi: { keyword: memoViKeyword.trim(), body: memoViBody.trim() },
      },
      readingCheck: cleanQuestions,
    };

    const updated = updateLesson({
      id: lesson.id,
      title: title.trim(),
      topic: "読解",
      level: level.trim() || null,
      course_id: courseId || null,
      source_url: lesson.source_url,
      media_url: lesson.media_url,
      duration_seconds: lesson.duration_seconds,
      is_public: isPublic,
      vocabulary: cleanVocabulary,
      reading_meta: readingMeta,
      sentences: bodyLines.map((line) => ({
        ja_text: line,
        vi_translation: null,
      })),
    });
    router.push(href(lessonHref(updated)));
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Reading lesson</CardTitle>
            <h2 className="mt-1 text-xl font-black text-fg">Edit full content</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Body, kanji memo, vocabulary and reading check are saved into the lesson data.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface px-3 py-2 text-xs font-bold text-muted">
            {bodyLines.length} paragraphs · {vocabulary.filter((item) => item.word.trim()).length} vocab ·{" "}
            {questions.length} quiz
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_12rem]">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Title</span>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Watermark</span>
            <input
              className={`${field} text-center text-lg font-black`}
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
              maxLength={3}
              lang="ja"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Course</span>
            <select className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Level</span>
            <input className={field} value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--accent)]"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-bold">Public lesson</span>
            <span className="mt-0.5 block text-xs text-muted">Visible to all users.</span>
          </span>
        </label>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Kanji memo</CardTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-border bg-surface/50 p-3">
            <p className="text-xs font-black uppercase text-muted">Japanese</p>
            <input
              className={field}
              value={memoJaKeyword}
              onChange={(e) => setMemoJaKeyword(e.target.value)}
              placeholder="迷う = 道の上の米粒"
              lang="ja"
            />
            <textarea
              className={`${textarea} min-h-20`}
              value={memoJaBody}
              onChange={(e) => setMemoJaBody(e.target.value)}
              placeholder="Short Japanese memo"
              lang="ja"
            />
          </div>
          <div className="space-y-2 rounded-2xl border border-border bg-surface/50 p-3">
            <p className="text-xs font-black uppercase text-muted">Vietnamese</p>
            <input
              className={field}
              value={memoViKeyword}
              onChange={(e) => setMemoViKeyword(e.target.value)}
              placeholder="迷う = hạt gạo trên đường"
            />
            <textarea
              className={`${textarea} min-h-20`}
              value={memoViBody}
              onChange={(e) => setMemoViBody(e.target.value)}
              placeholder="Short Vietnamese memo"
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Body</CardTitle>
          <span className="text-xs font-bold text-muted">One paragraph per line</span>
        </div>
        <textarea
          className={`${textarea} min-h-[28rem] font-[var(--font-jp)]`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          lang="ja"
        />
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Vocabulary</CardTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setVocabulary((prev) => [...prev, emptyVocab()])}
          >
            <Icon name="plus" size={14} />
            Add word
          </Button>
        </div>
        <div className="space-y-3">
          {vocabulary.map((item, index) => (
            <div key={index} className="rounded-2xl border border-border bg-surface/45 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-black text-muted">#{index + 1}</span>
                <button
                  type="button"
                  className="text-xs font-bold text-danger hover:underline"
                  onClick={() =>
                    setVocabulary((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-2 lg:grid-cols-4">
                <input
                  className={field}
                  value={item.word}
                  onChange={(e) => updateVocab(index, { word: e.target.value })}
                  placeholder="語彙"
                  lang="ja"
                />
                <input
                  className={field}
                  value={item.reading}
                  onChange={(e) => updateVocab(index, { reading: e.target.value })}
                  placeholder="読み方"
                  lang="ja"
                />
                <input
                  className={`${field} lg:col-span-2`}
                  value={item.meaning}
                  onChange={(e) => updateVocab(index, { meaning: e.target.value })}
                  placeholder="Nghĩa tiếng Việt"
                />
              </div>
              <textarea
                className={`${textarea} mt-2 min-h-16 font-[var(--font-jp)]`}
                value={item.example_ja}
                onChange={(e) => updateVocab(index, { example_ja: e.target.value })}
                placeholder="例文"
                lang="ja"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Reading check</CardTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
          >
            <Icon name="plus" size={14} />
            Add question
          </Button>
        </div>
        <div className="space-y-4">
          {questions.map((question, questionIndex) => (
            <div key={questionIndex} className="rounded-2xl border border-border bg-surface/45 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-black text-muted">Q{questionIndex + 1}</span>
                <button
                  type="button"
                  className="text-xs font-bold text-danger hover:underline"
                  onClick={() =>
                    setQuestions((prev) => prev.filter((_, i) => i !== questionIndex))
                  }
                >
                  Remove
                </button>
              </div>
              <textarea
                className={`${textarea} min-h-16 font-[var(--font-jp)]`}
                value={question.question}
                onChange={(e) => updateQuestion(questionIndex, { question: e.target.value })}
                placeholder="Question"
                lang="ja"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {question.choices.map((choice, choiceIndex) => (
                  <label key={choiceIndex} className="block">
                    <span className="mb-1 block text-xs font-black text-muted">
                      {String.fromCharCode(65 + choiceIndex)}
                    </span>
                    <input
                      className={field}
                      value={choice}
                      onChange={(e) =>
                        updateChoice(questionIndex, choiceIndex, e.target.value)
                      }
                      lang="ja"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-[10rem_1fr]">
                <label className="block">
                  <span className="mb-1 block text-xs font-black text-muted">Correct</span>
                  <select
                    className={field}
                    value={question.answer}
                    onChange={(e) =>
                      updateQuestion(questionIndex, { answer: Number(e.target.value) })
                    }
                  >
                    {question.choices.map((_, i) => (
                      <option key={i} value={i}>
                        {String.fromCharCode(65 + i)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black text-muted">Explanation</span>
                  <input
                    className={field}
                    value={question.explanation}
                    onChange={(e) =>
                      updateQuestion(questionIndex, { explanation: e.target.value })
                    }
                    placeholder="Giải thích"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {error && <p className="text-sm font-bold text-danger">{error}</p>}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" size="lg">
          Save reading lesson
        </Button>
      </div>
    </form>
  );
}
