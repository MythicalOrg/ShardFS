import WebSocket from "ws";
import { log, error, warn } from "../utils/logger";
import { storage } from "./storage";

// Heartbeat service - keeps master updated about worker status
class HeartbeatService {
  private ws: WebSocket | null = null;
  private workerId: string;
  private masterUrl: string;
  private heartbeatInterval: number;
  private reconnectInterval: number = 5000; // 5 seconds
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(workerId: string, masterUrl: string, heartbeatInterval: number) {
    this.workerId = workerId;
    this.masterUrl = masterUrl;
    this.heartbeatInterval = heartbeatInterval;
  }

  async start(): Promise<void> {
    log(`Starting heartbeat service to ${this.masterUrl}`);
    await this.connect();
  }

  private async connect(): Promise<void> {
    try {
      // Create WebSocket connection to master
      this.ws = new WebSocket(this.masterUrl);
      
      // Setup event handlers
      this.ws.on("open", () => {
        log("Connected to master");
        this.isConnected = true;
        
        // Clear any reconnect timer
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        
        // Start sending heartbeats
        this.startHeartbeat();
      });

      this.ws.on("message", (data) => {
        this.handleMessage(data);
      });

      this.ws.on("close", () => {
        log("Disconnected from master");
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        error("WebSocket error:", err);
        this.isConnected = false;
      });

    } catch (err) {
      error("Failed to connect to master:", err);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    // Send initial heartbeat immediately
    this.sendHeartbeat();
    
    // Then send heartbeats at regular intervals
    setInterval(() => {
      if (this.isConnected) {
        this.sendHeartbeat();
      }
    }, this.heartbeatInterval);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.ws || !this.isConnected) {
      return;
    }

    try {
      // Get current storage stats
      const stats = await storage.getStorageStats();
      
      // Prepare heartbeat payload
      const heartbeat = {
        type: "worker:heartbeat",
        data: {
          id: this.workerId,
          host: this.getWorkerHost(),
          freeBytes: stats.freeSpace,
          totalBytes: stats.freeSpace + stats.totalSize, // Approximate total
          metadata: {
            totalChunks: stats.totalChunks,
            totalSize: stats.totalSize,
            hostname: require("os").hostname()
          }
        }
      };

      // Send heartbeat to master
      this.ws.send(JSON.stringify(heartbeat));
      
      log(`Sent heartbeat - freeBytes: ${stats.freeSpace}, chunks: ${stats.totalChunks}`);
    } catch (err) {
      error("Failed to send heartbeat:", err);
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case "master:info":
          log("Received master info:", message.data);
          break;
          
        case "workers:list":
          // Master sent us list of workers (for debugging)
          log(`Master reports ${message.data.length} workers`);
          break;
          
        default:
          log("Received unknown message type:", message.type);
      }
    } catch (err) {
      error("Failed to parse message:", err);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    log(`Scheduling reconnect in ${this.reconnectInterval}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      log("Attempting to reconnect to master...");
      this.connect();
    }, this.reconnectInterval);
  }

  private getWorkerHost(): string {
    // Get worker host from config or use localhost
    // In production, this should be the actual IP address
    const port = process.env.WORKER_PORT || "8000";
    return `localhost:${port}`;
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    log("Heartbeat service stopped");
  }
}

// Export setup function
export async function setupHeartbeat(workerId: string, config: any): Promise<void> {
  const heartbeatService = new HeartbeatService(
    workerId,
    config.MASTER_WS_URL,
    config.HEARTBEAT_INTERVAL_MS
  );
  
  await heartbeatService.start();
  
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    heartbeatService.stop();
  });
  
  process.on("SIGTERM", () => {
    heartbeatService.stop();
  });
}
