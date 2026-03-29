import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import { LoadingSpinner } from "@shared";

// Debounce helper function
function useDebounce(callback: (...args: any[]) => void, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedCallback = useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

interface RecapEditorProps {
  bookId: string;
  onSave: (content: any) => Promise<void>;
  onTitleChange?: (title: string) => void;
  initialTitle?: string;
  initialContent?: any;
}

export default function RecapEditor({
  bookId,
  onSave,
  onTitleChange,
  initialTitle,
  initialContent,
}: RecapEditorProps) {
  const [title, setTitle] = useState(initialTitle || "Chapter Summary");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced save function
  const performSave = useCallback(async (editorInstance: any) => {
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

      // Save both content and title
      await onSave(content);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const debouncedSave = useDebounce(performSave, 2000);

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
        HTMLAttributes: {
          class: "text-primary-600 underline",
        },
      }),
      HorizontalRule,
      Blockquote,
    ],
    content: initialContent || "<p>Start typing your recap notes here...</p>",
    autofocus: "end",
    onUpdate: ({ editor: editorInstance }) => {
      // Debounced autosave: waits 2 seconds after last edit to save
      debouncedSave(editorInstance as any);
    },
  });

  const handleInsertImage = useCallback(() => {
    const url = prompt("Enter image URL (Google Drive, etc.):");
    // Only proceed if user entered a URL (not null from cancel, not empty string)
    if (url?.trim() && editor) {
      editor.chain().focus().setImage({ src: url.trim() }).run();
    }
  }, [editor]);

  const handleInsertLink = useCallback(() => {
    const url = prompt("Enter URL:");
    // Only proceed if user entered a URL (not null from cancel, not empty string)
    if (url?.trim() && editor) {
      editor.chain().focus().setLink({ href: url.trim() }).run();
    }
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
          onClick={handleInsertImage}
          className="px-3 py-1.5 rounded text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          🖼 Image
        </button>

        <button
          type="button"
          onClick={handleInsertLink}
          className="px-3 py-1.5 rounded text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          🔗 Link
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
        <span className="text-gray-400">Auto-saves 2 seconds after you stop editing</span>
      </div>
    </div>
  );
}
