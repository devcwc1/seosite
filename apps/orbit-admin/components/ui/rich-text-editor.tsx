"use client";

import { useEffect, useId, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Rich text for product copy.
 *
 * Two views over one value: a visual editor, and the HTML behind it. Neither
 * is a security boundary — whatever either produces is sanitised again on the
 * server, and lib/content/sanitize.ts is the authority on what may be stored.
 * That is what makes it safe to let an editor paste arbitrary markup into the
 * source view: the worst case is that their markup is stripped on save, not
 * that it reaches a reader.
 */

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
type HeadingLevel = (typeof HEADING_LEVELS)[number];

const EMPTY_DOC = "<p></p>";

/** Block tags, for the one-block-per-line formatting in the source view. */
const BLOCK_TAGS = "p|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote";

/**
 * Break the markup onto one block per line so it can be read and edited.
 *
 * Whitespace only, and deliberately so: it never reorders, drops or rewrites
 * anything. Anything cleverer would be a second parser to keep in step with
 * the sanitiser, and two parsers that disagree is how markup gets mangled.
 */
export function formatHtml(html: string): string {
  if (!html) return "";

  const lines = html
    .replace(new RegExp(`<(${BLOCK_TAGS})(\\s[^>]*)?>`, "gi"), "\n<$1$2>")
    .replace(new RegExp(`</(${BLOCK_TAGS})>`, "gi"), "</$1>\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Indent list contents one step. Nothing else nests in the allowed set.
  let depth = 0;
  return lines
    .map((line) => {
      if (/^<\/(ul|ol)>/i.test(line)) depth = Math.max(0, depth - 1);
      const indented = "  ".repeat(depth) + line;
      if (/^<(ul|ol)(\s|>)/i.test(line) && !/<\/(ul|ol)>/i.test(line)) {
        depth += 1;
      }
      return indented;
    })
    .join("\n");
}

function HeadingSelect({
  editor,
  disabled,
  fieldId,
}: {
  editor: Editor;
  disabled: boolean;
  fieldId: string;
}) {
  const active = HEADING_LEVELS.find((level) =>
    editor.isActive("heading", { level }),
  );

  return (
    <>
      <label htmlFor={`${fieldId}-block`} className="sr-only">
        Text style
      </label>
      {/*
        A native select rather than a styled listbox: seven options is past
        the point where a row of buttons stays scannable, and the native
        control already answers arrow keys, type-ahead and screen readers
        correctly without any of it being reimplemented here.
      */}
      <select
        id={`${fieldId}-block`}
        disabled={disabled}
        value={active ? `h${active}` : "p"}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "p") {
            editor.chain().focus().setParagraph().run();
            return;
          }
          const level = Number(next.slice(1)) as HeadingLevel;
          editor.chain().focus().setHeading({ level }).run();
        }}
        className="focus-visible:ring-ring/50 h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
      >
        <option value="p">Paragraph</option>
        {HEADING_LEVELS.map((level) => (
          <option key={level} value={`h${level}`}>
            Heading {level}
          </option>
        ))}
      </select>
    </>
  );
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel = "Description",
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
}) {
  // Unique per instance, so two editors on one form do not share element ids.
  const fieldId = useId();
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState("");

  const editor = useEditor({
    // Rendered on the client only; Next would otherwise warn about the
    // mismatch between server HTML and the editor's own DOM.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [...HEADING_LEVELS] },
        // Images belong to the gallery, which is hardened; inline ones would
        // be an unchecked way to put remote URLs on the page.
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto", "tel"],
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class:
          "min-h-48 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      // Tiptap spells "empty" as <p></p>; the form should see an empty string.
      onChange(html === EMPTY_DOC ? "" : html);
    },
  });

  // Keep the editor in step when the form resets or loads a different product.
  // Skipped while the source view is open: markup being typed there is
  // half-finished by definition, and feeding every keystroke through the
  // parser would rewrite it under the cursor.
  useEffect(() => {
    if (!editor || showSource) return;
    const current = editor.getHTML();
    const next = value === "" ? EMPTY_DOC : value;
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value, showSource]);

  if (!editor) {
    return (
      <div className="text-muted-foreground min-h-48 w-full rounded-md border bg-transparent px-3 py-2 text-sm">
        Loading editor…
      </div>
    );
  }

  function toggleSource() {
    if (!editor) return;

    if (showSource) {
      // Back to visual: hand the markup to the editor and let it normalise.
      // Tiptap keeps only what its own schema knows, so this is also where a
      // paste of unsupported markup visibly loses the parts that would have
      // been stripped on save anyway — better seen now than discovered later.
      editor.commands.setContent(source, { emitUpdate: false });
      const html = editor.getHTML();
      onChange(html === EMPTY_DOC ? "" : html);
      setShowSource(false);
      return;
    }

    const html = editor.getHTML();
    setSource(formatHtml(html === EMPTY_DOC ? "" : html));
    setShowSource(true);
  }

  function setLink() {
    if (!editor) return;

    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const marks = [
    {
      label: "Bold",
      isActive: editor.isActive("bold"),
      onClick: () => editor.chain().focus().toggleBold().run(),
      content: <Bold className="size-4" aria-hidden />,
    },
    {
      label: "Italic",
      isActive: editor.isActive("italic"),
      onClick: () => editor.chain().focus().toggleItalic().run(),
      content: <Italic className="size-4" aria-hidden />,
    },
    {
      label: "Strikethrough",
      isActive: editor.isActive("strike"),
      onClick: () => editor.chain().focus().toggleStrike().run(),
      content: <Strikethrough className="size-4" aria-hidden />,
    },
    {
      label: "Bullet list",
      isActive: editor.isActive("bulletList"),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      content: <List className="size-4" aria-hidden />,
    },
    {
      label: "Numbered list",
      isActive: editor.isActive("orderedList"),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      content: <ListOrdered className="size-4" aria-hidden />,
    },
    {
      label: "Quote",
      isActive: editor.isActive("blockquote"),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
      content: <Quote className="size-4" aria-hidden />,
    },
    {
      label: "Link",
      isActive: editor.isActive("link"),
      onClick: setLink,
      content: <LinkIcon className="size-4" aria-hidden />,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted/40 flex flex-wrap items-center gap-1 rounded-md border p-1">
        <HeadingSelect editor={editor} disabled={showSource} fieldId={fieldId} />

        <span className="bg-border mx-1 h-5 w-px" aria-hidden />

        {/* The formatting controls act on the visual document, so they are
            disabled rather than misleading while the source view is open. */}
        {marks.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={item.label}
            aria-pressed={item.isActive}
            title={item.label}
            disabled={showSource}
            className={cn(item.isActive && "bg-background shadow-sm")}
            onClick={item.onClick}
          >
            {item.content}
          </Button>
        ))}

        <span className="bg-border mx-1 h-5 w-px" aria-hidden />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          title="Undo"
          disabled={showSource || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          title="Redo"
          disabled={showSource || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" aria-hidden />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          // aria-pressed rather than two buttons: it is one control with two
          // states, and a screen reader should hear which state it is in.
          aria-pressed={showSource}
          aria-label="Edit HTML source"
          title="Edit HTML source"
          className={cn("ml-auto", showSource && "bg-background shadow-sm")}
          onClick={toggleSource}
        >
          <Code2 className="size-4" aria-hidden />
          HTML
        </Button>
      </div>

      {showSource ? (
        <>
          <label htmlFor={`${fieldId}-source`} className="sr-only">
            {ariaLabel} HTML source
          </label>
          <textarea
            id={`${fieldId}-source`}
            value={source}
            spellCheck={false}
            onChange={(event) => {
              setSource(event.target.value);
              // The form tracks the raw markup as it is typed, so saving
              // straight from this view works without switching back.
              onChange(event.target.value);
            }}
            className="focus-visible:ring-ring/50 min-h-48 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-[3px]"
          />
          <p className="text-muted-foreground text-xs">
            Paste or edit HTML here. Headings, paragraphs, lists, quotes and
            links are kept; anything else is removed when the product is saved.
          </p>
        </>
      ) : (
        /* `rich-text` styles the headings and lists inside the editor so what
           an editor sees here matches what the storefront renders. */
        <EditorContent editor={editor} className="rich-text" />
      )}
    </div>
  );
}
