import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  morphPattern: {
    lexicalEntries: r.many.lexicalEntry({
      from: r.morphPattern.id,
      to: r.lexicalEntry.morphPatternId,
    }),
    resolutions: r.many.morphPatternResolution({
      from: r.morphPattern.id,
      to: r.morphPatternResolution.morphPatternId,
    }),
  },
  morphPatternResolution: {
    morphPattern: r.one.morphPattern({
      from: r.morphPatternResolution.morphPatternId,
      to: r.morphPattern.id,
    }),
  },
  lexicalEntry: {
    morphPattern: r.one.morphPattern({
      from: r.lexicalEntry.morphPatternId,
      to: r.morphPattern.id,
    }),
    senses: r.many.sense({
      from: r.lexicalEntry.id,
      to: r.sense.lexicalEntryId,
    }),
    conjugations: r.many.conjugation({
      from: r.lexicalEntry.id,
      to: r.conjugation.lexicalEntryId,
    }),
  },
  sense: {
    lexicalEntry: r.one.lexicalEntry({
      from: r.sense.lexicalEntryId,
      to: r.lexicalEntry.id,
    }),
    translations: r.many.senseTranslationView({
      from: r.sense.id,
      to: r.senseTranslationView.senseId,
    }),
    relatedSenses: r.many.senseRelationView({
      from: r.sense.id,
      to: r.senseRelationView.senseId,
    }),
  },
}));
