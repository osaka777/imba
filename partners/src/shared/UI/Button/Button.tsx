import Link from "next/link";
import type { CustomButtonProps } from "./Button.d";

export const Button: React.FC<CustomButtonProps> = (props) => {
    if (props.elementType === "link") {
        const { elementType: _, external, ...linkProps } = props;
        const { children, disabled, href } = linkProps;

        if (disabled) {
            return (
                <button className={`${linkProps.className}`} style={linkProps.style} disabled={true}>
                    {children}
                </button>
            );
        } else {
            return (
                <Link {...linkProps} href={href || "#"}>
                    {children}
                </Link>
            );
        }
    } else if (props.elementType === "externalLink") {
        const { elementType: _, external, ...anchorProps } = props;
        const { children, disabled, href } = anchorProps;

        if (disabled) {
            return (
                <button className={`${anchorProps.className}`} style={anchorProps.style} disabled={true}>
                    {children}
                </button>
            );
        } else {
            return (
                <a {...anchorProps} href={href || "#"}>
                    {children}
                </a>
            );
        }
    }

    const { elementType: _, children, ...buttonProps } = props;
    return <button {...buttonProps}>{children}</button>;
};
