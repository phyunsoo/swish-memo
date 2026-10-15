// Network work is single-flight. Only its short read/commit steps enter the
// local storage queue, so offline sync never blocks typing or local saves.
export function createCloudSyncCoordinator<T>(options: {
  read: () => Promise<T>;
  sync: (snapshot: T) => Promise<T>;
  commit: (snapshot: T) => Promise<void>;
  onError: (error: unknown) => void;
  debounceMs?: number;
  retryMs?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending = false;
  let stopped = false;
  let failures = 0;

  function schedule(delay: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void drain(); }, delay);
  }

  async function drain() {
    if (running || stopped || !pending) return;
    running = true;
    pending = false;
    try {
      const remote = await options.sync(await options.read());
      await options.commit(remote);
      failures = 0;
    } catch (error) {
      pending = true;
      failures += 1;
      options.onError(error);
    } finally {
      running = false;
      if (pending && !stopped) {
        schedule(failures ? Math.min((options.retryMs ?? 5000) * 2 ** (failures - 1), 60000) : 0);
      }
    }
  }

  return {
    request() {
      if (stopped) return;
      pending = true;
      if (!running) schedule(options.debounceMs ?? 1200);
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
