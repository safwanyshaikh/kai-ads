/**
 * DTP BOOKING SELECTION — which purchased height the content needs.
 *
 * A classified is sold by the square centimetre, so the height is a
 * commercial decision the tenant is shown before they commit. This
 * picks the SMALLEST bookable height that carries every verified fact,
 * which is the cheapest honest answer: the agency is never quietly
 * upsold to a taller booking, and never sold one too small for its own
 * copy.
 *
 * It works by asking the compositor, not by estimating. The compositor
 * already refuses — with LayoutCapacityError — to place content it
 * cannot fit at the legibility floor, so trying 6x5 upward and taking
 * the first that renders is both the simplest implementation and the
 * only one guaranteed to agree with what is actually printed. An
 * estimator would be a second opinion about capacity, and the two would
 * eventually disagree.
 */
import { LayoutCapacityError } from "../pipeline/fact-layer";
import {
  DTP_AD_HEIGHTS_CM,
  DTP_CLASSIFIED_WIDTH_CM,
  renderDtpClassifiedSvg,
  type DtpAdHeightCm,
  type DtpClassifiedInput,
  type DtpClassifiedResult,
} from "./dtp-classified";

export interface DtpBookingSelection {
  /** The height the content needs, from the approved family. */
  heightCm: DtpAdHeightCm;
  widthCm: number;
  /** Rendered at the selected height — no second render needed. */
  render: DtpClassifiedResult;
  /**
   * Heights tried and refused, with the facts each could not place.
   *
   * Kept so the tenant can be told WHY a booking is the size it is
   * ("6x5 and 6x6 could not carry the interview venue") rather than
   * being handed a number to accept on trust.
   */
  rejected: { heightCm: DtpAdHeightCm; unplaced: string[] }[];
  /**
   * True when even the chosen height only fitted by compressing.
   *
   * Means no approved booking carries this content at comfortable
   * reading sizes — legible, but tight. A commercial signal for the
   * tenant, not an error.
   */
  compressed: boolean;
}

/**
 * Raised when no bookable height carries the content.
 *
 * Distinct from LayoutCapacityError for one height: this says the whole
 * approved family is too small, which is a content decision for the
 * tenant (advertise fewer trades, shorten the address) rather than
 * something the compositor may resolve by dropping facts.
 */
export class DtpBookingTooSmallError extends Error {
  readonly code = "DTP_BOOKING_TOO_SMALL";
  constructor(readonly unplaced: string[]) {
    super(
      "No approved classified height can carry this content without omitting " +
        `verified information. Unplaced at the largest booking: ${unplaced.join("; ")}`,
    );
    this.name = "DtpBookingTooSmallError";
  }
}

/**
 * Chooses the booking, smallest first.
 *
 * `input` carries everything except the height — the caller supplies
 * approved content and identity, and this decides the one dimension the
 * content itself determines.
 */
export function selectDtpBooking(
  input: Omit<DtpClassifiedInput, "heightCm">,
): DtpBookingSelection {
  const rejected: DtpBookingSelection["rejected"] = [];
  let lastUnplaced: string[] = [];
  /** The smallest height that rendered at all, however tightly. */
  let tightest: DtpBookingSelection | null = null;

  for (const heightCm of DTP_AD_HEIGHTS_CM) {
    let render: DtpClassifiedResult;
    try {
      render = renderDtpClassifiedSvg({ ...input, heightCm });
    } catch (error) {
      if (!(error instanceof LayoutCapacityError)) throw error;
      lastUnplaced = error.unplaced;
      rejected.push({ heightCm, unplaced: error.unplaced });
      continue;
    }

    const selection: DtpBookingSelection = {
      heightCm,
      widthCm: DTP_CLASSIFIED_WIDTH_CM,
      render,
      rejected: [...rejected],
      compressed: render.compressed,
    };

    // "Smallest that fits at all" is the wrong answer on its own: eight
    // trades with benefits technically fit a 6x6 by shrinking every
    // trade name to the legibility floor, which is overcrowding sold as
    // efficiency. Keep looking for a height that carries the content at
    // comfortable sizes, and fall back to the tight one only if no
    // approved height does.
    if (!render.compressed) return selection;
    tightest ??= selection;
  }

  if (tightest) return tightest;
  throw new DtpBookingTooSmallError(lastUnplaced);
}
