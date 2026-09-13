import SenseItem from "~/components/entry/entry-page/SenseItem";
import type { EntryPageSense } from "~/server/db/repository/lexical-entry";
import type { LanguageType } from "~/server/db/schema";

interface SenseListProps {
  senses: EntryPageSense[];
  language: LanguageType;
}

const SenseList = ({ senses, language }: SenseListProps) => (
  <div className="space-y-5">
    {senses.map((sense) => (
      <SenseItem key={sense.id} sense={sense} language={language} />
    ))}
  </div>
);

export default SenseList;
