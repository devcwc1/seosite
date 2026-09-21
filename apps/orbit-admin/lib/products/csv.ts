/**
 * A tolerant delimited-text parser for product imports.
 *
 * Exports (WooCommerce, Shopify, a spreadsheet's "Save as CSV") disagree on
 * almost everything: comma vs tab, whether fields are quoted, whether a
 * description spanning several lines is one field or several rows. This parses
 * all of them the same way, and — importantly — returns columns by position
 * as well as by header, because a header row cannot always be trusted to line
 * up with the data beneath it.
 */

export type ParsedCsv = {
  /** "," or "\t", detected from the header row. */
  delimiter: string;
  /** The header row, verbatim. Duplicates and blanks are kept as-is. */
  headers: string[];
  /**
   * Data rows as arrays, each padded or trimmed to the header's width so a
   * ragged row cannot shift every column after it.
   */
  rows: string[][];
};

/** Strip a UTF-8 BOM; Excel writes one and it corrupts the first header. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Guess the delimiter from the first line. Tab wins when it appears at all —
 * a tab in a genuinely comma-separated file is vanishingly rare, while a
 * tab-separated export is full of commas inside prose.
 */
function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > 0 && tabs >= commas ? "\t" : ",";
}

/**
 * Parse one delimited document. RFC 4180 rules for quoting: a field may be
 * wrapped in double quotes, a quote inside such a field is written doubled,
 * and a quoted field may contain the delimiter and newlines.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = stripBom(input);
  const newline = text.indexOf("\n");
  const firstLine = newline === -1 ? text : text.slice(0, newline);
  const delimiter = detectDelimiter(firstLine);

  const table: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let started = false; // whether the current field opened with a quote

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "" && !started) {
      inQuotes = true;
      started = true;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      started = false;
      continue;
    }
    if (char === "\r") continue;
    if (char === "\n") {
      row.push(field);
      table.push(row);
      row = [];
      field = "";
      started = false;
      continue;
    }
    field += char;
  }
  // Flush a trailing field/row that had no final newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    table.push(row);
  }

  const headers = table[0] ?? [];
  const width = headers.length;
  const rows = table
    .slice(1)
    // Drop entirely blank lines (a single empty field), which trailing
    // newlines and spreadsheet quirks leave behind.
    .filter((r) => !(r.length === 1 && (r[0] ?? "").trim() === ""))
    .map((r) => {
      const padded = r.slice(0, width);
      while (padded.length < width) padded.push("");
      return padded;
    });

  return { delimiter, headers, rows };
}
