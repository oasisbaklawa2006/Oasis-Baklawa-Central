import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logoImg from "@/assets/logo-open.png";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";

// Public Buyer welcome entry. Buyer authentication lives at /buyer/login;
// employee authentication remains a deliberately secondary restricted entry at
// /staff/login. No credential field is rendered on this surface.
const AuthEntry = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { lang, setLang } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const showPreferences = searchParams.get("view") === "preferences";

  const handleApplyForB2BAccess = () => {
    navigate("/buyer/access-request");
  };

  if (showPreferences) {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={18} />
            Back
          </button>

          <div className="space-y-2">
            <h1 className="text-3xl text-foreground">Language and currency</h1>
            <p className="text-sm text-muted-foreground">Select your business preferences</p>
          </div>

          <div className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Preferred Language</p>
              <button
                type="button"
                aria-pressed={lang === "en"}
                onClick={() => setLang("en")}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm ${lang === "en" ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}
              >
                English
              </button>
              <button
                type="button"
                aria-pressed={lang === "hi"}
                onClick={() => setLang("hi")}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm ${lang === "hi" ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}
              >
                हिन्दी (Hindi)
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Default Currency</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={currency === "INR"}
                  onClick={() => setCurrency("INR")}
                  className={`rounded-xl border px-4 py-3 text-sm ${currency === "INR" ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  aria-pressed={currency === "USD"}
                  onClick={() => setCurrency("USD")}
                  className={`rounded-xl border px-4 py-3 text-sm ${currency === "USD" ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}
                >
                  $ USD
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm"
          >
            Save and continue
          </button>

          <button
            type="button"
            onClick={() => navigate("/staff/login")}
            className="w-full py-3 text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Admin Access
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col">
        <div className="flex flex-1 flex-col justify-center space-y-8">
          <div className="space-y-6 text-center">
            <img
              src={logoImg}
              alt="Oasis Baklawa"
              width={134}
              height={96}
              fetchPriority="high"
              decoding="async"
              className="mx-auto h-20 w-auto object-contain"
            />
            <div className="space-y-3">
              <h1 className="text-3xl text-foreground">Everything you need from Oasis Baklawa — in one place.</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Explore products, prepare orders, track production, manage payments and access business documents.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate("/buyer/login")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm"
            >
              Log in
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={handleApplyForB2BAccess}
              className="w-full rounded-xl border border-border bg-card py-3.5 text-sm font-semibold text-foreground"
            >
              Request B2B Access
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSearchParams({ view: "preferences" })}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Language and currency
          </button>
        </div>

        <div className="border-t border-border pt-5 text-center">
          <button
            type="button"
            onClick={() => navigate("/staff/login")}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ShieldCheck size={15} />
            Admin Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthEntry;
