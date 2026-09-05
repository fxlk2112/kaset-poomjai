import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createEnvelope,
  readLocalMessages,
  validateEnvelope,
  validateMessages,
  writeEnvelope,
} from "../../scripts/codex-relay.mjs";

const context = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  now: "2026-09-03T00:00:00.000Z",
  branch: "folk/codex-relay",
  commit: "1234567890abcdef1234567890abcdef12345678",
};

test("creates a SAFE_OFF relay envelope that requires human write approval", () => {
  const envelope = createEnvelope({
    from: "folk",
    to: "sucha",
    kind: "handshake",
    summary: "Folk Codex preflight complete",
    requires_response: true,
  }, context);

  assert.deepEqual(validateEnvelope(envelope), []);
  assert.equal(envelope.safety.data_only, true);
  assert.equal(envelope.safety.safe_off, true);
  assert.equal(envelope.safety.output_control_allowed, false);
  assert.equal(envelope.safety.approval, "HUMAN_REQUIRED_FOR_EXTERNAL_WRITE");
});

test("rejects private endpoints, coordinates, credentials, and unsafe output flags", () => {
  const privateAddress = ["192", "168", "1", "25"].join(".");
  const coordinate = ["lat", "13.123456"].join("=");
  const passwordLiteral = `${["pass", "word"].join("")}='not-a-real-secret'`;
  const privateCloudHost = `https://private-example.${["workers", "dev"].join(".")}`;
  const samples = [
    `internal endpoint is http://${privateAddress}:9000`,
    coordinate,
    passwordLiteral,
    `service is ${privateCloudHost}`,
  ];
  for (const details of samples) {
    assert.throws(() => createEnvelope({
      from: "folk",
      to: "sucha",
      kind: "status",
      summary: "Unsafe sample",
      details,
    }, context), /sensitive content rejected/);
  }

  const envelope = createEnvelope({
    from: "folk",
    to: "sucha",
    kind: "status",
    summary: "Safe sample",
  }, context);
  envelope.safety.output_control_allowed = true;
  assert.match(validateEnvelope(envelope).join("; "), /output_control_allowed must be false/);
});

test("writes and validates append-only message files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "farmult-relay-"));
  try {
    const envelope = createEnvelope({
      from: "folk",
      to: "sucha",
      kind: "ack",
      summary: "Handshake acknowledged",
    }, context);
    const relative = writeEnvelope(root, envelope);
    assert.match(relative.replaceAll("\\", "/"), /^coordination\/relay\/messages\/folk\//);
    const messages = readLocalMessages(root);
    assert.equal(messages.length, 1);
    assert.deepEqual(validateMessages(messages), []);
    assert.throws(() => writeEnvelope(root, envelope), /EEXIST/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("treats relay messages as non-authoritative handoffs", () => {
  const envelope = createEnvelope({
    from: "sucha",
    to: "folk",
    kind: "task",
    summary: "Review the dashboard map tests",
    details: "Prepare a local branch and report findings. Do not push or deploy.",
  }, { ...context, branch: "pick/codex-relay-setup" });
  assert.equal(envelope.safety.approval, "HUMAN_REQUIRED_FOR_EXTERNAL_WRITE");
  assert.equal(envelope.safety.deployment, "NOT_DEPLOYED");
});
