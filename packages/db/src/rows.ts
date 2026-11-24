/** The single row an INSERT … RETURNING or a lookup must produce; a missing row is a bug, said loudly. */
export function firstRow<T>(rows: readonly T[], what: string): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`expected a row: ${what}`);
  return row;
}
