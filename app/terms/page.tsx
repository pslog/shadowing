import Image from "next/image";
import Link from "next/link";

const UPDATED_AT = "July 29, 2026";
const CONTACT_EMAIL = "vovansinh1991@gmail.com";

const sections = [
  {
    title: "1. Acceptance of these Terms",
    body: [
      "By accessing or using Shadowing JP, you agree to these Terms of Service. If you do not agree, please do not use the service.",
      "Shadowing JP is an educational web application for Japanese shadowing practice, learning progress tracking, and optional social video upload tools for authorized administrators.",
    ],
  },
  {
    title: "2. Eligibility and accounts",
    body: [
      "You are responsible for keeping your login credentials and account access secure.",
      "Some features may require authentication. Administrative tools, including video upload tools, are restricted to authorized administrators.",
    ],
  },
  {
    title: "3. Learning and user content",
    body: [
      "You may submit learning activity, voice recordings, lesson content, video files, captions, titles, descriptions, and related metadata when using the service.",
      "You must only upload or submit content that you own or have permission to use. You are responsible for ensuring that your content does not violate copyright, privacy, publicity, platform rules, or applicable law.",
    ],
  },
  {
    title: "4. Social platform uploads",
    body: [
      "The upload tool may help authorized administrators upload videos to selected third-party platforms such as YouTube, TikTok, and Facebook.",
      "When you choose a platform and start an upload, Shadowing JP sends the selected video and related metadata to that platform using the credentials or access tokens configured for the service.",
      "Uploads to third-party platforms are also governed by those platforms' own terms, community guidelines, developer policies, review requirements, and API limits. Shadowing JP does not control those platforms and cannot guarantee that a video will be accepted, published, recommended, retained, or kept available.",
    ],
  },
  {
    title: "5. Acceptable use",
    body: [
      "You may not use Shadowing JP to upload harmful, illegal, infringing, deceptive, abusive, private, or unauthorized content.",
      "You may not attempt to bypass security controls, access accounts or data without permission, disrupt the service, or misuse platform APIs.",
    ],
  },
  {
    title: "6. Service availability",
    body: [
      "Shadowing JP is provided on a best-effort basis. Features may change, pause, or stop without prior notice, especially when third-party APIs, hosting providers, or authentication providers change their behavior.",
    ],
  },
  {
    title: "7. Disclaimers and limitation of liability",
    body: [
      "Shadowing JP is provided as is, without warranties of any kind. We do not guarantee uninterrupted service, perfect scoring, error-free uploads, or specific learning outcomes.",
      "To the fullest extent permitted by law, Shadowing JP and its maintainers are not liable for indirect, incidental, consequential, or platform-related damages arising from your use of the service.",
    ],
  },
  {
    title: "8. Changes to these Terms",
    body: [
      "We may update these Terms from time to time. The updated date on this page indicates the latest version. Continued use of the service after updates means you accept the revised Terms.",
    ],
  },
  {
    title: "9. Contact",
    body: [`For questions about these Terms, contact ${CONTACT_EMAIL}.`],
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/about" className="flex items-center gap-2.5 font-bold">
          <Image
            src="/logo-mark-256.webp"
            alt="Shadowing JP"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            quality={75}
          />
          <span className="text-lg text-gradient">Shadowing JP</span>
        </Link>
      </header>

      <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-sm font-semibold uppercase text-primary">Legal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: {UPDATED_AT}</p>

        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-black">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-muted sm:text-base">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 border-t border-border pt-5 text-sm text-muted">
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
        </div>
      </article>
    </main>
  );
}
