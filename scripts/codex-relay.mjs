import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RELAY_PROTOCOL = "farmultimate-codex-relay/v1";
export const RELAY_ACTORS = new Set(["sucha", "folk"]);
export const RELAY_KINDS = new Set([
  "handshake",
  "task",
  "status",
  "blocker",
  "review_request",
  "ack",
]);

const MESSAGE_ROOT = path.join("coordination", "relay", "messages");
const MAX_SUMMARY_LENGTH = 240;
const MAX_DETAILS_LENGTH = 4_000;

const SENSITIVE_PATTERNS = [
  ["private_ip", /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/],
  ["coordinate", /\b(?:lat|latitude|lng|lon|longitude)\b\s*[:=]\s*-?\d{1,3}\.\d{3,}/i],
  ["mac", /\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/i],
  ["private_cloud_host", /https?:\/\/[^\s"']+(?:workers\.dev|pages\.dev|trycloudflare\.com)/i],
  ["url_credential", /https?:\/\/[^\s\/@:]+:[^\s\/@]+@/i],
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["known_token", /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/],
  ["infra_id", /\b[a-f0-9]{32}\b/i],
  ["secret_literal", /\b(?:api[_-]?key|client[_-]?secret|app[_-]?secret|access[_-]?token|refresh[_-]?token|password|authorization)\b\s*[:=]\s*["'][^"']{8,}["']/i],
];

function requiredString(value, name, errors, maxLength = undefined) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${name} must be a non-empty string`);
    return;
  }
  if (maxLength && value.length > maxLength) {
    errors.push(`${name} exceeds ${maxLength} characters`);
  }
}

function scanSensitiveText(value) {
  const serialized = JSON.stringify(value);
  return SENSITIVE_PATTERNS
    .filter(([, pattern]) => pattern.test(serialized))
    .map(([name]) => name);
}

export function validateEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return ["message must be a JSON object"];
  }

  if (envelope.protocol !== RELAY_PROTOCOL) errors.push("unsupported protocol");
  if (typeof envelope.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(envelope.id)) {
    errors.push("id must be a UUID v4");
  }
  if (typeof envelope.created_at !== "string" || Number.isNaN(Date.parse(envelope.created_at))) {
    errors.push("created_at must be an ISO timestamp");
  }
  if (!RELAY_ACTORS.has(envelope.from)) errors.push("from must be sucha or folk");
  if (!RELAY_ACTORS.has(envelope.to)) errors.push("to must be sucha or folk");
  if (envelope.from === envelope.to) errors.push("from and to must differ");
  if (!RELAY_KINDS.has(envelope.kind)) errors.push("unsupported kind");
  requiredString(envelope.summary, "summary", errors, MAX_SUMMARY_LENGTH);
  if (typeof envelope.details !== "string") errors.push("details must be a string");
  if (typeof envelope.details === "string" && envelope.details.length > MAX_DETAILS_LENGTH) {
    errors.push(`details exceeds ${MAX_DETAILS_LENGTH} characters`);
  }
  if (typeof envelope.requires_response !== "boolean") {
    errors.push("requires_response must be boolean");
  }
  if (envelope.reply_to !== null && (typeof envelope.reply_to !== "string" || !/^[0-9a-f-]{36}$/i.test(envelope.reply_to))) {
    errors.push("reply_to must be null or a message UUID");
  }

  if (!envelope.source || typeof envelope.source !== "object") {
    errors.push("source is required");
  } else {
    requiredString(envelope.source.branch, "source.branch", errors, 180);
    if (envelope.from === "sucha" && typeof envelope.source.branch === "string" && !envelope.source.branch.startsWith("pick/")) {
      errors.push("SUCHA messages must originate from a pick/ branch");
    }
    if (envelope.from === "folk" && typeof envelope.source.branch === "string" && !envelope.source.branch.startsWith("folk/")) {
      errors.push("Folk messages must originate from a folk/ branch");
    }
    if (typeof envelope.source.commit !== "string" || !/^[0-9a-f]{7,40}$/i.test(envelope.source.commit)) {
      errors.push("source.commit must be a Git commit hash");
    }
  }

  const safety = envelope.safety;
  if (!safety || typeof safety !== "object") {
    errors.push("safety contract is required");
  } else {
    if (safety.data_only !== true) errors.push("safety.data_only must be true");
    if (safety.safe_off !== true) errors.push("safety.safe_off must be true");
    if (safety.output_control_allowed !== false) errors.push("safety.output_control_allowed must be false");
    if (safety.deployment !== "NOT_DEPLOYED") errors.push("safety.deployment must be NOT_DEPLOYED");
    if (safety.approval !== "HUMAN_REQUIRED_FOR_EXTERNAL_WRITE") {
      errors.push("safety.approval must require a human for external writes");
    }
  }

  for (const category of scanSensitiveText(envelope)) {
    errors.push(`sensitive content rejected: ${category}`);
  }
  return errors;
}

export function createEnvelope(input, context = {}) {
  const envelope = {
    protocol: RELAY_PROTOCOL,
    id: context.id ?? randomUUID(),
    created_at: context.now ?? new Date().toISOString(),
    from: input.from,
    to: input.to,
    kind: input.kind,
    summary: input.summary,
    details: input.details ?? "",
    requires_response: input.requires_response ?? false,
    reply_to: input.reply_to ?? null,
    source: {
      branch: context.branch ?? input.branch,
      commit: context.commit ?? input.commit,
    },
    safety: {
      data_only: true,
      safe_off: true,
      output_control_allowed: false,
      deployment: "NOT_DEPLOYED",
      approval: "HUMAN_REQUIRED_FOR_EXTERNAL_WRITE",
    },
  };

  const errors = validateEnvelope(envelope);
  if (errors.length) throw new Error(errors.join("; "));
  return envelope;
}

export function messageRelativePath(envelope) {
  const timestamp = envelope.created_at.replace(/[-:.]/g, "");
  return path.join(MESSAGE_ROOT, envelope.from, `${timestamp}-${envelope.id}.json`);
}

export function writeEnvelope(repositoryRoot, envelope) {
  const errors = validateEnvelope(envelope);
  if (errors.length) throw new Error(errors.join("; "));
  const relativePath = messageRelativePath(envelope);
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  const allowedRoot = path.resolve(repositoryRoot, MESSAGE_ROOT) + path.sep;
  if (!absolutePath.startsWith(allowedRoot)) throw new Error("message path escaped relay root");
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(envelope, null, 2)}\n`, { flag: "wx" });
  return relativePath;
}

