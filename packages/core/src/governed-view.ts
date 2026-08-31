import type { GovernedView, JsonValue } from "@aicoo/sharedos-contracts";

/**
 * The outcome of serving one typed governed view.
 *
 * There is no partial success. A representation that cannot carry the view is
 * refused whole, because the alternative -- serving what could be projected and
 * passing the rest through -- is exactly the disclosure the view was issued to
 * prevent.
 */
export type GovernedViewProjection =
  | { readonly ok: true; readonly output: JsonValue }
  | { readonly ok: false; readonly reason: string };

/**
 * Project one resource representation down to a view's declared fields.
 *
 * The projection is kernel-owned enforcement, not provider courtesy: the
 * provider serves the raw representation exactly as it would for a raw read,
 * and what leaves the kernel is decided here, after the fact, from the view the
 * authorization decision carried. A provider that lied about its shape cannot
 * widen the result -- a representation that is not a record (or an array of
 * records) fails closed rather than passing through.
 *
 * A declared field absent from the record is simply absent from the view. The
 * field list is an allowlist over what exists, not a schema the record must
 * satisfy: a calendar entry with no `location` still has a free/busy view.
 */
export function projectGovernedView(view: GovernedView, output: JsonValue): GovernedViewProjection {
  if (Array.isArray(output)) {
    const projected: JsonValue[] = [];
    for (const element of output) {
      const row = projectGovernedView(view, element);
      if (!row.ok) {
        return row;
      }
      projected.push(row.output);
    }
    return { ok: true, output: projected };
  }

  if (output === null || typeof output !== "object") {
    return { ok: false, reason: "the resource representation is not a record" };
  }

  const record = output as Readonly<Record<string, JsonValue>>;
  const projected: Record<string, JsonValue> = {};
  for (const field of view.fields) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      projected[field] = record[field] as JsonValue;
    }
  }
  return { ok: true, output: projected };
}
