import type { PassiveParadigmFixture } from "./passive-paradigm-types.ts";
import { PASSIVE_FORM_I_FIXTURES } from "./passive-paradigms-form-1.ts";
import { PASSIVE_FORM_IQ_FIXTURES } from "./passive-paradigms-form-1q.ts";
import { PASSIVE_FORMS_II_TO_V_FIXTURES } from "./passive-paradigms-forms-2-5.ts";
import { PASSIVE_FORMS_VI_TO_X_FIXTURES } from "./passive-paradigms-forms-6-10.ts";

export type { PassiveParadigmFixture } from "./passive-paradigm-types.ts";

export const PASSIVE_PARADIGM_FIXTURES: PassiveParadigmFixture[] = [
  ...PASSIVE_FORM_I_FIXTURES,
  ...PASSIVE_FORM_IQ_FIXTURES,
  ...PASSIVE_FORMS_II_TO_V_FIXTURES,
  ...PASSIVE_FORMS_VI_TO_X_FIXTURES,
];
