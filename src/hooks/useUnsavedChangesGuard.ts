"use client";

import { useCallback, useEffect, useRef } from "react";
import { getNavigationApi, guardTraversal, type TraversalEventLike } from "~/lib/navigation-guard";

export const UNSAVED_CHANGES_MESSAGE = "You have unsaved changes. Leave this page and discard them?";

export const canGuardTraversal = (): boolean => typeof window !== "undefined" && getNavigationApi(window) !== null;

const isPlainLeftClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const isInternalNavigation = (event: MouseEvent): boolean => {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return false;
  }
  const url = new URL(anchor.href, window.location.href);
  const isSamePage = url.pathname === window.location.pathname && url.search === window.location.search;
  return url.origin === window.location.origin && !isSamePage;
};

export const useUnsavedChangesGuard = (
  isDirty: boolean,
  message: string = UNSAVED_CHANGES_MESSAGE,
): (() => boolean) => {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !isPlainLeftClick(event) || !isInternalNavigation(event)) {
        return;
      }
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const navigation = getNavigationApi(window);
    const handleNavigate = (event: TraversalEventLike) => {
      guardTraversal(event, () => window.confirm(message));
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    navigation?.addEventListener("navigate", handleNavigate);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
      navigation?.removeEventListener("navigate", handleNavigate);
    };
  }, [isDirty, message]);

  return useCallback(() => !isDirtyRef.current || window.confirm(message), [message]);
};
