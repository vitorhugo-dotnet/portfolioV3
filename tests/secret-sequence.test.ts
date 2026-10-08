import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceMobileLogoSequence,
  advanceSecretSequence,
  INITIAL_MOBILE_LOGO_SEQUENCE_STATE,
  INITIAL_SECRET_SEQUENCE_STATE,
  MAX_MOBILE_LOGO_GAP_MS,
  MAX_SECRET_KEY_GAP_MS,
  MOBILE_LOGO_CLICKS,
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
  const state = advanceSecretSequence(
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

test("six mobile logo taps unlock and reset the counter", () => {
  let state = INITIAL_MOBILE_LOGO_SEQUENCE_STATE;
  for (let count = 1; count <= MOBILE_LOGO_CLICKS; count++) {
    const result = advanceMobileLogoSequence(state, 1000 + count * 150);
    assert.equal(result.unlocked, count === MOBILE_LOGO_CLICKS);
    state = result.state;
  }
  assert.deepEqual(state, INITIAL_MOBILE_LOGO_SEQUENCE_STATE);
});

test("mobile logo tap timeout restarts at the first tap", () => {
  const first = advanceMobileLogoSequence(
    INITIAL_MOBILE_LOGO_SEQUENCE_STATE,
    1000,
  );
  const afterPause = advanceMobileLogoSequence(
    first.state,
    1000 + MAX_MOBILE_LOGO_GAP_MS + 1,
  );
  assert.equal(afterPause.unlocked, false);
  assert.equal(afterPause.state.count, 1);
});

test("mobile logo taps never unlock before the sixth tap", () => {
  let state = INITIAL_MOBILE_LOGO_SEQUENCE_STATE;
  for (let count = 1; count < MOBILE_LOGO_CLICKS; count++) {
    const result = advanceMobileLogoSequence(state, count * 100);
    assert.equal(result.unlocked, false);
    assert.equal(result.state.count, count);
    state = result.state;
  }
});
