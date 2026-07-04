import { Input } from "@mantine/core";
import { RichTextEditor } from "@mantine/tiptap";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import { useEffect } from "react";
import "./rich-text.css";

const ALLOWED_TAGS = ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li"];

/** Small WYSIWYG editor: bold / italic / underline / bullet + ordered lists.
 *  Emits sanitised HTML (empty content emits ""). */
export function RichTextField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  // Keep the editor in sync when the external value changes (e.g. modal reopens).
  useEffect(() => {
    if (!editor) return;
    if ((value || "") !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    const box = <div style={{ minHeight: 60 }} />;
    return label ? <Input.Wrapper label={label}>{box}</Input.Wrapper> : box;
  }

  const control = (
    <RichTextEditor editor={editor} aria-label={placeholder}>
      {!disabled && (
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
      )}
      <RichTextEditor.Content />
    </RichTextEditor>
  );

  return label ? <Input.Wrapper label={label}>{control}</Input.Wrapper> : control;
}

/** Render stored rich text safely (defence-in-depth; the API also sanitises). */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
  return (
    <div className={`tkc-rte-view ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}

/** Flatten rich text to plain text for very compact previews. */
export function htmlToText(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}
