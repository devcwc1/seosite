import { NextResponse } from "next/server";

/**
 * RFC 7807 "Problem Details for HTTP APIs".
 *
 * Error responses are returned as `application/problem+json` with the standard
 * members (`type`, `title`, `status`, `detail`, `instance`) plus any extension
 * members. `type` defaults to "about:blank", which per the spec means the title
 * is simply the HTTP status phrase.
 */
export type ProblemOptions = {
  status: number;
  title: string;
  detail?: string;
  /** URI reference identifying the problem type. Defaults to "about:blank". */
  type?: string;
  /** URI reference for this specific occurrence (typically the request path). */
  instance?: string;
  /** Additional, problem-specific members merged into the body. */
  extensions?: Record<string, unknown>;
};

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

/** Build an `application/problem+json` response. */
export function problem({
  status,
  title,
  detail,
  type = "about:blank",
  instance,
  extensions,
}: ProblemOptions): NextResponse {
  const body: Record<string, unknown> = { type, title, status };
  if (detail !== undefined) body.detail = detail;
  if (instance !== undefined) body.instance = instance;
  if (extensions) Object.assign(body, extensions);

  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json; charset=utf-8" },
  });
}

/** Convenience: build a problem using the standard title for the status code. */
export function problemFor(
  status: number,
  detail?: string,
  extra?: Omit<ProblemOptions, "status" | "title">,
): NextResponse {
  return problem({
    status,
    title: STATUS_TITLES[status] ?? "Error",
    detail,
    ...extra,
  });
}
