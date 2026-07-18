"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Nav link to /admin, shown only when a session exists. The check runs
 * client-side (against NextAuth's session endpoint) rather than via a server
 * `auth()` call because reading cookies during render would force the whole
 * homepage dynamic — this link is the only session-dependent thing on it.
 * Visitors see nothing; a signed-in admin sees the link appear after hydration.
 */
export function AdminLink({ className }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (!cancelled) setSignedIn(Boolean(session?.user));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!signedIn) return null;

  return (
    <Link href="/admin" className={className}>
      Admin
    </Link>
  );
}
