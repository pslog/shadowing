"use client";

import { useEffect } from "react";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { FullScreenLoading } from "@/components/ui/loading";
import { useI18n } from "@/components/i18n/useI18n";

// プロダクトの3本柱（文言は lib/i18n.ts の login.features）:
// ① 話せる会話力はシャドーイングから（反射を鍛える）
// ② 毎日少しずつ→習慣化→実際の場面へ
// ③ 仲間と高め合うコミュニティ
const FEATURE_ICONS: IconName[] = ["mic", "flame", "book"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase の「Email OTP Length」設定に合わせる（既定6、範囲6〜10）。
// 入力欄は最大長まで受け付け、最小6桁で送信可能にする。
const OTP_MIN = 6;
const OTP_MAX = 8;

export default function LoginPage() {
  const { state, ready, usingSupabase, login, sendEmailOtp, verifyEmailOtp } =
    useData();
  const router = useRouter();
  const { dictionary: dict, href } = useI18n();
  const t = dict.login;
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  // Email OTP flow
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (ready && state.profile) router.replace(href("/"));
  }, [href, ready, state.profile, router]);

  useEffect(() => {
    // Google chặn OAuth trong webview nhúng (Zalo/Messenger/FB/IG/Line…).
    // Trong các app này, Email OTP là đường đăng nhập chạy được.
    const ua = navigator.userAgent || "";
    setInApp(
      /(FBAN|FBAV|FB_IAB|Messenger|Instagram|Zalo|Line\/|MicroMessenger|; wv\)|KAKAOTALK)/i.test(
        ua,
      ),
    );
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
        email: "you@shadowing.jp",
        display_name: dict.common.guest,
        avatar_url: null,
      });
      if (profile) router.replace(href("/"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorLoginFailed);
      setSubmitting(false);
    }
  }

  async function handleSendCode() {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError(t.errorInvalidEmail);
      return;
    }
    setError(null);
    setOtpBusy(true);
    try {
      await sendEmailOtp(value);
      setOtpSent(true);
      setResendIn(45);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorSendFailed);
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyCode() {
    const code = otp.trim();
    if (code.length < OTP_MIN) {
      setError(t.errorEnterCode);
      return;
    }
    setError(null);
    setOtpBusy(true);
    try {
      const profile = await verifyEmailOtp(email.trim(), code);
      // Supabase: profile は onAuthStateChange 経由で反映され、上の useEffect が遷移する。
      if (profile) router.replace(href("/"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorInvalidCode);
      setOtpBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full border border-white/20" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="flex items-center gap-2.5">
          <Image
            src="/logo-mark-256.webp"
            alt="Shadowing JP"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl object-contain"
            quality={75}
          />
          <span className="text-lg font-bold">Shadowing JP</span>
        </div>

        <div className="relative">
          <h2 className="whitespace-pre-line text-4xl font-extrabold leading-tight">
            {t.heroTitle}
          </h2>
          <p className="mt-4 max-w-md text-white/85">{t.heroBody}</p>
          <ul className="mt-8 space-y-3">
            {t.features.map((text, i) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon name={FEATURE_ICONS[i] ?? "mic"} size={18} />
                </span>
                <span className="text-white/90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex gap-3">
          {[
            { k: t.statStreak, v: "🔥" },
            { k: t.statTopics, v: "9+" },
            { k: t.statScoring, v: "AI-ready" },
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
          <Image
            src="/logo-mark-256.webp"
            alt="Shadowing JP"
            width={64}
            height={64}
            className="animate-pop mx-auto mb-5 h-16 w-16 rounded-2xl object-contain shadow-[var(--shadow-glow)] lg:hidden"
            quality={75}
          />
          <h1 className="text-3xl font-extrabold">{t.welcomeBack}</h1>
          <p className="mt-2 text-muted">{t.welcomeBody}</p>

          {inApp && (
            <div className="mt-6 rounded-2xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 p-4 text-left">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-[var(--primary)]">
                <Icon name="mic" size={15} />
                {t.inAppTitle}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-fg">{t.inAppBody}</p>
            </div>
          )}

          <div className="card mt-6 space-y-4 p-6 text-left">
            {/* --- Email OTP: đường chính, chạy trong mọi webview --- */}
            {!otpSent ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCode();
                }}
                className="space-y-3"
              >
                <label
                  htmlFor="email"
                  className="block text-sm font-bold text-fg"
                >
                  {t.emailLabel}
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus-ring h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={otpBusy}
                >
                  {otpBusy ? t.sending : t.sendCode}
                </Button>
                <p className="text-[11px] text-muted">{t.emailHint}</p>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyCode();
                }}
                className="space-y-3"
              >
                <p className="text-sm font-bold text-fg">{t.enterCode}</p>
                <p className="text-xs text-muted">{t.codeSentTo(email)}</p>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={OTP_MAX}
                  placeholder={"".padStart(OTP_MAX, "•")}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_MAX))
                  }
                  className="focus-ring h-12 w-full rounded-xl border border-border bg-card px-3 text-center text-lg font-bold tracking-[0.3em]"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={otpBusy}
                >
                  {otpBusy ? t.verifying : dict.common.login}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    className="focus-ring rounded font-bold text-[var(--primary)] disabled:opacity-50"
                    onClick={handleSendCode}
                    disabled={otpBusy || resendIn > 0}
                  >
                    {resendIn > 0 ? t.resendIn(resendIn) : t.resend}
                  </button>
                  <button
                    type="button"
                    className="focus-ring rounded text-muted"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setError(null);
                    }}
                  >
                    {t.changeEmail}
                  </button>
                </div>
              </form>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}

            {/* --- Google: ẩn trong webview vì chắc chắn bị chặn --- */}
            {!inApp && (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted">{t.or}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={signInWithGoogle}
                  disabled={submitting}
                >
                  <GoogleIcon />
                  {submitting ? t.googleSigningIn : t.googleSignIn}
                </Button>
              </>
            )}

            {/* --- Webview: nút mở trình duyệt ngoài để dùng được Google --- */}
            {inApp && (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted">
                    {t.useGoogle}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <p className="text-[11px] leading-5 text-muted">{t.openExternal}</p>
                <button
                  type="button"
                  onClick={copyLink}
                  className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-bold"
                >
                  <Icon name={copied ? "check" : "book"} size={15} />
                  {copied ? t.copied : t.copyLink}
                </button>
              </>
            )}

            <p className="text-xs text-muted">{t.noteOptional}</p>
            <p className="text-xs text-muted">
              {usingSupabase ? t.noteSupabase : t.noteLocal}
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
