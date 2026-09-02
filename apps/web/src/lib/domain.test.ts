import { describe, expect, it } from "vitest";

import { isRole, roleLabels, roleRoutes, roles } from "./domain";

describe("Waste-Wise roles", () => {
  it("exposes exactly the approved unified workspaces", () => {
    expect(roles).toEqual(["driver", "dispatcher", "admin"]);
    expect(roleLabels.admin).toBe("HR / Admin");
  });

  it("accepts only supported role values and points each role to its workspace", () => {
    expect(isRole("driver")).toBe(true);
    expect(isRole("dispatcher")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(roleRoutes.driver).toBe("/driver");
    expect(roleRoutes.dispatcher).toBe("/dispatch");
    expect(roleRoutes.admin).toBe("/admin");
  });
});
