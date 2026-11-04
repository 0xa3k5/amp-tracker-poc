import { StrictMode } from "react"
import { EDSProvider, Pane } from "@edgeandnode/eds-react"
import { createRoot } from "react-dom/client"

import { App } from "./App.tsx"

import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EDSProvider persistTheme="localStorage">
      <Pane.Provider>
        <App />
      </Pane.Provider>
    </EDSProvider>
  </StrictMode>,
)
