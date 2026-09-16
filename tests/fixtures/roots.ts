export interface RootSample {
  shape: string;
  root: string;
  latin: string;
}

export const ROOT_SAMPLES: RootSample[] = [
  { shape: "sound", root: "كتب", latin: "ktb" },
  { shape: "sound", root: "ضرب", latin: "ḍrb" },
  { shape: "sound", root: "سكن", latin: "skn" },
  { shape: "assimilated-waw", root: "وعد", latin: "wʕd" },
  { shape: "assimilated-ya", root: "يسر", latin: "ysr" },
  { shape: "hollow-waw", root: "قول", latin: "qwl" },
  { shape: "hollow-ya", root: "بيع", latin: "byʕ" },
  { shape: "final-weak-waw", root: "دعو", latin: "dʕw" },
  { shape: "final-weak-ya", root: "رمي", latin: "rmy" },
  { shape: "geminate", root: "مدد", latin: "mdd" },
  { shape: "hamzated-first", root: "أكل", latin: "ʔkl" },
  { shape: "hamzated-second", root: "سأل", latin: "sʔl" },
  { shape: "hamzated-third", root: "قرأ", latin: "qrʔ" },
  { shape: "hamzated-second-final-weak-ya", root: "نأي", latin: "nʔy" },
  { shape: "hamzated-second-final-weak-ya", root: "رأي", latin: "rʔy" },
  { shape: "hollow-waw-final-weak-ya", root: "روي", latin: "rwy" },
  { shape: "assimilated-waw-final-weak-ya", root: "وقي", latin: "wqy" },
];

export const rootFor = (shape: string): string => {
  const sample = ROOT_SAMPLES.find((candidate) => candidate.shape === shape);
  if (!sample) {
    throw new Error(`No root sample registered for shape "${shape}"`);
  }
  return sample.root;
};

export const representativeRootFor = (radical1: string, radical2: string, radical3: string, geminate: boolean) => {
  if (geminate) {
    return rootFor("geminate");
  }
  const pick = (kind: string, waw: string, ya: string, hamza: string, sound: string) =>
    kind === "waw" ? waw : kind === "ya" ? ya : kind === "hamza" ? hamza : sound;
  const first = pick(radical1, "و", "ي", "أ", "ك");
  const second = pick(radical2, "و", "ي", "أ", "ت");
  const third = pick(radical3, "و", "ي", "أ", "ب");
  return `${first}${second}${third}`;
};
