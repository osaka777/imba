import { Metadata } from 'next';
import { makeMetadata } from '~/shared/lib';
import { BonusHistory } from '~/entities/user/ui/BonusHistory/BonusHistory';

export const metadata: Metadata = makeMetadata('История бонусов');

export default function PromocodesPage() {
  return <BonusHistory />;
} 