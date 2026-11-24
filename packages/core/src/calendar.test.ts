import { describe, expect, it } from "vitest";
import { buildCalendar, isAfterCutoff, pragueDate, type BakerySchedule } from "./calendar.ts";

const schedule: BakerySchedule = {
  closedWeekdays: [7],
  closedDays: ["2026-12-01"],
  cutoffDaysBefore: 1,
  cutoffTime: "14:00",
};

// Tuesday 2026-11-24, 10:00 in Prague (09:00 UTC)
const tuesdayMorning = new Date("2026-11-24T09:00:00Z");

describe("pragueDate", () => {
  it("uses the Prague day, not the UTC day", () => {
    // 23:30 UTC on 24 Nov is 00:30 on 25 Nov in Prague
    expect(pragueDate(new Date("2026-11-24T23:30:00Z"))).toBe("2026-11-25");
  });
});

describe("buildCalendar", () => {
  const days = buildCalendar(tuesdayMorning, schedule);

  it("lists 14 days starting today", () => {
    expect(days).toHaveLength(14);
    expect(days[0]?.date).toBe("2026-11-24");
    expect(days[13]?.date).toBe("2026-12-07");
  });

  it("marks today, tomorrow and the day after", () => {
    expect(days.slice(0, 4).map((d) => d.relative)).toEqual(["today", "tomorrow", "day_after", null]);
  });

  it("gives Czech weekday names", () => {
    expect(days[0]?.weekdayName).toBe("úterý");
    expect(days[4]?.weekdayName).toBe("sobota");
  });

  it("closes Sundays, owner's closed days and Czech public holidays", () => {
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
    expect(byDate["2026-11-29"]?.closedReason).toBe("weekday");
    expect(byDate["2026-12-01"]?.closedReason).toBe("owner");
    expect(byDate["2026-11-28"]?.closed).toBe(false);
  });

  it("closes Christmas Eve as a public holiday", () => {
    const december = buildCalendar(new Date("2026-12-20T09:00:00Z"), schedule);
    const eve = december.find((d) => d.date === "2026-12-24");
    expect(eve?.closed).toBe(true);
    expect(eve?.closedReason).toBe("holiday");
  });

  it("keeps calendar days across the end of daylight saving time", () => {
    const october = buildCalendar(new Date("2026-10-24T09:00:00Z"), schedule);
    expect(october.slice(0, 3).map((d) => d.date)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });
});

describe("isAfterCutoff", () => {
  it("allows tomorrow before 14:00 today", () => {
    expect(isAfterCutoff("2026-11-25", tuesdayMorning, schedule)).toBe(false);
  });

  it("refuses tomorrow after 14:00 today", () => {
    expect(isAfterCutoff("2026-11-25", new Date("2026-11-24T13:30:00Z"), schedule)).toBe(true);
  });

  it("refuses today", () => {
    expect(isAfterCutoff("2026-11-24", tuesdayMorning, schedule)).toBe(true);
  });

  it("allows the day after tomorrow in the afternoon", () => {
    expect(isAfterCutoff("2026-11-26", new Date("2026-11-24T15:00:00Z"), schedule)).toBe(false);
  });
});
