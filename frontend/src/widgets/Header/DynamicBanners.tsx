  'use client';
import Image from 'next/image';
import { Slide } from '~/shared/api/slide';
import styles from './SlidesMock.module.css';

interface DynamicslideSlideProps {
  slide: Slide;
  priority?: boolean;
}

const BANNER_SIZES = "(max-width: 767px) 100vw, (max-width: 1200px) 720px, 960px";

const clampPct = (value?: number, fallback = 50) =>
  Math.max(0, Math.min(100, typeof value === 'number' ? value : fallback));

const buildTextPosStyle = (
  x?: number,
  y?: number,
  mobileX?: number,
  mobileY?: number,
  defaultY = 50,
): React.CSSProperties | undefined => {
  const hasPos = [x, y, mobileX, mobileY].some((v) => typeof v === 'number');
  if (!hasPos) return undefined;

  return {
    ['--slide-text-x' as string]: `${clampPct(x)}%`,
    ['--slide-text-y' as string]: `${clampPct(y, defaultY)}%`,
    ...(typeof mobileX === 'number'
      ? { ['--slide-text-mobile-x' as string]: `${clampPct(mobileX)}%` }
      : {}),
    ...(typeof mobileY === 'number'
      ? { ['--slide-text-mobile-y' as string]: `${clampPct(mobileY, defaultY)}%` }
      : {}),
  } as React.CSSProperties;
};

