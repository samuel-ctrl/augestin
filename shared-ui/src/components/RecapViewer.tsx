import { useMemo } from "react";

interface RecapViewerProps {
  content: any;
  title?: string;
}

// Supported Tiptap node types for recap content
const SUPPORTED_NODE_TYPES = new Set([
  "doc",
  "document",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "bold",
  "italic",
  "code",
  "codeBlock",
  "image",
  "link",
  "horizontalRule",
  "blockquote",
  "hardBreak",
]);

// Validate and filter Recap content to only include supported extensions
function validateRecapContent(node: any): any {
  if (!node) return null;

  // Filter unsupported node types
  if (node.type && !SUPPORTED_NODE_TYPES.has(node.type)) {
    return null;
  }

  // Recursively validate nested content
  if (node.content && Array.isArray(node.content)) {
    node.content = node.content
      .map((child: any) => validateRecapContent(child))
      .filter(Boolean);
  }

  // Validate marks (bold, italic, etc.)
  if (node.marks && Array.isArray(node.marks)) {
    node.marks = node.marks.filter((mark: any) =>
      SUPPORTED_NODE_TYPES.has(mark.type)
    );
  }

  return node;
}

// Convert Google Drive sharing links to direct viewable/embeddable URLs
function toDirectImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Google Drive file link: https://drive.google.com/file/d/FILE_ID/view...
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFileMatch) {
    return `https://drive.google.com/thumbnail?id=${driveFileMatch[1]}&sz=w1000`;
  }

  // Google Drive open link: https://drive.google.com/open?id=FILE_ID
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (driveOpenMatch) {
    return `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w1000`;
  }

  // Google Drive uc link: https://drive.google.com/uc?id=FILE_ID
  const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (driveUcMatch) {
    return `https://drive.google.com/thumbnail?id=${driveUcMatch[1]}&sz=w1000`;
  }

  return url;
}

// Check if a URL points to an image (by extension or known image host)
function isImageUrl(url: string): boolean {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
  if (imageExtensions.test(url)) return true;
  if (url.includes("drive.google.com/file/d/")) return true;
  if (url.includes("drive.google.com/thumbnail")) return true;
  return false;
}

export default function RecapViewer({ content, title }: RecapViewerProps) {
  const rendered = useMemo(() => {
    try {
      if (!content || !content.content) {
        return null;
      }

      // Validate and filter content
      const validatedContent = validateRecapContent(content);
      if (!validatedContent || !validatedContent.content) {
        return null;
      }

      const renderNodes = (nodes: any[]): React.ReactNode[] => {
        return nodes.map((node, idx) => {
          if (!node || !node.type) return null;

          const key = `${node.type}-${idx}`;

          switch (node.type) {
            case "doc":
            case "document":
              return renderNodes(node.content || []);

            case "paragraph":
              return (
                <p key={key} className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                  {renderInline(node.content || [])}
                </p>
              );

            case "heading": {
              const level = (node.attrs?.level || 1) as number;
              const headingClasses: Record<number, string> = {
                1: "text-2xl sm:text-3xl font-bold mb-4",
                2: "text-xl sm:text-2xl font-bold mb-3",
                3: "text-lg sm:text-xl font-bold mb-2",
              };
              const className = headingClasses[level] || "text-lg font-bold mb-2";

              const Tag = `h${level}` as keyof JSX.IntrinsicElements;
              return (
                <Tag key={key} className={className}>
                  {renderInline(node.content || [])}
                </Tag>
              );
            }

            case "bulletList":
              return (
                <ul key={key} className="list-disc list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-1">
                  {renderNodes(node.content || [])}
                </ul>
              );

            case "orderedList":
              return (
                <ol key={key} className="list-decimal list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-1">
                  {renderNodes(node.content || [])}
                </ol>
              );

            case "listItem":
              return (
                <li key={key}>
                  {renderInline(node.content || [])}
                </li>
              );

            case "codeBlock": {
              const language = node.attrs?.language || "plaintext";
              return (
                <pre key={key} className="bg-gray-900 text-gray-100 p-4 rounded-lg mb-4 overflow-x-auto">
                  <code className={`language-${language}`}>
                    {node.content?.[0]?.text || ""}
                  </code>
                </pre>
              );
            }

            case "image": {
              const src = toDirectImageUrl(node.attrs?.src);
              const alt = node.attrs?.alt || "Image";
              return src ? (
                <img
                  key={key}
                  src={src}
                  alt={alt}
                  className="max-w-full h-auto rounded-lg mb-4"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    // If direct URL fails, try the original
                    if (img.src !== node.attrs?.src) {
                      img.src = node.attrs?.src;
                    }
                  }}
                />
              ) : null;
            }

            case "horizontalRule":
              return <hr key={key} className="my-6 border-gray-300 dark:border-gray-600" />;

            case "blockquote":
              return (
                <blockquote key={key} className="border-l-4 border-primary-400 pl-4 py-1 mb-4 italic text-gray-600 dark:text-gray-400">
                  {renderInline(node.content || [])}
                </blockquote>
              );

            case "text":
              return <span key={key}>{node.text}</span>;

            default:
              return null;
          }
        });
      };

      const renderInline = (nodes: any[]): React.ReactNode[] => {
        return nodes.map((node, idx) => {
          if (!node || !node.type) return null;

          const key = `inline-${node.type}-${idx}`;

          if (node.type === "hardBreak") {
            return <br key={key} />;
          }

          const text = node.text || "";
          const isMarked = node.marks && node.marks.length > 0;

          let element: React.ReactNode = <span key={key}>{text}</span>;

          if (isMarked) {
            node.marks.forEach((mark: any) => {
              switch (mark.type) {
                case "bold":
                  element = <strong key={key}>{element}</strong>;
                  break;
                case "italic":
                  element = <em key={key}>{element}</em>;
                  break;
                case "code":
                  element = (
                    <code key={key} className="bg-gray-100 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded text-sm font-mono">
                      {element}
                    </code>
                  );
                  break;
                case "link": {
                  const href = mark.attrs?.href || "";
                  // If the link points to an image, render it as an inline image
                  if (isImageUrl(href)) {
                    element = (
                      <img
                        key={key}
                        src={toDirectImageUrl(href)}
                        alt={text || "Image"}
                        className="max-w-full h-auto rounded-lg my-2 inline-block"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src !== href) img.src = href;
                        }}
                      />
                    );
                  } else {
                    element = (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 underline hover:text-primary-700"
                      >
                        {element}
                      </a>
                    );
                  }
                  break;
                }
                default:
                  break;
              }
            });
          }

          return element;
        });
      };

      return renderNodes(validatedContent.content);
    } catch {
      return <p className="text-red-600">Failed to render recap content</p>;
    }
  }, [content]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
      {title && <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 dark:text-gray-50">{title}</h2>}
      <div className="prose prose-sm max-w-none">
        {rendered}
      </div>
    </div>
  );
}
