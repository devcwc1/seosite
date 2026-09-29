// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/test/a11y";
import { renderUI, screen } from "@/test/render";

import { SeoMetaFields, type SeoMetaValue } from "./seo-meta-fields";

function value(over: Partial<SeoMetaValue> = {}): SeoMetaValue {
  return {
    title: "",
    description: "",
    keywords: "",
    ogImageAssetId: "",
    ogImageUrl: "",
    noindex: false,
    canonicalUrl: "",
    ...over,
  };
}

function renderFields(over: {
  value?: SeoMetaValue;
  publishing?: boolean;
}) {
  return renderUI(
    <SeoMetaFields
      idPrefix="seo"
      value={over.value ?? value()}
      onChange={() => {}}
      errors={{}}
      path="/example"
      fallbackTitle="Fallback title"
      fallbackDescription="Fallback description"
      publishing={over.publishing ?? false}
    />,
  );
}

describe("SeoMetaFields counters (ORB-601)", () => {
  it("warns past the recommended length without a hard-cap error", () => {
    renderFields({ value: value({ title: "a".repeat(70) }) });

    const hint = screen.getByText(/70 of 60 recommended characters/);
    expect(hint).toHaveTextContent("search results will cut this short");
    expect(hint).not.toHaveTextContent("over the");
  });

  it("flags a title past the hard cap", () => {
    renderFields({ value: value({ title: "a".repeat(121) }) });

    expect(
      screen.getByText(/121 of 60 recommended characters/),
    ).toHaveTextContent("over the 120-character limit");
  });

  it("flags a description past the hard cap", () => {
    renderFields({ value: value({ description: "a".repeat(321) }) });

    expect(
      screen.getByText(/321 of 160 recommended characters/),
    ).toHaveTextContent("over the 320-character limit");
  });
});

describe("SeoMetaFields pre-publish summary (ORB-601)", () => {
  it("lists an empty meta description when publishing", () => {
    renderFields({ value: value({ title: "Set" }), publishing: true });

    expect(screen.getByText("Before you publish")).toBeInTheDocument();
    expect(screen.getByText(/Meta description is empty/)).toBeInTheDocument();
  });

  it("stays silent while drafting", () => {
    renderFields({ value: value(), publishing: false });

    expect(screen.queryByText("Before you publish")).not.toBeInTheDocument();
  });

  it("stays silent when the fields are filled at publish", () => {
    renderFields({
      value: value({ title: "A title", description: "A description" }),
      publishing: true,
    });

    expect(screen.queryByText("Before you publish")).not.toBeInTheDocument();
  });

  it("passes axe", async () => {
    const { container } = renderFields({
      value: value({ title: "Set" }),
      publishing: true,
    });

    await expectNoA11yViolations(container);
  });
});
