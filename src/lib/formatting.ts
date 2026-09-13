import type { LanguageType, PartOfSpeechType, SenseRelationType } from "~/server/db/schema";

const LANGUAGE_LABELS: Record<LanguageType, string> = {
  ar: "Arabic",
  en: "English",
};

const SENSE_RELATION_LABELS: Record<SenseRelationType, string> = {
  synonym: "synonym",
  antonym: "antonym",
  hyponym: "hyponym",
  hypernym: "hypernym",
  near_synonym: "near synonym",
};

const POS_LABELS: Record<PartOfSpeechType, string> = {
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  preposition: "Preposition",
  conjunction: "Conjunction",
  interjection: "Interjection",
  pronoun: "Pronoun",
  determiner: "Determiner",
  particle: "Particle",
  adverbial_phrase: "Adverbial phrase",
  idiom: "Idiom",
};

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

export const formatLanguageName = (language: LanguageType): string => LANGUAGE_LABELS[language];
export const formatSenseRelationType = (relation: SenseRelationType): string => SENSE_RELATION_LABELS[relation];
export const formatPartOfSpeechType = (pos: PartOfSpeechType): string => POS_LABELS[pos];

export const formatRoot = (root: string): string => [...root].join("-");

export const formatMorphPatternFormNumber = (formNumber: number): string =>
  ROMAN_NUMERALS[formNumber - 1] ?? String(formNumber);
