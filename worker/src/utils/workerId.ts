import { v4 as uuidv4 } from "uuid";
import os from "os";

// Generate a unique worker ID
// We combine hostname with a UUID to make it both readable and unique
export function createWorkerId(): string {
  const hostname = os.hostname();
  const uuid = uuidv4().slice(0, 8); // Take first 8 chars of UUID
  
  // Format: hostname-uuid (e.g., "mycomputer-a1b2c3d4")
  return `${hostname}-${uuid}`;
}

// Alternative: if you want just a simple UUID
export function createSimpleWorkerId(): string {
  return uuidv4();
}
