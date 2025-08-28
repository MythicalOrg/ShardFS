# ShardFS – A Fault-Tolerant Distributed File Storage System

### 🎓 Minor Project 
---

## 📌 Introduction
In the modern digital era, centralized file storage systems face critical challenges such as **single points of failure, limited scalability, and constrained throughput**. To address these challenges, industry has developed large-scale distributed storage systems like **Google File System (GFS)**, **Hadoop Distributed File System (HDFS)**, and **Amazon S3**.

This project demonstrates a simplified **Distributed File Storage System with Replication and Fault Tolerance**, built as part of our **minor project**. The system showcases how data can be:

- Split into **chunks**  
- Distributed across multiple **worker nodes**  
- **Replicated** for fault tolerance  
- Retrieved and **reassembled** even if nodes fail  
- **Monitored live** via a GUI dashboard  

---

## 🎯 Objectives
- Implement a **miniature distributed file system** for academic learning.  
- Ensure **fault tolerance** with replication and worker heartbeats.  
- Provide **scalability** by adding worker nodes dynamically.  
- Deliver **efficient data access** with chunk-based I/O.  
- Offer both **CLI tools** and a **React-based dashboard** for user interaction.  

---

## 🏗️ System Architecture
The system follows a **Master–Worker Architecture** with **WebSocket-based communication**:

- **Master Node**:  
  - Maintains file metadata and chunk mapping.  
  - Accepts worker registrations via WebSockets.  
  - Receives **heartbeat pings** to track worker availability.  
  - Exposes a built-in **React Dashboard** at `/dashboard` for visualization.  

- **Worker Nodes**:  
  - Store assigned file chunks locally.  
  - Replicate chunks to peers when instructed by the master.  
  - Maintain a **WebSocket connection** with the master for heartbeats and status updates.  

- **Client (CLI Tool)**:  
  - Provides upload, download, and file management commands.  
  - Interacts with the master, which delegates tasks to workers.  

- **React Dashboard**:  
  - Runs at **`http://<master-url>/dashboard`**.  
  - Displays **active workers, file distribution, chunk replication, and heartbeat status**.    

- **SDKs**:  
  - Currently includes a **Node.js SDK** for programmatic use.  
  - More SDKs can be added for other languages.  

---

## ⚡ Features

### Phase 1 (Core Features ✅)
- Chunking & **replication-based fault tolerance**  
- Horizontal **scalability** by adding workers  
- **CLI tool** for uploads/downloads  
- **WebSocket-based heartbeat monitoring**  

### Phase 2 (Advanced Features 🚀 – Work in Progress)
- **Self-healing replication** (automatic redistribution if worker dies)  
- Full-featured **React Dashboard** with charts & logs  
- SDKs for multiple languages (Python, Go, etc.)  
- Integration with **Docker orchestration**  

---

## 🛠️ Tech Stack
- **Language**: TypeScript  
- **Runtime**: Node.js  
- **Networking**: WebSockets (Worker ↔ Master), HTTP (CLI ↔ Master)  
- **UI**: React (Dashboard)  
- **Interface**: CLI Tool + SDKs  

---

## 📂 Project Structure
 `/master → Master node service (metadata manager)`
 `/worker → Worker node service (chunk storage)`
 `/worker → Worker node service (chunk storage)`
 `/sdk/node → Node.js SDK for programmatic use`

## 🚀 Usage

### 1️⃣ Start the Master Node
```bash
cd master
npm install
npm start
```
### 2️⃣ Start Worker Nodes

```bash
cd worker
npm install
npm run dev //8000 default
npm run dev 8001
```
### 3️⃣ Upload a File (CLI)

```bash
npm i -g shardfs
shardfs upload {filename}
shardfs upload video.mp4
```
### 4️⃣ Download a File

```bash
shardf download {filename} {destination}
shardfs download video.mp4 ./downloaded_video.mp4
```

## 📈 Learning Outcomes
- Hands-on understanding of distributed systems.
- Experience in fault tolerance mechanisms like replication.
- Practical exposure to master–worker architecture.
- Development of scalable, resilient storage systems in TypeScript.

### 🔮 Future Scope

- Erasure coding for storage efficiency.
- Multi-master / decentralized architecture.
- Advanced dashboard analytics (alerts, usage graphs).
- Cloud-native deployment with Kubernetes.
### 👨‍💻 Contributors
- [Anchal Jain](https://github.com/Anchal627)
- [Aniket Singh](https://github.com/ROG4113)
- [Piyush Mishra](https://github.com/PiyushXmishra)
- [Yash Bansal](https://github.com/YashXBansal)
