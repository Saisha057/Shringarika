import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGA, initFacebookPixel } from "./services/analytics";
import { initSentry } from "./services/errorTracking";
import { ErrorBoundary } from "./components/ErrorBoundary";

// DO NOT clear authentication on app load
// Users should stay logged in across sessions

// Initialize Error Tracking
initSentry();

// Initialize Analytics
initGA();
initFacebookPixel();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

console.log("Mounting React app...");
createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
console.log("React app mounted");
