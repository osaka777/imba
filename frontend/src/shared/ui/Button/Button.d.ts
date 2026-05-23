import type { LinkProps as NextLinkProps } from "next/link";

import { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";
type ButtonProps = {
  elementType?: "button";
} & ComponentPropsWithoutRef<"button">;

type LinkProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  elementType: "link";
  external?: boolean;
  style?: CSSProperties;
} & NextLinkProps;

type AnchorProps = {
  disabled?: boolean;
  elementType: "externalLink";
  external: true;
} & ComponentPropsWithoutRef<"a">;

export type CustomButtonProps = AnchorProps | ButtonProps | LinkProps;
