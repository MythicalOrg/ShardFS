import dotenv from "dotenv";
import os from "os";

// Load environment variables from .env file
dotenv.config();

export function getConfig() {
  // Get worker port from env or use default
  const DEFAULT_PORT = 8000;

  // Check command line args first
  const argPort = process.argv[2] ? parseInt(process.argv[2]) : undefined;

  // Then check env variable, fallback to default
  const PORT =
    argPort ||
    (process.env.WORKER_PORT
      ? parseInt(process.env.WORKER_PORT)
      : DEFAULT_PORT);

  console.log(`Worker running on port: ${PORT}`);

  // Get master URL from env or use default
  const MASTER_URL = process.env.MASTER_URL || "http://localhost:9000";

  // Get master WebSocket URL (convert http to ws)
  const MASTER_WS_URL = MASTER_URL.replace("http://", "ws://") + "/ws";

  // Get storage directory from env or use default (chunks_PORT)
  const STORAGE_DIR = process.env.STORAGE_DIR || `./chunks_${PORT}`;

  // Get heartbeat interval from env or use default (5 seconds)
  const HEARTBEAT_INTERVAL_MS = process.env.HEARTBEAT_INTERVAL_MS
    ? parseInt(process.env.HEARTBEAT_INTERVAL_MS)
    : 5000;

  // Get hostname for worker identification
  const HOSTNAME = os.hostname();

  // Get worker host (IP:PORT) for master to connect back
  const WORKER_HOST = process.env.WORKER_HOST || `localhost:${PORT}`;

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
