import { Metadata } from "next";

import { Profile } from "~/entities/user";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoProfile");
}

export default async function ProfilePage() {
  return <Profile />;
}
