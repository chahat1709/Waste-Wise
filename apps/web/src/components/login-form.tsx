"use client";

import { ArrowRight, Check, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { isRole, roleLabels, roleRoutes, roles, type Role } from "@/lib/domain";

const roleDetails: Record<Role, { description: string; accent: string }> = {
  driver: {
    description: "Mobile shift, route and collection workflow",
    accent: "Field execution",
  },
  dispatcher: {
    description: "Live bin alerts, routes and fleet operations",
    accent: "Control centre",
  },
  admin: {
    description: "People, vehicles, payroll and reporting",
    accent: "Administration",
  },
};

export function LoginForm() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>("dispatcher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!configured) {
      router.push(roleRoutes[selectedRole]);
      return;
    }

    if (!email || !password) {
      setMessage("Enter your work email and password to continue.");
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage("Supabase configuration is unavailable. Try again or contact your administrator.");
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const authenticatedRole = data.user?.app_metadata?.role;
    if (!isRole(authenticatedRole)) {
      setMessage("Your account has no approved Waste-Wise role. Contact an administrator.");
      await client.auth.signOut();
      return;
    }

    router.push(roleRoutes[authenticatedRole]);
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-hero__mesh" aria-hidden="true" />
        <div className="login-hero__orb login-hero__orb--one" aria-hidden="true" />
        <div className="login-hero__orb login-hero__orb--two" aria-hidden="true" />
        <div className="login-hero__content">
          <BrandMark inverse />
          <div className="login-hero__copy">
            <span className="eyebrow-chip eyebrow-chip--light">
              <Sparkles size={14} /> Ahmedabad showcase · local and reliable
            </span>
            <h1>
              Safer streets.
              <br />
              Smarter collection.
            </h1>
            <p>
              A stable, clickable Waste-Wise prototype for every route, safety signal, and verified shift.
            </p>
          </div>
          <div className="login-hero__proof">
            <div className="login-hero__proof-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <strong>Built for accountable operations</strong>
              <span>Role-aware access, verified telemetry, and traceable field actions.</span>
            </div>
          </div>
        </div>
        <div className="login-hero__footer">Waste-Wise · Ahmedabad showcase prototype</div>
      </section>

      <section className="login-panel-wrap">
        <div className="login-panel">
          <div className="login-panel__heading">
            <span className="eyebrow-chip">Secure sign in</span>
            <h2>Choose a showcase workspace</h2>
            <p>
              {configured
                ? "Use your municipality or agency account to enter your assigned workspace."
                : "Explore the Ahmedabad prototype with local sample data. No account, API key, or internet connection is needed."}
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <fieldset className="role-selector">
              <legend>Choose workspace</legend>
              <div className="role-selector__grid">
                {roles.map((role) => (
                  <button
                    className={`role-card ${selectedRole === role ? "role-card--selected" : ""}`}
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                  >
                    <span className="role-card__check" aria-hidden="true">
                      {selectedRole === role && <Check size={13} strokeWidth={3} />}
                    </span>
                    <strong>{roleLabels[role]}</strong>
                    <small>{roleDetails[role].accent}</small>
                    <span>{roleDetails[role].description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="field-label" htmlFor="email">
              Work email
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                placeholder="you@municipality.gov"
                onChange={(event) => setEmail(event.target.value)}
                disabled={!configured}
              />
            </label>

            <label className="field-label" htmlFor="password">
              Password
              <span className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  placeholder="Enter your password"
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={!configured}
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={!configured}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {message && <p className="form-message" role="alert">{message}</p>}

            <button className="primary-button primary-button--wide" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : configured ? "Sign in securely" : `Open ${roleLabels[selectedRole]} demo`}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>

          <div className="login-panel__footer">
            <span>
              <ShieldCheck size={15} />
              {configured ? "Your access is protected by role-based controls." : "Showcase mode uses deterministic local sample data only."}
            </span>
            {configured ? <Link href="#reset">Forgot password?</Link> : <Link href="/">About this prototype</Link>}
          </div>
        </div>
      </section>
    </main>
  );
}
