export type AppVerseTvSurface = {
  key: string;
  label: string;
  route: string;
  audience: string[];
  purpose: string;
};

// Dragees and Dates have no standalone TV -- they share the Chocolates &
// Confectionery and Fusion Sweets screens respectively, and Ready Goods runs
// on its own chrome-free kiosk route rather than the full authenticated
// /admin shell, per the owner's six-TV estate (Central issue #368).
export const APPVERSE_TV_SURFACES: AppVerseTvSurface[] = [
  { key: "arabic-sweets", label: "Arabic Sweets Line", route: "/tv/arabic-sweets", audience: ["HOD_ARABIC", "PROD_ARABIC_SWEETS"], purpose: "Production line visibility" },
  { key: "chocolate", label: "Chocolate Line", route: "/tv/chocolate", audience: ["HOD_CHOCOLATE", "PROD_CHOCOLATE", "HOD_DRAGEES", "PROD_DRAGEES"], purpose: "Production line visibility" },
  { key: "fusion", label: "Fusion Sweets Line", route: "/tv/fusion", audience: ["HOD_FUSION", "PROD_FUSION", "HOD_DATES", "PROD_DATES"], purpose: "Production line visibility" },
  { key: "bakery", label: "Bakery Line", route: "/tv/bakery", audience: ["HOD_BAKERY", "PROD_BAKERY"], purpose: "Production line visibility" },
  { key: "nuts", label: "Nuts & Dry Fruits Line", route: "/tv/nuts", audience: ["HOD_NUTS", "PROD_NUTS"], purpose: "Production line visibility" },
  { key: "assembly", label: "Assembly TV", route: "/admin/assembly-tv", audience: ["HOD_ASSEMBLY", "ASSEMBLY_MANAGER", "TV_ASSEMBLY"], purpose: "Assembly queue visibility" },
  { key: "ready-goods", label: "Ready Goods TV", route: "/tv/rgs", audience: ["STORE_READY_GOODS", "RGS_ADMIN", "TV_READY"], purpose: "Ready-goods visibility" },
  { key: "dispatch", label: "Dispatch TV", route: "/admin/dispatch-tv", audience: ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"], purpose: "Dispatch readiness and movement visibility" },
];

export function getTvSurfacesForRole(role: string | null | undefined) {
  if (!role) return [];
  const normalized = role.trim().toUpperCase();
  if (normalized === "SUPER_ADMIN" || normalized === "ADMIN" || normalized === "TV_DISPLAY") return APPVERSE_TV_SURFACES;
  return APPVERSE_TV_SURFACES.filter((surface) => surface.audience.includes(normalized));
}
