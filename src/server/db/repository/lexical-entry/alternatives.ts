import { sql } from "drizzle-orm";
import type { AlternativeFormsByCell, AlternativeNounsByKind } from "~/lib/alternative-forms";
import { db } from "~/server/db";
import type { AffixMoodType, AlternativeNounKind, PersonType, VoiceType } from "~/server/db/schema";

interface AlternativeRow extends Record<string, unknown> {
  lexical_entry_id: number;
  kind: "cell" | "noun";
  voice: VoiceType | null;
  mood: AffixMoodType | null;
  person: PersonType | null;
  noun: AlternativeNounKind | null;
  form: string;
}

export interface EntryAlternatives {
  forms?: AlternativeFormsByCell;
  passiveForms?: AlternativeFormsByCell;
  nouns?: AlternativeNounsByKind;
}

export const getEntryAlternatives = async (entryIds: readonly number[]): Promise<Map<number, EntryAlternatives>> => {
  const grouped = new Map<number, EntryAlternatives>();
  if (entryIds.length === 0) {
    return grouped;
  }

  const ids = sql.join(
    entryIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await db.execute<AlternativeRow>(sql`
    SELECT lexical_entry_id, 'cell' AS kind, voice::text AS voice, mood::text AS mood, person::text AS person,
           NULL::text AS noun, form
    FROM entry_alternative_forms(ARRAY[${ids}]::integer[])
    UNION ALL
    SELECT lexical_entry_id, 'noun', NULL, NULL, NULL, noun::text, form
    FROM entry_alternative_nouns(ARRAY[${ids}]::integer[])
  `);

  for (const row of result.rows) {
    const alternatives = grouped.get(row.lexical_entry_id) ?? {};
    if (row.kind === "cell" && row.mood && row.person) {
      const key = row.voice === "passive" ? "passiveForms" : "forms";
      const forms = alternatives[key] ?? {};
      const persons = forms[row.mood] ?? {};
      persons[row.person] = [...(persons[row.person] ?? []), row.form];
      forms[row.mood] = persons;
      alternatives[key] = forms;
    } else if (row.kind === "noun" && row.noun) {
      const nouns = alternatives.nouns ?? {};
      nouns[row.noun] = [...(nouns[row.noun] ?? []), row.form];
      alternatives.nouns = nouns;
    }
    grouped.set(row.lexical_entry_id, alternatives);
  }
  return grouped;
};
