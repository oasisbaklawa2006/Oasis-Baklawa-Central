import { describe, expect, it } from "vitest";
import { showsPendingApplicationBadge } from "../adminNavBadges";

describe("showsPendingApplicationBadge", () => {
  it("shows the B2B application count on the Clients link only", () => {
    expect(showsPendingApplicationBadge("/admin/clients", 3)).toBe(true);
    expect(showsPendingApplicationBadge("/admin/gifting-enquiries", 3)).toBe(false);
    expect(showsPendingApplicationBadge("/admin/products", 3)).toBe(false);
  });

  it("shows no badge when nothing is pending", () => {
    expect(showsPendingApplicationBadge("/admin/clients", 0)).toBe(false);
  });
});
