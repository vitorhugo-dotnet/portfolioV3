import type { LiveActivityResponse } from "./live-activity.ts";

export function isActivityStale(generatedAt: string, now: number): boolean {
  const time = Date.parse(generatedAt);
  return !Number.isFinite(time) || now - time > 120000;
}
export function createActivityRefresh(options: {
  load(signal: AbortSignal): Promise<LiveActivityResponse>;
  onData(data: LiveActivityResponse): void;
  onError(): void;
  schedule(callback: () => void, delay: number): unknown;
  cancel(timer: unknown): void;
}) {
  let visible = false;
  let disposed = false;
  let timer: unknown;
  let active: AbortController | undefined;
  function clearTimer() {
    if (timer !== undefined) options.cancel(timer);
    timer = undefined;
  }
  async function load() {
    if (!visible || disposed || active) return;
    const controller = new AbortController();
    active = controller;
    try {
      const data = await options.load(controller.signal);
      if (active === controller && visible && !disposed) options.onData(data);
    } catch {
      if (
        active === controller &&
        visible &&
        !disposed &&
        !controller.signal.aborted
      )
        options.onError();
    } finally {
      if (active === controller) {
        active = undefined;
        if (visible && !disposed)
          timer = options.schedule(() => {
            timer = undefined;
            void load();
          }, 60000);
      }
    }
  }
  function stop() {
    clearTimer();
    active?.abort();
    active = undefined;
  }
  return {
    setVisible(value: boolean) {
      if (disposed || value === visible) return;
      visible = value;
      if (value) void load();
      else stop();
    },
    dispose() {
      disposed = true;
      visible = false;
      stop();
    },
  };
}
