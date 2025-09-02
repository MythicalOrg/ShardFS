import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cors from "cors";
import registerRoute from "./routes/register";
import download from "./routes/download";
import getAllFiles from "./routes/getAllFilesInfo";
import deleteRoute from "./routes/delete";
import { serveDashboard } from "./middleware/serveDashboard";
import { attachWebsocket } from "./ws/wsServer";
import { PORT } from "./config/constants";
import { log } from "./utils/logger";
import path from "path";

const app = express();

// middlewares
app.use(bodyParser.json({ limit: "10mb" }));
app.use(cors());

// routes
app.use("/api", registerRoute);
app.use("/api", download);
app.use("/api", getAllFiles);
app.use("/api", deleteRoute);

// serve react dashboard - expects build in /react-build
serveDashboard(app, path.join(process.cwd(), "src/react-dist/dist"));

const server = http.createServer(app);

// attach ws
attachWebsocket(server);

server.listen(PORT, () => {
  log(`ShardFS Master running on http://localhost:${PORT}`);
  log(`Dashboard available at http://localhost:${PORT}/dashboard`);
});
