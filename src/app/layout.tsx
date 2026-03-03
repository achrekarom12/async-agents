import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Agents",
    description: "Minimal AI Chat Frontend",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
            <body className="antialiased">
                <TooltipProvider>{children}</TooltipProvider>
            </body>
        </html>
    );
}
