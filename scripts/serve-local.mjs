import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const requestedPort = Number(process.env.FARMULTIMATE_PREVIEW_PORT || 4173);
const port = Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535
  ? requestedPort
  : 4173;
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", `http://${host}`).pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    let target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) throw new Error("outside root");
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, "index.html");
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream"
    });
    createReadStream(target).pipe(response);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`FARMULTIMATE preview http://${host}:${port}`);
});
