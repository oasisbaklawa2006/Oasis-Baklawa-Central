import { NavLink, useLocation } from "react-router-dom";
import {
  APPVERSE_WORKSPACES,
  canAccessWorkspace,
  getWorkspaceForPath,
} from "@/lib/appverse/workspaces";
import type { AppVerseGrantedModule } from "@/lib/appverse/roleAccess";

type AppverseWorkspaceRailProps = {
  allowedModules: readonly AppVerseGrantedModule[];
  onNavigate?: () => void;
};

export default function AppverseWorkspaceRail({
  allowedModules,
  onNavigate,
}: AppverseWorkspaceRailProps) {
  const location = useLocation();
  const activeWorkspace = getWorkspaceForPath(location.pathname);
  const visibleWorkspaces = APPVERSE_WORKSPACES.filter((workspace) =>
    canAccessWorkspace(workspace, allowedModules),
  );

  return (
    <nav aria-label="App-Verse workspaces" className="space-y-1">
      {visibleWorkspaces.map((workspace) => {
        const Icon = workspace.icon;
        const isActive = workspace.key === activeWorkspace.key;

        return (
          <NavLink
            key={workspace.key}
            to={workspace.landingPath}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={[
              "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              isActive
                ? "bg-[hsl(var(--appverse-premium))] text-[hsl(var(--appverse-espresso))] font-medium"
                : "text-foreground/72 hover:bg-[hsl(var(--appverse-utility))] hover:text-foreground",
            ].join(" ")}
          >
            <span
              className={[
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
                isActive
                  ? "border-[hsl(var(--appverse-gold)/0.45)] bg-background/70 text-[hsl(var(--appverse-olive))]"
                  : "border-border/70 bg-background/40 text-muted-foreground group-hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{workspace.label}</span>
              <span className="mt-0.5 hidden truncate text-[11px] font-normal text-muted-foreground xl:block">
                {workspace.description}
              </span>
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
