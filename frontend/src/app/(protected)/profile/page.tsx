import { Metadata } from "next";

import { Profile } from "~/entities/user";
import { makeMetadata } from "~/shared/lib";

export const metadata: Metadata = makeMetadata("Профиль");

export default async function ProfilePage() {
  return <Profile />;
}
