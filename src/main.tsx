import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "./theme-overrides.css";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { SettingsProvider } from "./settings/SettingsContext";

// Taman Kuda Club brand (UAT#3 BRANDING). Primary = the brand maroon (#801e2b,
// Pantone 1815 C); brand font is Gill Sans. Explicit color="teal" usages stay teal
// as a "success / on-site" semantic — only default-primary elements turn maroon.
const theme = createTheme({
  primaryColor: "tkc",
  primaryShade: { light: 8, dark: 6 },
  colors: {
    tkc: [
      "#fdecef", "#f4d3d9", "#e6a7b1", "#d97a88", "#ce5366",
      "#c73a50", "#c32c44", "#a92338", "#801e2b", "#5e141d",
    ],
    // Brand secondaries from the Taman Kuda palette (the Malaysian-flag accents),
    // used as identity/accent colours (roles, activities) — not as state semantics.
    gold: [
      "#fff8e1", "#ffefc0", "#ffe299", "#ffd166", "#ffc23d",
      "#f7b016", "#e09a00", "#bd7f00", "#996600", "#7a5100",
    ],
    royal: [
      "#ecedfb", "#cccef0", "#a7abe4", "#8286d9", "#6167cf",
      "#4a50c7", "#3238a8", "#282d86", "#1f2368", "#15184a",
    ],
  },
  defaultRadius: "md",
  fontFamily: '"Gill Sans Nova", "Gill Sans", "Gill Sans MT", Calibri, "Segoe UI", system-ui, sans-serif',
  headings: {
    fontFamily: '"Gill Sans Nova", "Gill Sans", "Gill Sans MT", Calibri, "Segoe UI", system-ui, sans-serif',
  },
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SettingsProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </SettingsProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>,
);
