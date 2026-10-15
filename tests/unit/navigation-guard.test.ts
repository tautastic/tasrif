import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getNavigationApi,
  guardTraversal,
  isGuardableTraversal,
  type NavigationLike,
  type TraversalEventLike,
} from "~/lib/navigation-guard";

const makeEvent = (overrides: Partial<Omit<TraversalEventLike, "preventDefault">> = {}) => {
  let prevented = 0;
  const event: TraversalEventLike = {
    navigationType: "traverse",
    cancelable: true,
    hashChange: false,
    ...overrides,
    preventDefault: () => {
      prevented += 1;
    },
  };
  return { event, prevented: () => prevented };
};

test("a cancelable traversal is cancelled when the user declines to leave", () => {
  const { event, prevented } = makeEvent();
  let asked = 0;
  const cancelled = guardTraversal(event, () => {
    asked += 1;
    return false;
  });
  assert.equal(cancelled, true);
  assert.equal(asked, 1);
  assert.equal(prevented(), 1);
});

test("a cancelable traversal proceeds when the user agrees to leave", () => {
  const { event, prevented } = makeEvent();
  assert.equal(
    guardTraversal(event, () => true),
    false,
  );
  assert.equal(prevented(), 0);
});

test("navigations that are not back or forward traversals are never confirmed", () => {
  for (const navigationType of ["push", "replace", "reload"]) {
    const { event, prevented } = makeEvent({ navigationType });
    let asked = 0;
    guardTraversal(event, () => {
      asked += 1;
      return false;
    });
    assert.equal(asked, 0, navigationType);
    assert.equal(prevented(), 0, navigationType);
  }
});

test("a traversal the browser does not allow to cancel is left alone", () => {
  const { event, prevented } = makeEvent({ cancelable: false });
  let asked = 0;
  guardTraversal(event, () => {
    asked += 1;
    return false;
  });
  assert.equal(asked, 0);
  assert.equal(prevented(), 0);
});

test("a traversal that only changes the fragment is not confirmed", () => {
  assert.equal(isGuardableTraversal({ navigationType: "traverse", cancelable: true, hashChange: true }), false);
  assert.equal(isGuardableTraversal({ navigationType: "traverse", cancelable: true, hashChange: false }), true);
});

test("the navigation api is detected only when it exposes both listener methods", () => {
  const complete: NavigationLike = { addEventListener: () => undefined, removeEventListener: () => undefined };
  assert.equal(getNavigationApi({ navigation: complete }), complete);
  assert.equal(getNavigationApi({}), null);
  assert.equal(getNavigationApi({ navigation: undefined }), null);
  assert.equal(getNavigationApi({ navigation: null }), null);
  assert.equal(getNavigationApi({ navigation: { addEventListener: () => undefined } }), null);
  assert.equal(getNavigationApi({ navigation: "navigation" }), null);
});
