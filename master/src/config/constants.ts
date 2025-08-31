// This file will export all constants and variables from .env used in the Master folder.
// Keep this file clean and organized.

import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 9000;
export const WS_PATH = process.env.WS_PATH || "/ws";
export const HEARTBEAT_WINDOW_MS = 45_000; // 45 seconds => alive worker
export const HEARTBEAT_INTERVAL_MS = 5_000; // expected worker heartbeat interval
export const DEFAULT_RF = process.env.RF ? parseInt(process.env.RF) : 2; // replication factor
export const MB = 1024 * 1024;
export const REPLICATION_CANDIDATE_LIMIT = 10;