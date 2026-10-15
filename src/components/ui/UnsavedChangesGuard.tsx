"use client";

import { useFormContext } from "react-hook-form";
import { useUnsavedChangesGuard } from "~/hooks/useUnsavedChangesGuard";

const UnsavedChangesGuard = () => {
  const {
    formState: { isDirty },
  } = useFormContext();
  useUnsavedChangesGuard(isDirty);
  return null;
};

export default UnsavedChangesGuard;
