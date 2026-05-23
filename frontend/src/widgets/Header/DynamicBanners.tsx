  'use client';
import Image from 'next/image';
import { Slide } from '~/shared/api/slide';
import styles from './SlidesMock.module.css';

interface DynamicslideSlideProps {
  slide: Slide;
}

const DynamicslideSlide: React.FC<DynamicslideSlideProps> = ({ slide }) => {
  const handleClick = () => {
    if (slide.linkUrl) {
      window.open(slide.linkUrl, '_blank');
    }
  };

  // Позиция кнопки (если заданы проценты)
  const getButtonPositionStyles = (): React.CSSProperties | null => {
    if (
      typeof (slide as any).buttonPosXPct === 'number' &&
      typeof (slide as any).buttonPosYPct === 'number'
    ) {
      return {
        position: 'absolute',
        left: `${Math.max(0, Math.min(100, (slide as any).buttonPosXPct))}%`,
        top: `${Math.max(0, Math.min(100, (slide as any).buttonPosYPct))}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
        textAlign: 'center',
      };
    }
    return null;
  };

  
  // Получаем базовый URL для изображений
  const getBaseUrl = () => {
    // Всегда используем NEXT_PUBLIC_HOST для изображений
    return process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';
  };

  // Определяем источник изображения (приоритет backend-пути imagePath)
  const imageSource = slide.imagePath
    ? `${getBaseUrl()}/${slide.imagePath}`
    : slide.imageUrl
      ? slide.imageUrl
      : `${getBaseUrl()}/public/slides/default.png`;

  // Стили для позиционирования текста (legacy общий блок)
  const getTextPositionStyles = () => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 2,
    };

    // Горизонтальное позиционирование
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

    // Вертикальное позиционирование
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

  // Новые независимые позиции (если заданы проценты)
  const getTitlePositionStyles = (): React.CSSProperties | null => {
    if (
      typeof slide.titlePosXPct === 'number' &&
      typeof slide.titlePosYPct === 'number'
    ) {
      return {
        position: 'absolute',
        left: `${Math.max(0, Math.min(100, slide.titlePosXPct))}%`,
        top: `${Math.max(0, Math.min(100, slide.titlePosYPct))}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
        textAlign: 'center',
      };
    }
    return null;
  };

  const getDescPositionStyles = (): React.CSSProperties | null => {
    if (
      typeof slide.descPosXPct === 'number' &&
      typeof slide.descPosYPct === 'number'
    ) {
      return {
        position: 'absolute',
        left: `${Math.max(0, Math.min(100, slide.descPosXPct))}%`,
        top: `${Math.max(0, Math.min(100, slide.descPosYPct))}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
        textAlign: 'center',
      };
    }
    return null;
  };

  // Стили для заголовка
  const titleStyles: React.CSSProperties = {
    color: slide.titleColor || '#ffffff',
    // делаем шрифт адаптивным: минимум 16px, желаемое из БД, максимум ~6vw
    fontSize: slide.titleSize
      ? `clamp(20px, ${slide.titleSize}px, 6vw)`
      : 'clamp(20px, 48px, 6vw)',
    textShadow: slide.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
    margin: 0,
    marginBottom: slide.description ? '8px' : 0,
    fontWeight: 700,
    lineHeight: 1.2,
    width: '100%',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  };

  // Стили для описания
  const descriptionStyles: React.CSSProperties = {
    color: slide.descColor || '#ffffff',
    // адаптивный размер: минимум 12px, желаемое из БД, максимум ~4.5vw
    fontSize: slide.descSize
      ? `clamp(12px, ${slide.descSize}px, 4.5vw)`
      : 'clamp(12px, 13px, 4.5vw)',
    textShadow: slide.textShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
    margin: 0,
    lineHeight: 1.4,
    maxWidth: '90%',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  };

  const titlePos = getTitlePositionStyles();
  const descPos = getDescPositionStyles();
  const buttonPos = getButtonPositionStyles();

  return (
    <div 
      className={`${styles.slide} ${styles.slide2}`}
      style={{ 
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {imageSource && (
        <Image
          alt={slide.title}
          className={`${styles.slideImage} ${styles.slide2Image}`}
          src={imageSource}
          priority
          fill
          style={{ 
            objectFit: 'cover',
            objectPosition: 'center'
          }}
        />
      )}

      {/* Кнопка */}
      {(slide as any).showButton && (slide as any).buttonText && (
        buttonPos ? (
          <div style={buttonPos}>
            <button
              onClick={handleClick}
              style={{
                background: 'white',
                color: 'black',
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.15,
                cursor: slide.linkUrl ? 'pointer' : 'default',
              }}
            >
              {(slide as any).buttonText}
            </button>
          </div>
        ) : (
          // дефолтная позиция (низ по центру)
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '24px',
              transform: 'translateX(-50%)',
              zIndex: 2,
            }}
          >
            <button
              onClick={handleClick}
              style={{
                background: 'white',
                color: 'black',
                padding: '12px 16px',
                borderRadius: 8,
                border: 'none',
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.15,
                cursor: slide.linkUrl ? 'pointer' : 'default',
              }}
            >
              {(slide as any).buttonText}
            </button>
          </div>
        )
      )}
      {/* Независимое позиционирование, если есть проценты */}
      {slide.title && (slide.showTitle ?? true) && (
        titlePos ? (
          <div style={titlePos}>
            <div style={titleStyles}>{slide.title}</div>
          </div>
        ) : null
      )}
      {slide.description && (slide.showDesc ?? true) && (
        descPos ? (
          <div style={descPos}>
            <div style={descriptionStyles}>{slide.description}</div>
          </div>
        ) : null
      )}

      {/* Fallback: общий блок legacy, если проценты не заданы ни для заголовка, ни для описания */}
      {(!titlePos && !descPos && slide.title) && (
        <div style={getTextPositionStyles()}>
          <div style={titleStyles}>{slide.title}</div>
          {slide.description && (
            <div style={descriptionStyles}>{slide.description}</div>
          )}
        </div>
      )}
    </div>
  );
};

interface DynamicslidesProps {
  slide: Slide;
}

export const Dynamicslides: React.FC<DynamicslidesProps> = ({ slide }) => {
  return <DynamicslideSlide slide={slide} />;
};