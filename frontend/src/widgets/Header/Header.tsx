'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import styles from "./Header.module.css";
import { Dynamicslides } from "./DynamicBanners";
import { Slide, slideAPI } from "~/shared/api/slide";

const SLIDES_CACHE_KEY = "imba_slides_v1";
const SLIDES_CACHE_TTL_MS = 10 * 60 * 1000;

/** Must stay module-scoped — `dynamic()` inside render creates a new component type each time and remounts Swiper (banner blink). */
const Slider = dynamic(() => import('~/shared/ui/Slider').then(m => m.Slider), {
  ssr: false,
});

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

const HeaderComponent: React.FC<HeaderProps> = ({ className }) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);

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

  const slideElements = useMemo(
    () =>
      slides.map((slide, index) => (
        <Dynamicslides
          slide={slide}
          key={`slide-${slide.id}-${index}`}
          priority={index === 0}
        />
      )),
    [slides],
  );

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

    return <Slider className={styles.slider} slides={slideElements} />;
  };

  return (
    <header className={`${styles.Header}${className ? ` ${className}` : ''}`}>
      {renderBannerContent()}
    </header>
  );
};

export const Header = memo(HeaderComponent);

