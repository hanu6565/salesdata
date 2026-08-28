import "./globals.css";

export const metadata = {
  title: "OKPOS 다지점 매출 분석 대시보드",
  description: "외식 프랜차이즈 다지점 매출 데이터를 정제하고 분석해 주는 프리미엄 풀스택 플랫폼",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[#090b11] text-[#f4f4f7] font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

