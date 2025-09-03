import express from "express";
import path from "path";

export function serveDashboard(
  app: express.Application,
  reactBuildPath:string
) {
  // Serve React build assets
  console.log("Serving dashboard from:", process.cwd());
  console.log("React build path:", reactBuildPath);
  app.use("/dashboard", express.static(reactBuildPath));

  // Wildcard for React router
  app.get("/dashboard/{*path}", (req, res) => {
    res.sendFile(path.join(reactBuildPath, "index.html"));
  });
}
