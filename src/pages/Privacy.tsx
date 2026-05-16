import { Link } from "react-router-dom";

const Privacy = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/" className="font-display text-lg font-bold text-foreground">
          Oasis Baklawa Central
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
      </div>
    </header>

    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Purpose of Data Collection</h2>
          <p>
            We collect account and profile information needed to authenticate you and operate the Oasis Baklawa Central B2B portal—primarily through email and password sign-in, mobile one-time codes (SMS, WhatsApp, or voice where supported), and details you provide in your partner application. We do not use this information for marketing or advertising.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Data Security</h2>
          <p>
            We do not sell, rent, or share user data with third parties. All account information is securely stored using Supabase, our authenticated infrastructure provider, with industry-standard encryption at rest and in transit.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email address and password (processed by our authentication provider)</li>
            <li>Phone number when you use mobile one-time code sign-in</li>
            <li>Name and business profile details you provide during onboarding</li>
            <li>Order history and transactional records associated with your account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. User Rights & Account Deletion</h2>
          <p>
            You may request deletion of your account and all associated personal data at any time by emailing{" "}
            <a href="mailto:oasisbaklawa2006@gmail.com" className="text-primary underline">
              oasisbaklawa2006@gmail.com
            </a>
            . Requests are processed within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Contact</h2>
          <p>
            For privacy-related questions, contact us at{" "}
            <a href="mailto:oasisbaklawa2006@gmail.com" className="text-primary underline">
              oasisbaklawa2006@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>

    <footer className="border-t border-border mt-12">
      <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-center gap-6 text-sm">
        <Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
        <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
        <Link to="/shipping" className="text-muted-foreground hover:text-foreground">Shipping</Link>
      </div>
    </footer>
  </div>
);

export default Privacy;
