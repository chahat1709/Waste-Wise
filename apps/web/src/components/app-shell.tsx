"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ClipboardList,
  CircleHelp,
  Map,
  Menu,
  Route,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { roleLabels, type Role } from "@/lib/domain";

interface AppShellProps {
  role: Role;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const roleNavigation = [
  { href: "/driver", label: "Driver view", icon: Route, role: "driver" as const },
  { href: "/dispatch", label: "Dispatch", icon: Map, role: "dispatcher" as const },
  { href: "/admin", label: "HR & Admin", icon: UsersRound, role: "admin" as const },
];

const operationNavigationByRole = {
  driver: [
    { href: "#activity", label: "Route stops", icon: ClipboardList },
    { href: "#safety", label: "Safety hand-off", icon: ShieldCheck },
  ],
  dispatcher: [
    { href: "#activity", label: "Route monitor", icon: ClipboardList },
    { href: "#safety", label: "Safety centre", icon: ShieldCheck },
  ],
  admin: [
    { href: "#activity", label: "Execution ledger", icon: ClipboardList },
    { href: "#help", label: "Admin readiness", icon: CircleHelp },
  ],
};

const setupNavigation = [
  { href: "#bin-setup", label: "Bin setup", icon: ClipboardList },
  { href: "#map-preview", label: "Map preview", icon: Map },
];

export function AppShell({ role, eyebrow, title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const operationNavigation = pathname === "/setup" ? setupNavigation : operationNavigationByRole[role];

  return (
    <div className="workspace">
      <aside className={`workspace-sidebar ${isNavOpen ? "workspace-sidebar--open" : ""}`}>
        <div className="sidebar-topline">
          <BrandMark inverse />
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-context">
          <span className="sidebar-context__eyebrow">Unified operations</span>
          <strong>{roleLabels[role]} workspace</strong>
          <span className="sidebar-context__status">
            <i aria-hidden="true" /> Local prototype
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <span className="sidebar-nav__label">Showcase role previews</span>
          {roleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                className={`sidebar-nav__item ${isActive ? "sidebar-nav__item--active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setIsNavOpen(false)}
              >
                <Icon size={18} strokeWidth={2.1} />
                <span>{item.label}</span>
                {item.role === role && <span className="sidebar-nav__current">Current</span>}
              </Link>
            );
          })}

          <span className="sidebar-nav__label sidebar-nav__label--spaced">Current workflow</span>
          <Link
            className={`sidebar-nav__item sidebar-nav__item--muted ${pathname === "/setup" ? "sidebar-nav__item--active" : ""}`}
            href="/setup"
            onClick={() => setIsNavOpen(false)}
          >
            <Map size={18} strokeWidth={2.1} />
            <span>Configure real bins</span>
          </Link>
          {operationNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <a
                className="sidebar-nav__item sidebar-nav__item--muted"
                href={item.href}
                key={item.href}
                onClick={() => setIsNavOpen(false)}
              >
                <Icon size={18} strokeWidth={2.1} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-security">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              <strong>Role previews only</strong>
              <small>Server authorization comes next</small>
            </span>
          </div>
          <Link className="sidebar-settings" href="/login">
            <Settings size={17} aria-hidden="true" /> Switch workspace
          </Link>
        </div>
      </aside>

      {isNavOpen && (
        <button
          type="button"
          className="workspace-scrim"
          aria-label="Close navigation"
          onClick={() => setIsNavOpen(false)}
        />
      )}

      <section className="workspace-body">
        <header className="workspace-header">
          <div className="workspace-header__leading">
            <button
              className="icon-button mobile-nav-toggle"
              type="button"
              aria-label="Open navigation"
              onClick={() => setIsNavOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="page-eyebrow">
                <span className="page-eyebrow__pulse" aria-hidden="true" />
                {eyebrow}
              </div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>

          <div className="workspace-header__actions">
            <button className="header-alert-button" type="button" aria-label="Showcase notifications are not connected" title="Notifications are not connected in showcase mode">
              <Bell size={18} />
            </button>
            <button className="profile-chip" type="button">
              <span className="profile-chip__avatar" aria-hidden="true">
                {role === "driver" ? "DR" : role === "dispatcher" ? "DP" : "AD"}
              </span>
              <span className="profile-chip__identity">
                <strong>{role === "driver" ? "Showcase driver" : role === "dispatcher" ? "Showcase dispatcher" : "Showcase admin"}</strong>
                <small>{roleLabels[role]} preview</small>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="preview-banner" role="status">
          <span className="preview-banner__dot" aria-hidden="true" />
          <span>
            <strong>Ahmedabad showcase mode</strong> — real bin records stay in this browser; fill levels, route hand-offs, driver outcomes, and safety reports are manual local demonstrations.
          </span>
          <Link href="/setup">Configure bins</Link>
        </div>

        <main className="workspace-main">{children}</main>
      </section>
    </div>
  );
}
