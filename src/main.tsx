import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

if (location.protocol !== "file:") {
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
