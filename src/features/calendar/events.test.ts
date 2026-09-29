import { describe, expect, test } from "bun:test";
import {
  eventsInMonth,
  visibleEvents,
  type CalendarEvent,
  type CalendarScope,
} from "./events";

function ev(over: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Uji",
    source: "period",
    start: "2026-10-01",
    end: "2026-10-31",
    divisionId: null,
    classId: null,
    ...over,
  };
}

function scope(over: Partial<CalendarScope> = {}): CalendarScope {
  return {
    userId: "u1",
    divisionIds: [],
    classIds: [],
    canViewAll: false,
    ...over,
  };
}

describe("visibleEvents", () => {
  test("tanpa sesi: kosong", () => {
    expect(visibleEvents([ev()], scope({ userId: null }))).toEqual([]);
  });

  test("rentang org terlihat semua user login", () => {
    const events = [
      ev({ source: "period" }),
      ev({ source: "batch", id: "e2" }),
    ];
    expect(visibleEvents(events, scope())).toHaveLength(2);
  });

  test("kelas: hanya anggota / akses luas", () => {
    const e = ev({
      source: "class",
      id: "c1",
      classId: "class-a",
      divisionId: "div-web",
    });
    expect(visibleEvents([e], scope())).toEqual([]);
    expect(visibleEvents([e], scope({ classIds: ["class-a"] }))).toHaveLength(
      1,
    );
    expect(
      visibleEvents([e], scope({ divisionIds: ["div-web"] })),
    ).toHaveLength(1);
    expect(visibleEvents([e], scope({ canViewAll: true }))).toHaveLength(1);
  });
});

describe("eventsInMonth", () => {
  test("filter singgung bulan", () => {
    const events = [
      ev({ id: "a", start: "2026-09-20", end: "2026-10-05" }),
      ev({ id: "b", start: "2026-11-01", end: null }),
      ev({ id: "c", start: "2026-10-15", end: null }),
    ];
    const ids = eventsInMonth(events, 2026, 10)
      .map((e) => e.id)
      .sort();
    expect(ids).toEqual(["a", "c"]);
  });
});
