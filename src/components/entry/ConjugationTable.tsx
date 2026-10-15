import { useId } from "react";
import AlternativeForms from "~/components/entry/AlternativeForms";
import FormReference from "~/components/entry/FormReference";
import {
  type AlternativeFormsByCell,
  type AlternativeNounsByKind,
  alternativeFormsFor,
  alternativeNounsFor,
} from "~/lib/alternative-forms";
import type { AffixMoodType, AlternativeNounKind, ConjugationSelect, PersonType, VoiceType } from "~/server/db/schema";

interface ConjugationTableProps {
  word: string;
  patternFormNumber: number;
  patternRadicalCount?: number;
  patternDescription: string;
  masdar: string | null;
  activeParticiple: string | null;
  passiveParticiple: string | null;
  conjugations: ConjugationSelect[];
  alternatives?: AlternativeFormsByCell;
  passiveAlternatives?: AlternativeFormsByCell;
  alternativeNouns?: AlternativeNounsByKind;
}

interface PersonSlot {
  masculine?: PersonType;
  feminine?: PersonType;
}

const FULL_PERSON_SLOTS: readonly PersonSlot[] = [
  { masculine: "first_person_singular" },
  { masculine: "second_person_masculine_singular", feminine: "second_person_feminine_singular" },
  { masculine: "third_person_masculine_singular", feminine: "third_person_feminine_singular" },
  { masculine: "second_person_dual" },
  { masculine: "third_person_masculine_dual", feminine: "third_person_feminine_dual" },
  { masculine: "first_person_plural" },
  { masculine: "second_person_masculine_plural", feminine: "second_person_feminine_plural" },
  { masculine: "third_person_masculine_plural", feminine: "third_person_feminine_plural" },
];

const IMPERATIVE_PERSON_SLOTS: readonly PersonSlot[] = [
  {},
  { masculine: "second_person_masculine_singular", feminine: "second_person_feminine_singular" },
  {},
  { masculine: "second_person_dual" },
  {},
  {},
  { masculine: "second_person_masculine_plural", feminine: "second_person_feminine_plural" },
  {},
];

const MOODS: ReadonlyArray<{ mood: AffixMoodType; label: string; arabicLabel: string }> = [
  { mood: "perfect", label: "past (perfect) indicative", arabicLabel: "الْمَاضِي" },
  { mood: "imperfect_indicative", label: "non-past (imperfect) indicative", arabicLabel: "الْمُضَارِع الْمَرْفُوع" },
  { mood: "imperfect_subjunctive", label: "subjunctive", arabicLabel: "الْمُضَارِع الْمَنْصُوب" },
  { mood: "imperfect_jussive", label: "jussive", arabicLabel: "الْمُضَارِع الْمَجْزُوم" },
  { mood: "imperative", label: "imperative", arabicLabel: "الْأَمْر" },
];

const NUMBER_HEADERS: ReadonlyArray<{ label: string; arabicLabel: string; span: number }> = [
  { label: "singular", arabicLabel: "الْمُفْرَد", span: 3 },
  { label: "dual", arabicLabel: "الْمُثَنَّى", span: 2 },
  { label: "plural", arabicLabel: "الْجَمْع", span: 3 },
];

const PERSONS = {
  first: { ordinal: "1", suffix: "st", arabicLabel: "الْمُتَكَلِّم" },
  second: { ordinal: "2", suffix: "nd", arabicLabel: "الْمُخَاطَب" },
  third: { ordinal: "3", suffix: "rd", arabicLabel: "الْغَائِب" },
} as const;

const PERSON_HEADERS: ReadonlyArray<keyof typeof PERSONS> = [
  "first",
  "second",
  "third",
  "second",
  "third",
  "first",
  "second",
  "third",
];

const baseTh = "border border-[#b4b4b4] py-0.5 px-2";
const baseTd = "border border-[#b4b4b4] py-2.5 px-2 text-center min-w-22";
const separator = "border border-[#b4b4b4] px-1 py-1 bg-gray-100";
const headerTh = `${baseTh} bg-[#ddefd3]`;
const genderTh = `${baseTh} bg-[#eaf5e4] sticky left-24 z-10 w-8 sm:left-30`;
const moodTh = `${headerTh} sticky left-0 z-10 w-24 min-w-24 h-32 text-sm sm:w-30 sm:min-w-30 sm:text-base`;

