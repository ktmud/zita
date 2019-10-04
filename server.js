const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const ptDebug = require("debug")("ZT.server");
const { spawn } = require("child_process");
const isPortReachable = require("is-port-reachable");

const BACKEND_API_ROOT =
  process.env.ZT_BACKEND_API_ROOT || "tcp://localhost:3002";

const backend = new URL(BACKEND_API_ROOT);

const dev = process.env.NODE_ENV !== "production";
ptDebug("Starting Next.js %sserver", dev ? "dev " : "");
const app = next({ dev });
const handle = app.getRequestHandler();

function spawnPy(port) {
  ptDebug("> Spawning Python process listing on %s...", port);
  const pyprocess = spawn("python3", ["-m", "zita.rpc", port], {
    cwd: "python"
  });
  this.pyprocess = pyprocess;
  pyprocess.stdout.on("data", data => {
    ptDebug("[stdout]: %s", data);
  });
  pyprocess.stderr.on("data", data => {
    ptDebug("[stderr]: %s", data);
  });
  pyprocess.on("close", code => {
    ptDebug("[PY] Exited with code %d", code);
  });
}

// if backend is a TCP Socket, assume we require a py process
if (backend.protocol === "tcp:") {
  ptDebug("Checking RPC backend status on %s", backend);
  isPortReachable(backend.port, { host: backend.hostname, timeout: 5000 }).then(
    reachable => {
      if (!reachable) {
        spawnPy(backend.port);
      }
    }
  );
}

app.prepare().then(() => {
  createServer((req, res) => {
    // Be sure to pass `true` as the second argument to `url.parse`.
    // This tells it to parse the query portion of the URL.
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, err => {
    if (err) throw err;
    ptDebug("> Ready on http://localhost:3000");
  });
});
