"use client";

import { useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import { canGuardTraversal, UNSAVED_CHANGES_MESSAGE } from "~/hooks/useUnsavedChangesGuard";

const FormCancelButton = ({ fallbackHref }: { fallbackHref: string }) => {
  const router = useRouter();
  const {
    formState: { isDirty },
  } = useFormContext();

  const handleClick = () => {
    const canGoBack = window.history.length > 1;
    const traversalGuardConfirms = canGoBack && canGuardTraversal();
    if (isDirty && !traversalGuardConfirms && !window.confirm(UNSAVED_CHANGES_MESSAGE)) {
      return;
    }
    if (canGoBack) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button type="button" onClick={handleClick} className="btn-secondary">
      Cancel
    </button>
  );
};

export default FormCancelButton;
