interface RequestScope {
  cookies: Map<string, string>;
  headers: Headers;
}

const scope: RequestScope = { cookies: new Map(), headers: new Headers() };

export const setRequestScope = (next: { cookies?: Record<string, string>; headers?: Record<string, string> }) => {
  scope.cookies = new Map(Object.entries(next.cookies ?? {}));
  scope.headers = new Headers(next.headers ?? {});
};

export const cookies = async () => ({
  get: (name: string) => {
    const value = scope.cookies.get(name);
    return value === undefined ? undefined : { name, value };
  },
});

export const headers = async () => scope.headers;
