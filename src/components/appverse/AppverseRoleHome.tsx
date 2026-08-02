import { ArrowRight, BellRing, ListChecks, MoveUpRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getRoleHomeDefinition,
  getVisibleRoleHomeCards,
  type RoleHomeCardKind,
} from "@/lib/appverse/roleHome";

type AppverseRoleHomeProps = {
  role: string | null | undefined;
  allowedModules: string[];
  userName?: string | null;
};

const KIND_META: Record<
  RoleHomeCardKind,
  { label: string; icon: typeof BellRing }
> = {
  metric: { label: "Overview", icon: Sparkles },
  queue: { label: "Work queue", icon: ListChecks },
  alert: { label: "Attention", icon: BellRing },
  shortcut: { label: "Open", icon: MoveUpRight },
};

export default function AppverseRoleHome({
  role,
  allowedModules,
  userName,
}: AppverseRoleHomeProps) {
  const navigate = useNavigate();
  const definition = getRoleHomeDefinition(role);
  const cards = getVisibleRoleHomeCards(role, allowedModules);
  const primaryCards = cards.filter((card) => card.priority === 1);
  const secondaryCards = cards.filter((card) => card.priority !== 1);

  const renderCard = (card: (typeof cards)[number], prominent: boolean) => {
    const meta = KIND_META[card.kind];
    const Icon = meta.icon;

    return (
      <button
        key={card.key}
        type="button"
        onClick={() => navigate(card.route)}
        className={[
          "group flex min-h-36 flex-col justify-between rounded-2xl border p-5 text-left transition-all",
          prominent
            ? "border-[hsl(var(--appverse-gold)/0.38)] bg-[hsl(var(--appverse-premium))] shadow-[0_10px_32px_rgba(67,51,38,0.06)] hover:-translate-y-0.5"
            : "border-border/80 bg-card hover:border-[hsl(var(--appverse-gold)/0.32)] hover:bg-[hsl(var(--appverse-utility))]",
        ].join(" ")}
      >
        <span className="flex items-start justify-between gap-4">
          <span
            className={[
              "grid h-10 w-10 place-items-center rounded-xl border",
              prominent
                ? "border-[hsl(var(--appverse-gold)/0.38)] bg-background/70 text-[hsl(var(--appverse-olive))]"
                : "border-border/75 bg-background text-muted-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {meta.label}
          </span>
        </span>

        <span className="mt-6 flex items-end justify-between gap-4">
          <span>
            <span className="block text-base font-medium text-[hsl(var(--appverse-espresso))]">
              {card.label}
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {card.priority === 1 ? "Priority work for this role" : "Available when needed"}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(var(--appverse-olive))]" aria-hidden="true" />
        </span>
      </button>
    );
  };

  return (
    <section aria-labelledby="appverse-role-home-title" className="mx-auto w-full max-w-7xl space-y-8">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--appverse-olive))]">
            {userName ? `Welcome, ${userName}` : "Oasis App-Verse"}
          </p>
          <h1 id="appverse-role-home-title" className="mt-2 text-3xl text-[hsl(var(--appverse-espresso))] sm:text-4xl">
            {definition.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {definition.subtitle}
          </p>
        </div>
        {role && (
          <span className="w-fit rounded-full border border-[hsl(var(--appverse-gold)/0.3)] bg-[hsl(var(--appverse-premium))] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[hsl(var(--appverse-espresso))]">
            {role.replaceAll("_", " ")}
          </span>
        )}
      </header>

      {primaryCards.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--appverse-espresso))]">Needs attention</h2>
            <span className="text-xs text-muted-foreground">Primary actions only</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {primaryCards.map((card) => renderCard(card, true))}
          </div>
        </div>
      )}

      {secondaryCards.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--appverse-espresso))]">Supporting views</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {secondaryCards.map((card) => renderCard(card, false))}
          </div>
        </div>
      )}

      {cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-[hsl(var(--appverse-utility))] p-8 text-center">
          <p className="text-sm font-medium text-[hsl(var(--appverse-espresso))]">No workspace actions are assigned to this role.</p>
          <p className="mt-1 text-xs text-muted-foreground">Access remains governed by the existing module permission model.</p>
        </div>
      )}
    </section>
  );
}
