import { cleanup, render, type RenderResult } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";
import "./dom-stubs";

// Each test gets a clean document; a leaked tree makes the next test's
// queries ambiguous in ways that look like flakiness.
afterEach(cleanup);

export function renderUI(ui: React.ReactElement): RenderResult {
  return render(ui);
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
