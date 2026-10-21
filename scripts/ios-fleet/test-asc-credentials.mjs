// AFC-459: asc-api.mjs resolves App Store Connect credentials from the
// environment first (the APPLE_API_* trio, then the ASC_KEY_ID / ASC_ISSUER_ID
// / ASC_KEY_P8 trio), then from Infisical through fleet-secrets, and never
// from a key file:  a path on disk is not an approved secret source (Kody
// rule 42), so the shell layer hands the key over in the environment.
//
// Runs asc-api.mjs against a local HTTP server with a FAKE fleet-secrets binary
// and a throwaway HOME.  The JWT header's kid proves which key id was used and
// the signature proves which private key signed it.  No real secrets.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "asc-api.mjs");
const keyPair = () => generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = () => keyPair().privateKey.export({ type: "pkcs8", format: "pem" });
const publicPem = (pair) => pair.publicKey.export({ type: "spki", format: "pem" });

const root = mkdtempSync(join(tmpdir(), "asc-js-test-"));
const home = join(root, "home");
mkdirSync(home);
const ascPem = pem();
const otherPem = pem();
const fake = join(root, "fleet-secrets");
writeFileSync(fake, `#!/usr/bin/env node
const [, , verb, name, , folder] = process.argv;
const table = {
  "/asc:ASC_KEY_ID": "ASCKEY0001",
  "/asc:ASC_ISSUER_ID": "issuer-from-asc",
  "/asc:ASC_KEY_P8": ${JSON.stringify(ascPem)},
  "/authkey-otherkey01-p8:AUTHKEY_OTHERKEY01": ${JSON.stringify(otherPem)},
};
const v = verb === "get" ? table[folder + ":" + name] : undefined;
if (v === undefined) process.exit(3);
process.stdout.write(v + "\\n");
`);
chmodSync(fake, 0o755);

