import FormReference from "~/components/entry/FormReference";
import type { AffixMoodType, ConjugationSelect, PersonType, VoiceType } from "~/server/db/schema";

interface ConjugationTableProps {
  word: string;
  patternFormNumber: number;
  patternDescription: string;
  masdar: string | null;
  activeParticiple: string | null;
  passiveParticiple: string | null;
  conjugations: ConjugationSelect[];
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
const baseTd = "border border-[#b4b4b4] py-2.5 px-2 text-center";
const separator = "border border-[#b4b4b4] px-1 py-1 bg-gray-100";
const headerTh = `${baseTh} bg-[#ddefd3]`;
const genderTh = `${baseTh} bg-[#eaf5e4]`;
const moodTh = `${headerTh} w-30 h-32`;

const ACTIVE_VOICE: VoiceType = "active";

const ArabicForm = ({ form }: { form: string | null | undefined }) => (form ? <span lang="ar">{form}</span> : null);

const StackedLabel = ({ label, arabicLabel }: { label: string; arabicLabel: string }) => (
  <>
    {label}
    <br />
    <span lang="ar">{arabicLabel}</span>
  </>
);

const PrincipalPartRow = ({ label, arabicLabel, form }: { label: string; arabicLabel: string; form: string }) => (
  <tr>
    <th colSpan={6} className={`${headerTh} text-center`}>
      <StackedLabel label={label} arabicLabel={arabicLabel} />
    </th>
    <td colSpan={7} className={baseTd}>
      <span lang="ar">{form}</span>
    </td>
  </tr>
);

const MoodRows = ({
  label,
  arabicLabel,
  forms,
  slots,
}: {
  label: string;
  arabicLabel: string;
  forms: ReadonlyMap<PersonType, string>;
  slots: readonly PersonSlot[];
}) => (
  <>
    <tr>
      <th rowSpan={2} className={moodTh}>
        <StackedLabel label={label} arabicLabel={arabicLabel} />
      </th>
      <th className={genderTh}>m</th>
      {slots.map((slot, index) => (
        <td key={index} rowSpan={slot.feminine ? 1 : 2} className={baseTd}>
          <ArabicForm form={slot.masculine && forms.get(slot.masculine)} />
        </td>
      ))}
    </tr>
    <tr>
      <th className={genderTh}>f</th>
      {slots.map((slot, index) =>
        slot.feminine ? (
          <td key={index} className={baseTd}>
            <ArabicForm form={forms.get(slot.feminine)} />
          </td>
        ) : null,
      )}
    </tr>
  </>
);

const buildActiveFormsByMood = (conjugations: ConjugationSelect[]): Map<AffixMoodType, Map<PersonType, string>> => {
  const byMood = new Map<AffixMoodType, Map<PersonType, string>>();
  for (const row of conjugations) {
    if (row.voice !== ACTIVE_VOICE) {
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

const ConjugationTable = ({
  word,
  patternFormNumber,
  patternDescription,
  masdar,
  activeParticiple,
  passiveParticiple,
  conjugations,
}: ConjugationTableProps) => {
  const byMood = buildActiveFormsByMood(conjugations);

  const principalParts = [
    { label: "verbal noun", arabicLabel: "الْمَصْدَر", form: masdar },
    { label: "active participle", arabicLabel: "اِسْم الْفَاعِل", form: activeParticiple },
    { label: "passive participle", arabicLabel: "اِسْم الْمَفْعُول", form: passiveParticiple },
  ];

  return (
    <div className="overflow-x-scroll leading-[34.5833px]">
      <table className="w-full border-collapse border border-gray-300">
        <caption className="text-lg mb-2 text-left text-gray-800">
          <span className="font-semibold ">
            Conjugation of <span lang="ar">{word}</span>{" "}
          </span>
          <span className="text-sm">
            (<FormReference formNumber={patternFormNumber} formDescription={patternDescription} />)
          </span>
        </caption>
        <tbody>
          {principalParts.map(
            ({ label, arabicLabel, form }) =>
              form && <PrincipalPartRow key={label} label={label} arabicLabel={arabicLabel} form={form} />,
          )}

          <tr>
            <th colSpan={13} className={separator} />
          </tr>
          <tr>
            <th colSpan={13} className={`${baseTh} text-center bg-[#b3da9d]`}>
              <i>active voice</i>
              <br />
              <span lang="ar">الْفِعْل الْمَعْلُوم</span>
            </th>
          </tr>

          <tr>
            <th colSpan={2} className={headerTh} />
            {NUMBER_HEADERS.flatMap(({ label, arabicLabel, span }, index) => [
              ...(index > 0 ? [<th key={`${label}-separator`} rowSpan={12} className={separator} />] : []),
              <th key={label} colSpan={span} className={`${headerTh} text-center`}>
                <StackedLabel label={label} arabicLabel={arabicLabel} />
              </th>,
            ])}
          </tr>
          <tr>
            <th colSpan={2} className={headerTh} />
            {PERSON_HEADERS.map((person, index) => {
              const { ordinal, suffix, arabicLabel } = PERSONS[person];
              return (
                <th key={index} className={headerTh}>
                  {ordinal}
                  <sup>{suffix}</sup> person
                  <br />
                  <span lang="ar">{arabicLabel}</span>
                </th>
              );
            })}
          </tr>

          {MOODS.map(({ mood, label, arabicLabel }) => {
            const forms = byMood.get(mood);
            return (
              forms && (
                <MoodRows
                  key={mood}
                  label={label}
                  arabicLabel={arabicLabel}
                  forms={forms}
                  slots={mood === "imperative" ? IMPERATIVE_PERSON_SLOTS : FULL_PERSON_SLOTS}
                />
              )
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ConjugationTable;
