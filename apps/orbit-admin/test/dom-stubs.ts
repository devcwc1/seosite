/**
 * Browser APIs jsdom does not implement, stubbed just enough for the
 * component suite.
 *
 * These are layout and media-query APIs. Stubbing them changes nothing about
 * the behaviour under test — the components use them to position and measure,
 * and assertions here are about roles, names and keyboard order, never about
 * pixels. Anything that genuinely depends on layout needs a real browser.
 */

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub;
}

// TypeScript narrows `window` to never inside an `in` guard on a declared
// global, so the check is done on the value instead.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

/**
 * Geometry. ProseMirror asks the document where things are on screen so it
 * can keep the caret in view; jsdom has no layout and returns nothing, and
 * the editor throws mid-transaction. Zero rectangles are the honest answer
 * from a document that was never laid out, and they satisfy the callers.
 */
const EMPTY_RECT: DOMRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
};

function emptyRectList(): DOMRectList {
  const list = [] as unknown as DOMRectList;
  Object.defineProperty(list, "item", { value: () => null });
  return list;
}

if (typeof Range.prototype.getClientRects !== "function") {
  Range.prototype.getClientRects = emptyRectList;
  Range.prototype.getBoundingClientRect = () => EMPTY_RECT;
}

if (typeof Element.prototype.getClientRects !== "function") {
  Element.prototype.getClientRects = emptyRectList;
}

/**
 * Hit testing. ProseMirror maps a mousedown's coordinates back to a document
 * position; jsdom has no such method, and the resulting TypeError escapes the
 * event handler as an unhandled rejection that can fail an unrelated test.
 *
 * Returning null is the correct answer for "no element at that point" in a
 * document with no layout — ProseMirror then falls back to its DOM-based
 * path, which is what actually resolves the click here.
 */
if (typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}
