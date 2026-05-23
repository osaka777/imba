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
  return (
    <Swiper
      autoplay={{ delay: 5000, disableOnInteraction: false }}
      className={`${styles.Slider} ${className}`}
      loop={slides.length > 1}
      modules={[Navigation, Pagination, Autoplay]}
      navigation={{ nextEl: `.${styles.nextEl}`, prevEl: `.${styles.prevEl}` }}
      pagination={{ clickable: true, dynamicBullets: true }}
      slidesPerView={1}
    >
      {slides.map((slide, index) => {
        return (
          <SwiperSlide className={styles.slide} key={index}>
            {slide}
          </SwiperSlide>
        );
      })}
      <Button className={`${styles.navEl} ${styles.nextEl} a`}>
        {<ArrowIcon className={`${styles.navIcon} ${styles.navIcon_next}`} />}
      </Button>
      <Button className={`${styles.navEl} ${styles.prevEl}`}>
        {<ArrowIcon className={`${styles.navIcon} ${styles.navIcon_prev}`} />}
      </Button>
    </Swiper>
  );
};
