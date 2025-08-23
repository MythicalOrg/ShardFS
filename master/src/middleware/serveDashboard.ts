// import express from "express";
// import path from "path";

// export function serveDashboard(
//   app: express.Application,
//   reactBuildPath = path.join(process.cwd(), "react-build")
// ) {
//   // serve static assets
//   app.use(
//     "/dashboard/",
//     express.static(path.join(reactBuildPath, "static"))
//   );

//   // wildcard route - map /dashboard/* to react-build/index.html
//   app.get("/dashboard/{*path}", (req, res) => {
//     res.sendFile(path.join(reactBuildPath, "index.html"));
//   });

// }

// // Work to be done in this for dashboard enhancements
