export const createRevocationList = (now: () => number = Date.now) => {
  const revoked = new Map<string, number>();

  const prune = () => {
    const nowSeconds = Math.floor(now() / 1000);
    for (const [id, expiresAtSeconds] of revoked) {
      if (expiresAtSeconds <= nowSeconds) {
        revoked.delete(id);
      }
    }
  };

  return {
    revoke: (id: string, expiresAtSeconds: number): void => {
      prune();
      revoked.set(id, expiresAtSeconds);
    },
    isRevoked: (id: string): boolean => revoked.has(id),
    size: (): number => revoked.size,
  };
};

const globalForRevocation = globalThis as { __sessionRevocations?: ReturnType<typeof createRevocationList> };

globalForRevocation.__sessionRevocations ??= createRevocationList();

export const sessionRevocations = globalForRevocation.__sessionRevocations;
