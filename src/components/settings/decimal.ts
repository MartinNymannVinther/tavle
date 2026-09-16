/**
 * What a person typed into a field that wants a number with a fraction.
 *
 * `<input type="number">` is not an option for these: the HTML spec
 * defines its value as a floating-point number written with a point,
 * whatever language the page is in, so a Dane who writes the half the
 * Danish sentence beside the field asks for — "0,5" — hands the form an
 * empty string, and the number quietly becomes something else. The field
 * is a text field with a decimal keyboard instead, and this is what
 * reads it: the comma and the point mean the same thing here, because
 * they mean the same thing to the person typing.
 *
 * Anything else — an empty field, a word, two separators — comes back as
 * NaN, which every caller already has to handle: a range is checked
 * before the number is used.
 */
export function decimalValue(typed: string): number {
  const cleaned = typed.trim().replace(",", ".");
  // Number("") is 0, and an empty field is not a zero anybody typed.
  return cleaned === "" ? Number.NaN : Number(cleaned);
}
