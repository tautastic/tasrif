import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { buildPageMetadata } from "~/app/site";
import EntryDetail from "~/components/entry/entry-page/EntryDetail";
import RootInfoBox from "~/components/entry/entry-page/RootInfoBox";
import { entryPath, formatPartOfSpeechType } from "~/lib/formatting";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { type EntryPageData, findEntryRedirectSlug, getLexicalEntryBySlug } from "~/server/db/repository/lexical-entry";

export const revalidate = 3600;

export const generateStaticParams = (): { slug: string }[] => [];

const MAX_DESCRIPTION_LENGTH = 160;

type EntryLookup = { kind: "page"; page: EntryPageData } | { kind: "redirect"; slug: string } | { kind: "missing" };

const lookUpEntry = cache(async (key: string): Promise<EntryLookup> => {
  const page = await getLexicalEntryBySlug(key);
  if (page) {
    return { kind: "page", page };
  }
  const slug = await findEntryRedirectSlug(key);
  return slug ? { kind: "redirect", slug } : { kind: "missing" };
});

const truncate = (value: string): string =>
  value.length > MAX_DESCRIPTION_LENGTH ? `${value.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…` : value;

export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> => {
  const lookup = await lookUpEntry(await decodeSlugOrNotFound(params));
  const headword = lookup.kind === "page" ? lookup.page.entries[0] : undefined;
  if (lookup.kind !== "page" || !headword) {
    return {};
  }
  const { page } = lookup;

  const partsOfSpeech = [
    ...new Set(page.entries.flatMap((entry) => entry.senses.map((sense) => formatPartOfSpeechType(sense.pos)))),
  ];
  const definition = headword.senses.flatMap((sense) => sense.definitions).find((value) => value.trim() !== "");
  const title = partsOfSpeech.length > 0 ? `${headword.text} — ${partsOfSpeech.join(", ")}` : headword.text;

  return buildPageMetadata({
    title,
    description: truncate(definition ? `${headword.text}: ${definition}` : `${title} in the Tasrif dictionary.`),
    path: entryPath(page.slug),
  });
};

export default async function EntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const lookup = await lookUpEntry(await decodeSlugOrNotFound(params));

  if (lookup.kind === "redirect") {
    permanentRedirect(entryPath(lookup.slug));
  }
  if (lookup.kind === "missing") {
    notFound();
  }
  const { page } = lookup;

  return (
    <>
      <RootInfoBox rootInfo={page.rootInfo} />
      <div>
        {page.entries.map((entry, index) => (
          <EntryDetail key={entry.id} entry={entry} language={page.language} isPrimary={index === 0} />
        ))}
      </div>
    </>
  );
}
