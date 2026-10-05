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
  ReadingMeta,
  SavedVocab,
  ScoreBreakdown,
  VocabEntry,
} from "@/lib/types";
import { todayKey } from "@/lib/date";
import { useI18n } from "@/components/i18n/useI18n";
import { createClient as createSupabaseClient, hasSupabaseEnv } from "@/lib/supabase/client";
import {
  applyAttempt,
  applyReadingComplete,
  applyVocabProgress,
  type AttemptOutcome,
  type ReadingOutcome,
  type VocabOutcome,
} from "./engine";
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
  vocabulary?: VocabEntry[] | null;
  reading_meta?: ReadingMeta | null;
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
  attemptId: string;
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
  ensureLessonSentences: (lessonIds: string | string[]) => Promise<void>;
  /**
   * Mark a 読解 lesson read and pay out its XP. Returns null for guests (nothing
   * to credit) and for a lesson already completed earlier.
   */
  markReadingLessonRead: (
    lessonId: string,
    result: { correct: number; total: number },
  ) => ReadingOutcome | null;
  recordAttempt: (input: RecordAttemptInput) => Promise<AttemptOutcome>;
  /**
   * Credit newly-mastered vocabulary words to today's quest. Callers pass how
   * many words crossed into "learned" on this action, never how many were
   * answered. Returns null for guests and for a no-op (0 new words).
   */
  recordVocabLearned: (learned: number) => VocabOutcome | null;
  reset: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);
const USING_SUPABASE = hasSupabaseEnv();
const SUPABASE_SHELL_CACHE_KEY = "shadowing-jp-supabase-shell-v10";
const SUPABASE_SHELL_CACHE_TTL_MS = 5 * 60 * 1000;

interface SupabaseShellCache {
  savedAt: number;
  state: AppState;
}

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

function loadSupabaseShellCache(): AppState | null {
  try {
    const raw = sessionStorage.getItem(SUPABASE_SHELL_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as SupabaseShellCache;
    if (!cached?.state || Date.now() - cached.savedAt > SUPABASE_SHELL_CACHE_TTL_MS) {
      sessionStorage.removeItem(SUPABASE_SHELL_CACHE_KEY);
      return null;
    }
    return cached.state;
  } catch {
    return null;
  }
}

/** rows from lesson_sentence_counts -> { [lessonId]: count } */
type SentenceCountRow = { lesson_id: string; sentence_count: number | null };

function sentenceCountsFrom(
  rows: SentenceCountRow[] | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows ?? []) {
    if (row?.lesson_id) out[row.lesson_id] = row.sentence_count ?? 0;
  }
  return out;
}

function writeSupabaseShellCache(state: AppState): void {
  try {
    const shellState: AppState = {
      profile: state.profile,
      courses: state.courses,
      lessons: state.lessons,
      sentences: [],
      sentenceCounts: state.sentenceCounts,
      attempts: [],
      progress: state.progress,
      missions: [],
      xpEvents: [],
      savedVocab: [],
    };
    sessionStorage.setItem(
      SUPABASE_SHELL_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), state: shellState } satisfies SupabaseShellCache),
    );
  } catch {
    /* sessionStorage may be unavailable or full; cache is optional. */
  }
}

