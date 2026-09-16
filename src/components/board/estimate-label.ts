import { useTranslations } from "next-intl";
import type { EstimateUnit } from "@/core/db/schema";
import { labelOf, totalLabel } from "@/modules/boards/estimates";

/**
 * The words on an estimate (docs/adr/0030).
 *
 * `src/modules/boards/estimates.ts` decides the numbers and deliberately
 * holds no copy: an hour is "t" in Danish and "h" in English, and
 * CLAUDE.md puts every word a person reads in `messages/*.json`. So the
 * whole sentence — the number's place in it included — comes from the
 * catalogue here, in the UI layer, and is handed to the domain
 * formatter. This is the one place that knows the word, so no chip can
 * be left saying "t" to an English reader.
 *
 * `useTranslations` reads the request's locale on the server and the
 * provider's on the client, so a chip rendered from either side wears
 * the same word.
 */
export function useEstimateLabel(): {
  label: (value: number | null | undefined, unit: EstimateUnit) => string | null;
  total: (value: number, unit: EstimateUnit) => string;
} {
  const t = useTranslations("common");
  const hours = (value: number) => t("hours", { value });
  return {
    label: (value, unit) => labelOf(value, unit, hours),
    total: (value, unit) => totalLabel(value, unit, hours),
  };
}
