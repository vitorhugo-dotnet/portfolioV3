import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createActivityRefresh,
  isActivityStale,
} from "../lib/activity-refresh.ts";
import type { LiveActivityResponse } from "../lib/live-activity.ts";

const data: LiveActivityResponse = {
  generatedAt: "2026-10-07T12:00:00Z",
  providerStates: {
    coding: "empty",
    spotify: "empty",
    simkl: "empty",
    steam: "empty",
  },
};
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
test("polling only runs while visible, every 60 seconds, and never overlaps", async () => {
  const tasks = new Map<number, () => void>();
  let id = 0;
  let calls = 0;
  let delivered = 0;
  const controller = createActivityRefresh({
    load: async () => {
      calls++;
      return data;
    },
    onData: () => {
      delivered++;
    },
    onError: () => {},
    schedule: (callback, delay) => {
      assert.equal(delay, 60000);
      tasks.set(++id, callback);
      return id;
    },
    cancel: (key) => {
      tasks.delete(key as number);
    },
  });
  assert.equal(calls, 0);
  controller.setVisible(true);
  await flush();
  assert.equal(calls, 1);
  assert.equal(delivered, 1);
  assert.equal(tasks.size, 1);
  controller.setVisible(true);
  assert.equal(calls, 1);
  const tick = [...tasks.values()][0];
  tasks.clear();
  tick();
  await flush();
  assert.equal(calls, 2);
  controller.setVisible(false);
  assert.equal(tasks.size, 0);
  controller.setVisible(true);
  await flush();
  assert.equal(calls, 3);
  controller.dispose();
  assert.equal(tasks.size, 0);
});
test("hiding or unmounting aborts slow loads and discards their late results", async () => {
  const signals: AbortSignal[] = [];
  const resolveLoads: ((data: LiveActivityResponse) => void)[] = [];
  let delivered = 0;
  const controller = createActivityRefresh({
    load: (signal) => {
      signals.push(signal);
      return new Promise((resolve) => {
        resolveLoads.push(resolve);
      });
    },
    onData: () => {
      delivered++;
    },
    onError: () => assert.fail("aborted loads are not errors"),
    schedule: () => 1,
    cancel: () => {},
  });
  controller.setVisible(true);
  controller.setVisible(true);
  assert.equal(signals.length, 1);
  controller.setVisible(false);
  assert.equal(signals[0].aborted, true);
  controller.setVisible(true);
  assert.equal(signals.length, 2);
  resolveLoads[0](data);
  await flush();
  assert.equal(delivered, 0);
  controller.dispose();
  assert.equal(signals[1].aborted, true);
  resolveLoads[1](data);
  await flush();
  assert.equal(delivered, 0);
});
test("failed loads revalidate and old data is stale after two minutes", async () => {
  let errors = 0;
  let timer: (() => void) | undefined;
  const controller = createActivityRefresh({
    load: async () => {
      throw Error("offline");
    },
    onData: () => assert.fail(),
    onError: () => {
      errors++;
    },
    schedule: (callback) => {
      timer = callback;
      return 1;
    },
    cancel: () => {},
  });
  controller.setVisible(true);
  await flush();
  assert.equal(errors, 1);
  assert.ok(timer);
  controller.dispose();
  const start = Date.parse(data.generatedAt);
  assert.equal(isActivityStale(data.generatedAt, start + 120000), false);
  assert.equal(isActivityStale(data.generatedAt, start + 120001), true);
});
