'use client';

import { useEffect, useState } from 'react';

import styles from './Footer.module.css';

type FooterBadge = {
  id: number;
  title?: string;
  imageUrl?: string;
  imagePath?: string;
  linkUrl?: string;
};

const FALLBACK_BADGES: FooterBadge[] = [
  { id: 1, title: 'Award', imageUrl: '/images/trust/badge-mascot.svg' },
  { id: 2, title: 'Seal of Approval', imageUrl: '/images/trust/badge-seal.svg' },
  { id: 3, title: 'Best Casino', imageUrl: '/images/trust/badge-casino.svg' },
  { id: 4, title: 'Sports Award', imageUrl: '/images/trust/badge-shield.svg' },
];

function resolveSrc(badge: FooterBadge) {
  if (badge.imagePath) {
    const host = process.env.NEXT_PUBLIC_HOST || '';
    return `${host}/${badge.imagePath}`.replace(/([^:]\/)\/+/g, '$1');
  }
  return badge.imageUrl || '';
}

export function TrustBadgesRow() {
  const [badges, setBadges] = useState<FooterBadge[]>(FALLBACK_BADGES);

  useEffect(() => {
    const host = process.env.NEXT_PUBLIC_HOST || '';
    fetch(`${host}/api/footer-badges`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FooterBadge[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setBadges(data);
        }
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);

  if (!badges.length) return null;

  return (
    <div className={styles.TrustBadges_row}>
      {badges.map((badge, index) => {
        const src = resolveSrc(badge);
        if (!src) return null;

        const content = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={badge.title || 'Award'}
            className={styles.TrustBadges_image}
            loading="lazy"
          />
        );

        return (
          <div key={badge.id} className={styles.TrustBadges_item}>
            {index > 0 ? <span className={styles.TrustBadges_divider} aria-hidden /> : null}
            {badge.linkUrl ? (
              <a
                href={badge.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.TrustBadges_link}
              >
                {content}
              </a>
            ) : (
              <span className={styles.TrustBadges_link}>{content}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
