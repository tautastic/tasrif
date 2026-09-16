import { notFound } from "next/navigation";

const decodeSlug = (slug: string): string | null => {
  if (!slug.includes("%")) {
    return slug;
  }
  try {
    return decodeURIComponent(slug);
  } catch {
    return null;
  }
};

export const decodeSlugOrNotFound = async (params: Promise<{ slug: string }>): Promise<string> => {
  const { slug } = await params;
  const decoded = decodeSlug(slug);
  if (!decoded) {
    notFound();
  }
  return decoded;
};

export const parseIdOrNotFound = async <K extends string = "id">(
  params: Promise<Record<K, string>>,
  key: K = "id" as K,
): Promise<number> => {
  const resolved = await params;
  const id = resolved[key];
  if (!/^[1-9]\d*$/.test(id)) {
    notFound();
  }
  const parsed = Number(id);
  if (!Number.isSafeInteger(parsed)) {
    notFound();
  }
  return parsed;
};
