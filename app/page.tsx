import { CreateGuestbookButton } from "@/components/landing/CreateGuestbookButton"
import { CtaWave } from "@/components/landing/CtaWave"
import { RevealScript } from "@/components/landing/RevealScript"
import { StickyNav } from "@/components/landing/StickyNav"
import { VoiceSection } from "@/components/landing/VoiceSection"
import { Button } from "@/components/ui/button"
import { Check, Download, Plus, QrCode } from "lucide-react"

const testimonials = [
  {
    text: "We have a thousand photos. But hearing my dad's voice from that night, that's the thing I play when I miss him.",
    name: "Priya & Dev",
    date: "Married June 2026",
  },
  {
    text: "Grandma left a two-minute message and cried the whole way through. It's the best thing we own from the wedding.",
    name: "Sam & Alex",
    date: "Married May 2026",
  },
  {
    text: "The QR went on every table and people just got it. Even the guests who hate technology left something.",
    name: "Nina & Jordan",
    date: "Married April 2026",
  },
]

const faqItems = [
  {
    q: "Do guests need to download an app?",
    a: "Never. Guests scan the QR code or open your link and the recorder opens right in their phone's browser. No app, no account, no sign-up, they tap record and talk.",
  },
  {
    q: "Does it work on iPhone and Android?",
    a: "Both. Because Toastbook runs in the browser, it works on any modern phone. We ask for microphone access the moment a guest taps record, so recording starts instantly.",
  },
  {
    q: "How long can a message be?",
    a: "Up to 60 seconds each, long enough for a heartfelt note or a toast, short enough that guests don't overthink it. They can re-record as many times as they like before sending.",
  },
  {
    q: "Who can hear the messages?",
    a: "Only you. Your gallery is private by default. After the wedding you can choose to share a read-only link with the people who were there.",
  },
  {
    q: "Can I download and keep the recordings?",
    a: "Yes. With the one-time €49 unlock you can download every message individually or grab the whole collection as a zip, they're yours to keep, forever.",
  },
  {
    q: "Why voices instead of photos?",
    a: "Plenty of apps capture how your day looked. Toastbook captures how it sounded, laughter, nerves, the catch in someone's voice. It's the closest thing to being back in the room.",
  },
]

const WaveformMark = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
  >
    <path d="M3 12h2M5 8v8M8 5v14M11 9v6M14 4v16M17 8v8M20 10v4M23 11v2" />
  </svg>
)

const Tick = () => (
  <span className="tick">
    <Check size={18} strokeWidth={2.2} />
  </span>
)

