import { Link } from "react-router-dom";

const PublicTerms = () => (
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
        Terms of Service
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Authorized Use</h2>
          <p>
            This portal is strictly for Oasis Baklawa franchisees, managers, and authorized B2B partners. Unauthorized access, scraping, reverse engineering, or use by parties outside of our partner network is prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Account Responsibility</h2>
          <p>
            Users are responsible for maintaining the confidentiality of their login credentials and for all activity that occurs under their account. Notify us immediately of any unauthorized use or security breach.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Intellectual Property</h2>
          <p>
            All recipes, cost sheets, brand assets, product imagery, and operational documentation made available through this portal are the exclusive property of Oasis Baklawa. Reproduction, redistribution, or commercial use outside the scope of your partner agreement is strictly prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Acceptable Use</h2>
          <p>
            You agree not to misuse the portal, attempt unauthorized access, upload malicious content, or interfere with the proper functioning of the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Termination</h2>
          <p>
            We reserve the right to suspend or terminate access for any user found in violation of these terms or upon termination of the underlying partner agreement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Contact</h2>
          <p>
            For questions about these terms, contact{" "}
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

export default PublicTerms;
