import { describe, it, expect } from "vitest";
import { localBusinessJsonLd } from "./site";

describe("localBusinessJsonLd", () => {
  it("identifies the business as a Wichita Falls professional service", () => {
    const jsonLd = localBusinessJsonLd();
    expect(jsonLd["@type"]).toBe("ProfessionalService");
    expect(jsonLd.address.addressLocality).toBe("Wichita Falls");
    expect(jsonLd.address.addressRegion).toBe("TX");
  });

  it("covers both Wichita Falls and North Texas in areaServed", () => {
    const names = localBusinessJsonLd().areaServed.map((area) => area.name);
    expect(names).toContain("Wichita Falls");
    expect(names).toContain("North Texas");
  });

  it("omits sameAs entirely when no social profile has a URL", () => {
    const jsonLd = localBusinessJsonLd([{ label: "Instagram", url: null }]);
    expect(jsonLd).not.toHaveProperty("sameAs");
  });

  it("lists only the profiles that have URLs in sameAs", () => {
    const jsonLd = localBusinessJsonLd([
      { label: "Instagram", url: "https://www.instagram.com/example" },
      { label: "TikTok", url: null },
    ]);
    expect(jsonLd.sameAs).toEqual(["https://www.instagram.com/example"]);
  });
});
