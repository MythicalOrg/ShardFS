# ShardFS - Master Node

The Master Node is the central coordinator in the ShardFS distributed file system. It handles metadata, worker registration, chunk allocation, replication logic, and cluster state management.

## Features

```
✅ REST API for file metadata management
✅ WebSocket interface for worker heartbeat & cluster updates
✅ Supports replication factor (RF) for fault tolerance
✅ Scalable architecture for distributed storage
```

<!-- ✅ In-memory state management (optional Postgres integration) -->

## Tech Stack

- Node.js + TypeScript

- WebSocket (ws)

- Express.js

- Dotenv for configuration

<!-- - Postgres (optional for persistence) -->

## Folder Structure

```
master/
 ├── src/
 │    ├── routes/        # REST API routes
 │    ├── services/      # Business logic (workerManager, mappingStore)
 │    ├── utils/         # Logger, time utils
 │    ├── ws/            # WebSocket handlers
 │    └── index.ts       # Entry point
 ├── .env.example        # Example environment variables
 ├── package.json
 └── tsconfig.json
```

## Getting Started

### 1. Clone the Repo

```
git clone https://github.com/YOUR_GITHUB_USERNAME/ShardFS.git
cd ShardFS/master
```

### 2. Install Dependencies

```
npm install
```

### 3. Configure Environment

- Create a .env file from the .env.example:

```
cp .env.example .env
```

- Edit .env values as needed:

```
PORT=9000
WS_PATH=/ws
HEARTBEAT_WINDOW_MS=10000
HEARTBEAT_INTERVAL_MS=5000
DEFAULT_RF=2
```
<!-- DATABASE_URL=postgresql://user:password@localhost:5432/shardfs -->

### 4. Run the Master Node

```
npm run dev
```

### Output Example:

```
[dotenv] env loaded
WebSocket server attached on path /ws
ShardFS Master running on http://localhost:9000
Dashboard available at http://localhost:9000/dashboard
```

### API Endpoints

```
Method	    Endpoint	    Description
POST	    /register	    Register file metadata
GET	        /getChunkInfo	Get chunk info by filename
```
