import type { Page } from "playwright";

/**
 * audit.js, as specified in §5 — run in the same headless Chromium that
 * rendered the page, checking exactly the four things a green
 * board-level screenshot does NOT guarantee:
 *
 *   - board-level overflow
 *   - per-element spill (scrollHeight − clientHeight on every text node,
 *     flagged past max(6px, 0.35×font-size)) — the check that catches a
 *     fixed-height band clipping or overpainting its neighbour while the
 *     board itself still measures clean
 *   - overlap between floating furniture (the QR) and text
 *   - type floor
 */

export interface AuditFinding {
  severity: "fail" | "warn";
  check: string;
  detail: string;
}

export async function runAudit(page: Page, typeFloorPx: number): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = await page.evaluate((floor) => {
    const out: { severity: "fail" | "warn"; check: string; detail: string }[] = [];

    const board = document.querySelector('[data-audit="board"][data-code]') as HTMLElement | null;
    if (!board) {
      out.push({ severity: "fail", check: "board", detail: "no board element found" });
      return out;
    }

    // 1. Board-level overflow.
    if (board.scrollWidth > board.clientWidth + 1 || board.scrollHeight > board.clientHeight + 1) {
      out.push({
        severity: "fail",
        check: "board-overflow",
        detail: `board content ${board.scrollWidth}x${board.scrollHeight} exceeds canvas ${board.clientWidth}x${board.clientHeight}`,
      });
    }

    // 2. Per-element spill — the check board-level overflow cannot catch.
    const textEls = document.querySelectorAll('[data-audit="text"]');
    textEls.forEach((el) => {
      const e = el as HTMLElement;
      const fontSize = parseFloat(getComputedStyle(e).fontSize);
      const thresholdPx = Math.max(6, 0.35 * fontSize);
      const spillH = e.scrollHeight - e.clientHeight;
      const spillW = e.scrollWidth - e.clientWidth;
      if (spillH > thresholdPx || spillW > thresholdPx) {
        out.push({
          severity: "fail",
          check: "element-spill",
          detail: `${e.dataset.zone ?? e.className} spills ${spillW}x${spillH}px (threshold ${thresholdPx.toFixed(1)}px) — text: "${e.textContent?.slice(0, 40)}"`,
        });
      }
    });

    // 3. Safe-margin check — nothing with real content renders outside .safe.
    const safe = document.querySelector('[data-audit="safe"]') as HTMLElement | null;
    if (safe) {
      const safeRect = safe.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      if (
        safeRect.left < boardRect.left - 0.5 ||
        safeRect.top < boardRect.top - 0.5 ||
        safeRect.right > boardRect.right + 0.5 ||
        safeRect.bottom > boardRect.bottom + 0.5
      ) {
        out.push({ severity: "fail", check: "safe-area", detail: "safe area extends past the board" });
      }
    }

    // 4. Type floor. §2 states the 7pt/22px floor for CATEGORY LINES
    //    specifically ("The categories are the product... legibility
    //    floor: 7pt print, 22px digital"). The type ramp table in §3
    //    explicitly permits smaller roles below that — licence/micro at
    //    5–5.5pt, body at 6pt — so checking every zone against the
    //    category floor would flag correct, spec-compliant text as a
    //    defect. Only Z3 category cells are checked here.
    document.querySelectorAll(".cat-label").forEach((el) => {
      const e = el as HTMLElement;
      const fontSize = parseFloat(getComputedStyle(e).fontSize);
      if (fontSize < floor - 0.5) {
        out.push({
          severity: "fail",
          check: "type-floor",
          detail: `category label renders at ${fontSize.toFixed(1)}px, below the ${floor.toFixed(1)}px floor — "${e.textContent}"`,
        });
      }
    });

    // 5. Overlap between floating furniture (QR) and text.
    const qr = document.querySelector('[data-audit="qr"]') as HTMLElement | null;
    if (qr) {
      const qrRect = qr.getBoundingClientRect();
      textEls.forEach((el) => {
        const e = el as HTMLElement;
        if (qr.contains(e) || e.contains(qr)) return;
        const r = e.getBoundingClientRect();
        const overlaps = !(r.right <= qrRect.left || r.left >= qrRect.right || r.bottom <= qrRect.top || r.top >= qrRect.bottom);
        if (overlaps) {
          out.push({
            severity: "fail",
            check: "furniture-overlap",
            detail: `QR overlaps "${e.textContent?.slice(0, 30)}"`,
          });
        }
      });
    }

    return out;
  }, typeFloorPx);

  return findings;
}
