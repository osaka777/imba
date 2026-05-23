import { ReactNode, Suspense } from "react";

import { Metadata } from "next";
import Script from "next/script";
import "react-toastify/dist/ReactToastify.min.css";
import "~/shared/ui/styles/index.css"; 

import { Footer } from "~/widgets/Footer";
import { HeaderLineTop } from "~/widgets/HeaderTop";
import { MobileNavigation } from "~/widgets/MobileNavigation";
import { Navigation } from "~/widgets/Navigation";
import { Provider } from "~/widgets/Provider";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { CurrencyProvider } from "~/app/providers/CurrencyProvider";
import { YandexMetrika } from "~/shared/metrics";
import { init } from "~/shared/lib";
import { preloadPopularPages } from "~/shared/lib/preload";
import { GamesBettingProvider } from "~/app/providers/GamesBetting.provider";
import { AuthProvider } from "~/app/providers/AuthProvider";
import { RealtimeProviders } from "~/app/providers/RealtimeProviders";
import { languageService } from "~/shared/services/language.service";
import { AppToastContainer } from "~/shared/ui/Toast";

export const metadata: Metadata = {
  description: "Лучшие ставки на спорт онлайн — высокие коэффициенты и бонусы!",
  title: "Лучшие ставки на спорт онлайн — высокие коэффициенты и бонусы!",
};

// Компонент для предзагрузки данных
const PreloadData = () => {
  if (typeof window !== 'undefined') {
    // Добавляем глобальный обработчик unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      // Предотвращаем показ ошибки в консоли браузера
      event.preventDefault();
    });
    
    // Предзагружаем данные после загрузки страницы с увеличенной задержкой
    setTimeout(() => {
      preloadPopularPages();
    }, 3000);
  }
  return null;
};

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
        <meta property="og:title" content="Лучшие ставки на спорт онлайн — высокие коэффициенты и бонусы!" />
        <meta property="og:description" content="Делайте ставки на спорт с лучшими коэффициентами и быстрыми выплатами. Получите бонус за регистрацию!" />
        {/* Предзагрузка критичных ресурсов */}
        <link rel="dns-prefetch" href="//cdn.incub.space" />
        <link rel="dns-prefetch" href="//upload.wikimedia.org" />
        <link rel="dns-prefetch" href="//flagcdn.com" />
      </head>
      <body>
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
          strategy="afterInteractive"
        />
        <Suspense fallback={<></>}>
          <YandexMetrika />
        </Suspense>
        <div id="root">
          <CurrencyProvider>
            <Provider>
              <AuthProvider>
                <RealtimeProviders>
                  <HeaderLineTop />
                  <Navigation />
                  {children}
                  <Footer />
                  <ReactQueryDevtools />
                  <PreloadData />
                </RealtimeProviders>
              </AuthProvider>
            </Provider>
          </CurrencyProvider>
        </div>
        <MobileNavigation />
        <AppToastContainer />
      </body>
    </html>
  );
}
