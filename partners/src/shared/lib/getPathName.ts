"use server";

import { headers } from "next/headers";

export const getPathName = async () => {
  const heads = headers();

  const path = heads.get("x-pathname");
  const pathName = path === "/" ? "/" : path?.split("/")[1];
  return pathName;
};
