import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/appverse-theme.css";

// CONSOLE SILENCER — suppress non-critical noise in production only.
// Keeps console.error intact so real failures stay visible.
if (import.meta.env.PROD) {
  const NOISE = [
    "invalid_union", "WebSocket", "realtime", "Multiple GoTrueClient",
    "channel error", "[Cart]", "[RoleProtectedRoute]", "Skipping public profile",
    "DevTools", "deprecated", "Download the React",
  ];
  const shouldSilence = (args: unknown[]) =>
    args.some((a) => typeof a === "string" && NOISE.some((n) => a.includes(n)));
  const origWarn = console.warn;
  const origLog = console.log;
  const origInfo = console.info;
  console.warn = (...args: unknown[]) => { if (!shouldSilence(args)) origWarn(...args); };
  console.log = (...args: unknown[]) => { if (!shouldSilence(args)) origLog(...args); };
  console.info = (...args: unknown[]) => { if (!shouldSilence(args)) origInfo(...args); };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
