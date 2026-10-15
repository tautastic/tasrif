import { revalidatePath, revalidateTag } from "next/cache";
import type { z } from "zod";
import { entryPath } from "~/lib/formatting";
import { containsNul } from "~/lib/validation/nul";
import { PUBLIC_DATA_TAG } from "~/server/cache/tags";
import { type ActionResult, fail, succeed } from "./result";

export const parseInput = <S extends z.ZodType>(schema: S, data: unknown, label: string): ActionResult<z.output<S>> => {
  if (containsNul(data)) {
    return fail(`Invalid ${label} — null characters are not allowed`);
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return fail(`Invalid ${label} — ${details.join("; ")}`);
  }
  return succeed(result.data);
};

export const revalidateEntryPaths = (slugs: readonly string[]) => {
  for (const slug of new Set(slugs)) {
    revalidatePath(entryPath(slug));
  }
};

export const revalidatePublicPages = () => {
  revalidatePath("/", "layout");
  revalidateTag(PUBLIC_DATA_TAG, { expire: 0 });
};
