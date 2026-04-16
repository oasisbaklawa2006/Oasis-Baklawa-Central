import { Link } from "react-router-dom";

const PublicLanding = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground tracking-wide">
              Oasis Baklawa Central
            </h1>
            <p className="text-xs text-muted-foreground tracking-wider uppercase mt-0.5">
              B2B Portal
            </p>
          </div>
          <Link
            to="/login"
            className="text-sm font-medium px-4 py-2 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
          >
            Partner Login
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">
            For Authorized Retail Partners
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground leading-tight mb-6">
            The central nervous system for Oasis Baklawa retail partners.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
            Manage orders, track production across our 11 locations, and access standardized recipes — all in one secure portal designed for franchisees, managers, and B2B partners.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-6 py-3 rounded-full border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
            >
              Apply for Access
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-6">
          {[
            { title: "Order Management", desc: "Place and track wholesale orders across categories with full visibility." },
            { title: "Production Tracking", desc: "Live updates from our 11 production locations through a 10-point artisan journey." },
            { title: "Standardized Recipes", desc: "Authorized access to brand-controlled recipes, cost sheets, and assets." },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Oasis Baklawa. All rights reserved.
          </p>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link to="/shipping" className="text-muted-foreground hover:text-foreground transition-colors">
              Shipping & Refunds
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default PublicLanding;
