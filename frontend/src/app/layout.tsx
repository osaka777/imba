import { ReactNode, Suspense } from "react";

import { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "react-toastify/dist/ReactToastify.min.css";
import "~/shared/ui/styles/index.css"; 

import { FooterDeferred } from "~/widgets/Footer/FooterDeferred";
import { HeaderLineTop } from "~/widgets/HeaderTop";
import { MobileNavigation } from "~/widgets/MobileNavigation";
import { RootNav } from "~/widgets/Navigation/RootNav";
import { Provider } from "~/widgets/Provider";
import shellStyles from "~/app/SiteShell.module.css";
import { PreloadData } from "~/app/PreloadData";
import { FontsExtendedLoader } from "~/app/FontsExtendedLoader";
import { QueryDevtoolsGate } from "~/app/providers/QueryDevtoolsGate";
import { CurrencyProvider } from "~/app/providers/CurrencyProvider";
import { LocaleProvider } from "~/app/providers/LocaleProvider";
import { YandexMetrika } from "~/shared/metrics";
import { init } from "~/shared/lib";
import { AuthProvider } from "~/app/providers/AuthProvider";
import { RealtimeProviders } from "~/app/providers/RealtimeProviders";
import { languageService } from "~/shared/services/language.service";
import { AppToastContainer } from "~/shared/ui/Toast";
import { LiveSupportChat } from "~/widgets/LiveSupportChat";
import { SupportChatModalHost } from "~/widgets/SupportChatModalHost";
import { AppPushProvider } from "~/entities/push/providers/AppPushProvider";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  description:
    "Imba.bet — ставки на спорт: live и линия на футбол, теннис и киберспорт. Пополнение Kaspi и USDT.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_HOST || "https://imba.bet"),
  openGraph: {
    locale: "ru_RU",
    siteName: "Imba.bet",
    type: "website",
  },
  title: {
    default: "Imba.bet — ставки на спорт онлайн",
    template: "%s — Imba.bet",
  },
  verification: {
    yandex: "9c1017629c3a6211",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Компонент предзагрузки вынесен в ~/app/PreloadData.tsx (client)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const _ = init;
  const defaultLanguage = languageService.getDefaultLanguage();
  return (
    <html className="dark" lang={defaultLanguage} data-scroll-behavior="smooth">
      <head>
        {/* Предзагрузка критичных ресурсов */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/app-icon-192.png" />
        <meta name="theme-color" content="#090F1E" />
        <link rel="dns-prefetch" href="//cdn.incub.space" />
        <link rel="dns-prefetch" href="//upload.wikimedia.org" />
        <link rel="dns-prefetch" href="//flagcdn.com" />
      </head>
      <body className={inter.variable}>
        <Script
          dangerouslySetInnerHTML={{
            __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
              (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

              ym(98703324, "init", {
                    defer: true,
                    clickmap:true,
                    trackLinks:true,
                    accurateTrackBounce:true,
                    webvisor:true
              });`,
          }}
          id="metrika-counter"
          strategy="afterInteractive"
        />
        <Script
          dangerouslySetInnerHTML={{
            __html:
              'var _tmr = window._tmr || (window._tmr = []); _tmr.push({id: "3569387", type: "pageView", start: (new Date()).getTime()}); (function (d, w, id) {if (d.getElementById(id)) return; var ts = d.createElement("script"); ts.type = "text/javascript"; ts.async = true; ts.id = id; ts.src = "https://top-fwz1.mail.ru/js/code.js"; var f = function () {var s = d.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ts, s);};if (w.opera == "[object Opera]") { d.addEventListener("DOMContentLoaded", f, false); } else { f(); }})(document, window, "tmr-code");',
          }}
          id="mail-counter"
          strategy="lazyOnload"
        />
        <Suspense fallback={<></>}>
          <YandexMetrika />
        </Suspense>
        <div id="root">
          <CurrencyProvider>
            <LocaleProvider>
              <Provider>
                <AuthProvider>
                  <AppPushProvider>
                    <RealtimeProviders>
                    <div className={shellStyles.siteShell}>
                      <div className={`${shellStyles.fullBleed} ${shellStyles.topBar}`}>
                        <HeaderLineTop />
                      </div>
                      <RootNav />
                      <div className={shellStyles.siteMain}>{children}</div>
                      <div className={shellStyles.fullBleed}>
                        <FooterDeferred />
                      </div>
                    </div>
                    <QueryDevtoolsGate />
                    <PreloadData />
                    <FontsExtendedLoader />
                    </RealtimeProviders>
                  </AppPushProvider>
                  <LiveSupportChat />
                  <SupportChatModalHost />
                  <MobileNavigation />
                </AuthProvider>
              </Provider>
            </LocaleProvider>
          </CurrencyProvider>
        </div>
        <AppToastContainer />
      </body>
    </html>
  );
}
