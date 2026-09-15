import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { STATUS_REGISTRY, type StatusTone } from "./registry";

/**
 * Contrast for the status tones, checked arithmetically.
 *
 * axe cannot do this for us: its colour-contrast rule needs a canvas to
 * sample rendered pixels, and jsdom has none — the component suite prints
 * "Not implemented: HTMLCanvasElement's getContext()" and quietly skips the
 * rule. So the one WCAG criterion most likely to be broken by a designer's
 * token tweak is exactly the one the automated suite would miss.
 *
 * Chips are small text, so the bar is AA 4.5:1 (WCAG 1.4.3).
 */
const AA_NORMAL_TEXT = 4.5;

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

/** oklch(L C H) as authored in globals.css. */
function parseOklch(value: string): [number, number, number] {
  const match = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/,
  );
  if (!match) throw new Error(`not an oklch colour: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** OKLCh -> OKLab -> LMS -> linear sRGB. */
function oklchToLinearRgb([L, C, H]: [number, number, number]) {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function relativeLuminance(value: string): number {
  const { r, g, b } = oklchToLinearRgb(parseOklch(value));
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Read one custom property out of a given block of globals.css. */
function token(block: ":root" | ".dark", name: string): string {
  // Take the first block with this selector, up to its closing brace.
  const start = CSS.indexOf(`${block} {`);
  if (start === -1) throw new Error(`no ${block} block`);
  const body = CSS.slice(start, CSS.indexOf("\n}", start));
  const match = body.match(new RegExp(`--${name}:\s*([^;]+);`));
  if (!match) throw new Error(`no --${name} in ${block}`);
  return match[1]!.trim();
}

const TONES: StatusTone[] = ["neutral", "success", "warning", "danger", "info"];

describe("status tone contrast (WCAG 1.4.3 AA)", () => {
  for (const block of [":root", ".dark"] as const) {
    describe(block === ":root" ? "light theme" : "dark theme", () => {
      for (const tone of TONES) {
        it(`${tone} text on its own surface clears ${AA_NORMAL_TEXT}:1`, () => {
          const surface = token(block, `status-${tone}`);
          const text = token(block, `status-${tone}-foreground`);
          const ratio = contrastRatio(surface, text);

          expect(
            ratio,
            `${tone} in ${block} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        });
      }
    });
  }

  it("defines a token pair for every tone the registry can produce", () => {
    const used = new Set(
      Object.values(STATUS_REGISTRY).flatMap((domain) =>
        Object.values(domain).map((entry) => entry.tone),
      ),
    );
    for (const tone of used) {
      expect(() => token(":root", `status-${tone}`)).not.toThrow();
      expect(() => token(".dark", `status-${tone}`)).not.toThrow();
    }
  });
});
