import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app container");

createRoot(container).render(<App />);
