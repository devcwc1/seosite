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
