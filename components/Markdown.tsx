"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { highlight } from "../lib/highlight";
import { parseMarkdown, parseInline } from "../lib/markdown";
import type { Block, InlineNode } from "../lib/markdown";
import { copyText } from "../lib/utils";
import { CheckIcon, CopyIcon } from "./Icons";

function renderInlineNodes(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.value}</Fragment>;
      case "br":
        return <br key={index} />;
      case "code":
        return <code key={index}>{node.value}</code>;
      case "strong":
        return <strong key={index}>{renderInlineNodes(node.children)}</strong>;
      case "em":
        return <em key={index}>{renderInlineNodes(node.children)}</em>;
      case "del":
        return <del key={index}>{renderInlineNodes(node.children)}</del>;
      case "link":
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInlineNodes(node.children)}
          </a>
        );
    }
  });
}

function Inline({ text }: { text: string }) {
  const nodes = useMemo(() => parseInline(text), [text]);
  return <>{renderInlineNodes(nodes)}</>;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const tokens = useMemo(() => highlight(code, lang), [code, lang]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const onCopy = async () => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-line bg-codebg">
      <div className="flex items-center justify-between bg-elevated px-4 py-1.5 text-xs text-ink2">
        <span className="font-medium">{lang || "code"}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:text-ink"
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto p-4">
        <code className="md-code text-ink">
          {tokens.map((token, index) =>
            token.type ? (
              <span key={index} className={`tk-${token.type}`}>
                {token.value}
              </span>
            ) : (
              <Fragment key={index}>{token.value}</Fragment>
            )
          )}
        </code>
      </pre>
    </div>
  );
}

function renderBlocks(blocks: Block[], tight: boolean): ReactNode[] {
  return blocks.map((block, index) => {
    switch (block.type) {
      case "heading": {
        const children = <Inline text={block.text} />;
        if (block.level === 1) return <h1 key={index}>{children}</h1>;
        if (block.level === 2) return <h2 key={index}>{children}</h2>;
        if (block.level === 3) return <h3 key={index}>{children}</h3>;
        if (block.level === 4) return <h4 key={index}>{children}</h4>;
        if (block.level === 5) return <h5 key={index}>{children}</h5>;
        return <h6 key={index}>{children}</h6>;
      }
      case "paragraph":
        return tight ? (
          <Fragment key={index}>
            <Inline text={block.text} />
          </Fragment>
        ) : (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        );
      case "code":
        return <CodeBlock key={index} lang={block.lang} code={block.code} />;
      case "hr":
        return <hr key={index} />;
      case "quote":
        return <blockquote key={index}>{renderBlocks(block.blocks, false)}</blockquote>;
      case "list": {
        const items = block.items.map((item, itemIndex) => {
          const onlyInline = item.blocks.length > 0 && item.blocks[0].type === "paragraph";
          return (
            <li key={itemIndex}>
              {item.blocks.map((child, childIndex) =>
                child.type === "paragraph" && onlyInline && childIndex === 0 ? (
                  <Inline key={childIndex} text={child.text} />
                ) : (
                  <Fragment key={childIndex}>{renderBlocks([child], false)}</Fragment>
                )
              )}
            </li>
          );
        });
        return block.ordered ? (
          <ol key={index} start={block.start !== 1 ? block.start : undefined}>
            {items}
          </ol>
        ) : (
          <ul key={index}>{items}</ul>
        );
      }
      case "table":
        return (
          <div key={index} className="table-wrap scroll-thin">
            <table>
              <thead>
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th key={cellIndex} style={{ textAlign: block.align[cellIndex] ?? "left" }}>
                      <Inline text={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} style={{ textAlign: block.align[cellIndex] ?? "left" }}>
                        <Inline text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });
}

export default function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return <div className="md">{renderBlocks(blocks, false)}</div>;
}