const VOICES: ReadonlyArray<{ voice: VoiceType; label: string; arabicLabel: string; regionLabel: string }> = [
  { voice: "active", label: "active voice", arabicLabel: "الْفِعْل الْمَعْلُوم", regionLabel: "Active voice" },
  { voice: "passive", label: "passive voice", arabicLabel: "الْفِعْل الْمَجْهُول", regionLabel: "Passive voice" },
];

const GROUP_START_INDEXES: ReadonlySet<number> = new Set(
  NUMBER_HEADERS.slice(0, -1).map((_, index) =>
    NUMBER_HEADERS.slice(0, index + 1).reduce((sum, { span }) => sum + span, 0),
  ),
);

const Separator = () => <td rowSpan={2} className={separator} aria-hidden="true" />;

const ArabicForm = ({ form }: { form: string | null | undefined }) => (form ? <span lang="ar">{form}</span> : null);

const StackedLabel = ({ label, arabicLabel }: { label: string; arabicLabel: string }) => (
  <>
    {label}
    <br />
    <span lang="ar">{arabicLabel}</span>
  </>
);

const PrincipalPartRow = ({
  label,
  arabicLabel,
  form,
  alternatives,
}: {
  label: string;
  arabicLabel: string;
  form: string;
  alternatives: readonly string[];
}) => (
  <tr>
    <th scope="row" className={`${headerTh} w-[46%] text-center`}>
      <StackedLabel label={label} arabicLabel={arabicLabel} />
    </th>
    <td className={baseTd}>
      <span lang="ar">{form}</span>
      <AlternativeForms forms={alternatives} />
    </td>
  </tr>
);

const MoodRows = ({
  mood,
  label,
  arabicLabel,
  forms,
  slots,
  alternatives,
}: {
  mood: AffixMoodType;
  label: string;
  arabicLabel: string;
  forms: ReadonlyMap<PersonType, string>;
  slots: readonly PersonSlot[];
  alternatives?: AlternativeFormsByCell;
}) => (
  <>
    <tr>
      <th scope="row" rowSpan={2} className={moodTh}>
        <StackedLabel label={label} arabicLabel={arabicLabel} />
      </th>
      <th scope="row" className={genderTh}>
        <abbr title="masculine" className="no-underline">
          m
        </abbr>
      </th>
      {slots.flatMap((slot, index) => [
        ...(GROUP_START_INDEXES.has(index) ? [<Separator key={`separator-${index}`} />] : []),
        <td key={index} rowSpan={slot.feminine ? 1 : 2} className={baseTd}>
          <ArabicForm form={slot.masculine && forms.get(slot.masculine)} />
          <AlternativeForms forms={alternativeFormsFor(alternatives, mood, slot.masculine)} />
        </td>,
      ])}
    </tr>
    <tr>
      <th scope="row" className={genderTh}>
        <abbr title="feminine" className="no-underline">
          f
        </abbr>
      </th>
      {slots.map((slot, index) =>
        slot.feminine ? (
          <td key={index} className={baseTd}>
            <ArabicForm form={forms.get(slot.feminine)} />
            <AlternativeForms forms={alternativeFormsFor(alternatives, mood, slot.feminine)} />
          </td>
        ) : null,
      )}
    </tr>
  </>
);

const buildFormsByMood = (
  conjugations: ConjugationSelect[],
  voice: VoiceType,
): Map<AffixMoodType, Map<PersonType, string>> => {
  const byMood = new Map<AffixMoodType, Map<PersonType, string>>();
  for (const row of conjugations) {
    if (row.voice !== voice) {
      continue;
    }
    let forms = byMood.get(row.mood);
    if (!forms) {
      forms = new Map();
      byMood.set(row.mood, forms);
    }
    forms.set(row.person, row.form);
  }
  return byMood;
};

