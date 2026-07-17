"use client";

import type { MouseEvent, ReactNode } from "react";

import { tryHandleSupportLinkClick } from "~/shared/lib/supportSiteActions";

import styles from "./LiveSupportChat.module.css";

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const URL_RE =
  /(https?:\/\/[^\s]+|imba\.bet\/[^\s]+|t\.me\/[^\s]+|@[A-Za-z0-9_]{4,})/gi;

function normalizeHref(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("@")) {
    return `https://t.me/${value.slice(1)}`;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("imba.bet/") || value.startsWith("t.me/")) {
    return `https://${value}`;
  }
  return value;
}

function linkNode(
  key: string,
  href: string,
  label: string,
  isUser: boolean,
  onLinkClick?: (event: MouseEvent<HTMLAnchorElement>, href: string, label: string) => void,
) {
  return (
    <a
      key={key}
      className={isUser ? styles.bubbleLinkUser : styles.bubbleLinkAgent}
      href={normalizeHref(href)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => onLinkClick?.(event, href, label)}
    >
      {label}
    </a>
  );
}

function linkifyPlainSegment(
  segment: string,
  isUser: boolean,
  keyPrefix: string,
  onLinkClick?: (event: MouseEvent<HTMLAnchorElement>, href: string, label: string) => void,
) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of segment.matchAll(URL_RE)) {
    const matchText = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(segment.slice(lastIndex, start));
    }
    const href = normalizeHref(matchText);
    const label = matchText.startsWith("@") ? matchText : matchText.replace(/^https?:\/\//, "");
    parts.push(linkNode(`${keyPrefix}-u-${matchIndex}`, href, label, isUser, onLinkClick));
    lastIndex = start + matchText.length;
    matchIndex += 1;
  }

  if (lastIndex < segment.length) {
    parts.push(segment.slice(lastIndex));
  }

  return parts;
}

function parseMarkdownLinks(
  text: string,
  isUser: boolean,
  onLinkClick?: (event: MouseEvent<HTMLAnchorElement>, href: string, label: string) => void,
) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let linkIndex = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(
        ...linkifyPlainSegment(text.slice(lastIndex, start), isUser, `pre-${linkIndex}`, onLinkClick),
      );
    }
    nodes.push(linkNode(`md-${linkIndex}`, match[2], match[1], isUser, onLinkClick));
    lastIndex = start + match[0].length;
    linkIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(...linkifyPlainSegment(text.slice(lastIndex), isUser, "tail", onLinkClick));
  }

  return nodes.length ? nodes : linkifyPlainSegment(text, isUser, "all", onLinkClick);
}

type ChatBubbleTextProps = {
  text: string;
  isUser?: boolean;
  isAuth?: boolean;
  onNeedAuth?: () => void;
};

export function ChatBubbleText({ text, isUser = false, isAuth = false, onNeedAuth }: ChatBubbleTextProps) {
  const onLinkClick = (event: MouseEvent<HTMLAnchorElement>, href: string, label: string) => {
    tryHandleSupportLinkClick(event, href, label, { isAuth, onNeedAuth });
  };

  const lines = text.split("\n");

  return (
    <p className={styles.bubbleText}>
      {lines.map((line, lineIndex) => (
        <span key={`line-${lineIndex}`}>
          {lineIndex > 0 ? <br /> : null}
          {parseMarkdownLinks(line, isUser, onLinkClick)}
        </span>
      ))}
    </p>
  );
}
