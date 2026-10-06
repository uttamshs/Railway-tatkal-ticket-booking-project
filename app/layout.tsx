import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
 title: "Dash — Smart Rail Journey Planner",
 description: "A Jaipur–Delhi railway journey planner focused on group decisions, live availability and explainable recommendations.",
 icons: { icon: "/icon.png" },
};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
