import { type AnchorHTMLAttributes, createElement, type ReactNode } from "react";

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  children?: ReactNode;
}

export default function Link({ prefetch: _prefetch, replace: _replace, scroll: _scroll, ...anchorProps }: LinkProps) {
  return createElement("a", anchorProps);
}
