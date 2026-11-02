import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contigoo Cinematic Studio",
  description: "Your vision. Your models. An independent, open-model cinematic workspace by Contigoo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
