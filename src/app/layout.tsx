import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ConfigureAmplifyClient from './configure-amplify';

const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
// Google Analytics(GA4): main環境のみAmplify Consoleで環境変数を設定する想定。未設定のdevelop/ローカルでは読み込まれない。
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "AWS WordCard | クラウド・ITインフラ用語帳";
const siteDescription = "AWSやクラウド、ネットワーク、セキュリティのIT用語をカード形式で学べる単語帳アプリ。基本用語からAWSの実サービス名まで収録。";

export const metadata = {
  metadataBase: new URL("https://wordcard.link"),
  title: siteTitle,
  description: siteDescription,
  manifest: "/manifest.json",
  icons: {
    icon: ["/icon-192.png", "/icon-512.png"],
    apple: "/icon-192.png",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "https://wordcard.link",
    siteName: "AWS WordCard",
    images: [
      {
        url: "/branding/wordcard-og-image.png",
        width: 900,
        height: 600,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/branding/wordcard-og-image.png"],
  },
};

export const viewport = {
  themeColor: "#60a5fa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* AdSenseのサイト確認クローラーはJSを実行せず静的HTML中の<script>タグを探すため、
            next/scriptの遅延読み込み最適化(__next_sキュー)を経由しない素のscriptタグで出力する */}
        {adsenseClientId && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}
        {gaMeasurementId && (
          <>
            <Script async src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}');
              `}
            </Script>
          </>
        )}
        <ConfigureAmplifyClient />
        {children}
      </body>
    </html>
  );
}