import { Fraunces, Inter } from "next/font/google";

// Same faces as thevaryboard.com.
export const fontSans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const fontDisplay = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"] });
