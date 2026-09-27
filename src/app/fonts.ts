import {Playfair_Display, Be_Vietnam_Pro, Geist_Mono, Oswald, JetBrains_Mono, Playpen_Sans, Inter} from "next/font/google";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin", "vietnamese"],
});

// Chữ hẹp, đậm cho áp phích và tiêu đề vé
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin", "vietnamese"],
});

// Chữ nhỏ kiểu vé (nhãn, số seri); cần subset vietnamese vì có tên nghệ sĩ tiếng Việt
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "vietnamese"],
});

// Hai font đã nạp sẵn để dùng khi cần (chưa áp vào đâu): class Tailwind là `font-jetbrains-mono` và `font-playpen-sans`
// (khai báo ở @theme trong globals.css). Cả hai đều có subset vietnamese và là font biến thiên nên chọn được mọi độ đậm.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
});

const playpenSans = Playpen_Sans({
  variable: "--font-playpen-sans",
  subsets: ["latin", "vietnamese"],
});

// Nạp sẵn để dùng khi cần (chưa áp vào đâu): class Tailwind là `font-inter` (khai báo ở @theme trong globals.css).
// Font biến thiên, có subset vietnamese nên chọn được mọi độ đậm.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

// Chuỗi class biến font gắn lên <html> ở mọi root layout (công khai vi/en, admin, global-error)
export const FONT_CLASSES = `${beVietnamPro.variable} ${playfairDisplay.variable} ${oswald.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${playpenSans.variable} ${inter.variable}`;
