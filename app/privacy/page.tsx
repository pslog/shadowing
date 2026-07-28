import Image from "next/image";
import Link from "next/link";

const UPDATED_AT = "July 29, 2026";
const CONTACT_EMAIL = "vovansinh1991@gmail.com";

const sections = [
  {
    title: "1. Overview",
    body: [
      "This Privacy Policy explains how Shadowing JP collects, uses, stores, and shares information when you use our website and related tools.",
      "Shadowing JP is an educational web application for Japanese shadowing practice. It also includes optional administrative tools for uploading videos to third-party platforms such as YouTube, TikTok, and Facebook.",
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "Account information: email address, display name, avatar, role, and authentication information when you log in.",
      "Learning information: courses, lessons, progress, streaks, scores, attempts, saved vocabulary, and related usage activity.",
      "Audio and media: voice recordings, lesson media, uploaded videos, captions, titles, descriptions, privacy settings, and platform selection when you use recording or upload features.",
      "Technical information: browser, device, IP-derived information, logs, errors, and basic usage data needed to operate and secure the service.",
      "Third-party authorization information: access tokens or related credentials may be configured server-side to enable authorized uploads to platforms such as YouTube, TikTok, and Facebook.",
    ],
  },
  {
    title: "3. How we use information",
    body: [
      "We use information to provide the learning experience, authenticate users, save progress, score practice attempts, operate administrative tools, upload selected videos to selected platforms, troubleshoot issues, and protect the service.",
      "We do not sell personal information.",
    ],
  },
  {
    title: "4. Social platform uploads and TikTok data",
    body: [
      "If you use the upload tool, Shadowing JP sends the selected video file and metadata, such as title, description, caption, privacy option, and platform choice, only to the third-party platforms selected for that upload.",
      "For TikTok integration, Shadowing JP uses TikTok authorization only to perform actions requested by the authorized user, such as uploading a selected video through TikTok's Content Posting API.",
      "We do not use TikTok data to profile users, sell data, or share TikTok data with unrelated third parties.",
    ],
  },
  {
    title: "5. Sharing information",
    body: [
      "We may share information with service providers needed to run the app, including hosting, authentication, database, storage, analytics, or error-monitoring providers.",
      "We share upload content and metadata with YouTube, TikTok, Facebook, or other selected platforms only when an authorized user chooses to upload to those platforms.",
      "We may disclose information if required by law, to protect rights and safety, or to investigate abuse of the service.",
    ],
  },
  {
    title: "6. Data retention",
    body: [
      "We retain account, learning, media, and upload information for as long as needed to provide the service, maintain records, comply with obligations, resolve disputes, or protect the service.",
      "You may request deletion of your account data or uploaded data controlled by Shadowing JP by contacting us. Content already uploaded to third-party platforms may need to be managed or deleted through those platforms.",
    ],
  },
  {
    title: "7. Security",
    body: [
      "We use reasonable technical and organizational measures to protect information. However, no online service can guarantee perfect security.",
      "Administrative upload credentials and access tokens should be stored server-side and should not be exposed in browser code or public repositories.",
    ],
  },
  {
    title: "8. Children",
    body: [
      "Shadowing JP is not intended for children under 13. If you believe a child has provided personal information without appropriate consent, contact us so we can review and delete it where appropriate.",
    ],
  },
  {
    title: "9. Your choices",
    body: [
      "You can choose not to provide optional media or upload content. You can also contact us to request access, correction, or deletion of personal information controlled by Shadowing JP.",
      "Third-party platforms may provide their own controls for connected apps, uploaded videos, privacy settings, and account data.",
    ],
  },
  {
    title: "10. Changes to this Policy",
    body: [
      "We may update this Privacy Policy from time to time. The updated date on this page indicates the latest version.",
    ],
  },
  {
    title: "11. Contact",
    body: [`For privacy questions or requests, contact ${CONTACT_EMAIL}.`],
  },
];

export default function PrivacyPage() {
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
          Privacy Policy
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
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            Terms of Service
          </Link>
        </div>
      </article>
    </main>
  );
}
