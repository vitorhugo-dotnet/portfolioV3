import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceSecretSequence,
  INITIAL_SECRET_SEQUENCE_STATE,
  MAX_SECRET_KEY_GAP_MS,
  SECRET_KEYS,
} from "../lib/secret-sequence.ts";

test("unlocks after six alternating arrows", () => {
  let state = INITIAL_SECRET_SEQUENCE_STATE;
  let unlocked = false;
  for (const [index, key] of SECRET_KEYS.entries()) {
    const result = advanceSecretSequence(state, key, 1000 + index * 120);
    state = result.state;
    unlocked = result.unlocked;
  }
  assert.equal(unlocked, true);
  assert.deepEqual(state, INITIAL_SECRET_SEQUENCE_STATE);
});

test("slow keypresses reset the sequence", () => {
  let state = advanceSecretSequence(
    INITIAL_SECRET_SEQUENCE_STATE,
    "ArrowUp",
    1000,
  ).state;
  const result = advanceSecretSequence(
    state,
    "ArrowDown",
    1000 + MAX_SECRET_KEY_GAP_MS + 1,
  );
  assert.equal(result.unlocked, false);
  assert.equal(result.state.position, 0);
});

test("incorrect keypresses reset progress", () => {
  const started = advanceSecretSequence(
    INITIAL_SECRET_SEQUENCE_STATE,
    "ArrowUp",
    1000,
  );
  const wrong = advanceSecretSequence(started.state, "ArrowLeft", 1100);
  assert.equal(wrong.state.position, 0);
  assert.equal(wrong.unlocked, false);
});

test("a new ArrowUp restarts the sequence after a mismatch", () => {
  const started = advanceSecretSequence(
    INITIAL_SECRET_SEQUENCE_STATE,
    "ArrowUp",
    1000,
  );
  const restarted = advanceSecretSequence(started.state, "ArrowUp", 1100);
  assert.equal(restarted.state.position, 1);
});
