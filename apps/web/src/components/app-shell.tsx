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

const sharedNavigation = [
  { href: "#activity", label: "Activity", icon: ClipboardList },
  { href: "#safety", label: "Safety centre", icon: ShieldCheck },
  { href: "#help", label: "Help & runbooks", icon: CircleHelp },
];

export function AppShell({ role, eyebrow, title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();
  const [isNavOpen, setIsNavOpen] = useState(false);

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
            <i aria-hidden="true" /> Showcase mode
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <span className="sidebar-nav__label">Role workspaces</span>
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

          <span className="sidebar-nav__label sidebar-nav__label--spaced">Operations</span>
          {sharedNavigation.map((item) => {
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
              <strong>Role-aware by design</strong>
              <small>Local Ahmedabad demo data</small>
            </span>
          </div>
          <Link className="sidebar-settings" href="/login">
            <Settings size={17} aria-hidden="true" /> Switch account
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
            <button className="header-alert-button" type="button" aria-label="Open alerts">
              <Bell size={18} />
              <span className="header-alert-button__count">2</span>
            </button>
            <button className="profile-chip" type="button">
              <span className="profile-chip__avatar" aria-hidden="true">
                {role === "driver" ? "AP" : role === "dispatcher" ? "RK" : "MS"}
              </span>
              <span className="profile-chip__identity">
                <strong>{role === "driver" ? "Arjun Patel" : role === "dispatcher" ? "Riya Kapadia" : "Mira Shah"}</strong>
                <small>{roleLabels[role]}</small>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="preview-banner" role="status">
          <span className="preview-banner__dot" aria-hidden="true" />
          <span>
            <strong>Ahmedabad showcase mode</strong> — all bins, routes, alerts, trucks, and payroll figures are local demo data; no internet or external API is required.
          </span>
          <Link href="/login">Switch view</Link>
        </div>

        <main className="workspace-main">{children}</main>
      </section>
    </div>
  );
}
