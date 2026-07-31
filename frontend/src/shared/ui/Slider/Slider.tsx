"use client";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { ArrowIcon } from "~/shared/assets";

import { Button } from "../Button";
import styles from "./Slider.module.css";

export type SliderProps = {
  className?: string;
  slides: React.JSX.Element[];
};

export const Slider: React.FC<SliderProps> = ({ className, slides }) => {
  const hasMultipleSlides = slides.length > 1;
  const modules = hasMultipleSlides
    ? [Navigation, Pagination, Autoplay]
    : [Autoplay];

  return (
    <Swiper
      autoplay={{ delay: 5000, disableOnInteraction: false }}
      className={`${styles.Slider} ${className}`}
      loop={hasMultipleSlides}
      modules={modules}
      navigation={
        hasMultipleSlides
          ? { nextEl: `.${styles.nextEl}`, prevEl: `.${styles.prevEl}` }
          : undefined
      }
      pagination={hasMultipleSlides ? { clickable: true, dynamicBullets: false } : false}
      slidesPerView={1}
    >
      {slides.map((slide, index) => {
        return (
          <SwiperSlide className={styles.slide} key={index}>
            {slide}
          </SwiperSlide>
        );
      })}
      {hasMultipleSlides ? (
        <>
          <Button className={`${styles.navEl} ${styles.prevEl}`} aria-label="Previous slide">
            <ArrowIcon className={`${styles.navIcon} ${styles.navIcon_prev}`} />
          </Button>
          <Button className={`${styles.navEl} ${styles.nextEl}`} aria-label="Next slide">
            <ArrowIcon className={`${styles.navIcon} ${styles.navIcon_next}`} />
          </Button>
        </>
      ) : null}
    </Swiper>
  );
};
