import assert from "node:assert/strict";
import { test } from "node:test";
import { getSql } from "@/lib/db";
import {
  challengeFor,
  newCode,
  redeemCode,
  storeCode,
  storePendingAuth,
  takePendingAuth,
} from "./native-auth-codes";

test("pending auth: stores challenge and consumes it in a single use", async () => {
  const verifier = newCode();
  const challenge = challengeFor(verifier);
  const state = newCode();

  await storePendingAuth(state, challenge);

  // First take succeeds and returns the exact challenge.
  const taken = await takePendingAuth(state);
  assert.equal(taken, challenge);

  // Second take returns null because it is single-use.
  const replay = await takePendingAuth(state);
  assert.equal(replay, null);
});

test("pending auth: unknown state returns null", async () => {
  const unknownState = newCode();
  const res = await takePendingAuth(unknownState);
  assert.equal(res, null);
});

test("pending auth: expired state returns null", async () => {
  const sql = await getSql();
  const state = newCode();
  const challenge = challengeFor(newCode());

  // Insert directly with an expired timestamp.
  await sql`
    insert into native_auth_pending (state, challenge, expires_at)
    values (${state}, ${challenge}, now() - interval '1 second')
  `;

  const taken = await takePendingAuth(state);
  assert.equal(taken, null);
});

test("native auth codes: store code and redeem with correct verifier", async () => {
  const verifier = newCode();
  const challenge = challengeFor(verifier);
  const code = newCode();
  const session = { token: "session-token-abc-123", email: "trainer@example.com" };

  await storeCode(code, challenge, session);

  const redeemed = await redeemCode(code, verifier);
  assert.ok(redeemed, "redeemCode should succeed");
  assert.equal(redeemed?.token, session.token);
  assert.equal(redeemed?.email, session.email);

  // Single-use: redeeming a second time returns null.
  const secondRedeem = await redeemCode(code, verifier);
  assert.equal(secondRedeem, null);
});

test("native auth codes: wrong verifier burns the code immediately", async () => {
  const correctVerifier = newCode();
  const wrongVerifier = newCode();
  const challenge = challengeFor(correctVerifier);
  const code = newCode();
  const session = { token: "secret-token", email: "user@example.com" };

  await storeCode(code, challenge, session);

  // Wrong verifier returns null.
  const wrongResult = await redeemCode(code, wrongVerifier);
  assert.equal(wrongResult, null);

  // Code is burned — even correct verifier now fails.
  const burnedResult = await redeemCode(code, correctVerifier);
  assert.equal(burnedResult, null);
});

test("native auth codes: non-existent code returns null", async () => {
  const nonExistentCode = newCode();
  const verifier = newCode();
  const result = await redeemCode(nonExistentCode, verifier);
  assert.equal(result, null);
});

test("native auth codes: expired code returns null", async () => {
  const sql = await getSql();
  const verifier = newCode();
  const challenge = challengeFor(verifier);
  const code = newCode();

  // Insert an expired code directly.
  await sql`
    insert into native_auth_codes (code, challenge, token, email, expires_at)
    values (${code}, ${challenge}, 'token-expired', 'expired@example.com', now() - interval '5 seconds')
  `;

  const res = await redeemCode(code, verifier);
  assert.equal(res, null);
});
