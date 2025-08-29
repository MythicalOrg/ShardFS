import dotenv from "dotenv";
import os from "os";

// Load environment variables
dotenv.config();

export function getConfig() {
  const DEFAULT_PORT = 8000;

  // CLI argument for port: npm run dev 8001
  const argPort = process.argv[2] ? parseInt(process.argv[2]) : undefined;

  const PORT =
    argPort ||
    (process.env.WORKER_PORT
      ? parseInt(process.env.WORKER_PORT)
      : DEFAULT_PORT);

  console.log(`Worker running on port: ${PORT}`);

  const MASTER_URL = process.env.MASTER_URL || "http://localhost:9000";
  const MASTER_WS_URL = MASTER_URL.replace("http://", "ws://") + "/ws";

  const STORAGE_DIR = process.env.STORAGE_DIR || `./chunks_${PORT}`;
  const HEARTBEAT_INTERVAL_MS = process.env.HEARTBEAT_INTERVAL_MS
    ? parseInt(process.env.HEARTBEAT_INTERVAL_MS)
    : 5000;

  const HOSTNAME = os.hostname();

  // Dynamically detect worker IP
  const interfaces = os.networkInterfaces();
  let ipAddress = "localhost";
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const i of iface) {
      if (i.family === "IPv4" && !i.internal) {
        ipAddress = i.address;
        break;
      }
    }
    if (ipAddress !== "localhost") break;
  }

  const WORKER_HOST = process.env.WORKER_HOST || `${ipAddress}:${PORT}`;

  return {
    PORT,
    MASTER_URL,
    MASTER_WS_URL,
    STORAGE_DIR,
    HEARTBEAT_INTERVAL_MS,
    HOSTNAME,
    WORKER_HOST,
  };
}
