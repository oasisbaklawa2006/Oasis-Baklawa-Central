import { Link } from "react-router-dom";
import AppverseRoleHome from "@/components/appverse/AppverseRoleHome";
import { useAuth } from "@/hooks/useAuth";
import { getAllowedModulesForRole } from "@/lib/appverse/roleAccess";
import { getInternalApps } from "@/lib/appverse/appRegistry";
import { getTvSurfacesForRole } from "@/lib/appverse/tvSurfaces";

export default function AppverseAdminHome() {
  const { role } = useAuth();
  const allowedModules = getAllowedModulesForRole(role);
  const tvSurfaces = getTvSurfacesForRole(role);
  const internalApps = getInternalApps();
  const normalizedRole = role?.trim().toUpperCase() ?? null;
  const isExecutive = normalizedRole === "SUPER_ADMIN" || normalizedRole === "ADMIN";

  return (
    <div className="space-y-8">
      <AppverseRoleHome role={role} allowedModules={allowedModules} />

      {isExecutive && (
        <section className="rounded-2xl border border-border/80 bg-[hsl(var(--appverse-utility))] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--appverse-espresso))]">Management intelligence</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The existing analytical dashboard remains available as a deeper management view.
              </p>
            </div>
            <Link
              to="/admin/heartbeat"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[hsl(var(--appverse-gold)/0.35)] bg-background px-4 text-xs font-semibold text-[hsl(var(--appverse-espresso))] hover:bg-[hsl(var(--appverse-premium))]"
            >
              Open executive overview
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--appverse-espresso))]">Oasis App-Verse</h2>
          <p className="mt-1 text-xs text-muted-foreground">Application boundaries are explicit; backend authority is not duplicated here.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {internalApps.map((app) => (
            <div key={app.key} className="rounded-2xl border border-border/75 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[hsl(var(--appverse-espresso))]">{app.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{app.description}</p>
                </div>
                <span className="rounded-full border border-border bg-background/70 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {app.status === "active" ? "Active" : "Integration"}
                </span>
              </div>
              {app.defaultPath && (
                <Link to={app.defaultPath} className="mt-4 inline-flex text-xs font-semibold text-[hsl(var(--appverse-olive))]">
                  Open {app.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {tvSurfaces.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--appverse-espresso))]">Display surfaces</h2>
            <p className="mt-1 text-xs text-muted-foreground">Only TV views relevant to this role are exposed.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tvSurfaces.map((surface) => (
              <Link
                key={surface.key}
                to={surface.route}
                className="rounded-2xl border border-border/75 bg-card p-4 transition-colors hover:bg-[hsl(var(--appverse-utility))]"
              >
                <span className="block text-sm font-semibold text-[hsl(var(--appverse-espresso))]">{surface.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{surface.purpose}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