function run(env) {
  return new Promise((resolve) => {
    const seen = [];
    const server = createServer((req, res) => {
      seen.push(req.headers.authorization || "");
      res.setHeader("content-type", "application/json");
      res.end("{\"data\":[]}");
    });
    server.listen(0, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${server.address().port}/v1/apps`;
      const base = { PATH: process.env.PATH, HOME: home, FLEET_SECRETS: fake };
      const child = spawn(process.execPath, [script, "GET", url], { env: { ...base, ...env }, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.resume();
      let stderr = "";
      child.stderr.on("data", (c) => { stderr += c; });
      child.on("close", (code) => {
        server.close();
        const jwt = (seen[0] || "").replace(/^Bearer /, "");
        let kid = null;
        let iss = null;
        if (jwt) {
          const part = (i) => JSON.parse(Buffer.from(jwt.split(".")[i], "base64url").toString());
          kid = part(0).kid;
          iss = part(1).iss;
        }
        resolve({ code, kid, iss, jwt, stderr });
      });
    });
  });
}

// Did this private key sign the token?  The kid alone does not prove it:  two
// key ids can carry the same kid, and the whole point of the port is that the
// key that signs the request is the one the operator meant.
function signedWith(jwt, publicKeyPem) {
  if (!jwt) return false;
  const [h, p, s] = jwt.split(".");
  const verifier = createVerify("SHA256");
  verifier.update(`${h}.${p}`);
  verifier.end();
  try {
    //  ASC requires the JOSE (r||s) signature encoding, not DER, so the
    //  verifier has to use the same one the signer did.
    return verifier.verify({ key: publicKeyPem, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  } catch {
    return false;
  }
}

test("nothing in the environment:  id, issuer and key all come from /asc", async () => {
  const r = await run({});
  assert.equal(r.code, 0);
  assert.equal(r.kid, "ASCKEY0001");
  assert.equal(r.iss, "issuer-from-asc");
});

test("an env key id equal to the /asc one is served from /asc", async () => {
  const r = await run({ ASC_KEY_ID: "ASCKEY0001" });
  assert.equal(r.code, 0);
  assert.equal(r.kid, "ASCKEY0001");
});

test("an env key id that is not the /asc one gets its own .p8 and its own issuer, never the /asc pair", async () => {
  const r = await run({ ASC_KEY_ID: "OTHERKEY01", ASC_ISSUER_ID: "issuer-other" });
  assert.equal(r.code, 0);
  assert.equal(r.kid, "OTHERKEY01");
  assert.equal(r.iss, "issuer-other");
});

test("an env key id that is not the /asc one with no env issuer fails closed", async () => {
  const r = await run({ ASC_KEY_ID: "OTHERKEY01" });
  assert.notEqual(r.code, 0);
  assert.equal(r.kid, null);
});

test("an env key id with no key material anywhere fails closed", async () => {
  const r = await run({ ASC_KEY_ID: "NOSUCHKEY0", ASC_ISSUER_ID: "any-issuer" });
  assert.notEqual(r.code, 0);
  assert.equal(r.kid, null);
});

test("the environment wins over a named key file", async () => {
  //  The property the port exists for:  a disk credential never overrides the
  //  environment (Kody rule 42).  A stale or foreign value in an operator's
  //  shell would sign the upload with the wrong key, and App Store Connect
  //  would answer 401 without saying which input was wrong.
  const envPair = keyPair();
  const filePair = keyPair();
  const keyFile = join(root, "named-key.p8");
  writeFileSync(keyFile, filePair.privateKey.export({ type: "pkcs8", format: "pem" }));
  chmodSync(keyFile, 0o600);
  const r = await run({
    ASC_KEY_ID: "ENVKEY0001",
    ASC_ISSUER_ID: "env-issuer",
    ASC_KEY_P8: envPair.privateKey.export({ type: "pkcs8", format: "pem" }),
    ASC_KEY_PATH: keyFile,
    FLEET_SECRETS: join(root, "does-not-exist")
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.kid, "ENVKEY0001");
  assert.equal(r.iss, "env-issuer");
  assert.ok(signedWith(r.jwt, publicPem(envPair)), "the request was not signed with the environment key");
  assert.ok(!signedWith(r.jwt, publicPem(filePair)), "the request was signed with the named file's key");
  assert.match(r.stderr, /asc-auth: using ASC_KEY_P8 environment/);
  assert.doesNotMatch(r.stderr, /using ASC_KEY_PATH environment/);
});

test("a named ASC_KEY_PATH is not a credential source", async () => {
  //  A path on disk is not an approved secret source.  The client refuses it
  //  and says who does hand the key over.
  const filePair = keyPair();
  const keyFile = join(root, "only-a-file.p8");
  writeFileSync(keyFile, filePair.privateKey.export({ type: "pkcs8", format: "pem" }));
  chmodSync(keyFile, 0o600);
  const r = await run({
    ASC_KEY_ID: "FILEKEY0001",
    ASC_ISSUER_ID: "file-issuer",
    ASC_KEY_PATH: keyFile,
    FLEET_SECRETS: join(root, "does-not-exist")
  });
  assert.notEqual(r.code, 0);
  assert.equal(r.kid, null, "a path was read as a credential");
  assert.match(r.stderr, /no App Store Connect credential found/);
  assert.match(r.stderr, /A path in ASC_KEY_PATH is not a credential source/);
  assert.match(r.stderr, /hands the key over in ASC_KEY_P8/);
});

test("the APPLE_API_* trio is resolved before the ASC_* trio", async () => {
  const applePair = keyPair();
  const ascPair = keyPair();
  const r = await run({
    APPLE_API_KEY_ID: "APPLEKEY01",
    APPLE_API_ISSUER_ID: "apple-issuer",
    APPLE_API_KEY_P8_BASE64: Buffer.from(
      applePair.privateKey.export({ type: "pkcs8", format: "pem" }), "utf8"
    ).toString("base64"),
    ASC_KEY_ID: "ENVKEY0001",
    ASC_ISSUER_ID: "env-issuer",
    ASC_KEY_P8: ascPair.privateKey.export({ type: "pkcs8", format: "pem" })
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.kid, "APPLEKEY01");
  assert.equal(r.iss, "apple-issuer");
  assert.ok(signedWith(r.jwt, publicPem(applePair)), "the request was not signed with the APPLE_API_* key");
  assert.ok(!signedWith(r.jwt, publicPem(ascPair)), "the request was signed with the ASC_* key");
  assert.match(r.stderr, /asc-auth: using APPLE_API_\* environment/);
});

test("an ASC_KEY_P8 that is not a private key is a credential error, not a stack trace", async () => {
  const r = await run({
    ASC_KEY_ID: "ENVKEY0002",
    ASC_ISSUER_ID: "env-issuer",
    ASC_KEY_P8: "this is not a private key at all"
  });
  assert.notEqual(r.code, 0);
  assert.equal(r.kid, null);
  assert.match(r.stderr, /ASC_KEY_P8 is set but is not a PEM private key/);
  assert.doesNotMatch(r.stderr, /\n\s+at /, "a stack trace reached the operator");
  //  The rejection carries a MASKED PREVIEW -- the first eight and the last
  //  four characters -- and never the key itself.
  assert.match(r.stderr, /preview: this is \.\.\. all/,
    "the rejected key was reported without a masked preview");
  assert.ok(!r.stderr.includes("this is not a private key at all"),
    "the rejected key was reported whole");
});

test("a rejected key is reported with the blessed masked preview", async () => {
  //  The first eight characters of "not a private key at all" are "not a pr"
  //  and the last four are " all", so that value previews as "not a pr... all".
  const r = await run({
    ASC_KEY_ID: "ENVKEY0004",
    ASC_ISSUER_ID: "env-issuer",
    ASC_KEY_P8: "not a private key at all"
  });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /preview: not a pr\.\.\. all/,
    "the rejected key was reported without the masked preview");
  assert.ok(!r.stderr.includes("not a private key at all"),
    "the rejected key was reported whole");
});

test("a value too short to mask safely is withheld whole", async () => {
  //  A preview can never become the secret it describes, so a short value is
  //  reported as a length and nothing else.
  const r = await run({
    ASC_KEY_ID: "ENVKEY0005",
    ASC_ISSUER_ID: "env-issuer",
    ASC_KEY_P8: "short"
  });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /preview: \[5 chars, withheld\]/,
    "a short value was not withheld");
  assert.ok(!r.stderr.includes("short"),
    "a short value was reported whole");
});

test("a rejected base64 key is reported with a masked preview too", async () => {
  const r = await run({
    APPLE_API_KEY_ID: "APPLEKEY02",
    APPLE_API_ISSUER_ID: "apple-issuer",
    APPLE_API_KEY_P8_BASE64: Buffer.from("not a private key at all", "utf8").toString("base64")
  });
  assert.notEqual(r.code, 0);
  assert.equal(r.kid, null);
  assert.match(r.stderr, /APPLE_API_KEY_P8_BASE64 is set but did not decode to a PEM private key/);
  assert.match(r.stderr, /preview: bm90IGEg\.\.\.YWxs/,
    "the rejected base64 key was reported without a masked preview");
  assert.ok(!r.stderr.includes("bm90IGEgcHJpdmF0ZSBrZXkgYXQgYWxs"),
    "the rejected base64 key was reported whole");
});

test("a truncated ASC_KEY_P8 is refused before it reaches the signer", async () => {
  //  The envelope alone is not a key:  a truncated key carries the envelope
  //  and still fails to parse, and an unparsable key that reaches the signer
  //  comes back as a stack trace instead of a credential error.
  const truncated = "-----BEGIN PRIVATE KEY-----\nnot base64 at all\n-----END PRIVATE KEY-----\n"; // gitleaks:allow
  const r = await run({
    ASC_KEY_ID: "ENVKEY0003",
    ASC_ISSUER_ID: "env-issuer",
    ASC_KEY_P8: truncated
  });
  assert.notEqual(r.code, 0);
  assert.equal(r.kid, null);
  assert.match(r.stderr, /ASC_KEY_P8 is set but is not a PEM private key/);
  assert.doesNotMatch(r.stderr, /\n\s+at /, "a stack trace reached the operator");
});

test("a fleet-secrets failure names the reason instead of 'exited undefined'", async () => {
  // A missing binary, a non-zero exit and a spawn error all reach the catch
  // path; each must report its own cause.
  const missing = await run({ FLEET_SECRETS: join(root, "no-such-binary") });
  assert.match(missing.stderr, /the fleet-secrets binary is not available/);
  assert.doesNotMatch(missing.stderr, /exited undefined/);

  const failing = join(root, "failing-fleet-secrets");
  writeFileSync(failing, "#!/usr/bin/env node\nprocess.exit(3);\n");
  chmodSync(failing, 0o755);
  const exited = await run({ FLEET_SECRETS: failing });
  assert.match(exited.stderr, /fleet-secrets exited 3/);
  assert.doesNotMatch(exited.stderr, /exited undefined/);

  const notExecutable = join(root, "not-executable-fleet-secrets");
  writeFileSync(notExecutable, "#!/usr/bin/env node\n");
  chmodSync(notExecutable, 0o600);
  const spawnFailed = await run({ FLEET_SECRETS: notExecutable });
  assert.match(spawnFailed.stderr, /fleet-secrets failed: E[A-Z]+/);
  assert.doesNotMatch(spawnFailed.stderr, /exited undefined/);
});

test("a skipped source stays visible in the notes even when another source resolves", async () => {
  // The fall-through to the APPLE_API_* trio succeeds, but the skipped source
  // must not vanish from the log:  the recorded note has to reach the operator.
  const r = await run({
    ASC_KEY_ID: "PARTIAL001",
    ASC_ISSUER_ID: "partial-issuer",
    APPLE_API_KEY_ID: "APPLEKEY01",
    APPLE_API_ISSUER_ID: "apple-issuer",
    APPLE_API_KEY_P8_BASE64: Buffer.from(pem(), "utf8").toString("base64")
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.kid, "APPLEKEY01");
  assert.match(r.stderr, /asc-auth: using APPLE_API_\* environment/);
  assert.match(r.stderr, /the environment is missing ASC_KEY_P8/);
});

test.after(() => rmSync(root, { recursive: true, force: true }));
