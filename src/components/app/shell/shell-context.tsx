"use client";

import * as React from "react";

const SIDEBAR_COOKIE = "crb-sidebar";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const MOBILE_QUERY = "(max-width: 767px)";

type ShellState = {
  collapsed: boolean;
  /** Collapse or expand on desktop; open the off-canvas sheet on mobile. */
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
};

const ShellContext = React.createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const context = React.useContext(ShellContext);
  if (!context) throw new Error("useShell must be used inside <ShellProvider>");
  return context;
}

/** True when the keyboard event is Ctrl+<key> (Windows, Linux) or Cmd+<key> (macOS). */
function isModShortcut(event: KeyboardEvent, key: string): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === key;
}

export function ShellProvider({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const toggleSidebar = React.useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setMobileNavOpen((open) => !open);
      return;
    }
    setCollapsed((current) => {
      const next = !current;
      // Read by the server on the next request so the sidebar renders in the
      // same state without a flash.
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isModShortcut(event, "b")) {
        event.preventDefault();
        toggleSidebar();
      } else if (isModShortcut(event, "k")) {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const value = React.useMemo(
    () => ({
      collapsed,
      toggleSidebar,
      mobileNavOpen,
      setMobileNavOpen,
      commandOpen,
      setCommandOpen,
    }),
    [collapsed, toggleSidebar, mobileNavOpen, commandOpen],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
