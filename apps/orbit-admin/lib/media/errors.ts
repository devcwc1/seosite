export type UploadErrorCode =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "svg_rejected"
  | "type_mismatch"
  | "not_an_image"
  | "dimensions_out_of_bounds";

/** A rejected upload. `status` maps directly to the problem+json HTTP status. */
export class UploadError extends Error {
  constructor(
    readonly code: UploadErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}
