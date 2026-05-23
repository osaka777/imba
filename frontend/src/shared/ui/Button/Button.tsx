import Link from "next/link";

import type { CustomButtonProps } from "./Button.d";

export const Button: React.FC<CustomButtonProps> = (props) => {
  if (props.elementType === "link") {
    const { elementType: _, external, ...linkProps } = props;
    const { children, disabled, href } = linkProps;

    if (disabled) {
      return (
        <button
          className={`${linkProps.className || ''}`}
          disabled={true}
          style={linkProps.style}
        >
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
        <button
          className={`${anchorProps.className || ''}`}
          disabled={true}
          style={anchorProps.style}
        >
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
  else if (props.elementType === "linkButton") {
    const { elementType: _, href, onClick, ...buttonProps } = props;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (onClick) {
        onClick(e);
      }
    };

    return (
        <button {...buttonProps} onClick={handleClick}>
          {props.children}
        </button>
    );
  }

  const { children, elementType: _, ...buttonProps } = props;
  return <button {...buttonProps}>{children}</button>;
};