const DynamicslideSlide: React.FC<DynamicslideSlideProps> = ({ slide, priority = false }) => {
  const handleClick = () => {
    if (slide.linkUrl) {
      window.open(slide.linkUrl, '_blank');
    }
  };

  const getBaseUrl = () => process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';

  const imageSource = slide.imagePath
    ? `${getBaseUrl()}/${slide.imagePath}`
    : slide.imageUrl
      ? slide.imageUrl
      : `${getBaseUrl()}/public/slides/default.png`;

  const getTextPositionStyles = () => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 2,
    };

    switch (slide.textPosition) {
      case 'left':
        baseStyles.left = `${20 + (slide.textOffsetX || 0)}px`;
        baseStyles.textAlign = 'left';
        break;
      case 'right':
        baseStyles.right = `${20 - (slide.textOffsetX || 0)}px`;
        baseStyles.textAlign = 'right';
        break;
      case 'center':
      default:
        baseStyles.left = '50%';
        baseStyles.transform = `translateX(-50%) translateX(${slide.textOffsetX || 0}px)`;
        baseStyles.textAlign = 'center';
        break;
    }

    switch (slide.textVerticalPos) {
      case 'top':
        baseStyles.top = `${20 + (slide.textOffsetY || 0)}px`;
        break;
      case 'bottom':
        baseStyles.bottom = `${20 - (slide.textOffsetY || 0)}px`;
        break;
      case 'center':
      default:
        baseStyles.top = '50%';
        if (baseStyles.transform) {
          baseStyles.transform += ` translateY(-50%) translateY(${slide.textOffsetY || 0}px)`;
        } else {
          baseStyles.transform = `translateY(-50%) translateY(${slide.textOffsetY || 0}px)`;
        }
        break;
    }

    return baseStyles;
  };

  const titleDesktopSize = slide.titleSize ?? 28;
  const titleMobileSize = slide.titleMobileSize ?? titleDesktopSize;
  const descDesktopSize = slide.descSize ?? 13;
  const descMobileSize = slide.descMobileSize ?? descDesktopSize;
  const buttonDesktopSize = slide.buttonSize ?? 14;
  const buttonMobileSize = slide.buttonMobileSize ?? buttonDesktopSize;

  const titleStyles: React.CSSProperties = {
    color: slide.titleColor || '#ffffff',
    ['--slide-title-size' as string]: `${titleDesktopSize}px`,
    ['--slide-title-mobile-size' as string]: `${titleMobileSize}px`,
    textShadow: slide.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
    margin: 0,
    fontWeight: 700,
    lineHeight: 1.2,
    width: '100%',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  };

  const descriptionStyles: React.CSSProperties = {
    color: slide.descColor || '#ffffff',
    ['--slide-desc-size' as string]: `${descDesktopSize}px`,
    ['--slide-desc-mobile-size' as string]: `${descMobileSize}px`,
    textShadow: slide.textShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
    margin: 0,
    lineHeight: 1.4,
    width: '100%',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  };

  const titlePosStyle = buildTextPosStyle(
    slide.titlePosXPct,
    slide.titlePosYPct,
    slide.titleMobilePosXPct,
    slide.titleMobilePosYPct,
    40,
  );

  const descPosStyle = buildTextPosStyle(
    slide.descPosXPct,
    slide.descPosYPct,
    slide.descMobilePosXPct,
    slide.descMobilePosYPct,
    55,
  );

  const hasCustomButtonPos =
    typeof slide.buttonPosXPct === 'number' ||
    typeof slide.buttonPosYPct === 'number';

  const buttonPosStyle = hasCustomButtonPos
    ? ({
        ['--slide-btn-x' as string]: `${clampPct(slide.buttonPosXPct)}%`,
        ['--slide-btn-y' as string]: `${clampPct(slide.buttonPosYPct, 70)}%`,
        ['--slide-btn-size' as string]: `${buttonDesktopSize}px`,
        ['--slide-btn-mobile-size' as string]: `${buttonMobileSize}px`,
        ...(typeof slide.buttonMobilePosXPct === 'number'
          ? { ['--slide-btn-mobile-x' as string]: `${clampPct(slide.buttonMobilePosXPct)}%` }
          : {}),
        ...(typeof slide.buttonMobilePosYPct === 'number'
          ? { ['--slide-btn-mobile-y' as string]: `${clampPct(slide.buttonMobilePosYPct, 70)}%` }
          : {}),
      } as React.CSSProperties)
    : undefined;

  const buttonInlineStyle: React.CSSProperties = {
    ['--slide-btn-size' as string]: `${buttonDesktopSize}px`,
    ['--slide-btn-mobile-size' as string]: `${buttonMobileSize}px`,
  } as React.CSSProperties;

  const useLegacyTextBlock = !titlePosStyle && !descPosStyle && !!slide.title;

  return (
    <div
      className={`${styles.slide} ${styles.slide2}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {imageSource && (
        <Image
          alt={slide.title}
          className={`${styles.slideImage} ${styles.slide2Image}`}
          src={imageSource}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          sizes={BANNER_SIZES}
          fill
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      )}

      {slide.showButton && slide.buttonText && (
        hasCustomButtonPos ? (
          <div className={styles.slideButtonPos} style={buttonPosStyle}>
            <button
              type="button"
              className={styles.slideButton}
              onClick={handleClick}
              style={{
                cursor: slide.linkUrl ? 'pointer' : 'default',
                ...buttonInlineStyle,
              }}
            >
              {slide.buttonText}
            </button>
          </div>
        ) : (
          <div className={styles.slideButtonWrapper}>
            <button
              type="button"
              className={styles.slideButton}
              onClick={handleClick}
              style={{
                cursor: slide.linkUrl ? 'pointer' : 'default',
                ...buttonInlineStyle,
              }}
            >
              {slide.buttonText}
            </button>
          </div>
        )
      )}

      {slide.title && (slide.showTitle ?? true) && titlePosStyle && (
        <div className={styles.slideTextPos} style={titlePosStyle}>
          <div className={styles.slideTitleText} style={titleStyles}>{slide.title}</div>
        </div>
      )}

      {slide.description && (slide.showDesc ?? true) && descPosStyle && (
        <div className={styles.slideTextPos} style={descPosStyle}>
          <div className={styles.slideDescText} style={descriptionStyles}>{slide.description}</div>
        </div>
      )}

      {useLegacyTextBlock && (
        <div style={getTextPositionStyles()}>
          <div className={styles.slideTitleText} style={titleStyles}>{slide.title}</div>
          {slide.description && (
            <div className={styles.slideDescText} style={descriptionStyles}>{slide.description}</div>
          )}
        </div>
      )}
    </div>
  );
};

interface DynamicslidesProps {
  slide: Slide;
  priority?: boolean;
}

export const Dynamicslides: React.FC<DynamicslidesProps> = ({ slide, priority }) => {
  return <DynamicslideSlide slide={slide} priority={priority} />;
};
