export interface TraversalEventLike {
  readonly navigationType: string;
  readonly cancelable: boolean;
  readonly hashChange: boolean;
  preventDefault(): void;
}

export interface NavigationLike {
  addEventListener(type: "navigate", listener: (event: TraversalEventLike) => void): void;
  removeEventListener(type: "navigate", listener: (event: TraversalEventLike) => void): void;
}

export const isGuardableTraversal = (event: Omit<TraversalEventLike, "preventDefault">): boolean =>
  event.navigationType === "traverse" && event.cancelable && !event.hashChange;

export const guardTraversal = (event: TraversalEventLike, confirmLeave: () => boolean): boolean => {
  if (!isGuardableTraversal(event) || confirmLeave()) {
    return false;
  }
  event.preventDefault();
  return true;
};

const hasFunction = (value: object, name: string): boolean => typeof Reflect.get(value, name) === "function";

export const getNavigationApi = (target: object): NavigationLike | null => {
  const candidate: unknown = Reflect.get(target, "navigation");
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    hasFunction(candidate, "addEventListener") &&
    hasFunction(candidate, "removeEventListener")
  ) {
    return candidate as NavigationLike;
  }
  return null;
};
