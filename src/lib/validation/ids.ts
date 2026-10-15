import { z } from "zod";

export const MAX_BULK_IDS = 200;

export const idSchema = z.int({ error: "ID must be an integer" }).positive({ error: "ID must be positive" });

export const idListSchema = z
  .array(idSchema)
  .max(MAX_BULK_IDS, { error: `At most ${MAX_BULK_IDS} items can be processed at once` })
  .transform((ids) => [...new Set(ids)]);
