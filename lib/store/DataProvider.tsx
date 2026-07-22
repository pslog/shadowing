"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Course,
  Lesson,
  LessonSentence,
  Profile,
  SavedVocab,
  ScoreBreakdown,
  VocabEntry,
} from "@/lib/types";
import { createClient as createSupabaseClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { applyAttempt, type AttemptOutcome } from "./engine";
import { isSuperAdminEmail, vocabKey } from "./selectors";
import {
  buildSeed,
  emptyState,
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  uid,
  type AppState,
} from "./state";

export interface LoginInput {
  email: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface CreateLessonInput {
  title: string;
  topic: string | null;
  level: string | null;
  course_id: string | null;
  source_url: string | null;
  media_url: string | null;
  duration_seconds: number | null;
  /** 公開（承認済み）フラグ。UIで管理者が切り替える。省略時は既存値を維持。 */
  is_public?: boolean;
  sentences: {
    ja_text: string;
    vi_translation: string | null;
  }[];
}

export interface UpdateLessonInput extends CreateLessonInput {
  id: string;
}

export interface CreateCourseInput {
  title: string;
  description: string | null;
  topic: string | null;
  level: string | null;
  accent: string | null;
  image_url: string | null;
  /** 公開フラグ。省略時は非公開（既存値を維持 for update）。 */
  is_public?: boolean;
}

export interface UpdateCourseInput extends CreateCourseInput {
  id: string;
}

export interface RecordAttemptInput {
  sentenceId: string;
  score: ScoreBreakdown;
  recordingUrl: string | null;
  transcript: string | null;
  userDurationSeconds: number | null;
}

interface DataContextValue {
  state: AppState;
  ready: boolean;
  usingSupabase: boolean;
  /** Save a vocab entry to (or remove it from) the review notebook. Returns the new saved-state. */
  toggleSavedVocab: (entry: VocabEntry, lessonId: string | null) => boolean;
  /** Mark a saved word as learned / not learned during review. */
  setVocabLearned: (savedId: string, learned: boolean) => void;
  /** Remove a saved word from the notebook. */
  removeSavedVocab: (savedId: string) => void;
  login: (input: LoginInput) => Promise<Profile | null>;
  /**
   * Gửi mã OTP 6 số tới email. Chạy được trong mọi webview (Zalo/Messenger…)
   * vì không đụng Google OAuth. Ở chế độ local demo là no-op (mã nào cũng hợp lệ).
   */
  sendEmailOtp: (email: string) => Promise<void>;
  /** Xác minh mã OTP, thiết lập session. Profile tự hydrate qua onAuthStateChange. */
  verifyEmailOtp: (email: string, token: string) => Promise<Profile | null>;
  logout: () => void;
  createCourse: (input: CreateCourseInput) => Course;
  updateCourse: (input: UpdateCourseInput) => Course;
  createLesson: (input: CreateLessonInput) => Lesson;
  updateLesson: (input: UpdateLessonInput) => Lesson;
  updateSentenceTiming: (
    sentenceId: string,
    audioStart: number | null,
    audioEnd: number | null,
  ) => void;
  recordAttempt: (input: RecordAttemptInput) => AttemptOutcome;
  reset: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);
const USING_SUPABASE = hasSupabaseEnv();

function migrateSeedContent(state: AppState): AppState {
  const seed = buildSeed(new Date().toISOString());
  const seedCourseIds = new Set(seed.courses.map((course) => course.id));
  const seedLessonIds = new Set(seed.lessons.map((lesson) => lesson.id));
  const seedSentenceIds = new Set(seed.sentences.map((sentence) => sentence.id));

  // Drop any seed course from old blobs (they're rebuilt fresh from buildSeed).
  const customCourses = (state.courses ?? []).filter(
    (course) => !seedCourseIds.has(course.id) && !course.id.startsWith("seed-course-"),
  );
  const customLessons = state.lessons
    .filter((lesson) => !seedLessonIds.has(lesson.id))
    // Backfill course_id; drop references to removed local seed courses.
    .map((lesson) => ({
      ...lesson,
      course_id: lesson.course_id?.startsWith("seed-course-")
        ? null
        : lesson.course_id ?? null,
    }));
  const customSentences = state.sentences.filter(
    (sentence) => !seedSentenceIds.has(sentence.id),
  );

  return {
    ...state,
    courses: [...seed.courses, ...customCourses],
    lessons: [...seed.lessons, ...customLessons],
    sentences: [...seed.sentences, ...customSentences],
    savedVocab: state.savedVocab ?? [],
  };
}

function loadLocalState(): AppState {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (raw && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, raw);
    }
    return raw
      ? migrateSeedContent(JSON.parse(raw) as AppState)
      : emptyState(new Date().toISOString());
  } catch {
    return emptyState(new Date().toISOString());
  }
}

