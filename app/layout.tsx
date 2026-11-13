import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Human AI Video",
  description: "Generate photorealistic AI videos of real-looking people in a real 3D world.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
