import { useMemo } from "react";

interface RecapViewerProps {
  content: any;
  title?: string;
}

export default function RecapViewer({ content, title }: RecapViewerProps) {
  const rendered = useMemo(() => {
    try {
      if (!content || !content.content) {
        return null;
      }

      const renderNodes = (nodes: any[]): React.ReactNode[] => {
        return nodes.map((node, idx) => {
          if (!node || !node.type) return null;

          const key = `${node.type}-${idx}`;

          switch (node.type) {
            case "document":
              return renderNodes(node.content || []);

            case "paragraph":
              return (
                <p key={key} className="text-gray-700 mb-4 leading-relaxed">
                  {renderInline(node.content || [])}
                </p>
              );

            case "heading": {
              const level = node.attrs?.level || 1;
              const className = {
                1: "text-3xl font-bold mb-4",
                2: "text-2xl font-bold mb-3",
                3: "text-xl font-bold mb-2",
              }[level] || "text-lg font-bold mb-2";

              const Tag = `h${level}` as keyof JSX.IntrinsicElements;
              return (
                <Tag key={key} className={className}>
                  {renderInline(node.content || [])}
                </Tag>
              );
            }

            case "bulletList":
              return (
                <ul key={key} className="list-disc list-inside mb-4 text-gray-700 space-y-1">
                  {renderNodes(node.content || [])}
                </ul>
              );

            case "orderedList":
              return (
                <ol key={key} className="list-decimal list-inside mb-4 text-gray-700 space-y-1">
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
              const src = node.attrs?.src;
              const alt = node.attrs?.alt || "Image";
              return src ? (
                <img
                  key={key}
                  src={src}
                  alt={alt}
                  className="max-w-full h-auto rounded-lg mb-4"
                />
              ) : null;
            }

            case "horizontalRule":
              return <hr key={key} className="my-6 border-gray-300" />;

            case "blockquote":
              return (
                <blockquote key={key} className="border-l-4 border-primary-400 pl-4 py-1 mb-4 italic text-gray-600">
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
                    <code key={key} className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                      {element}
                    </code>
                  );
                  break;
                default:
                  break;
              }
            });
          }

          return element;
        });
      };

      return renderNodes(content.content);
    } catch (error) {
      console.error("Error rendering recap content:", error);
      return <p className="text-red-600">Failed to render recap content</p>;
    }
  }, [content]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="prose prose-sm max-w-none">
        {rendered}
      </div>
    </div>
  );
}
