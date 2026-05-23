import type { LinkProps as NextLinkProps } from "next/link";
import { CSSProperties, ComponentPropsWithoutRef } from "react";
type ButtonProps = ComponentPropsWithoutRef<"button"> & {
    elementType?: "button";
};

type LinkProps = NextLinkProps & {
    elementType: "link";
    external?: boolean;
    disabled?: boolean;
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
};

type AnchorProps = ComponentPropsWithoutRef<"a"> & {
    elementType: "externalLink";
    external: true;
    disabled?: boolean;
};

export type CustomButtonProps = ButtonProps | AnchorProps | LinkProps;
