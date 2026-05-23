import { ProfileHeader } from "@/widgets/ProfileHeader/ProfileHeader";
import { verifySession } from "@/entities/user";
import NotFound from "@/app/not-found";
import { redirect } from "next/navigation";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {

    const user = await verifySession();

    if (!user) {
        redirect("/");
    }

   return (
       <>
           <ProfileHeader />
           {children}
       </>
   );
}
