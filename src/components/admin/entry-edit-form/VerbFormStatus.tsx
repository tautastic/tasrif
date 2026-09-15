"use client";

import { useVerbFormResolution } from "~/hooks/useVerbFormResolution";
import type { VerbFormChoice } from "~/lib/validation/verbFormChoice";

interface VerbFormStatusProps {
  root: string;
  verbFormChoice: VerbFormChoice | null;
}

const VerbFormStatus = ({ root, verbFormChoice }: VerbFormStatusProps) => {
  const resolution = useVerbFormResolution(root, verbFormChoice);

  if (!resolution) {
    return null;
  }

  if (resolution.rootError) {
    return <p className="text-sm text-amber-600">{resolution.rootError}</p>;
  }

  if (!resolution.classification) {
    return null;
  }

  return (
    <p className="text-sm text-gray-600">
      Detected: {resolution.classification.join(", ")}
      {verbFormChoice &&
        (resolution.pattern ? (
          <span className="text-green-700">
            {" "}
            — pattern found{resolution.pattern.description ? ` (${resolution.pattern.description})` : ""}
          </span>
        ) : (
          <span className="text-amber-600"> — no pattern available yet for this combination</span>
        ))}
    </p>
  );
};

export default VerbFormStatus;
