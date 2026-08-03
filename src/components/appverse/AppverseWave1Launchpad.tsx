import { ArrowRight, CircleDollarSign, Factory, MessagesSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { getVisibleWave1Areas } from "@/lib/appverse/wave1";

const ICONS = {
  "orders-finance": CircleDollarSign,
  "operations-production": Factory,
  "whatsapp-support": MessagesSquare,
} as const;

type Props = {
  allowedModules: string[];
};

export default function AppverseWave1Launchpad({ allowedModules }: Props) {
  const areas = getVisibleWave1Areas(allowedModules);
  if (areas.length === 0) return null;

  return (
    <section aria-labelledby="appverse-wave1-title">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--appverse-olive))]">Core workspaces</p>
          <h2 id="appverse-wave1-title" className="mt-1 text-lg font-semibold text-[hsl(var(--appverse-espresso))]">Move from signal to action</h2>
        </div>
        <p className="max-w-xl text-xs leading-5 text-muted-foreground">Only workspaces permitted by the existing module authority are shown. Backend state remains authoritative.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {areas.map((area) => {
          const Icon = ICONS[area.key];
          return (
            <Link
              key={area.key}
              to={area.landingPath}
              className="group flex min-h-48 flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--appverse-gold)/0.36)] hover:bg-[hsl(var(--appverse-utility))]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-[hsl(var(--appverse-gold)/0.28)] bg-[hsl(var(--appverse-premium))] text-[hsl(var(--appverse-olive))]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-border/75 bg-background px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Wave 1</span>
              </div>
              <div className="mt-6">
                <h3 className="text-base font-semibold text-[hsl(var(--appverse-espresso))]">{area.label}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{area.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--appverse-olive))]">
                  {area.primaryAction}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
