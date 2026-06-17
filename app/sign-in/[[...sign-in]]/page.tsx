import { SignIn } from "@clerk/nextjs"

// Host sign-in (email magic link — configured in the Clerk dashboard).
export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 24,
        background: "var(--aloud-paper)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          className="eyebrow"
          style={{ color: "var(--aloud-ink-faint)", marginBottom: 8 }}
        >
          Toastbook · for hosts
        </div>
        <h1
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontWeight: 400,
            fontSize: 34,
            margin: 0,
            color: "var(--aloud-ink)",
          }}
        >
          Sign in to your guestbook
        </h1>
      </div>
      <SignIn />
    </main>
  )
}