function jsonFilesBelow(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(target);
    }
  };
  visit(root);
  return files.sort();
}

export function readLocalMessages(repositoryRoot) {
  const root = path.resolve(repositoryRoot, MESSAGE_ROOT);
  return jsonFilesBelow(root).map((file) => ({
    path: path.relative(repositoryRoot, file),
    envelope: JSON.parse(fs.readFileSync(file, "utf8")),
  }));
}

function safeGitRef(ref) {
  return typeof ref === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$/.test(ref)
    && !ref.includes("..")
    && !ref.includes("@{");
}

function git(repositoryRoot, args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function readMessagesFromRef(repositoryRoot, ref) {
  if (!safeGitRef(ref)) throw new Error("invalid Git ref");
  let names;
  try {
    names = git(repositoryRoot, ["ls-tree", "-r", "--name-only", ref, "--", MESSAGE_ROOT]);
  } catch {
    throw new Error(`unable to read relay ref ${ref}`);
  }
  if (!names) return [];
  return names.split(/\r?\n/)
    .filter((name) => name.startsWith(`${MESSAGE_ROOT.replaceAll(path.sep, "/")}/`) && name.endsWith(".json"))
    .sort()
    .map((name) => {
      const raw = git(repositoryRoot, ["show", `${ref}:${name}`]);
      return { path: name, envelope: JSON.parse(raw) };
    });
}

export function validateMessages(messages) {
  const failures = [];
  for (const message of messages) {
    const errors = validateEnvelope(message.envelope);
    if (errors.length) failures.push({ path: message.path, errors });
  }
  return failures;
}

function parseFlags(args) {
  const flags = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith("--")) throw new Error(`unexpected argument ${key}`);
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key.slice(2), next);
      index += 1;
    } else {
      flags.set(key.slice(2), true);
    }
  }
  return flags;
}

