import { describe, expect, it } from "vitest";
import {
  assertPublicRequirementUrl,
  csvToTable,
  gridToText,
  htmlToText,
  readRequirementSources,
  stripEmailQuotedChain,
  toGoogleSheetCsvUrl,
} from "@/server/ai/requirement-source.service";

/**
 * Requirement Intelligence — intake (Task 002).
 *
 * "Accept any recruitment requirement from WhatsApp, PDF, Image, Voice
 * Note, Email, Word, Excel, Google Sheet, Website."
 *
 * These tests cover the parts that decide whether a requirement survives
 * the trip intact: the CSV reader that must not split a salary in half,
 * the email trimmer that must not read last month's requirement as this
 * month's, and the URL guard that must not let a requirement link reach
 * into private infrastructure.
 */

describe("csvToTable — a salary containing a comma is one field", () => {
  it("keeps quoted commas inside the field", () => {
    // The failure this prevents: "SAR 3,200" splitting into two columns
    // and shifting every value after it on the row.
    const rows = csvToTable('Trade,Count,Salary\nWelder,10,"SAR 3,200"\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["Welder", "10", "SAR 3,200"]);
  });

  it("handles escaped quotes inside a quoted field", () => {
    const rows = csvToTable('Note\n"He said ""urgent"" twice"\n');
    expect(rows[1][0]).toBe('He said "urgent" twice');
  });

  it("handles a newline inside a quoted field", () => {
    const rows = csvToTable('Trade,Notes\nWelder,"Line one\nLine two"\n');
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe("Line one\nLine two");
  });

  it("drops entirely blank rows but keeps rows with any content", () => {
    const rows = csvToTable("Trade,Count\n\n,\nWelder,10\n");
    expect(rows).toEqual([
      ["Trade", "Count"],
      ["Welder", "10"],
    ]);
  });

  it("handles a file with no trailing newline", () => {
    expect(csvToTable("Trade,Count\nWelder,10")).toHaveLength(2);
  });

  it("is deterministic", () => {
    const csv = 'Trade,Count,Salary\nWelder,10,"SAR 3,200"\nRigger,5,"SAR 2,800"\n';
    expect(csvToTable(csv)).toEqual(csvToTable(csv));
  });
});

describe("gridToText — a spreadsheet becomes a readable table", () => {
  it("renders rows as tab-separated lines and labels the sheet", () => {
    const text = gridToText(
      [
        ["Trade", "Count"],
        ["Welder", "10"],
      ],
      "Demand",
    );
    expect(text).toContain("# Sheet: Demand");
    expect(text).toContain("Trade\tCount");
    expect(text).toContain("Welder\t10");
  });

  it("preserves every row of a large requirement", () => {
    const grid = Array.from({ length: 60 }, (_, i) => [`Trade ${i}`, String(i + 1)]);
    expect(gridToText(grid).split("\n")).toHaveLength(60);
  });
});

describe("htmlToText — a job page becomes readable text", () => {
  it("removes scripts, styles and navigation", () => {
    const text = htmlToText(
      "<nav>Home About</nav><script>var x=1</script><style>a{}</style><p>Welder required</p>",
    );
    expect(text).toContain("Welder required");
    expect(text).not.toContain("var x");
    expect(text).not.toContain("Home About");
  });

  it("keeps table structure as line structure", () => {
    const text = htmlToText("<table><tr><td>Welder</td><td>10</td></tr><tr><td>Rigger</td><td>5</td></tr></table>");
    expect(text).toContain("Welder");
    expect(text).toContain("Rigger");
    expect(text.split("\n").length).toBeGreaterThan(1);
  });

  it("decodes the entities that appear in real listings", () => {
    expect(htmlToText("<p>Food &amp; accommodation</p>")).toBe("Food & accommodation");
  });
});

describe("toGoogleSheetCsvUrl", () => {
  it("rewrites a browser-bar edit link to its CSV export", () => {
    expect(toGoogleSheetCsvUrl("https://docs.google.com/spreadsheets/d/ABC123_x-y/edit#gid=0")).toBe(
      "https://docs.google.com/spreadsheets/d/ABC123_x-y/export?format=csv&gid=0",
    );
  });

  it("preserves the selected tab", () => {
    expect(
      toGoogleSheetCsvUrl("https://docs.google.com/spreadsheets/d/ABC123/edit#gid=987654"),
    ).toContain("gid=987654");
  });

  it("rejects anything that is not a Google Sheets link", () => {
    expect(toGoogleSheetCsvUrl("https://example.com/sheet.csv")).toBeNull();
    expect(toGoogleSheetCsvUrl("https://docs.google.com/document/d/ABC/edit")).toBeNull();
  });
});

describe("stripEmailQuotedChain — this month's requirement, not last month's", () => {
  it("cuts the quoted reply chain", () => {
    const body = [
      "We need 10 welders for Dammam, SAR 3200.",
      "",
      "On 1 July 2026, principal@example.com wrote:",
      "> We need 40 welders for Riyadh, SAR 2000.",
    ].join("\n");

    const { text, trimmed } = stripEmailQuotedChain(body);
    expect(trimmed).toBe(true);
    expect(text).toContain("10 welders");
    // The superseded requirement must not reach the extractor.
    expect(text).not.toContain("40 welders");
  });

  it("cuts an Outlook-style forwarded header", () => {
    const body = "New requirement: 5 riggers.\n\n-----Original Message-----\nFrom: old@example.com\n5000 masons";
    expect(stripEmailQuotedChain(body).text).not.toContain("masons");
  });

  it("cuts a signature block", () => {
    const body = "Need 12 electricians.\n\n--\nRajesh\nSenior Recruiter";
    expect(stripEmailQuotedChain(body).text).toBe("Need 12 electricians.");
  });

  it("keeps the whole message when trimming would leave nothing", () => {
    // Losing a signature is fine. Losing the requirement is not.
    const body = "From: someone@example.com\nWe need 10 welders.";
    const { text } = stripEmailQuotedChain(body);
    expect(text).toContain("10 welders");
  });

  it("leaves a plain message untouched", () => {
    const body = "We need 10 welders for Dammam.";
    expect(stripEmailQuotedChain(body)).toEqual({ text: body, trimmed: false });
  });
});

describe("assertPublicRequirementUrl — a link must not reach into private space", () => {
  it.each([
    "http://localhost/req",
    "http://127.0.0.1/req",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/req",
    "http://192.168.1.10/req",
    "http://172.16.0.1/req",
    "http://[::1]/req",
  ])("rejects %s", (url) => {
    expect(() => assertPublicRequirementUrl(url)).toThrow();
  });

  it("rejects a non-http scheme", () => {
    expect(() => assertPublicRequirementUrl("file:///etc/passwd")).toThrow();
    expect(() => assertPublicRequirementUrl("gopher://example.com")).toThrow();
  });

  it("allows an ordinary public URL", () => {
    expect(assertPublicRequirementUrl("https://example.com/jobs").hostname).toBe("example.com");
  });
});

describe("readRequirementSources — one bad source never costs the others", () => {
  it("reads plain text and WhatsApp text", async () => {
    const { sources, unreadable } = await readRequirementSources([
      { kind: "WHATSAPP_TEXT", text: "Need 10 welders, Dammam, SAR 3200." },
      { kind: "PLAIN_TEXT", text: "Interview on 14th August in Mumbai." },
    ]);
    expect(sources).toHaveLength(2);
    expect(unreadable).toHaveLength(0);
  });

  it("keeps processing siblings when one source is unreadable", async () => {
    const { sources, unreadable } = await readRequirementSources([
      { kind: "WHATSAPP_TEXT", text: "Need 10 welders." },
      { kind: "WHATSAPP_TEXT", text: "   " },
    ]);
    expect(sources).toHaveLength(1);
    expect(unreadable).toHaveLength(1);
    // The recruiter is told what was ignored, and why.
    expect(unreadable[0].error.length).toBeGreaterThan(0);
  });

  it("de-duplicates the same artifact forwarded twice in one batch", async () => {
    const text = "Need 10 welders for Dammam.";
    const { sources } = await readRequirementSources([
      { kind: "WHATSAPP_TEXT", text },
      { kind: "WHATSAPP_TEXT", text },
    ]);
    expect(sources).toHaveLength(1);
  });

  it("strips the quoted chain from an email source and says so", async () => {
    const { sources } = await readRequirementSources([
      {
        kind: "EMAIL",
        text: "Need 10 welders.\n\nOn 1 July 2026, x@example.com wrote:\n> Need 40 masons.",
      },
    ]);
    expect(sources[0].content.type).toBe("text");
    if (sources[0].content.type === "text") {
      expect(sources[0].content.text).not.toContain("masons");
    }
    expect(sources[0].notes.join(" ")).toContain("Quoted reply chain");
  });

  it("reports an unreadable voice note without failing the whole intake", async () => {
    // Transcription is unconfigured in tests — the voice note is reported
    // as unreadable and the text source still produces a requirement.
    const { sources, unreadable } = await readRequirementSources([
      { kind: "WHATSAPP_TEXT", text: "Need 10 welders for Dammam." },
      { kind: "VOICE_NOTE", data: Buffer.from("not-really-audio"), mimeType: "audio/ogg", fileName: "note.ogg" },
    ]);
    expect(sources).toHaveLength(1);
    expect(unreadable).toHaveLength(1);
    expect(unreadable[0].kind).toBe("VOICE_NOTE");
  });

  it("rejects a website source pointing at private space", async () => {
    const { sources, unreadable } = await readRequirementSources([
      { kind: "WEBSITE", url: "http://169.254.169.254/latest/meta-data/" },
    ]);
    expect(sources).toHaveLength(0);
    expect(unreadable[0].error).toContain("private address");
  });

  it("rejects a Google Sheet source that is not a Sheets link", async () => {
    const { unreadable } = await readRequirementSources([
      { kind: "GOOGLE_SHEET", url: "https://example.com/not-a-sheet" },
    ]);
    expect(unreadable[0].error).toContain("Google Sheets link");
  });

  it("reports a corrupt Excel workbook honestly rather than silently reading nothing", async () => {
    const { sources, unreadable } = await readRequirementSources([
      { kind: "EXCEL", data: Buffer.from("this is not a workbook"), mimeType: "application/vnd.ms-excel", fileName: "demand.xlsx" },
    ]);
    expect(sources).toHaveLength(0);
    expect(unreadable[0].error).toContain("could not be read");
  });

  it("reads a real multi-sheet workbook, including every sheet", async () => {
    // Built with the same library that reads it, so this is a genuine
    // round trip rather than a fixture that could drift.
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();

    const demand = workbook.addWorksheet("Demand");
    demand.addRow(["Trade", "Count", "Salary"]);
    demand.addRow(["Welder", 10, "SAR 3,200"]);
    demand.addRow(["Rigger", 5, "SAR 2,800"]);

    // Overseas demand workbooks routinely put the pay scale on a second
    // tab; reading only sheet 1 loses half the requirement.
    const scale = workbook.addWorksheet("Pay Scale");
    scale.addRow(["Experience", "Salary"]);
    scale.addRow(["8-9 years", "SAR 10,000"]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const { sources, unreadable } = await readRequirementSources([
      {
        kind: "EXCEL",
        data: buffer,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileName: "demand.xlsx",
      },
    ]);

    expect(unreadable).toHaveLength(0);
    expect(sources).toHaveLength(1);
    expect(sources[0].content.type).toBe("text");
    if (sources[0].content.type !== "text") return;

    const text = sources[0].content.text;
    expect(text).toContain("# Sheet: Demand");
    expect(text).toContain("Welder");
    expect(text).toContain("SAR 3,200");
    expect(text).toContain("# Sheet: Pay Scale");
    expect(text).toContain("SAR 10,000");
  });

  it("hashes every source so it can be identified later", async () => {
    const { sources } = await readRequirementSources([
      { kind: "PLAIN_TEXT", text: "Need 10 welders." },
    ]);
    expect(sources[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
