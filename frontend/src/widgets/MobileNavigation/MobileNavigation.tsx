'use client';
import { Content } from "./Content";
import { useAuth } from "~/app/providers/AuthProvider";

export const MobileNavigation = () => {
  const { isAuth } = useAuth();
  return <Content isAuth={isAuth} />;
};
