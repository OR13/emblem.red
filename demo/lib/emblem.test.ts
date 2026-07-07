import { test } from "node:test";
import assert from "node:assert/strict";
import {
  issueHashEmblem,
  verifyEmblem,
  sha256Hex,
  createPossessionProof,
  verifyPossessionProof,
  type IssuerKey,
} from "./emblem";

// Committed INSECURE demo keys (mirror issuer.ts).
const ISSUER: IssuerKey = {
  privateJwk: {
    kty: "EC", crv: "P-256",
    x: "Lk_JG6KJvF5bP79Wgs5cDlfUuwDDXHfepyk2vNpA_Jk",
    y: "WkqmDWYEhA0uejZCXPAaiIHQ5JCjVh17ownpn0g4Iwo",
    d: "mlbmSJUK4hUceTO9IRBmVlhO5GT_1-1dufOsCvDrDS0",
  },
  publicJwk: { kty: "EC", crv: "P-256", x: "Lk_JG6KJvF5bP79Wgs5cDlfUuwDDXHfepyk2vNpA_Jk", y: "WkqmDWYEhA0uejZCXPAaiIHQ5JCjVh17ownpn0g4Iwo" },
  kid: "emblem-demo-1",
};
const HOLDER_PRIV: JsonWebKey = {
  kty: "EC", crv: "P-256",
  x: "XLGv7xfBaFtPu9kq5Dv9EWDORjxnsc9l7bqc1zMJCqA",
  y: "DzKTaiV4sSTiPMvN_n_YsZybjsSLH_C8w3WHU-t7akQ",
  d: "zYPkyxZLR9jdzxdlUVxKYmFsP0GEDpkI95CuovblkJk",
};
const HOLDER_PUB: JsonWebKey = { kty: "EC", crv: "P-256", x: HOLDER_PRIV.x, y: HOLDER_PRIV.y };

const RESOURCE = new TextEncoder().encode('{"name":"Stephansdom","protected":true}');
const LOCATION = "https://emblem.red/landmarks/stephansdom.json";

const makeEmblem = () =>
  issueHashEmblem(
    { resource: RESOURCE, contentType: "application/json", location: LOCATION, sub: LOCATION, holderPublicJwk: HOLDER_PUB, holderKid: "holder-demo-1" },
    ISSUER
  );

test("issue + verify: valid signature and parsed hash-envelope headers", async () => {
  const v = await verifyEmblem(await makeEmblem(), ISSUER.publicJwk);
  assert.equal(v.valid, true);
  assert.deepEqual(v.errors, []);
  assert.equal(v.hashAlgName, "SHA-256");
  assert.equal(v.preimageContentType, "application/json");
  assert.equal(v.location, LOCATION);
  assert.equal(v.sub, LOCATION);
  assert.equal(v.kid, "emblem-demo-1");
});

test("payload equals the SHA-256 of the resource", async () => {
  const v = await verifyEmblem(await makeEmblem(), ISSUER.publicJwk);
  assert.equal(v.payloadHashHex, await sha256Hex(RESOURCE));
});

test("cnf carries the holder public key (RFC 8747)", async () => {
  const v = await verifyEmblem(await makeEmblem(), ISSUER.publicJwk);
  assert.ok(v.cnf, "cnf present");
  assert.equal(v.cnf!.jwk.x, HOLDER_PUB.x);
  assert.equal(v.cnf!.jwk.y, HOLDER_PUB.y);
  assert.equal(v.cnf!.kid, "holder-demo-1");
});

test("tampered emblem fails signature verification", async () => {
  const em = await makeEmblem();
  em[em.length - 1] ^= 0xff; // flip a signature byte
  const v = await verifyEmblem(em, ISSUER.publicJwk);
  assert.equal(v.valid, false);
});

test("verification with the wrong issuer key fails", async () => {
  const v = await verifyEmblem(await makeEmblem(), HOLDER_PUB);
  assert.equal(v.valid, false);
});

test("a modified resource no longer matches the signed payload hash", async () => {
  const v = await verifyEmblem(await makeEmblem(), ISSUER.publicJwk);
  const modified = new TextEncoder().encode('{"name":"Stephansdom","protected":false}');
  assert.notEqual(await sha256Hex(modified), v.payloadHashHex);
});

test("present: holder proves possession of the cnf key", async () => {
  const v = await verifyEmblem(await makeEmblem(), ISSUER.publicJwk);
  const challenge = crypto.getRandomValues(new Uint8Array(16));
  const proof = await createPossessionProof(HOLDER_PRIV, challenge);
  assert.equal(await verifyPossessionProof(v.cnf!.jwk, proof, challenge), true);
});

test("present: proof fails against a different key", async () => {
  const challenge = crypto.getRandomValues(new Uint8Array(16));
  const proof = await createPossessionProof(HOLDER_PRIV, challenge);
  assert.equal(await verifyPossessionProof(ISSUER.publicJwk, proof, challenge), false);
});

test("present: proof fails on challenge mismatch (anti-replay)", async () => {
  const c1 = crypto.getRandomValues(new Uint8Array(16));
  const c2 = crypto.getRandomValues(new Uint8Array(16));
  const proof = await createPossessionProof(HOLDER_PRIV, c1);
  assert.equal(await verifyPossessionProof(HOLDER_PUB, proof, c2), false);
});
