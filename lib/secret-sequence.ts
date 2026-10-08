export const SECRET_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowUp",
  "ArrowDown",
] as const;

export const MAX_SECRET_KEY_GAP_MS = 650;

export type SecretSequenceState = {
  position: number;
  lastPressedAt: number | null;
};

export const INITIAL_SECRET_SEQUENCE_STATE: SecretSequenceState = {
  position: 0,
  lastPressedAt: null,
};

export function advanceSecretSequence(
  state: SecretSequenceState,
  key: string,
  pressedAt: number,
): { state: SecretSequenceState; unlocked: boolean } {
  const withinWindow =
    state.lastPressedAt !== null &&
    pressedAt >= state.lastPressedAt &&
    pressedAt - state.lastPressedAt <= MAX_SECRET_KEY_GAP_MS;
  const expectedPosition = withinWindow ? state.position : 0;
  const nextPosition =
    key === SECRET_KEYS[expectedPosition]
      ? expectedPosition + 1
      : key === SECRET_KEYS[0]
        ? 1
        : 0;

  if (nextPosition === SECRET_KEYS.length) {
    return { state: INITIAL_SECRET_SEQUENCE_STATE, unlocked: true };
  }

  return {
    state: {
      position: nextPosition,
      lastPressedAt: nextPosition === 0 ? null : pressedAt,
    },
    unlocked: false,
  };
}
