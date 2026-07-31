'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import { useHomeHeroFeatured } from '~/entities/cybersport/hooks/useHomeHeroFeatured';
import { CyberHomeHeroBanner } from '~/entities/cybersport/ui/CyberHomeHeroBanner';
import { Slide, slideAPI } from '~/shared/api/slide';

import { Dynamicslides } from './DynamicBanners';
import styles from './Header.module.css';

const SLIDES_CACHE_KEY = 'imba_slides_v1';
const SLIDES_CACHE_TTL_MS = 10 * 60 * 1000;

/** Must stay module-scoped — `dynamic()` inside render creates a new component type each time and remounts Swiper (banner blink). */
const Slider = dynamic(() => import('~/shared/ui/Slider').then((m) => m.Slider), {
  ssr: false,
});

function readSlidesCache(): Slide[] | null {
  if (typeof window === 'undefined') return null;
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
  const pathname = usePathname();
  const isHome = pathname === '/' || pathname === '';
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);

  const heroQuery = useHomeHeroFeatured();
  // Wait until hero pool has resolved once — otherwise promo slides flash, then swap.
  const heroReady = !isHome || heroQuery.isFetched || heroQuery.isError;
  const hasMatchHero = useMemo(() => {
    if (!isHome || !heroReady) return false;
    return (heroQuery.data?.length ?? 0) > 0;
  }, [heroQuery.data, heroReady, isHome]);

  useEffect(() => {
    if (isHome && !heroReady) {
      return;
    }

    if (isHome && hasMatchHero) {
      setLoading(false);
      return;
    }

    const cached = readSlidesCache();
    if (cached?.length) {
      setSlides(cached);
      setLoading(false);
    }

    let cancelled = false;
    const fetchSlides = async () => {
      try {
        const activeSlides = await slideAPI.getActiveSlides();
        if (cancelled) return;
        const sortedSlides = activeSlides.sort((a, b) => a.order - b.order);
        setSlides(sortedSlides);
        if (sortedSlides.length > 0) writeSlidesCache(sortedSlides);
      } catch (error) {
        console.error('Error loading slides:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchSlides();
    return () => {
      cancelled = true;
    };
  }, [heroReady, hasMatchHero, isHome]);

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
    // Home: hold a shell until match hero is known — never flash promo slides first.
    if (isHome && !heroReady) {
      return <div aria-hidden className={styles.bannerShell} />;
    }

    if (isHome && hasMatchHero) {
      return (
        <div className={styles.cyberHero}>
          <CyberHomeHeroBanner />
        </div>
      );
    }

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