export default function Page() {
  return (
    <>
      <div className="grain-fixed" aria-hidden="true" />
      <StickyNav />

      <main>
        {/* ── Hero ── */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <div className="eyebrow reveal">
                A voice guestbook for weddings
              </div>
              <h1 className="reveal">
                Keep every <em>voice</em> from your day.
              </h1>
              <p className="lede reveal">
                Guests scan one code and leave a spoken message, no app, no
                account. You keep a private gallery of every voice, to play back
                long after the day is over.
              </p>
              <div className="hero-actions reveal">
                <CreateGuestbookButton
                  variant="accent"
                  className="h-[54px] rounded-full px-6 text-base"
                />
                <Button
                  variant="ghost-brand"
                  className="h-[54px] rounded-full px-6 text-base"
                  asChild
                >
                  <a href="#voices">Hear an example</a>
                </Button>
              </div>
              <div className="hero-note reveal">
                <span>Free to start</span>
                <span className="dot" />
                <span>€49 to keep everything</span>
                <span className="dot" />
                <span>No app for guests</span>
              </div>
            </div>

            <div className="hero-visual reveal" aria-hidden="true">
              {/* floating voice message cards */}
              <div className="float-card fc1">
                <span className="fc-play" aria-hidden="true">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
                <span className="fc-meta">
                  <span className="fc-name">Aunt Rosa</span>
                  <span className="fc-sub">MOTHER IN LAW · 0:41</span>
                </span>
              </div>
              <div className="float-card fc2">
                <span className="fc-play" aria-hidden="true">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
                <span className="fc-meta">
                  <span className="fc-name">Grandpa Lou</span>
                  <span className="fc-sub">A TOAST, OF COURSE · 0:58</span>
                </span>
              </div>

              {/* phone mock */}
              <div className="phone">
                <div className="phone-notch" aria-hidden="true" />
                <div className="phone-screen">
                  <div className="phone-cover">
                    <span className="phone-cover-label">Cover photo</span>
                  </div>
                  <div className="phone-eyebrow eyebrow">
                    Leave a message for
                  </div>
                  <div className="phone-names">
                    Maya <em>&amp;</em> Theo
                  </div>
                  <div className="phone-date">SEPTEMBER 14, 2026</div>
                  <div className="phone-rec">
                    <span className="ring">
                      <i />
                    </span>
                    Record your message
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Statement ── */}
        <section className="section alt">
          <div className="wrap">
            <p className="statement reveal">
              Photos capture how the day <em>looked.</em> Voices capture how it{" "}
              <em>felt.</em>
            </p>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="section" id="how">
          <div className="wrap">
            <div className="section-head reveal">
              <div className="eyebrow">How it works</div>
              <h2 className="section-title">
                From a code on the table to a keepsake you&apos;ll play for
                years.
              </h2>
            </div>
            <div className="steps">
              <div className="step reveal">
                <div className="step-num">STEP 01</div>
                <div className="step-rule" />
                <div className="step-icon">
                  <Plus size={22} />
                </div>
                <h3>Create your guestbook</h3>
                <p>
                  Add the couple&apos;s names and date, an optional cover photo,
                  and record a short hello. Two minutes, no design skills.
                </p>
              </div>
              <div className="step reveal">
                <div className="step-num">STEP 02</div>
                <div className="step-rule" />
                <div className="step-icon">
                  <QrCode size={22} />
                </div>
                <h3>Share one code</h3>
                <p>
                  Pop the QR on the tables or text the link to anyone who
                  couldn&apos;t make it. Guests just tap and talk, no app, no
                  account.
                </p>
              </div>
              <div className="step reveal">
                <div className="step-num">STEP 03</div>
                <div className="step-rule" />
                <div className="step-icon">
                  <Download size={22} />
                </div>
                <h3>Keep every voice</h3>
                <p>
                  Messages arrive live in your private gallery. Play them back,
                  download the lot, and revisit the day whenever you like.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sample voices (interactive client island) ── */}
        <VoiceSection />

        {/* ── Testimonials ── */}
        <section className="section">
          <div className="wrap">
            <div className="section-head center reveal">
              <div className="eyebrow">Loved by couples</div>
              <h2 className="section-title">
                The part of the day they didn&apos;t want to lose.
              </h2>
            </div>
            <div className="quotes">
              {testimonials.map((t, i) => (
                <figure key={i} className="quote reveal">
                  <div className="mark">&ldquo;</div>
                  <p>{t.text}</p>
                  <figcaption className="who">
                    <span>
                      <b>{t.name}</b>
                      <span>{t.date}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="section alt" id="pricing">
          <div className="wrap">
            <div className="section-head center reveal">
              <div className="eyebrow">Pricing</div>
              <h2 className="section-title">
                One price. <em>Everything.</em>
              </h2>
              <p className="section-sub">
                Start free and collect messages right away. When you&apos;re
                ready to keep them, it&apos;s a single payment, no subscription,
                ever.
              </p>
            </div>
            <div className="price-grid reveal">
              <div className="price-col">
                <h3>Start free</h3>
                <p className="price-desc">
                  Set up your guestbook, share the code, and start gathering
                  voices the moment your guests arrive.
                </p>
                <ul className="feat-list">
                  <li>
                    <Tick /> Unlimited guests, no app to install
                  </li>
                  <li>
                    <Tick /> QR code &amp; shareable link
                  </li>
                  <li>
                    <Tick /> Listen to messages as they arrive
                  </li>
                </ul>
                <CreateGuestbookButton
                  variant="ghost-brand"
                  className="h-12 w-full rounded-full text-sm"
                />
              </div>
              <div className="price-col feature">
                <div className="eyebrow price-eyebrow">Keepsake · one-time</div>
                <div className="price-tag">
                  <span className="amt">€49</span>
                  <span className="per">once, per wedding</span>
                </div>
                <p className="price-desc">
                  Unlock the full collection and make it yours forever.
                </p>
                <ul className="feat-list">
                  <li>
                    <Tick /> Unlimited messages, kept forever
                  </li>
                  <li>
                    <Tick /> Download everything as a zip
                  </li>
                  <li>
                    <Tick /> Share a read-only gallery
                  </li>
                </ul>
                <Button
                  variant="accent"
                  className="h-12 w-full rounded-full text-sm"
                  asChild
                >
                  <a href="#">Unlock for €49</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="section" id="faq">
          <div className="wrap">
            <div className="section-head center reveal">
              <div className="eyebrow">Good to know</div>
              <h2 className="section-title">Questions, answered.</h2>
            </div>
            <div className="faq reveal">
              {faqItems.map((item, i) => (
                <details key={i} open={i === 0}>
                  <summary>
                    {item.q}
                    <span className="pm" aria-hidden="true" />
                  </summary>
                  <p className="ans">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing CTA ── */}
        <section className="section ink-band">
          <div className="wrap cta-band">
            <div className="eyebrow reveal">Toastbook</div>
            <p className="big reveal">Some things are meant to be heard.</p>
            <p className="sub reveal">
              Start your guestbook today, it&apos;s free until you&apos;re ready
              to keep it.
            </p>
            <CtaWave />
            <div className="reveal">
              <CreateGuestbookButton
                variant="accent"
                className="h-[54px] rounded-full px-6 text-base"
              />
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="aloud-footer">
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <div className="nav-brand">
                <span className="mark" aria-hidden="true">
                  <WaveformMark />
                </span>
                <span className="footer-name">Toastbook</span>
              </div>
              <p className="footer-tag">
                Made for the moments that pass too quickly.
              </p>
            </div>
            <div className="footer-cols">
              <div className="footer-col">
                <h4>Product</h4>
                <a href="#how">How it works</a>
                <a href="#voices">Listen</a>
                <a href="#pricing">Pricing</a>
                <a href="#">Create a guestbook</a>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">Contact</a>
              </div>
            </div>
          </div>
          <div className="footer-base">
            <span>© 2026 Toastbook. A voice guestbook for weddings.</span>
            <span>hello@Toastbook.gift</span>
          </div>
        </div>
      </footer>

      <RevealScript />
    </>
  )
}
