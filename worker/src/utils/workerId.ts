import { v4 as uuidv4 } from "uuid";
import os from "os";

// Generate a worker ID in the format ip:port
export function createWorkerId(port: number | string): string {
  // Get the first non-internal IPv4 address
  const interfaces = os.networkInterfaces();
  let ip = "localhost";
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ip = iface.address;
        break;
      }
    }
    if (ip !== "localhost") break;
  }
  return `${ip}:${port}`;
}

// Alternative: if you want just a simple UUID
export function createSimpleWorkerId(): string {
  return uuidv4();
}
