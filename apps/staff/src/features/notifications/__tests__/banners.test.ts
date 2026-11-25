import { pickBanners, type BannerItem } from "../banners";

const item = (id: string, createdAt: string, readAt: string | null = null): BannerItem => ({
  id,
  kind: "new_order",
  title: "Nová objednávka",
  body: "Na čtvrtek 26. 11., přes web.",
  link: `/objednavka/${id}`,
  createdAt,
  readAt,
});

describe("pickBanners (spec 002 FR-021, FR-024)", () => {
  it("the first list only sets where the app started: nothing replays", () => {
    const r = pickBanners(
      [item("b", "2026-11-25T09:01:00.000Z"), item("a", "2026-11-25T09:00:00.000Z")],
      null,
      new Set(),
    );
    expect(r).toEqual({ fresh: [], since: "2026-11-25T09:01:00.000Z" });
    expect(pickBanners([], null, new Set()).since).toBe("");
  });

  it("later: unread ones created after the start, each once", () => {
    const since = "2026-11-25T09:01:00.000Z";
    const items = [
      item("d", "2026-11-25T09:03:00.000Z"),
      item("c", "2026-11-25T09:02:00.000Z", "2026-11-25T09:02:30.000Z"),
      item("b", since),
    ];
    expect(pickBanners(items, since, new Set()).fresh.map((n) => n.id)).toEqual(["d"]);
    expect(pickBanners(items, since, new Set(["d"])).fresh).toEqual([]);
  });

  it("one committed a moment late, older than one already shown, is still caught", () => {
    const since = "2026-11-25T09:00:00.000Z";
    const late = [item("e", "2026-11-25T09:05:00.000Z"), item("f", "2026-11-25T09:04:59.000Z")];
    expect(pickBanners(late, since, new Set(["e"])).fresh.map((n) => n.id)).toEqual(["f"]);
  });
});
