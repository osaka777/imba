import { useState, useEffect } from 'react';
import Image from 'next/image';

interface TeamImageProps {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
}

const DEFAULT_TEAM_ICON = '/images/default-team.svg'; // Путь к дефолтной иконке
const CDN_URL = 'https://cdn.incub.space/v1/opp/icon/';

export function TeamImage({ src, alt, size = 32, className = '' }: TeamImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(src ? formatImageUrl(src) : DEFAULT_TEAM_ICON);
  const [error, setError] = useState<boolean>(false);

  // Ensure alt text is always provided for accessibility
  const altText = alt || 'Team logo';

  useEffect(() => {
    if (src) {
      setImageSrc(formatImageUrl(src));
      setError(false);
    }
  }, [src]);

  function formatImageUrl(url: string): string {
    if (url.startsWith(CDN_URL)) {
      return url;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    const cleanUrl = url.replace(/^https?:\/\//, '');
    return `${CDN_URL}${cleanUrl}`;
  }

  function handleError() {
    if (!error) {
      setError(true);
      setImageSrc(DEFAULT_TEAM_ICON);
    }
  }

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={imageSrc}
        alt={altText}
        width={size}
        height={size}
        className={`object-contain w-auto h-auto ${error ? 'opacity-50' : ''}`}
        onError={handleError}
        loading="lazy"
        unoptimized={imageSrc.startsWith('http')}
      />
    </div>
  );
}