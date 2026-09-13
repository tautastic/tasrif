import FormReference from "~/components/entry/FormReference";
import type { AffixMoodType, ConjugationSelect } from "~/server/db/schema";

interface ConjugationTableProps {
  word: string;
  patternFormNumber: number;
  patternDescription: string;
  masdar: string | null;
  activeParticiple: string | null;
  passiveParticiple: string | null;
  conjugations: ConjugationSelect[];
}

type PersonColumn = Exclude<keyof ConjugationSelect, "id" | "lexicalEntryId" | "mood">;

interface PersonSlot {
  masculine?: PersonColumn;
  feminine?: PersonColumn;
}

const FULL_PERSON_SLOTS: readonly PersonSlot[] = [
  { masculine: "firstPersonSingular" },
  { masculine: "secondPersonMasculineSingular", feminine: "secondPersonFeminineSingular" },
  { masculine: "thirdPersonMasculineSingular", feminine: "thirdPersonFeminineSingular" },
  { masculine: "secondPersonDual" },
  { masculine: "thirdPersonMasculineDual", feminine: "thirdPersonFeminineDual" },
  { masculine: "firstPersonPlural" },
  { masculine: "secondPersonMasculinePlural", feminine: "secondPersonFemininePlural" },
  { masculine: "thirdPersonMasculinePlural", feminine: "thirdPersonFemininePlural" },
];

const IMPERATIVE_PERSON_SLOTS: readonly PersonSlot[] = [
  {},
  { masculine: "secondPersonMasculineSingular", feminine: "secondPersonFeminineSingular" },
  {},
  { masculine: "secondPersonDual" },
  {},
  {},
  { masculine: "secondPersonMasculinePlural", feminine: "secondPersonFemininePlural" },
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
  conjugation,
  slots,
}: {
  label: string;
  arabicLabel: string;
  conjugation: ConjugationSelect;
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
          <ArabicForm form={slot.masculine && conjugation[slot.masculine]} />
        </td>
      ))}
    </tr>
    <tr>
      <th className={genderTh}>f</th>
      {slots.map((slot, index) =>
        slot.feminine ? (
          <td key={index} className={baseTd}>
            <ArabicForm form={conjugation[slot.feminine]} />
          </td>
        ) : null,
      )}
    </tr>
  </>
);

const ConjugationTable = ({
  word,
  patternFormNumber,
  patternDescription,
  masdar,
  activeParticiple,
  passiveParticiple,
  conjugations,
}: ConjugationTableProps) => {
  const byMood = new Map(conjugations.map((conjugation) => [conjugation.mood, conjugation]));

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
            const conjugation = byMood.get(mood);
            return (
              conjugation && (
                <MoodRows
                  key={mood}
                  label={label}
                  arabicLabel={arabicLabel}
                  conjugation={conjugation}
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
