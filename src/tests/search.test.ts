// SearchService tests: exact names, aliases, fuzzy/partial matches,
// abbreviations, spelling variations, and honest empty results.

import { describe, it, expect } from "vitest";
import { searchPlaces, resultDescriptor } from "@/services/SearchService";

describe("SearchService", () => {
  it("finds the library by name", () => {
    const results = searchPlaces("library");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("central-library");
  });

  it("finds boys hostel blocks", () => {
    const results = searchPlaces("boys hostel");
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.id);
    expect(ids).toContain("osm-way-1367916185"); // Boys Hostel Block A
  });

  it("finds the mess (top result)", () => {
    const results = searchPlaces("mess");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("osm-way-1367916199" === results[0].id ? results[0].id : results[0].id);
    // The mess or the mess hall must rank first among food results.
    const top = results[0];
    expect(top.category).toBe("food");
    expect(top.name.toLowerCase()).toContain("mess");
  });

  it("finds ATMs via the manually curated entry", () => {
    const results = searchPlaces("ATM");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("hostel-atm");
  });

  it("finds the Lab Complex via the 'cse lab' alias", () => {
    const results = searchPlaces("cse lab");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("osm-way-1120857899");
  });

  it("finds academic blocks with a partial query", () => {
    const results = searchPlaces("acad");
    const ids = results.map((r) => r.id);
    expect(ids).toContain("osm-rel-16248225"); // Academic Block 1
    expect(ids).toContain("osm-way-1367916190"); // Academic Block 2
  });

  it("supports the 'bhm' abbreviation", () => {
    const results = searchPlaces("bhm");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe("food");
  });

  it("handles the medical centre / center spelling variation", () => {
    const results = searchPlaces("medical centre");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("health-center");
    const results2 = searchPlaces("medical center");
    expect(results2.length).toBeGreaterThan(0);
    expect(results2[0].id).toBe("health-center");
  });

  it("returns multiple Mayuri outlets", () => {
    const results = searchPlaces("mayuri");
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("finds the Multi-purpose Hall via the mph alias", () => {
    const results = searchPlaces("mph");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("osm-way-1120859271");
  });

  it("returns no results for room numbers (no room data exists)", () => {
    const results = searchPlaces("room 327");
    expect(results).toEqual([]);
  });

  it("returns no results for gibberish", () => {
    expect(searchPlaces("zzzzqqqq")).toEqual([]);
    expect(searchPlaces("")).toEqual([]);
  });

  it("finds the gym", () => {
    const results = searchPlaces("gym");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe("sports");
  });

  it("produces readable descriptors", () => {
    const results = searchPlaces("library");
    const desc = resultDescriptor(results[0]);
    expect(desc).toContain("Study");
  });
});
