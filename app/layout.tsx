import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/overpass/700.css";
import "@fontsource/overpass/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "./tokens.css";
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AnnouncerProvider, ToastProvider } from "@/components/ui";
import { DataClientProvider } from "@/lib/data/DataClientProvider";
import { demoReviewSources } from "@/lib/data/demo-data";
import { demoSourceLine } from "@/lib/data/demo-source";
import { getMode } from "@/lib/mode";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: { default: "UX Critic", template: "%s · UX Critic" },
  description:
    "Design review tool: code measures contrast and sizes from the pixels, Claude evaluates the screen against named UX principles.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const mode = getMode();
  const sourceLine = mode === "demo" ? demoSourceLine(demoReviewSources()) : "";

  return (
    <html lang="en">
      <body>
        <AnnouncerProvider>
          <ToastProvider>
            <DataClientProvider mode={mode}>
              <a href="#main" className={styles.skip}>
                Skip to content
              </a>
              <div className={styles.shell}>
                <Sidebar mode={mode} sourceLine={sourceLine} />
                <main id="main" tabIndex={-1} className={styles.main}>
                  <div className={styles.content}>{children}</div>
                </main>
              </div>
            </DataClientProvider>
          </ToastProvider>
        </AnnouncerProvider>
      </body>
    </html>
  );
}
