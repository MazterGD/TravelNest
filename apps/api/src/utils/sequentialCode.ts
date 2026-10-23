const MAX_ATTEMPTS = 5;

const isUniqueViolationOn = (error: unknown, field: string): boolean => {
  const err = error as { code?: string; meta?: { target?: unknown } } | null;
  if (err?.code !== "P2002") return false;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
};

/**
 * Human-readable sequential codes (QUO-2026-001) are derived from a count, so
 * two requests at the same moment can pick the same code. Build the code and
 * create the row together, and on a duplicate-code error try the next number.
 * The attempt offset also steps over gaps left by rows that no longer exist.
 */
export const createWithSequentialCode = async <T>(
  field: string,
  nextNumber: () => Promise<number>,
  format: (sequence: number) => string,
  create: (code: string) => Promise<T>,
): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    const code = format((await nextNumber()) + attempt);
    try {
      return await create(code);
    } catch (error) {
      if (attempt + 1 >= MAX_ATTEMPTS || !isUniqueViolationOn(error, field)) {
        throw error;
      }
    }
  }
};

export const yearSequence = (prefix: string, year: number, sequence: number) =>
  `${prefix}-${year}-${String(sequence).padStart(3, "0")}`;
