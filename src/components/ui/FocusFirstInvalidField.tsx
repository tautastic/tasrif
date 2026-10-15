"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";

const FocusFirstInvalidField = () => {
  const {
    formState: { submitCount, errors },
  } = useFormContext();
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    if (submitCount === 0 || !hasErrors) {
      return;
    }
    const timer = setTimeout(() => {
      const field = document.querySelector<HTMLElement>("form [aria-invalid='true']");
      field?.scrollIntoView({ block: "center" });
      field?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [submitCount, hasErrors]);

  return null;
};

export default FocusFirstInvalidField;
