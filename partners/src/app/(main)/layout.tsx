import { Footer } from "@/widgets/Footer";
import { Navigation } from "@/widgets/Navigation";
import type { Metadata } from "next";


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
          <>
              <Navigation />
              {children}
              <Footer />
          </>
    );
}
