'use client';

import { useState, useEffect } from 'react';
import { AuthForm, verifyUser } from "~/entities/user";
import dynamic from 'next/dynamic';
import styles from "./Header.module.css";
// import { BonusBibikaBanner } from "~/entities/bet/ui/Coupon/components/BonusBibikaBanner";
// import { BonusBonusBanner } from "~/entities/bet/ui/Coupon/components/BonusBonusBanner";
import { Dynamicslides } from "./DynamicBanners";
import { useAuth } from "~/app/providers/AuthProvider";
import { Slide, slideAPI } from "~/shared/api/slide";

const SLIDES_CACHE_KEY = "imba_slides_v1";
const SLIDES_CACHE_TTL_MS = 10 * 60 * 1000;

function readSlidesCache(): Slide[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SLIDES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; slides: Slide[] };
    if (Date.now() - parsed.ts > SLIDES_CACHE_TTL_MS) return null;
    return parsed.slides;
  } catch {
    return null;
  }
}

function writeSlidesCache(slides: Slide[]) {
  try {
    sessionStorage.setItem(
      SLIDES_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), slides }),
    );
  } catch {
    /* quota */
  }
}

type HeaderProps = {
  className?: string;
};

export const Header: React.FC<HeaderProps> = ({ className }) => {
  const { isAuth } = useAuth();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  // Lazy-load Slider (and therefore Swiper) only when needed
  const Slider = dynamic(() => import('~/shared/ui/Slider').then(m => m.Slider), {
    ssr: false,
  });

  useEffect(() => {
    const cached = readSlidesCache();
    if (cached?.length) {
      setSlides(cached);
      setLoading(false);
    }

    const fetchSlides = async () => {
      try {
        const activeSlides = await slideAPI.getActiveSlides();
        const sortedSlides = activeSlides.sort((a, b) => a.order - b.order);
        setSlides(sortedSlides);
        if (sortedSlides.length > 0) writeSlidesCache(sortedSlides);
      } catch (error) {
        console.error('Error loading slides:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchSlides();
  }, []);

  useEffect(() => {
    const getWidth = () => (typeof window !== 'undefined' ? window.innerWidth : 1088);
    const handleResize = () => setIsMobile(getWidth() <=  1088);
    handleResize();
    if (typeof window !== 'undefined') {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
    return () => {};
  }, []);

  const renderBannerContent = () => {
    if (loading || slides.length === 0) {
      return <div aria-hidden className={styles.slider} />;
    }

    if (slides.length === 1) {
      return (
        <div className={styles.slider}>
          <Dynamicslides slide={slides[0]} key="dynamic-single" priority />
        </div>
      );
    }

    // Если несколько баннеров, используем слайдер
    return (
      <Slider
        className={styles.slider}
        slides={slides.map((slide, index) => (
          <Dynamicslides slide={slide} key={`slide-${slide.id}-${index}`} priority={index === 0} />
        ))}
      />
    );
  };

  return (
    <header className={`${styles.Header} ${className}`}>
      {/* {!isAuth && <AuthForm className={styles.authForm} />} */}
        {renderBannerContent()}
       {/* <div className={styles.mobilePromos}>
          <BonusBibikaBanner />
          <BonusBonusBanner />
        </div> */}
    </header>
  );
};

