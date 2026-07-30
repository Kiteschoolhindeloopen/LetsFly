import { useEffect } from "react";

/**
 * The mock repository lives in localStorage, which only fires the native
 * `storage` event in *other* tabs/windows of the same origin — a tab that
 * writes never hears its own write. Combined with a `visibilitychange`
 * listener, this keeps pages that stay open across a role switch (e.g. an
 * admin tab left open while a customer submits a request in another tab)
 * from showing stale data.
 */
export function useLiveRefresh(reload: () => void) {
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") reload();
    }
    window.addEventListener("storage", reload);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
