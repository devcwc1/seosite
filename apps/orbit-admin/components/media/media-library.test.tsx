// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/test/a11y";
import { renderUI, screen, userEvent, waitFor } from "@/test/render";
import type { MediaAssetDTO, MediaListDTO } from "@/lib/media/types";

import { MediaLibrary } from "./media-library";

/** Every call the component makes, in order, so filters can be asserted. */
let requests: string[] = [];
let response: MediaListDTO;

function asset(overrides: Partial<MediaAssetDTO> = {}): MediaAssetDTO {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    url: "/api/v1/media/file/11111111-1111-1111-1111-111111111111",
    thumbUrl:
      "/api/v1/media/file/11111111-1111-1111-1111-111111111111?variant=thumb",
    width: 800,
    height: 600,
    sizeBytes: 2048,
    mimeType: "image/webp",
    format: "webp",
    originalName: "kitten.webp",
    title: null,
    alt: null,
    createdAt: new Date("2026-01-01").toISOString(),
    usageCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  requests = [];
  response = { items: [], nextCursor: null, total: 0 };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return {
        ok: true,
        json: async () => response,
      } as Response;
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

/** The first render fires a debounced load; wait for it to settle. */
async function loaded() {
  await waitFor(() => expect(requests.length).toBeGreaterThan(0));
}

describe("an empty library", () => {
  it("offers upload rather than describing it", async () => {
    // AC3. A sentence pointing at a button elsewhere is not an offer.
    renderUI(<MediaLibrary canWrite canDelete={false} />);
    await loaded();

    expect(await screen.findByText("The library is empty.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload your first image/i }),
    ).toBeInTheDocument();
  });

  it("offers a viewer nothing to click, because they cannot upload", async () => {
    renderUI(<MediaLibrary canWrite={false} canDelete={false} />);
    await loaded();

    expect(await screen.findByText("The library is empty.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upload your first image/i }),
    ).toBeNull();
  });

  it("distinguishes an empty library from an empty search", async () => {
    // "Nothing here" and "nothing matches" call for different next steps.
    const user = userEvent.setup();
    renderUI(<MediaLibrary canWrite canDelete={false} />);
    await loaded();

    await user.type(screen.getByLabelText(/search media/i), "nothing");

    expect(
      await screen.findByText("No assets match these filters."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /clear filters/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upload your first image/i }),
    ).toBeNull();
  });

  it("passes axe", async () => {
    const { container } = renderUI(<MediaLibrary canWrite canDelete={false} />);
    await loaded();
    await screen.findByText("The library is empty.");

    await expectNoA11yViolations(container);
  });
});

describe("the usage filter", () => {
  it("asks the server for used assets only", async () => {
    const user = userEvent.setup();
    renderUI(<MediaLibrary canWrite canDelete={false} />);
    await loaded();

    await user.selectOptions(screen.getByLabelText(/filter by usage/i), "used");

    // The filter is applied server-side; filtering in the browser would only
    // ever filter the page already fetched.
    await waitFor(() =>
      expect(requests.some((url) => url.includes("usage=used"))).toBe(true),
    );
  });
});

describe("the grid", () => {
  beforeEach(() => {
    response = {
      items: [asset({ usageCount: 3, title: "Shared banner" })],
      nextCursor: null,
      total: 1,
    };
  });

  it("shows whether an asset is in use", async () => {
    renderUI(<MediaLibrary canWrite canDelete />);

    expect(await screen.findByText("In use")).toBeInTheDocument();
  });

  it("hides the delete control from a non-admin", async () => {
    // Courtesy, not the control — the route refuses it either way.
    renderUI(<MediaLibrary canWrite canDelete={false} />);
    await screen.findByText("Shared banner");

    expect(screen.queryByRole("button", { name: /^delete /i })).toBeNull();
  });

  it("will not let an admin delete an asset a product still uses", async () => {
    renderUI(<MediaLibrary canWrite canDelete />);
    await screen.findByText("Shared banner");

    expect(screen.getByRole("button", { name: /^delete /i })).toBeDisabled();
  });

  it("lets an admin delete an unused asset", async () => {
    response = { items: [asset({ usageCount: 0 })], nextCursor: null, total: 1 };
    renderUI(<MediaLibrary canWrite canDelete />);
    // Wait on the asset, not on "Unused" — that also matches the filter's
    // own <option>, which renders before any request is made.
    await screen.findByText("kitten.webp");

    expect(screen.getByRole("button", { name: /^delete /i })).toBeEnabled();
  });
});
