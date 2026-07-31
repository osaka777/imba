import { Metadata } from 'next';
import { makeSeoMetadata } from '~/shared/i18n/seo-metadata';
import { BonusHistory } from '~/entities/user/ui/BonusHistory/BonusHistory';

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoBonusHistory");
}

export default function PromocodesPage() {
  return <BonusHistory />;
} 