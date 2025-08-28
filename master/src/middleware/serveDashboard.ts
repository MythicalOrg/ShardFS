import express from "express";
import path from "path";

export function serveDashboard(
  app: express.Application,
  reactBuildPath = path.join(process.cwd(), "src/react-build/dist")
) {
  // Serve React build assets
  app.use("/dashboard", express.static(reactBuildPath));

  // Wildcard for React router
  app.get("/dashboard/{*path}", (req, res) => {
    res.sendFile(path.join(reactBuildPath, "index.html"));
  });
}
