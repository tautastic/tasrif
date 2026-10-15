export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const succeed = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (error: string): ActionResult<never> => ({ ok: false, error });
