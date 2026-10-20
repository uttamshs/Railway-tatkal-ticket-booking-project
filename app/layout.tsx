import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dash — Smart Rail Journey Planner",
  description:
    "A Jaipur–Delhi railway journey planner focused on group decisions, live availability and explainable recommendations.",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light-theme" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('dash_theme');var t=(s==='dark'||s==='light')?s:'light';var cl=document.documentElement.classList;cl.remove('dark-theme','light-theme');cl.add(t+'-theme');document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="light-theme" data-theme="light" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
