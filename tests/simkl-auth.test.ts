import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  createSimklPkceRequest,
  parseSimklOAuthCallback,
} from "../scripts/simkl-auth.ts";

test("Simkl AUTH V2 authorization uses a private verifier and S256 challenge", () => {
  const request = createSimklPkceRequest(
    "public-client-id",
    "https://example.com/callback",
  );
  const verifier = request.codeVerifier;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(request.url.origin, "https://simkl.com");
  assert.equal(request.url.pathname, "/oauth2/authorize");
  assert.equal(request.url.searchParams.get("response_type"), "code");
  assert.equal(request.url.searchParams.get("client_id"), "public-client-id");
  assert.equal(
    request.url.searchParams.get("redirect_uri"),
    "https://example.com/callback",
  );
  assert.equal(request.url.searchParams.get("scope"), "media:read");
  assert.equal(request.url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(request.url.searchParams.get("code_challenge"), challenge);
  assert.ok(request.state.length >= 20);
  assert.ok(!request.url.href.includes(verifier));
});

test("Simkl callback validates redirect, issuer, and state before returning code", () => {
  assert.equal(
    parseSimklOAuthCallback(
      "https://example.com/callback?code=one-time-code&state=expected&iss=https%3A%2F%2Fsimkl.com",
      "https://example.com/callback",
      "expected",
    ),
    "one-time-code",
  );
});

test("Simkl callback rejects a mismatched issuer, state, or redirect", () => {
  for (const [callback, redirect, state] of [
    [
      "https://example.com/callback?code=c&state=expected&iss=https%3A%2F%2Fevil.test",
      "https://example.com/callback",
      "expected",
    ],
    [
      "https://example.com/callback?code=c&state=wrong&iss=https%3A%2F%2Fsimkl.com",
      "https://example.com/callback",
      "expected",
    ],
    [
      "https://other.test/callback?code=c&state=expected&iss=https%3A%2F%2Fsimkl.com",
      "https://example.com/callback",
      "expected",
    ],
  ] as const) {
    assert.throws(() => parseSimklOAuthCallback(callback, redirect, state));
  }
});
