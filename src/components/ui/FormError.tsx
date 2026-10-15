"use client";

import { useEffect, useRef } from "react";

const FormError = ({ message }: { message: string | null | undefined }) => {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (message && ref.current) {
      ref.current.scrollIntoView({ block: "center" });
      ref.current.focus({ preventScroll: true });
    }
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <p ref={ref} role="alert" tabIndex={-1} className="text-red-700 focus:outline-none">
      {message}
    </p>
  );
};

export default FormError;
