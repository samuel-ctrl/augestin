import { useState, useCallback, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import { LoadingSpinner, Button } from "@shared";

interface RecapEditorProps {
  bookId: string;
  onSave: (content: any) => Promise<void>;
  onTitleChange?: (title: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  initialTitle?: string;
  initialContent?: any;
}

function InsertModal({
  type,
  onSubmit,
  onClose,
}: {
  type: "image" | "link";
  onSubmit: (url: string, text?: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim(), text.trim() || undefined);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Allow paste to work naturally - the value will update via onChange
    const pasted = e.clipboardData.getData("text");
    if (pasted && !url) {
      // Auto-fill if pasting into empty field
      setTimeout(() => setUrl(pasted.trim()), 0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {type === "image" ? "Insert Image" : "Insert Link"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === "image" ? "Image URL" : "URL"}
            </label>
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={handlePaste}
              placeholder={
                type === "image"
                  ? "https://drive.google.com/file/d/... or image URL"
                  : "https://example.com"
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
            {type === "image" && (
              <p className="text-xs text-gray-400 mt-1">
                Supports Google Drive links, direct image URLs
              </p>
            )}
          </div>
          {type === "link" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Text (optional)
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Link text (uses URL if empty)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" color="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" color="primary" disabled={!url.trim()}>
              Insert
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RecapEditor({
  bookId,
  onSave,
  onTitleChange,
  onDirtyChange,
  initialTitle,
  initialContent,
}: RecapEditorProps) {
  const [title, setTitle] = useState(initialTitle || "Chapter Summary");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insertModal, setInsertModal] = useState<"image" | "link" | null>(null);

  const handleSave = useCallback(async (editorInstance: any) => {
    if (!editorInstance || editorInstance.getHTML().trim() === "<p></p>") {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const content = editorInstance.getJSON();

      // Check content size (5MB limit)
      const contentJson = JSON.stringify(content);
      const sizeMB = new Blob([contentJson]).size / (1024 * 1024);
      if (sizeMB > 5) {
        setError("Content exceeds 5MB limit");
        setSaving(false);
        return;
      }

      await onSave(content);
      setLastSaved(new Date().toLocaleTimeString());
      onDirtyChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [onSave, onDirtyChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlock,
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "max-w-full h-auto rounded",
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary-600 underline",
        },
      }),
      HorizontalRule,
      Blockquote,
    ],
    content: initialContent || "<p>Start typing your recap notes here...</p>",
    autofocus: "end",
    onUpdate: () => {
      onDirtyChange?.(true);
    },
    editorProps: {
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (text && /^https?:\/\//i.test(text.trim())) {
          // If pasting a URL, auto-detect if it's an image URL
          const url = text.trim();
          const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url) ||
            url.includes("drive.google.com/file/d/");

          if (isImage) {
            // Insert as image
            view.dispatch(view.state.tr);
            editor?.chain().focus().setImage({ src: url }).run();
            return true;
          }

          // Insert as clickable link
          const { from, to } = view.state.selection;
          const hasSelection = from !== to;
          if (!hasSelection) {
            // No text selected - insert URL as link text
            editor?.chain().focus()
              .insertContent(`<a href="${url}">${url}</a>`)
              .run();
            return true;
          }
        }
        return false;
      },
    },
  });

  const handleInsertImage = useCallback((url: string) => {
    if (editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    setInsertModal(null);
  }, [editor]);

  const handleInsertLink = useCallback((url: string, text?: string) => {
    if (editor) {
      if (text) {
        editor.chain().focus()
          .insertContent(`<a href="${url}">${text}</a>`)
          .run();
      } else {
        const { from, to } = editor.state.selection;
        if (from === to) {
          // No selection - insert URL as both text and link
          editor.chain().focus()
            .insertContent(`<a href="${url}">${url}</a>`)
            .run();
        } else {
          // Wrap selection with link
          editor.chain().focus().setLink({ href: url }).run();
        }
      }
    }
    setInsertModal(null);
  }, [editor]);

  if (!editor) {
    return <LoadingSpinner />;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Title input */}
      <div className="border-b border-gray-200 p-4">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            onTitleChange?.(e.target.value);
          }}
          className="w-full text-2xl font-bold border-0 outline-none"
          placeholder="Chapter Summary"
        />
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 p-3 bg-gray-50 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("bold")
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("italic")
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          <em>I</em>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("code")
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          Code
        </button>

        <div className="w-px bg-gray-300"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("heading", { level: 1 })
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("heading", { level: 2 })
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("heading", { level: 3 })
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          H3
        </button>

        <div className="w-px bg-gray-300"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("bulletList")
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("orderedList")
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          1. List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("codeBlock")
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          Code Block
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive("blockquote")
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          Quote
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-3 py-1.5 rounded text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          —
        </button>

        <div className="w-px bg-gray-300"></div>

        <button
          type="button"
          onClick={() => setInsertModal("image")}
          className="px-3 py-1.5 rounded text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Insert Image
        </button>

        <button
          type="button"
          onClick={() => setInsertModal("link")}
          className="px-3 py-1.5 rounded text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Insert Link
        </button>
      </div>

      {/* Editor */}
      <div className="p-4 min-h-96">
        <EditorContent editor={editor} className="prose prose-sm max-w-none" />
      </div>

      {/* Status bar */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {saving && (
            <>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-gray-600">Saving...</span>
            </>
          )}
          {lastSaved && !saving && (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-gray-600">Saved at {lastSaved}</span>
            </>
          )}
          {error && (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-600">{error}</span>
            </>
          )}
        </div>
        <Button
          color="primary"
          onClick={() => handleSave(editor)}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Insert Modal */}
      {insertModal && (
        <InsertModal
          type={insertModal}
          onSubmit={insertModal === "image" ? handleInsertImage : handleInsertLink}
          onClose={() => setInsertModal(null)}
        />
      )}
    </div>
  );
}
