import type { Dialog, Page } from "@playwright/test";

export interface DialogRecorder {
  messages: () => string[];
  types: () => string[];
  answerWith: (mode: "accept" | "dismiss") => void;
}

export const recordDialogs = (page: Page, initial: "accept" | "dismiss" = "dismiss"): DialogRecorder => {
  const seen: Dialog[] = [];
  let mode = initial;
  page.on("dialog", (dialog) => {
    seen.push(dialog);
    void (mode === "accept" ? dialog.accept() : dialog.dismiss());
  });
  return {
    messages: () => seen.map((dialog) => dialog.message()),
    types: () => seen.map((dialog) => dialog.type()),
    answerWith: (next) => {
      mode = next;
    },
  };
};

export const goBackExpectingPrompt = async (page: Page, answer: "accept" | "dismiss"): Promise<Dialog> => {
  const prompt = page.waitForEvent("dialog");
  const navigation = page.goBack({ timeout: 2_500 }).catch(() => null);
  const dialog = await prompt;
  await (answer === "accept" ? dialog.accept() : dialog.dismiss());
  await navigation;
  return dialog;
};