const VoiceBlock = ({
  word,
  label,
  arabicLabel,
  regionLabel,
  byMood,
  alternatives,
}: {
  word: string;
  label: string;
  arabicLabel: string;
  regionLabel: string;
  byMood: ReadonlyMap<AffixMoodType, ReadonlyMap<PersonType, string>>;
  alternatives?: AlternativeFormsByCell;
}) => {
  const voiceId = useId();
  const scrollRegion = { role: "region", tabIndex: 0, "aria-label": `${regionLabel} conjugation of ${word}` } as const;

  return (
    <>
      <div className={`${separator} h-2 border-t-0`} aria-hidden="true" />
      <div id={voiceId} className={`${baseTh} text-center font-semibold bg-[#b3da9d]`}>
        <em>{label}</em>
        <br />
        <span lang="ar">{arabicLabel}</span>
      </div>

      <div className="overflow-x-auto" {...scrollRegion}>
        <table className="w-full min-w-208 border-collapse border border-[#b4b4b4]" aria-labelledby={voiceId}>
          <thead>
            <tr>
              <td colSpan={2} className={headerTh} />
              {NUMBER_HEADERS.flatMap(({ label: numberLabel, arabicLabel: numberArabicLabel, span }, index) => [
                ...(index > 0 ? [<Separator key={`${numberLabel}-separator`} />] : []),
                <th key={numberLabel} scope="colgroup" colSpan={span} className={`${headerTh} text-center`}>
                  <StackedLabel label={numberLabel} arabicLabel={numberArabicLabel} />
                </th>,
              ])}
            </tr>
            <tr>
              <td colSpan={2} className={headerTh} />
              {PERSON_HEADERS.map((person, index) => {
                const { ordinal, suffix, arabicLabel: personArabicLabel } = PERSONS[person];
                return (
                  <th key={index} scope="col" className={headerTh}>
                    {ordinal}
                    <sup>{suffix}</sup> person
                    <br />
                    <span lang="ar">{personArabicLabel}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {MOODS.map(({ mood, label: moodLabel, arabicLabel: moodArabicLabel }) => {
              const forms = byMood.get(mood);
              return (
                forms && (
                  <MoodRows
                    key={mood}
                    mood={mood}
                    alternatives={alternatives}
                    label={moodLabel}
                    arabicLabel={moodArabicLabel}
                    forms={forms}
                    slots={mood === "imperative" ? IMPERATIVE_PERSON_SLOTS : FULL_PERSON_SLOTS}
                  />
                )
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

const ConjugationTable = ({
  word,
  patternFormNumber,
  patternRadicalCount,
  patternDescription,
  masdar,
  activeParticiple,
  passiveParticiple,
  conjugations,
  alternatives,
  passiveAlternatives,
  alternativeNouns,
}: ConjugationTableProps) => {
  const principalParts: ReadonlyArray<{
    kind: AlternativeNounKind;
    label: string;
    arabicLabel: string;
    form: string | null;
  }> = [
    { kind: "masdar", label: "verbal noun", arabicLabel: "الْمَصْدَر", form: masdar },
    { kind: "active_participle", label: "active participle", arabicLabel: "اِسْم الْفَاعِل", form: activeParticiple },
    { kind: "passive_participle", label: "passive participle", arabicLabel: "اِسْم الْمَفْعُول", form: passiveParticiple },
  ];

  return (
    <div className="leading-8">
      <table className="w-full border-collapse border border-gray-300">
        <caption className="text-lg mb-2 text-left text-gray-800">
          <span className="font-semibold ">
            Conjugation of <span lang="ar">{word}</span>{" "}
          </span>
          <span className="text-sm">
            (
            <FormReference
              formNumber={patternFormNumber}
              radicalCount={patternRadicalCount}
              formDescription={patternDescription}
            />
            )
          </span>
        </caption>
        <tbody>
          {principalParts.map(
            ({ kind, label, arabicLabel, form }) =>
              form && (
                <PrincipalPartRow
                  key={label}
                  label={label}
                  arabicLabel={arabicLabel}
                  form={form}
                  alternatives={alternativeNounsFor(alternativeNouns, kind)}
                />
              ),
          )}
        </tbody>
      </table>

      {VOICES.map(({ voice, label, arabicLabel, regionLabel }) => {
        const byMood = buildFormsByMood(conjugations, voice);
        return (
          (voice === "active" || byMood.size > 0) && (
            <VoiceBlock
              key={voice}
              word={word}
              label={label}
              arabicLabel={arabicLabel}
              regionLabel={regionLabel}
              byMood={byMood}
              alternatives={voice === "active" ? alternatives : passiveAlternatives}
            />
          )
        );
      })}
    </div>
  );
};

export default ConjugationTable;
