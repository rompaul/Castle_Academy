import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./ui/styles.css";
import "./ui/mission.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
