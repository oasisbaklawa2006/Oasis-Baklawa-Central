import { Link } from "react-router-dom";

const navLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const footerLinkClass =
  "inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-md px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const mailLinkClass =
  "inline-flex min-h-11 items-center rounded px-1 py-2 text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const Shipping = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="font-display text-lg font-bold text-foreground inline-flex min-h-11 items-center rounded-md px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Oasis Baklawa Central
        </Link>
        <Link to="/" className={navLinkClass} aria-label="Back to home">
          ← Home
        </Link>
      </div>
    </header>

    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
        Shipping & Refunds Policy
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Perishables Policy</h2>
          <p>
            All Oasis Baklawa products are food-based and perishable. Due to hygiene, food safety, and quality assurance standards, we do not accept returns once an order has been dispatched.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Damage Claims</h2>
          <p>
            Claims for damaged, defective, or short-shipped items must be reported within <strong>24 hours of delivery</strong>. Each claim must include clear photographic evidence of the damage and the original packaging. Claims submitted after 24 hours cannot be processed.
          </p>
          <p className="mt-3">
            Submit claims by emailing{" "}
            <a href="mailto:oasisbaklawa2006@gmail.com" className={mailLinkClass}>
              oasisbaklawa2006@gmail.com
            </a>{" "}
            with your invoice number and supporting photos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Shipping Timeline</h2>
          <p>
            Orders are dispatched within <strong>48 hours of production confirmation</strong>. Production confirmation occurs once payment and order details have been verified by our operations team. Delivery times thereafter depend on the destination and the courier or transporter assigned.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Approved Credit</h2>
          <p>
            For approved manufacturing defects, credit is issued at full value to your partner account wallet and may be applied to future orders. Credit is not refundable to original payment methods.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Contact</h2>
          <p>
            For shipping or claim-related questions, contact{" "}
            <a href="mailto:oasisbaklawa2006@gmail.com" className={mailLinkClass}>
              oasisbaklawa2006@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>

    <footer className="border-t border-border mt-12">
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        <Link to="/privacy" className={footerLinkClass}>
          Privacy
        </Link>
        <Link to="/terms" className={footerLinkClass}>
          Terms
        </Link>
        <Link to="/shipping" className={footerLinkClass} aria-current="page">
          Shipping
        </Link>
      </div>
    </footer>
  </div>
);

export default Shipping;
