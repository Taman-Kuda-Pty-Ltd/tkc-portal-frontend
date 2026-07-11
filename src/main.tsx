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