async function loadUserRows(table: string, userId: string) {
  const client = await createSupabaseClient();
  if (!client) throw new Error("save_unavailable");
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select("*")
      .eq("user_id", userId).order("id", { ascending: true }).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) {
      rows.sort((a, b) => {
        const left = a as { created_at?: string; id: string };
        const right = b as { created_at?: string; id: string };
        return (left.created_at ?? "").localeCompare(right.created_at ?? "") || left.id.localeCompare(right.id);
      });
      return { data: rows, error: null };
    }
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
  const { locale } = useI18n();
  const [state, setState] = useState<AppState>(() =>
    emptyState(new Date(0).toISOString()),
  );
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const hydrated = useRef(false);
  const loadingSentenceLessons = useRef(new Map<string, Promise<void>>());
  const stateRef = useRef<AppState>(state);

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const loadSupabaseCourseShellState = useCallback(async (): Promise<AppState> => {
    const supabase = await createSupabaseClient();
    if (!supabase) return loadLocalState();

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

    const [authResult, coursesResult, lessonsAll, countsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("courses")
        .select("*")
        .order("order_index", { ascending: true })
        .then((r) => r, () => ({ data: [], error: null })),
      fetchAll("lessons", [["title", true], ["id", true]]),
      fetchAll("lesson_sentence_counts", [["lesson_id", true]]),
    ]);
    const user = authResult.data.user;
    const lessons = lessonsAll as Lesson[];

    return {
      profile: user ? profileFromUser(user) : null,
      courses: (coursesResult.data ?? []) as Course[],
      lessons,
      // Reading and listening sentences are fetched by the player on demand.
      sentences: stateRef.current.sentences,
      sentenceCounts: sentenceCountsFrom(countsResult as SentenceCountRow[]),
      attempts: [],
      progress: [],
      missions: [],
      xpEvents: [],
      savedVocab: [],
    };
  }, []);

  const loadSupabaseState = useCallback(async (): Promise<AppState> => {
    const supabase = await createSupabaseClient();
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
      countsAllResult,
    ] = await Promise.all([
      supabase
        .from("courses")
        .select("*")
        .order("order_index", { ascending: true })
        .then((r) => r, () => ({ data: [], error: null })),
      user
        ? loadUserRows("sentence_attempts", user.id)
        : Promise.resolve({ data: [], error: null }),
      user
        ? loadUserRows("lesson_progress", user.id)
        : Promise.resolve({ data: [], error: null }),
      user
        ? loadUserRows("daily_missions", user.id)
        : Promise.resolve({ data: [], error: null }),
      user
        ? loadUserRows("xp_events", user.id)
        : Promise.resolve({ data: [], error: null }),
      user
        ? loadUserRows("saved_vocab", user.id)
        : Promise.resolve({ data: [], error: null }),
      fetchAll("lessons", [["title", true], ["id", true]]),
      fetchAll("lesson_sentence_counts", [["lesson_id", true]]),
    ]);

    return {
      profile,
      courses: (coursesResult.data ?? []) as Course[],
      lessons: lessonsAll as Lesson[],
      sentences: stateRef.current.sentences,
      sentenceCounts: sentenceCountsFrom(countsAllResult as SentenceCountRow[]),
      attempts: (attemptsResult.data ?? []) as AppState["attempts"],
      progress: (progressResult.data ?? []) as AppState["progress"],
      missions: (missionsResult.data ?? []) as AppState["missions"],
      xpEvents: (xpEventsResult.data ?? []) as AppState["xpEvents"],
      savedVocab: (savedVocabResult.data ?? []) as AppState["savedVocab"],
    };
  }, []);

  const loadSupabaseDeferredState = useCallback(async (base: AppState): Promise<AppState> => {
    const supabase = await createSupabaseClient();
    if (!supabase) return base;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let profile = base.profile;
    if (user) {
      const fallbackProfile = profileFromUser(user, base.profile);
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

    const userId = user?.id;

    const [
      attemptsResult,
      progressResult,
      missionsResult,
      xpEventsResult,
      savedVocabResult,
    ] = await Promise.all([
      userId
        ? loadUserRows("sentence_attempts", userId)
        : Promise.resolve({ data: [], error: null }),
      userId
        ? loadUserRows("lesson_progress", userId)
        : Promise.resolve({ data: [], error: null }),
      userId
        ? loadUserRows("daily_missions", userId)
        : Promise.resolve({ data: [], error: null }),
      userId
        ? loadUserRows("xp_events", userId)
        : Promise.resolve({ data: [], error: null }),
      userId
        ? loadUserRows("saved_vocab", userId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    return {
      ...base,
      profile,
      sentences: stateRef.current.sentences,
      sentenceCounts: base.sentenceCounts,
      attempts: (attemptsResult.data ?? []) as AppState["attempts"],
      progress: (progressResult.data ?? []) as AppState["progress"],
      missions: (missionsResult.data ?? []) as AppState["missions"],
      xpEvents: (xpEventsResult.data ?? []) as AppState["xpEvents"],
      savedVocab: (savedVocabResult.data ?? []) as AppState["savedVocab"],
    };
  }, []);

  const ensureLessonSentences = useCallback(
    async (lessonIds: string | string[]): Promise<void> => {
      if (!USING_SUPABASE) return;

      const ids = [...new Set(Array.isArray(lessonIds) ? lessonIds : [lessonIds])].filter(
        Boolean,
      );
      const pending = ids.flatMap((id) => {
        const request = loadingSentenceLessons.current.get(id);
        return request ? [request] : [];
      });
      const missingIds = ids.filter(
        (id) =>
          !stateRef.current.sentences.some((sentence) => sentence.lesson_id === id) &&
          !loadingSentenceLessons.current.has(id),
      );
      if (missingIds.length === 0) {
        await Promise.all(pending);
        return;
      }

      const request = (async () => {
        try {
          const supabase = await createSupabaseClient();
          if (!supabase) return;

          // A batch of lessons can exceed the API's 1,000-row response cap.
          // Publish only after every page succeeds, never a partial lesson.
          const incoming: LessonSentence[] = [];
          const pageSize = 1000;
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase
              .from("lesson_sentences")
              .select("*")
              .in("lesson_id", missingIds)
              .order("lesson_id", { ascending: true })
              .order("order_index", { ascending: true })
              .order("id", { ascending: true })
              .range(from, from + pageSize - 1);
            if (error) throw error;
            incoming.push(...((data ?? []) as LessonSentence[]));
            if (!data || data.length < pageSize) break;
          }
          const incomingLessonIds = new Set(missingIds);
          const prev = stateRef.current;
          commit({
            ...prev,
            sentences: [
              ...prev.sentences.filter(
                (sentence) => !incomingLessonIds.has(sentence.lesson_id),
              ),
              ...incoming,
            ],
          });
        } finally {
          for (const id of missingIds) loadingSentenceLessons.current.delete(id);
        }
      })();
      for (const id of missingIds) loadingSentenceLessons.current.set(id, request);
      await Promise.all([...pending, request]);
    },
    [commit],
  );

  const persistSupabaseLesson = useCallback(
    async (lesson: Lesson, sentences: LessonSentence[]) => {
      const supabase = await createSupabaseClient();
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

  const pendingAttempts = useRef(new Map<string, ReturnType<typeof applyAttempt> & { previous: AppState }>());
  const attemptSaveBusy = useRef(false);

  /** Mirrors a finished reading lesson: progress row, XP events, profile total. */
  const persistSupabaseReading = useCallback(
    async (next: AppState, outcome: ReadingOutcome, nowIso: string) => {
      const supabase = await createSupabaseClient();
      if (!supabase || !next.profile) return;

      const progress = next.progress.find(
        (item) =>
          item.user_id === next.profile?.id && item.lesson_id === outcome.lessonId,
      );
      const mission = next.missions.find(
        (item) =>
          item.user_id === next.profile?.id && item.mission_date === todayKey(),
      );
      const newXpEvents = next.xpEvents.filter((item) => item.created_at === nowIso);

      const writes = [
        progress
          ? supabase.from("lesson_progress").upsert(progress)
          : Promise.resolve({ error: null }),
        mission
          ? supabase
              .from("daily_missions")
              .upsert(mission, { onConflict: "user_id,mission_date" })
          : Promise.resolve({ error: null }),
        outcome.xpGained > 0
          ? supabase
              .from("profiles")
              .update({
                total_xp: next.profile.total_xp,
                current_level: next.profile.current_level,
              })
              .eq("id", next.profile.id)
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

  /** Mirrors vocabulary quest progress: the mission row, plus any quest payout. */
  const persistSupabaseVocab = useCallback(
    async (next: AppState, outcome: VocabOutcome, nowIso: string) => {
      const supabase = await createSupabaseClient();
      if (!supabase || !next.profile) return;

      const mission = next.missions.find(
        (item) =>
          item.user_id === next.profile?.id && item.mission_date === todayKey(),
      );
      const newXpEvents = next.xpEvents.filter((item) => item.created_at === nowIso);

      const writes = [
        mission
          ? supabase
              .from("daily_missions")
              .upsert(mission, { onConflict: "user_id,mission_date" })
          : Promise.resolve({ error: null }),
        outcome.xpGained > 0
          ? supabase
              .from("profiles")
              .update({
                total_xp: next.profile.total_xp,
                current_level: next.profile.current_level,
              })
              .eq("id", next.profile.id)
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
      let cachedShell: AppState | null = null;
      if (USING_SUPABASE) {
        cachedShell = loadSupabaseShellCache();
        if (cachedShell) {
          stateRef.current = cachedShell;
          setState(cachedShell);
          hydrated.current = true;
          setReady(true);
        }
      }

      let next: AppState;
      try {
        next = USING_SUPABASE ? await loadSupabaseCourseShellState() : loadLocalState();
      } catch {
        if (cancelled) return;
        if (cachedShell) return;
        // A production outage must never substitute local demo content.
        if (USING_SUPABASE) {
          setLoadFailed(true);
          return;
        }
        next = loadLocalState();
      }

      if (cancelled) return;
      stateRef.current = next;
      setState(next);
      hydrated.current = true;
      setReady(true);
      if (USING_SUPABASE) writeSupabaseShellCache(next);

      if (USING_SUPABASE) {
        window.setTimeout(() => {
          loadSupabaseDeferredState(next)
            .then((fullState) => {
              if (!cancelled) commit(fullState);
            })
            .catch(() => undefined);
        }, 250);
      }
    }

    hydrate();

    let subscription: { unsubscribe: () => void } | undefined;
    createSupabaseClient()
      .then((supabase) => {
        if (cancelled) return;
        subscription = supabase?.auth.onAuthStateChange((event) => {
          if (event === "INITIAL_SESSION") return;
          loadSupabaseState()
            .then((next) => {
              if (!cancelled) commit(next);
            })
            .catch(() => undefined);
        }).data.subscription;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [commit, loadSupabaseCourseShellState, loadSupabaseDeferredState, loadSupabaseState]);

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
      const supabase = await createSupabaseClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        return null;
      }
      return loginLocal(input);
    },
    [loginLocal],
  );

  const sendEmailOtp = useCallback(async (email: string): Promise<void> => {
    const supabase = await createSupabaseClient();
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
      const supabase = await createSupabaseClient();
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
    sessionStorage.removeItem(SUPABASE_SHELL_CACHE_KEY);
    createSupabaseClient()
      .then((supabase) => supabase?.auth.signOut())
      .catch(() => undefined);
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
          .then((supabase) => supabase?.from("courses").upsert(course))
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
          .then((supabase) =>
            supabase
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
              .eq("id", course.id),
          )
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
        vocabulary: input.vocabulary ?? null,
        reading_meta: input.reading_meta ?? null,
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
        vocabulary: input.vocabulary ?? existing.vocabulary,
        reading_meta: input.reading_meta ?? existing.reading_meta,
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
          .then((supabase) =>
            supabase
              ?.from("lesson_sentences")
              .update({ audio_start: audioStart, audio_end: audioEnd })
              .eq("id", sentenceId),
          )
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
            .then((supabase) =>
              supabase?.from("saved_vocab").delete().eq("id", existing.id),
            )
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
          .then((supabase) => supabase?.from("saved_vocab").insert(saved))
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
          .then((supabase) =>
            supabase?.from("saved_vocab").update({ learned }).eq("id", savedId),
          )
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
          .then((supabase) => supabase?.from("saved_vocab").delete().eq("id", savedId))
          .then(undefined, console.error);
      }
    },
    [commit],
  );

  const recordAttempt = useCallback(
    async (input: RecordAttemptInput): Promise<AttemptOutcome> => {
      if (attemptSaveBusy.current) throw new Error("save_in_progress");
      attemptSaveBusy.current = true;
      try {
        let plan = pendingAttempts.current.get(input.attemptId);
        if (!plan) {
          const previous = USING_SUPABASE ? await loadSupabaseState() : stateRef.current;
          if (previous.profile?.id !== stateRef.current.profile?.id) throw new Error("session_changed");
          plan = { ...applyAttempt(previous, input, new Date().toISOString()), previous };
          pendingAttempts.current.set(input.attemptId, plan);
        }
        const { state: next, outcome, previous } = plan;
        if (next.profile?.id !== stateRef.current.profile?.id) throw new Error("session_changed");
        if (USING_SUPABASE) {
          const supabase = await createSupabaseClient();
          if (!supabase) throw new Error("save_unavailable");
          const { error } = await supabase.rpc("save_shadowing_attempt_v2", {
            payload: {
              attempt: { ...outcome.attempt, recording_url: null },
              profile: next.profile,
              progress: next.progress.find((p) => p.user_id === next.profile?.id && p.lesson_id === outcome.attempt.lesson_id),
              mission: next.missions.find((m) => m.user_id === next.profile?.id && m.mission_date === todayKey()),
              xp_events: next.xpEvents.filter((event) => !previous.xpEvents.some((old) => old.id === event.id)),
              expected_xp: previous.profile?.total_xp,
              expected_attempt_count: previous.attempts.filter((a) => a.user_id === previous.profile?.id).length,
            },
          });
          if (error) throw new Error(error.code === "PGRST202" ? "save_setup_required" : "save_failed");
        }
        if (next.profile?.id !== stateRef.current.profile?.id) throw new Error("session_changed");
        commit(next);
        pendingAttempts.current.delete(input.attemptId);
        return outcome;
      } finally {
        attemptSaveBusy.current = false;
      }
    },
    [commit, loadSupabaseState],
  );

  const markReadingLessonRead = useCallback(
    (
      lessonId: string,
      result: { correct: number; total: number },
    ): ReadingOutcome | null => {
      const prev = stateRef.current;
      if (!prev.profile) return null;

      const now = new Date().toISOString();
      const { state: next, outcome } = applyReadingComplete(
        prev,
        { lessonId, correct: result.correct, total: result.total },
        now,
      );
      commit(next);

      if (USING_SUPABASE) persistSupabaseReading(next, outcome, now).catch(console.error);
      return outcome;
    },
    [commit, persistSupabaseReading],
  );

  const recordVocabLearned = useCallback(
    (learned: number): VocabOutcome | null => {
      const prev = stateRef.current;
      if (!prev.profile || learned <= 0) return null;

      const now = new Date().toISOString();
      const { state: next, outcome } = applyVocabProgress(prev, learned, now);
      if (!outcome) return null;
      commit(next);

      if (USING_SUPABASE) persistSupabaseVocab(next, outcome, now).catch(console.error);
      return outcome;
    },
    [commit, persistSupabaseVocab],
  );

  const reset = useCallback(() => {
    const next = emptyState(new Date().toISOString());
    commit(next);
    sessionStorage.removeItem(SUPABASE_SHELL_CACHE_KEY);
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
      ensureLessonSentences,
      markReadingLessonRead,
      recordAttempt,
      recordVocabLearned,
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
      ensureLessonSentences,
      markReadingLessonRead,
      recordAttempt,
      recordVocabLearned,
      reset,
    ],
  );

  return (
    <DataContext.Provider value={value}>
      {loadFailed ? (
        <main className="mx-auto max-w-lg px-4 py-16">
          <h1 className="text-2xl font-bold">{locale === "vi" ? "Chưa tải được dữ liệu" : "データを読み込めませんでした"}</h1>
          <p role="alert" className="mt-3 text-muted">
            {locale === "vi" ? "Vui lòng kiểm tra kết nối và thử lại. Dữ liệu bài học của bạn không bị thay đổi." : "接続を確認して、もう一度お試しください。学習データは変更されていません。"}
          </p>
          <button className="mt-5 min-h-11 rounded-xl bg-primary px-5 font-bold text-white" onClick={() => window.location.reload()}>
            {locale === "vi" ? "Thử lại" : "再試行"}
          </button>
        </main>
      ) : children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}
