declare module "vitest" {
  export const describe: any;
  export const it: any;
  export const test: any;
  export const expect: any;
  export const beforeAll: (...args: any[]) => any;
  export const afterAll: (...args: any[]) => any;
  export const beforeEach: (...args: any[]) => any;
  export const afterEach: (...args: any[]) => any;
  export const vi: {
    fn: (...args: any[]) => any;
    mock: (...args: any[]) => any;
    doMock: (...args: any[]) => any;
    unmock: (...args: any[]) => any;
    hoisted: <T>(factory: () => T) => T;
    importActual: <T = any>(path: string) => Promise<T>;
    mocked: <T>(item: T) => any;
    clearAllMocks: (...args: any[]) => any;
    resetAllMocks: (...args: any[]) => any;
    restoreAllMocks: (...args: any[]) => any;
    resetModules: (...args: any[]) => any;
    spyOn: (...args: any[]) => any;
    stubGlobal: (...args: any[]) => any;
    unstubAllGlobals: (...args: any[]) => any;
    stubEnv: (...args: any[]) => any;
    unstubAllEnvs: (...args: any[]) => any;
    useFakeTimers: (...args: any[]) => any;
    useRealTimers: (...args: any[]) => any;
    advanceTimersByTime: (...args: any[]) => any;
    advanceTimersByTimeAsync: (...args: any[]) => Promise<any>;
    runAllTimers: (...args: any[]) => any;
    setSystemTime: (...args: any[]) => any;
    waitFor: <T>(callback: () => T | Promise<T>, options?: any) => Promise<T>;
  };
}
