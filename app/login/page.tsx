"use client";

import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { FullScreenLoading } from "@/components/ui/loading";

const FEATURES: { icon: IconName; text: string }[] = [
  { icon: "mic", text: "一文ずつ発話して、発音をすぐに採点" },
  { icon: "flame", text: "ストリーク、XP、レベルで毎日継続" },
  { icon: "book", text: "スタンドアップ、コードレビュー、API、BrSEなどのITテーマ" },
];

export default function LoginPage() {
  const { state, ready, usingSupabase, login } = useData();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ready && state.profile) router.replace("/dashboard");
  }, [ready, state.profile, router]);

  useEffect(() => {
    // Google blocks OAuth inside embedded webviews (Zalo/Messenger/FB/IG/Line…).
    const ua = navigator.userAgent || "";
    setInApp(
      /(FBAN|FBAV|FB_IAB|Messenger|Instagram|Zalo|Line\/|MicroMessenger|; wv\)|KAKAOTALK)/i.test(ua),
    );
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (!ready) return <FullScreenLoading />;

  async function signInWithGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      const profile = await login({
        email: "you@shadow-it.jp",
        display_name: "学習者",
        avatar_url: null,
      });
      if (profile) router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました。");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full border border-white/20" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-xl backdrop-blur">
            話
          </span>
          <span className="text-lg font-bold">Shadowing JP</span>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight">
            IT日本語の会話力を、
            <br />
            毎日の練習で伸ばす。
          </h2>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon name={f.icon} size={18} />
                </span>
                <span className="text-white/90">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex gap-3">
          {[
            { k: "ストリーク", v: "🔥" },
            { k: "ITテーマ", v: "9+" },
            { k: "採点", v: "AI-ready" },
          ].map((s) => (
            <div
              key={s.k}
              className="flex-1 rounded-2xl bg-white/10 p-3 backdrop-blur"
            >
              <p className="text-lg font-bold">{s.v}</p>
              <p className="text-xs text-white/70">{s.k}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-sm text-center animate-in">
          <div className="animate-pop mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl brand-gradient text-2xl text-white shadow-[var(--shadow-glow)] lg:hidden">
            話
          </div>
          <h1 className="text-3xl font-extrabold">おかえりなさい</h1>
          <p className="mt-2 text-muted">
            ログインして、今日のストリークを続けましょう。
          </p>

          {inApp && (
            <div className="mt-6 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning-soft)] p-4 text-left">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-[var(--warning)]">
                <Icon name="mic" size={15} />
                アプリ内ブラウザでは Google ログインがブロックされます
              </p>
              <p className="mt-1.5 text-xs leading-5 text-fg">
                Zalo / Messenger などのアプリ内ブラウザは Google がログインを許可していません。
                <b>外部ブラウザ（Chrome / Safari）で開いてください：</b>
                右上または下の「⋯」メニュー →「ブラウザで開く / Open in browser」。
              </p>
              <p className="mt-2 text-[11px] text-muted">
                Tiếng Việt: Zalo/Messenger chặn đăng nhập Google. Mở bằng Chrome/Safari:
                bấm menu «⋯» → «Mở bằng trình duyệt», hoặc sao chép link dưới đây rồi dán vào trình duyệt.
              </p>
              <button
                type="button"
                onClick={copyLink}
                className="focus-ring mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-bold"
              >
                <Icon name={copied ? "check" : "book"} size={15} />
                {copied ? "コピーしました" : "リンクをコピー"}
              </button>
            </div>
          )}

          <div className="card mt-8 space-y-4 p-6">
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={signInWithGoogle}
              disabled={submitting}
            >
              <GoogleIcon />
              {submitting ? "ログイン中..." : "Googleでログイン"}
            </Button>
            {error && <p className="text-xs text-danger">{error}</p>}
            <p className="text-xs text-muted">
              ログインは会話の閲覧・再生には不要です。録音して採点するときだけ必要です。
            </p>
            <p className="text-xs text-muted">
              {usingSupabase
                ? "Supabase Authでログインします。学習データはクラウドに保存されます。"
                : "現在はローカルデモです。データはブラウザに保存されます。"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.2 40.2 44 34.5 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
