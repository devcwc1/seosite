"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
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
 * The toolbar is deliberately short: headings, emphasis, lists, quotes and
 * links are what a product description needs, and every extra control is
 * another shape the storefront has to render well. Whatever this produces is
 * sanitised again on the server — the allowlist there is the authority, not
 * this configuration.
 *
 * Heading levels start at 2: the storefront gives the product title the only
 * h1 on the page.
 */
export function RichTextEditor({
  value,
  onChange,
  ariaLabel = "Description",
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
}) {
  const editor = useEditor({
    // Rendered on the client only; Next would otherwise warn about the
    // mismatch between server HTML and the editor's own DOM.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
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
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Keep the editor in step when the form resets or loads a different product.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value === "" ? "<p></p>" : value;
    if (current !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-48 w-full rounded-md border bg-transparent px-3 py-2 text-sm text-muted-foreground">
        Loading editor…
      </div>
    );
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

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }

  const toolbar = [
    {
      label: "Heading 2",
      isActive: editor.isActive("heading", { level: 2 }),
      onClick: () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
      content: <span className="text-xs font-bold">H2</span>,
    },
    {
      label: "Heading 3",
      isActive: editor.isActive("heading", { level: 3 }),
      onClick: () =>
        editor.chain().focus().toggleHeading({ level: 3 }).run(),
      content: <span className="text-xs font-bold">H3</span>,
    },
    {
      label: "Paragraph",
      isActive: editor.isActive("paragraph"),
      onClick: () => editor.chain().focus().setParagraph().run(),
      content: <span className="text-xs font-bold">P</span>,
    },
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
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
        {toolbar.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={item.label}
            aria-pressed={item.isActive}
            title={item.label}
            className={cn(item.isActive && "bg-background shadow-sm")}
            onClick={item.onClick}
          >
            {item.content}
          </Button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          title="Undo"
          disabled={!editor.can().undo()}
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
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" aria-hidden />
        </Button>
      </div>

      {/* `rich-text` styles the headings and lists inside the editor so what an
          editor sees here matches what the storefront renders. */}
      <EditorContent editor={editor} className="rich-text" />
    </div>
  );
}
