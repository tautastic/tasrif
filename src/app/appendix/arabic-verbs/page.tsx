import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  type ArabicRefData,
  arabicVerbs,
  type BlockNode,
  type InlineNode,
  type MeaningItemData,
  type TableHeaderCell,
  type TableRow,
} from "~/content/appendix/arabic-verbs";

export const metadata: Metadata = {
  title: "Appendix:Arabic verbs — Tasrif",
  description: "The derived stems of Arabic verbs, illustrated with examples.",
};

const stripDiacritics = (text: string): string => text.replace(/[\u064B-\u065F\u0670\u0610-\u061A]/g, "");

const ArabicRef = ({ arabic, href, transliteration, gloss, literal, cf }: ArabicRefData) => {
  const parts: string[] = [];
  if (transliteration) {
    parts.push(transliteration);
  }
  if (gloss) {
    parts.push(`“${gloss}”`);
  }
  if (literal) {
    parts.push(`literally “${literal}”`);
  }

  const arabicSpan = <span lang="ar">{arabic}</span>;
  const target = href === undefined ? `/entry/${stripDiacritics(arabic)}#${arabic}` : href;

  return (
    <span className="leading-9">
      {target ? (
        <Link href={target} className="text-blue-600 hover:underline">
          {arabicSpan}
        </Link>
      ) : (
        arabicSpan
      )}
      {parts.length > 0 && <> ({parts.join(", ")})</>}
      {cf && (
        <>
          {" "}
          (cf. <ArabicRef {...cf} />)
        </>
      )}
    </span>
  );
};

const Inline = ({ nodes }: { nodes: InlineNode[] }) => (
  <>
    {nodes.map((node, index) => {
      switch (node.type) {
        case "text":
          return <Fragment key={index}>{node.value}</Fragment>;
        case "italic":
          return <i key={index}>{node.value}</i>;
        case "ref":
          return <ArabicRef key={index} {...node} />;
        default:
          return null;
      }
    })}
  </>
);

const SectionHeading = ({ title }: { title: string }) => (
  <h2 id={title.replaceAll(" ", "_")} className="text-2xl border-b border-[#a2a9b1] pb-1 mt-10 mb-3">
    {title}
  </h2>
);

const MainCategory = ({ href, children }: { href: string; children: ReactNode }) => (
  <p className="text-sm text-gray-600 my-2">
    Main category:{" "}
    <Link href={href} className="text-blue-600 hover:underline">
      {children}
    </Link>
  </p>
);

const MeaningItem = ({ item }: { item: MeaningItemData }) => (
  <li>
    <span className="font-semibold">{item.label}</span>
    {item.arabic && (
      <>
        {" ("}
        <ArabicRef arabic={item.arabic} href={null} transliteration={item.transliteration} />
        {")"}
      </>
    )}{" "}
    — {item.description}
    <ul className="list-disc ml-6 mt-2 space-y-1">
      {item.items.map((nodes, index) => (
        <li key={index}>
          <Inline nodes={nodes} />
        </li>
      ))}
    </ul>
  </li>
);

const cellClass = "border border-[#b4b4b4] px-3 py-1";
const headerCellClass = `${cellClass} bg-[#eaecf0] text-center font-semibold`;

const Table = ({ headers, rows }: { headers: TableHeaderCell[]; rows: TableRow[] }) => (
  <div className="overflow-x-auto mt-4">
    <table className="border-collapse border border-[#b4b4b4]">
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index} colSpan={header.colSpan} className={headerCellClass}>
              {header.content}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.cells.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                rowSpan={cell.rowSpan}
                className={cell.align === "center" ? `${cellClass} text-center` : cellClass}
              >
                <Inline nodes={cell.content} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Block = ({ node }: { node: BlockNode }) => {
  switch (node.type) {
    case "heading":
      return <SectionHeading title={node.title} />;
    case "mainCategory":
      return <MainCategory href={node.href}>{node.label}</MainCategory>;
    case "paragraph":
      return (
        <p>
          <Inline nodes={node.content} />
        </p>
      );
    case "examples":
      return (
        <ul className="list-disc ml-6 mt-2 space-y-1">
          {node.items.map((nodes, index) => (
            <li key={index}>
              <Inline nodes={nodes} />
            </li>
          ))}
        </ul>
      );
    case "table":
      return <Table headers={node.headers} rows={node.rows} />;
    case "meaningList":
      return (
        <ul className="list-disc ml-6 mt-4 space-y-4">
          {node.items.map((item, index) => (
            <MeaningItem key={index} item={item} />
          ))}
        </ul>
      );
  }
};

export default function ArabicVerbsAppendixPage() {
  return (
    <article className="mx-auto py-6 prose text-black">
      <h1 className="text-3xl border-b border-[#a2a9b1] pb-2 mb-6">Appendix:Arabic verbs</h1>
      <div className="space-y-4 text-base leading-6.5 font-sans">
        {arabicVerbs.map((node, index) => (
          <Block key={index} node={node} />
        ))}
      </div>
    </article>
  );
}
