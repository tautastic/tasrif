import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { buildPageMetadata } from "~/app/site";
import {
  type ArabicRefData,
  arabicVerbs,
  type BlockNode,
  type InlineNode,
  type MeaningItemData,
  type NestedListItemData,
  type TableHeaderCell,
  type TableRow,
} from "~/content/appendix/arabic-verbs";
import { entryPath } from "~/lib/formatting";
import { entrySlug } from "~/lib/slug";
import { decodeSlugOrNotFound } from "~/lib/validation/params";

export const revalidate = 3600;

export const generateStaticParams = (): { slug: string }[] => [];

interface Appendix {
  title: string;
  description: string;
  content: BlockNode[];
}

const APPENDICES: Readonly<Record<string, Appendix>> = {
  "arabic-verbs": {
    title: "Appendix:Arabic verbs",
    description: "The derived stems of Arabic verbs, illustrated with examples.",
    content: arabicVerbs,
  },
};

type AppendixPageProps = { params: Promise<{ slug: string }> };

const findAppendix = async (params: AppendixPageProps["params"]): Promise<{ slug: string; appendix: Appendix }> => {
  const slug = await decodeSlugOrNotFound(params);
  const appendix = Object.hasOwn(APPENDICES, slug) ? APPENDICES[slug] : undefined;
  if (!appendix) {
    notFound();
  }
  return { slug, appendix };
};

export const generateMetadata = async ({ params }: AppendixPageProps): Promise<Metadata> => {
  const { slug, appendix } = await findAppendix(params);
  return buildPageMetadata({
    title: appendix.title,
    description: appendix.description,
    path: `/appendix/${slug}`,
  });
};

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
  const target = href === undefined ? entryPath(entrySlug(arabic)) : href;

  return (
    <span className="leading-9">
      {target ? (
        <Link href={target} className="text-blue-600 underline hover:text-blue-800">
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
        case "bold":
          return (
            <b key={index}>
              <Inline nodes={node.content} />
            </b>
          );
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
    <Link href={href} className="text-blue-600 underline hover:text-blue-800">
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

const NestedListItem = ({ item }: { item: NestedListItemData }) => (
  <li>
    <Inline nodes={item.content} />
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
    case "nestedList":
      return (
        <ul className="list-disc ml-6 mt-4 space-y-4">
          {node.items.map((item, index) => (
            <NestedListItem key={index} item={item} />
          ))}
        </ul>
      );
  }
};

export default async function AppendixPage({ params }: AppendixPageProps) {
  const { appendix } = await findAppendix(params);

  return (
    <article className="mx-auto py-6 prose text-black">
      <h1 className="text-3xl border-b border-[#a2a9b1] pb-2 mb-6">{appendix.title}</h1>
      <div className="space-y-4 text-base leading-6.5 font-sans">
        {appendix.content.map((node, index) => (
          <Block key={index} node={node} />
        ))}
      </div>
    </article>
  );
}
