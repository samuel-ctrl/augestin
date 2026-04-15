import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

console.log(
  "%cAJ EduTrack %c· crafted by Samuel %c→ https://samuel-portfolio.pages.dev/",
  "color: #facc15; font-weight: bold; font-size: 14px;",
  "color: #22d3ee; font-size: 12px;",
  "color: #60a5fa; font-size: 12px;"
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
