import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cors from "cors";
import { createWorkerId } from "./utils/workerId";
import { setupStorage } from "./services/storage";
import { setupHeartbeat } from "./services/heartbeat";
import { setupUploadRoute } from "./routes/upload";
import { setupDownloadRoute } from "./routes/download";
import { log, error } from "./utils/logger";
import { getConfig } from "./config";
import { setupDeleteRoute } from "./routes/delete";

// Main worker class - handles all worker operations
class WorkerNode {
  private app: express.Application;
  private server: http.Server;
  private workerId: string;
  private config: ReturnType<typeof getConfig>;

  constructor() {
    // Load configuration first
    this.config = getConfig();

    // Generate unique worker ID (this will be our identity)
    this.workerId = createWorkerId(this.config.PORT);

    // Create Express app for HTTP endpoints
    this.app = express();

    // Create HTTP server (we'll attach WebSocket to this later)
    this.server = http.createServer(this.app);

    log(`Worker ${this.workerId} starting up...`);
  }

  async start() {
    try {
      // Initialize storage system first
      await setupStorage();
      log("Storage system initialized");

      // Setup HTTP middleware
      this.setupMiddleware();

      // Setup HTTP routes
      this.setupRoutes();

      // Setup WebSocket heartbeat to master
      await this.setupHeartbeat();

      // Start HTTP server
      this.server.listen(this.config.PORT, () => {
        log(
          `Worker ${this.workerId} running on http://localhost:${this.config.PORT}`
        );
        log(`Master connection: ${this.config.MASTER_URL}`);
      });
    } catch (err) {
      error("Failed to start worker:", err);
      process.exit(1);
    }
  }

  private setupMiddleware() {
    // Parse JSON bodies (for metadata)
    this.app.use(bodyParser.json({ limit: "1mb" }));

    // Parse raw bodies for file chunks (up to 100MB)
    this.app.use(
      bodyParser.raw({
        limit: "1024mb", // 1 GB
        type: "application/octet-stream",
      })
    );

    // Allow cross-origin requests (in case master is on different domain)
    this.app.use(cors());

    // Basic request logging
    this.app.use((req, res, next) => {
      log(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  private setupRoutes() {
    // Setup upload endpoint for receiving chunks
    setupUploadRoute(this.app);

    // Setup download endpoint for serving chunks
    setupDownloadRoute(this.app);

    setupDeleteRoute(this.app); //

    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        workerId: this.workerId,
        timestamp: Date.now(),
      });
    });
  }

  private async setupHeartbeat() {
    // Start heartbeat service to keep master updated
    await setupHeartbeat(this.workerId, this.config);
  }
}

// Start the worker
const worker = new WorkerNode();
worker.start().catch((err) => {
  error("Worker startup failed:", err);
  process.exit(1);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  log("Shutting down worker...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("Shutting down worker...");
  process.exit(0);
});
