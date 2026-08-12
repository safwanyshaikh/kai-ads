import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAYOUTS, DG4_FRAMES, type LayoutSpec } from "./layouts";
import { buildLayoutHtml } from "./template";
import { runAudit, type AuditFinding } from "./audit";
import { verifyQr, type QrVerifyResult } from "./verify-qr";

const OUT = path.join(process.cwd(), "scripts", "layout-engine", "out");
mkdirSync(OUT, { recursive: true });

const PRINT_FLOOR_PT = 7;
const DIGITAL_FLOOR_PX = 22;

/** 7pt at this render's own dpi, in px — print floor is physical, not a fraction of canvas. */
function printFloorPx(widthPx: number, widthCm: number): number {
  const dpi = widthPx / (widthCm / 2.54);
  return (PRINT_FLOOR_PT / 72) * dpi;
}

// Canvas cm, for the print layouts only — needed to compute the physical type floor.
const PRINT_CM: Record<string, number> = {
  "DTP-1": 4,
  "DTP-2": 10,
  "DTP-3": 12,
  "DTP-4": 25,
};

interface Report {
  code: string;
  name: string;
  surface: string;
  canvas: string;
  capacity: number;
  capacityNote: string;
  auditFindings: AuditFinding[];
  qr: QrVerifyResult[];
  file: string;
}

async function renderOne(browser: import("playwright").Browser, spec: LayoutSpec): Promise<Report> {
  const html = await buildLayoutHtml(spec);
  const page = await browser.newPage({ viewport: { width: spec.widthPx, height: spec.heightPx } });
  await page.setContent(html, { waitUntil: "networkidle" });

  const floor = spec.surface === "print" ? printFloorPx(spec.widthPx, PRINT_CM[spec.code.split(" ")[0]] ?? 10) : DIGITAL_FLOOR_PX;
  const auditFindings = await runAudit(page, floor);

  const file = path.join(OUT, `${spec.code.replace(/[^\w-]+/g, "_")}.png`);
  const buffer = await page.screenshot({ path: file, type: "png" });

  let qrResults: QrVerifyResult[] = [];
  if (spec.qrPctV > 0) {
    const qrBox = await page.evaluate(() => {
      const el = document.querySelector('[data-audit="qr"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    if (qrBox && qrBox.width > 0) {
      qrResults = await verifyQr(buffer, qrBox);
    }
  }

  await page.close();

  return {
    code: spec.code,
    name: spec.name,
    surface: spec.surface,
    canvas: `${spec.widthPx}×${spec.heightPx}px`,
    capacity: spec.capacity,
    capacityNote: spec.capacityNote,
    auditFindings,
    qr: qrResults,
    file,
  };
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });

  const reports: Report[] = [];
  for (const spec of LAYOUTS) {
    reports.push(await renderOne(browser, spec));
  }
  for (const frame of DG4_FRAMES) {
    reports.push(await renderOne(browser, frame));
  }

  await browser.close();

  writeFileSync(path.join(OUT, "audit-report.json"), JSON.stringify(reports, null, 2));

  console.log("\n=== AUDIT REPORT ===\n");
  let totalFail = 0;
  for (const r of reports) {
    const fails = r.auditFindings.filter((f) => f.severity === "fail");
    totalFail += fails.length;
    const qrLine = r.qr.length
      ? r.qr.map((q) => `${q.scale}x:${q.decoded ? "OK" : "FAIL"}`).join(" ")
      : "n/a";
    console.log(`${fails.length === 0 ? "PASS" : "FAIL"}  ${r.code.padEnd(16)} ${r.canvas.padEnd(14)} cap=${String(r.capacity).padStart(3)}  qr[${qrLine}]`);
    for (const f of fails) console.log(`      - ${f.check}: ${f.detail}`);
  }
  console.log(`\n${reports.length} layouts rendered, ${totalFail} audit failures total.`);
  console.log(`Images + audit-report.json in ${OUT}`);

  if (totalFail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