function requireFlag(flags, name) {
  const value = flags.get(name);
  if (typeof value !== "string" || value === "") throw new Error(`--${name} is required`);
  return value;
}

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/codex-relay.mjs create --from sucha --to folk --kind handshake --summary TEXT [--details TEXT] [--requires-response] [--reply-to UUID]");
  console.log("  node scripts/codex-relay.mjs validate-tree [--ref origin/folk/codex-relay]");
  console.log("  node scripts/codex-relay.mjs inbox --to sucha [--ref origin/folk/codex-relay]");
}

function gitContext(repositoryRoot) {
  return {
    branch: git(repositoryRoot, ["branch", "--show-current"]),
    commit: git(repositoryRoot, ["rev-parse", "HEAD"]),
  };
}

function loadMessages(repositoryRoot, flags) {
  const ref = flags.get("ref");
  return typeof ref === "string"
    ? readMessagesFromRef(repositoryRoot, ref)
    : readLocalMessages(repositoryRoot);
}

function runCli() {
  const [command, ...args] = process.argv.slice(2);
  const repositoryRoot = process.cwd();
  if (!command || command === "help" || command === "--help") {
    printUsage();
    return;
  }

  const flags = parseFlags(args);
  if (command === "create") {
    const context = gitContext(repositoryRoot);
    const envelope = createEnvelope({
      from: requireFlag(flags, "from"),
      to: requireFlag(flags, "to"),
      kind: requireFlag(flags, "kind"),
      summary: requireFlag(flags, "summary"),
      details: typeof flags.get("details") === "string" ? flags.get("details") : "",
      requires_response: flags.get("requires-response") === true,
      reply_to: typeof flags.get("reply-to") === "string" ? flags.get("reply-to") : null,
    }, context);
    const output = writeEnvelope(repositoryRoot, envelope);
    console.log(`RELAY_MESSAGE_CREATED path=${output}`);
    console.log(`MESSAGE_ID=${envelope.id}`);
    return;
  }

  if (command === "validate-tree") {
    const messages = loadMessages(repositoryRoot, flags);
    const failures = validateMessages(messages);
    if (failures.length) {
      for (const failure of failures) {
        console.error(`INVALID path=${failure.path} errors=${failure.errors.join(" | ")}`);
      }
      process.exitCode = 2;
      return;
    }
    console.log(`RELAY_VALIDATION_OK messages=${messages.length}`);
    return;
  }

  if (command === "inbox") {
    const recipient = requireFlag(flags, "to");
    if (!RELAY_ACTORS.has(recipient)) throw new Error("--to must be sucha or folk");
    const messages = loadMessages(repositoryRoot, flags);
    const failures = validateMessages(messages);
    if (failures.length) throw new Error(`relay contains ${failures.length} invalid message(s)`);
    const inbox = messages.filter(({ envelope }) => envelope.to === recipient);
    console.log(`RELAY_INBOX recipient=${recipient} messages=${inbox.length}`);
    for (const { path: messagePath, envelope } of inbox) {
      console.log(JSON.stringify({ path: messagePath, ...envelope }));
    }
    return;
  }

  throw new Error(`unknown command ${command}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath.toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  try {
    runCli();
  } catch (error) {
    console.error(`RELAY_ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
