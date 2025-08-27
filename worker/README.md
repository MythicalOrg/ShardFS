# ShardFS Worker Node

A worker node for the ShardFS distributed storage system. This worker stores and serves file chunks.

## Features

- **Chunk Storage**: Receives and stores file chunks on disk
- **Chunk Serving**: Serves chunks to clients for download
- **Heartbeat**: Maintains connection with master node
- **Storage Management**: Tracks available space and chunk metadata
- **HTTP API**: RESTful endpoints for chunk operations

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the worker:**
   ```bash
   npm run dev
   ```

3. **Or build and run:**
   ```bash
   npm run build
   npm start
   ```

## Configuration

Set environment variables or create a `.env` file:

```env
# Worker configuration
WORKER_PORT=8000
WORKER_HOST=localhost:8000

# Master connection
MASTER_URL=http://localhost:9000

# Storage
STORAGE_DIR=./chunks

# Heartbeat
HEARTBEAT_INTERVAL_MS=5000

# Debug mode
DEBUG=true
```

## API Endpoints

### Upload Chunk
```
POST /uploadChunk
Content-Type: application/octet-stream
Headers:
  x-chunk-id: <chunk-id>
  x-filename: <filename>
  x-chunk-index: <index>
  x-chunk-size: <size>
  x-total-size: <total-size>
```

### Download Chunk
```
GET /downloadChunk/:chunkId
```

### Get Chunk Info
```
GET /chunkInfo/:chunkId
```

### List All Chunks
```
GET /chunks
```

### Health Check
```
GET /health
```

## Architecture

The worker consists of several components:

- **HTTP Server**: Handles chunk upload/download requests
- **Storage Service**: Manages chunk storage on disk
- **Heartbeat Service**: Maintains connection with master
- **Logger**: Provides logging utilities

## Storage

Chunks are stored in the configured directory with the following structure:
```
chunks/
├── chunks.json          # Metadata file
├── chunk1.chunk         # Chunk data files
├── chunk2.chunk
└── ...
```

## Heartbeat Protocol

The worker sends heartbeats to the master every 5 seconds with:
- Worker ID and host information
- Available storage space
- Total chunks stored
- Metadata about the worker

## Error Handling

The worker handles various error conditions:
- Network failures (automatic reconnection)
- Disk space issues
- Invalid requests
- Corrupted chunks

## Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run tests (when implemented)
npm test
```
