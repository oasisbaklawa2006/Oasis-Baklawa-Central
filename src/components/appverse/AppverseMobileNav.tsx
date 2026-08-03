import { NavLink, useLocation } from "react-router-dom";
import {
  APPVERSE_WORKSPACES,
  canAccessWorkspace,
  getWorkspaceForPath,
  type AppVerseWorkspace,
} from "@/lib/appverse/workspaces";
import type { AppVerseGrantedModule } from "@/lib/appverse/roleAccess";

type AppverseMobileNavProps = { allowedModules: readonly AppVerseGrantedModule[] };

function scoreWorkspace(workspace: AppVerseWorkspace) {
  const preferredOrder = ["home", "customers-sales", "orders-finance", "operations", "products-catalogue", "trace-dispatch", "governance"];
  return preferredOrder.indexOf(workspace.key);
}

export default function AppverseMobileNav({ allowedModules }: AppverseMobileNavProps) {
  const location = useLocation();
  const activeWorkspace = getWorkspaceForPath(location.pathname);
  const visible = APPVERSE_WORKSPACES.filter((workspace) => canAccessWorkspace(workspace, allowedModules)).sort((a, b) => scoreWorkspace(a) - scoreWorkspace(b));
  const primary = visible.slice(0, 4);
  const governance = visible.find((workspace) => workspace.key === "governance");
  const items = governance && !primary.some((workspace) => workspace.key === governance.key) ? [...primary, governance] : visible.slice(0, 5);
  return (
    <nav aria-label="Mobile App-Verse workspaces" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map((workspace) => { const Icon = workspace.icon; const isActive = workspace.key === activeWorkspace.key; return (
          <NavLink key={workspace.key} to={workspace.landingPath} aria-current={isActive ? "page" : undefined} className={["flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors", isActive ? "bg-[hsl(var(--appverse-premium))] text-[hsl(var(--appverse-olive))]" : "text-muted-foreground hover:bg-[hsl(var(--appverse-utility))] hover:text-foreground"].join(" ")}>
            <Icon className="h-4 w-4" aria-hidden="true" /><span className="max-w-full truncate">{workspace.shortLabel}</span>
          </NavLink>
        ); })}
      </div>
    </nav>
  );
}
