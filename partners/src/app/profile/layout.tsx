import { ProfileHeader } from "@/widgets/ProfileHeader/ProfileHeader";
import { ProfileNavigation } from "@/widgets/ProfileNavigation/ProfileNavigation";
import { PartnerStatusBanner } from "@/widgets/PartnerStatusBanner/PartnerStatusBanner";
import { verifySession } from "@/entities/user";
import { redirect } from "next/navigation";
import shell from "./profile-shell.module.css";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await verifySession();

  if (!user) {
    redirect("/");
  }

  return (
    <>
      <ProfileHeader />
      <div className={shell.canvas}>
        <div className={shell.sheet}>
          <ProfileNavigation />
          <PartnerStatusBanner />
          {children}
        </div>
      </div>
    </>
  );
};