function profileFromUser(
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  fallback?: Profile | null,
): Profile {
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email?.split("@")[0] ?? "学習者";
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null;
  const now = new Date().toISOString();

  return {
    id: user.id,
    email: user.email ?? fallback?.email ?? "",
    role: isSuperAdminEmail(user.email ?? fallback?.email)
      ? "admin"
      : fallback?.role ?? "user",
    display_name: displayName,
    avatar_url: avatarUrl,
    total_xp: fallback?.total_xp ?? 0,
    current_level: fallback?.current_level ?? 1,
    current_streak: fallback?.current_streak ?? 0,
    longest_streak: fallback?.longest_streak ?? 0,
    last_completed_date: fallback?.last_completed_date ?? null,
    created_at: fallback?.created_at ?? now,
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() =>
    emptyState(new Date(0).toISOString()),
  );
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const stateRef = useRef<AppState>(state);

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const loadSupabaseState = useCallback(async (): Promise<AppState> => {
    const supabase = createSupabaseClient();
    if (!supabase) return loadLocalState();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let profile: Profile | null = null;
    if (user) {
      const fallbackProfile = profileFromUser(user);
      await supabase.from("profiles").upsert({
        id: fallbackProfile.id,
        email: fallbackProfile.email,
        display_name: fallbackProfile.display_name,
        avatar_url: fallbackProfile.avatar_url,
      });

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = profileFromUser(user, data as Profile | null);
    }

    // Supabase caps a single response at ~1000 rows (db-max-rows). Public
    // content (lessons/sentences) exceeds that, so page through with .range.
    const fetchAll = async (
      table: string,
      orderCols: [string, boolean][],
    ): Promise<unknown[]> => {
      const size = 1000;
      let out: unknown[] = [];
      let from = 0;
      for (;;) {
        let q = supabase.from(table).select("*");
        for (const [col, asc] of orderCols) q = q.order(col, { ascending: asc });
        const { data, error } = await q.range(from, from + size - 1);
        if (error) throw error;
        out = out.concat(data ?? []);
        if (!data || data.length < size) break;
        from += size;
      }
      return out;
    };

    const [
      coursesResult,
      attemptsResult,
      progressResult,
      missionsResult,
      xpEventsResult,
      savedVocabResult,
      lessonsAll,
      sentencesAll,
    ] = await Promise.all([
      supabase
        .from("courses")
        .select("*")
        .order("order_index", { ascending: true })
        .then((r) => r, () => ({ data: [], error: null })),
      user
        ? supabase
            .from("sentence_attempts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      user
        ? supabase.from("lesson_progress").select("*").eq("user_id", user.id)
        : Promise.resolve({ data: [], error: null }),
      user
        ? supabase.from("daily_missions").select("*").eq("user_id", user.id)
        : Promise.resolve({ data: [], error: null }),
      user
        ? supabase
            .from("xp_events")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      user
        ? supabase
            .from("saved_vocab")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      fetchAll("lessons", [["title", true]]),
      fetchAll("lesson_sentences", [
        ["lesson_id", true],
        ["order_index", true],
      ]),
    ]);

    return {
      profile,
      courses: (coursesResult.data ?? []) as Course[],
      lessons: lessonsAll as Lesson[],
      sentences: sentencesAll as LessonSentence[],
      attempts: (attemptsResult.data ?? []) as AppState["attempts"],
      progress: (progressResult.data ?? []) as AppState["progress"],
      missions: (missionsResult.data ?? []) as AppState["missions"],
      xpEvents: (xpEventsResult.data ?? []) as AppState["xpEvents"],
      savedVocab: (savedVocabResult.data ?? []) as AppState["savedVocab"],
    };
  }, []);

  const persistSupabaseLesson = useCallback(
    async (lesson: Lesson, sentences: LessonSentence[]) => {
      const supabase = createSupabaseClient();
      if (!supabase) return;

      const { error: lessonError } = await supabase.from("lessons").upsert(lesson);
      if (lessonError) throw lessonError;

      // Upsert sentences BY ID instead of delete-all + re-insert. sentence_attempts
      // FK-cascades on lesson_sentences delete, so a blanket delete wiped every
      // user's practice history for the lesson on each edit. updateLesson reuses
      // the existing sentence ids (by index), so upsert keeps those rows — and
      // their attempts — intact, updating text/timing in place.
      if (sentences.length > 0) {
        const { error } = await supabase.from("lesson_sentences").upsert(sentences);
        if (error) throw error;
      }

      // Remove only sentences that no longer exist (e.g. the lesson was shortened);
      // their attempts are meant to go. Keep everything still present.
      const keepIds = sentences.map((s) => s.id);
      let del = supabase.from("lesson_sentences").delete().eq("lesson_id", lesson.id);
      if (keepIds.length > 0) del = del.not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);
      const { error: deleteError } = await del;
      if (deleteError) throw deleteError;
    },
    [],
  );

  const persistSupabaseOutcome = useCallback(
    async (next: AppState, outcome: AttemptOutcome) => {
      const supabase = createSupabaseClient();
      if (!supabase || !next.profile) return;

      const progress = next.progress.find(
        (item) =>
          item.user_id === next.profile?.id &&
          item.lesson_id === outcome.attempt.lesson_id,
      );
      const mission = next.missions.find(
        (item) =>
          item.user_id === next.profile?.id &&
          item.mission_date === outcome.attempt.created_at.slice(0, 10),
      );
      const newXpEvents = next.xpEvents.filter(
        (item) => item.created_at === outcome.attempt.created_at,
      );

      const writes = [
        supabase.from("sentence_attempts").insert(outcome.attempt),
        supabase
          .from("profiles")
          .update({
            total_xp: next.profile.total_xp,
            current_level: next.profile.current_level,
            current_streak: next.profile.current_streak,
            longest_streak: next.profile.longest_streak,
            last_completed_date: next.profile.last_completed_date,
          })
          .eq("id", next.profile.id),
        progress
          ? supabase.from("lesson_progress").upsert(progress)
          : Promise.resolve({ error: null }),
        mission
          ? supabase.from("daily_missions").upsert(mission)
          : Promise.resolve({ error: null }),
        newXpEvents.length > 0
          ? supabase.from("xp_events").insert(newXpEvents)
          : Promise.resolve({ error: null }),
      ];

      const results = await Promise.all(writes);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      let next: AppState;
      try {
        next = USING_SUPABASE ? await loadSupabaseState() : loadLocalState();
      } catch {
        next = loadLocalState();
      }

      if (cancelled) return;
      stateRef.current = next;
      setState(next);
      hydrated.current = true;
      setReady(true);
    }

    hydrate();

    const supabase = createSupabaseClient();
    const subscription = supabase?.auth.onAuthStateChange(() => {
      loadSupabaseState()
        .then((next) => {
          if (!cancelled) commit(next);
        })
        .catch(() => undefined);
    }).data.subscription;

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [commit, loadSupabaseState]);

  useEffect(() => {
    if (!hydrated.current || USING_SUPABASE) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode - non-fatal */
    }
  }, [state]);

  // Tạo profile ở chế độ local demo (không có Supabase env). Dùng chung cho
  // login giả và verifyEmailOtp demo.
  const loginLocal = useCallback(
    (input: LoginInput): Profile => {
      const prev = stateRef.current;
      const existing = prev.profile;
      if (existing && existing.email === input.email) return existing;

      const now = new Date().toISOString();
      const profile: Profile = {
        id: existing?.id ?? uid(),
        email: input.email,
        role: isSuperAdminEmail(input.email) ? "admin" : existing?.role ?? "user",
        display_name: input.display_name,
        avatar_url: input.avatar_url ?? null,
        total_xp: existing?.total_xp ?? 0,
        current_level: existing?.current_level ?? 1,
        current_streak: existing?.current_streak ?? 0,
        longest_streak: existing?.longest_streak ?? 0,
        last_completed_date: existing?.last_completed_date ?? null,
        created_at: existing?.created_at ?? now,
      };
      commit({ ...prev, profile });
      return profile;
    },
    [commit],
  );

  const login = useCallback(
    async (input: LoginInput): Promise<Profile | null> => {
      const supabase = createSupabaseClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        return null;
      }
      return loginLocal(input);
    },
    [loginLocal],
  );

  const sendEmailOtp = useCallback(async (email: string): Promise<void> => {
    const supabase = createSupabaseClient();
    if (!supabase) return; // local demo: bỏ qua, verify chấp nhận mọi mã
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // shouldCreateUser: tự tạo tài khoản nếu email chưa tồn tại (đăng ký + đăng nhập gộp).
      // emailRedirectTo bỏ trống để Supabase gửi MÃ (OTP code) thay vì magic link.
      // Độ dài mã do setting "Email OTP Length" của Supabase quyết định (6–10).
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }, []);

  const verifyEmailOtp = useCallback(
    async (email: string, token: string): Promise<Profile | null> => {
      const supabase = createSupabaseClient();
      if (supabase) {
        // User đã tồn tại → type "email". User lần đầu (signInWithOtp vừa tạo
        // tài khoản) → token thuộc luồng "signup". Client không biết trước là
        // loại nào nên thử "email" trước, fail thì thử lại "signup".
        const first = await supabase.auth.verifyOtp({ email, token, type: "email" });
        if (first.error) {
          const second = await supabase.auth.verifyOtp({
            email,
            token,
            type: "signup",
          });
          if (second.error) throw first.error; // giữ lỗi gốc cho dễ đọc
        }
        // Session đã set → onAuthStateChange sẽ tự dựng lại profile.
        return null;
      }
      // Local demo: chấp nhận mọi mã, dựng profile cục bộ.
      return loginLocal({
        email,
        display_name: email.split("@")[0] || "学習者",
        avatar_url: null,
      });
    },
    [loginLocal],
  );

  const logout = useCallback(() => {
    createSupabaseClient()?.auth.signOut();
    commit({ ...stateRef.current, profile: null });
  }, [commit]);

  const createCourse = useCallback(
    (input: CreateCourseInput): Course => {
      const prev = stateRef.current;
      if (!prev.profile) throw new Error("Must be logged in to create a course");
      const now = new Date().toISOString();
      const course: Course = {
        id: uid(),
        user_id: prev.profile.id,
        slug: null,
        title: input.title,
        description: input.description,
        topic: input.topic,
        level: input.level,
        accent: input.accent,
        image_url: input.image_url,
        order_index: prev.courses.length,
        is_public: input.is_public ?? false,
        created_at: now,
      };
      commit({ ...prev, courses: [...prev.courses, course] });
      if (USING_SUPABASE) {
        createSupabaseClient()
          ?.from("courses")
          .upsert(course)
          .then(undefined, console.error);
      }
      return course;
    },
    [commit],
  );

  const updateCourse = useCallback(
    (input: UpdateCourseInput): Course => {
      const prev = stateRef.current;
      if (!prev.profile) throw new Error("Must be logged in to update a course");

      const existing = prev.courses.find((course) => course.id === input.id);
      if (!existing) throw new Error("Course not found");

      const course: Course = {
        ...existing,
        title: input.title,
        description: input.description,
        topic: input.topic,
        level: input.level,
        accent: input.accent,
        image_url: input.image_url,
        is_public: input.is_public ?? existing.is_public,
      };

      commit({
        ...prev,
        courses: prev.courses.map((item) => (item.id === course.id ? course : item)),
      });

      if (USING_SUPABASE) {
        createSupabaseClient()
          ?.from("courses")
          .update({
            title: course.title,
            description: course.description,
            topic: course.topic,
            level: course.level,
            accent: course.accent,
            image_url: course.image_url,
            is_public: course.is_public,
          })
          .eq("id", course.id)
          .then(undefined, console.error);
      }

      return course;
    },
    [commit],
  );

  const createLesson = useCallback(
    (input: CreateLessonInput): Lesson => {
      const prev = stateRef.current;
      if (!prev.profile) throw new Error("Must be logged in to create a lesson");
      const now = new Date().toISOString();
      const lesson: Lesson = {
        id: uid(),
        user_id: prev.profile.id,
        slug: null,
        course_id: input.course_id,
        title: input.title,
        topic: input.topic,
        level: input.level,
        duration_seconds: input.duration_seconds,
        source_type: input.source_url ? "youtube" : "upload",
        source_url: input.source_url,
        media_url: input.media_url,
        is_public: input.is_public ?? false,
        vocabulary: null,
        created_at: now,
      };
      const sentences: LessonSentence[] = input.sentences.map((s, i) => ({
        id: uid(),
        lesson_id: lesson.id,
        order_index: i,
        ja_text: s.ja_text,
        furigana: null,
        vi_translation: s.vi_translation,
        audio_url: null,
        audio_start: null,
        audio_end: null,
        pass_score: 80,
        created_at: now,
      }));
      commit({
        ...prev,
        lessons: [...prev.lessons, lesson],
        sentences: [...prev.sentences, ...sentences],
      });
      if (USING_SUPABASE) persistSupabaseLesson(lesson, sentences).catch(console.error);
      return lesson;
    },
    [commit, persistSupabaseLesson],
  );

  const updateLesson = useCallback(
    (input: UpdateLessonInput): Lesson => {
      const prev = stateRef.current;
      if (!prev.profile) throw new Error("Must be logged in to update a lesson");

      const existing = prev.lessons.find((lesson) => lesson.id === input.id);
      if (!existing) throw new Error("Lesson not found");

      const now = new Date().toISOString();
      const lesson: Lesson = {
        ...existing,
        course_id: input.course_id,
        title: input.title,
        topic: input.topic,
        level: input.level,
        duration_seconds: input.duration_seconds,
        source_type: input.source_url ? "youtube" : "upload",
        source_url: input.source_url,
        media_url: input.media_url,
        is_public: input.is_public ?? existing.is_public,
      };
      const existingSentences = prev.sentences
        .filter((sentence) => sentence.lesson_id === input.id)
        .sort((a, b) => a.order_index - b.order_index);
      const nextSentenceIds = new Set<string>();
      const nextLessonSentences: LessonSentence[] = input.sentences.map((s, i) => {
        const existingSentence = existingSentences[i];
        const id = existingSentence?.id ?? uid();
        nextSentenceIds.add(id);
        return {
          id,
          lesson_id: lesson.id,
          order_index: i,
          ja_text: s.ja_text,
          furigana: existingSentence?.furigana ?? null,
          vi_translation: s.vi_translation,
          audio_url: existingSentence?.audio_url ?? null,
          audio_start: existingSentence?.audio_start ?? null,
          audio_end: existingSentence?.audio_end ?? null,
          pass_score: existingSentence?.pass_score ?? 80,
          created_at: existingSentence?.created_at ?? now,
        };
      });

      commit({
        ...prev,
        lessons: prev.lessons.map((item) => (item.id === lesson.id ? lesson : item)),
        sentences: [
          ...prev.sentences.filter((sentence) => sentence.lesson_id !== lesson.id),
          ...nextLessonSentences,
        ],
        attempts: prev.attempts.filter(
          (attempt) =>
            attempt.lesson_id !== lesson.id || nextSentenceIds.has(attempt.sentence_id),
        ),
        progress: prev.progress.map((progress) =>
          progress.lesson_id === lesson.id
            ? {
                ...progress,
                total_sentence_count: nextLessonSentences.length,
                passed_sentence_count: Math.min(
                  progress.passed_sentence_count,
                  nextLessonSentences.length,
                ),
                updated_at: now,
              }
            : progress,
        ),
      });
      if (USING_SUPABASE) {
        persistSupabaseLesson(lesson, nextLessonSentences).catch(console.error);
      }
      return lesson;
    },
    [commit, persistSupabaseLesson],
  );

  const updateSentenceTiming = useCallback(
    (sentenceId: string, audioStart: number | null, audioEnd: number | null) => {
      const prev = stateRef.current;
      commit({
        ...prev,
        sentences: prev.sentences.map((s) =>
          s.id === sentenceId
            ? { ...s, audio_start: audioStart, audio_end: audioEnd }
            : s,
        ),
      });
      if (USING_SUPABASE) {
        createSupabaseClient()
          ?.from("lesson_sentences")
          .update({ audio_start: audioStart, audio_end: audioEnd })
          .eq("id", sentenceId)
          .then(undefined, console.error);
      }
    },
    [commit],
  );

  const toggleSavedVocab = useCallback(
    (entry: VocabEntry, lessonId: string | null): boolean => {
      const prev = stateRef.current;
      if (!prev.profile) return false;
      const uid_ = prev.profile.id;
      const key = vocabKey(entry.word, entry.reading);
      const existing = prev.savedVocab.find(
        (v) => v.user_id === uid_ && vocabKey(v.word, v.reading) === key,
      );

      if (existing) {
        commit({
          ...prev,
          savedVocab: prev.savedVocab.filter((v) => v.id !== existing.id),
        });
        if (USING_SUPABASE) {
          createSupabaseClient()
            ?.from("saved_vocab")
            .delete()
            .eq("id", existing.id)
            .then(undefined, console.error);
        }
        return false;
      }

      const saved: SavedVocab = {
        id: uid(),
        user_id: uid_,
        lesson_id: lessonId,
        word: entry.word,
        reading: entry.reading,
        meaning: entry.meaning,
        example_ja: entry.example_ja,
        example_vi: entry.example_vi,
        learned: false,
        created_at: new Date().toISOString(),
      };
      commit({ ...prev, savedVocab: [saved, ...prev.savedVocab] });
      if (USING_SUPABASE) {
        createSupabaseClient()
          ?.from("saved_vocab")
          .insert(saved)
          .then(undefined, console.error);
      }
      return true;
    },
    [commit],
  );

  const setVocabLearned = useCallback(
    (savedId: string, learned: boolean) => {
      const prev = stateRef.current;
      commit({
        ...prev,
        savedVocab: prev.savedVocab.map((v) =>
          v.id === savedId ? { ...v, learned } : v,
        ),
      });
      if (USING_SUPABASE) {
        createSupabaseClient()
          ?.from("saved_vocab")
          .update({ learned })
          .eq("id", savedId)
          .then(undefined, console.error);
      }
    },
    [commit],
  );

  const removeSavedVocab = useCallback(
    (savedId: string) => {
      const prev = stateRef.current;
      commit({
        ...prev,
        savedVocab: prev.savedVocab.filter((v) => v.id !== savedId),
      });
      if (USING_SUPABASE) {
        createSupabaseClient()
          ?.from("saved_vocab")
          .delete()
          .eq("id", savedId)
          .then(undefined, console.error);
      }
    },
    [commit],
  );

  const recordAttempt = useCallback(
    (input: RecordAttemptInput): AttemptOutcome => {
      const prev = stateRef.current;
      const now = new Date().toISOString();
      const { state: next, outcome } = applyAttempt(prev, input, now);
      commit(next);
      if (USING_SUPABASE) persistSupabaseOutcome(next, outcome).catch(console.error);
      return outcome;
    },
    [commit, persistSupabaseOutcome],
  );

  const reset = useCallback(() => {
    const next = emptyState(new Date().toISOString());
    commit(next);
    if (!USING_SUPABASE) localStorage.removeItem(STORAGE_KEY);
  }, [commit]);

  const value = useMemo<DataContextValue>(
    () => ({
      state,
      ready,
      usingSupabase: USING_SUPABASE,
      toggleSavedVocab,
      setVocabLearned,
      removeSavedVocab,
      login,
      sendEmailOtp,
      verifyEmailOtp,
      logout,
      createCourse,
      updateCourse,
      createLesson,
      updateLesson,
      updateSentenceTiming,
      recordAttempt,
      reset,
    }),
    [
      state,
      ready,
      toggleSavedVocab,
      setVocabLearned,
      removeSavedVocab,
      login,
      sendEmailOtp,
      verifyEmailOtp,
      logout,
      createCourse,
      updateCourse,
      createLesson,
      updateLesson,
      updateSentenceTiming,
      recordAttempt,
      reset,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}
