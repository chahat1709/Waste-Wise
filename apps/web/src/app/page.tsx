import { ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, MapPinned, Route, ShieldCheck, Smartphone, Sparkles, Truck } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

const capabilities = [
  {
    number: "01",
    title: "Sense the real world",
    description: "Turn fill, weight, smoke, and temperature telemetry into a live operational picture.",
    icon: CircleAlert,
  },
  {
    number: "02",
    title: "Plan routes that fit",
    description: "Use road-aware travel, truck constraints, and safety exclusions before dispatching work.",
    icon: Route,
  },
  {
    number: "03",
    title: "Verify every shift",
    description: "Connect field execution, proof of collection, and payroll-ready records in one system.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <BrandMark />
        <div className="marketing-nav__links">
          <a href="#workflow">How it works</a>
          <a href="#foundation">Build status</a>
          <Link className="marketing-nav__login" href="/login">Sign in <ArrowRight size={16} /></Link>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="marketing-hero__glow marketing-hero__glow--one" aria-hidden="true" />
        <div className="marketing-hero__glow marketing-hero__glow--two" aria-hidden="true" />
        <div className="marketing-hero__copy">
          <span className="eyebrow-chip"><Sparkles size={14} /> Waste-Wise v2.0 · Unified operations</span>
          <h1>Waste collection, <em>made operational.</em></h1>
          <p>
            A single role-aware workspace for municipal teams to act on bin intelligence, route safely, and verify field work.
          </p>
          <div className="marketing-hero__actions">
            <Link className="primary-button" href="/login">Explore the pilot workspace <ArrowRight size={18} /></Link>
            <a className="quiet-button quiet-button--marketing" href="#foundation">View build foundation <ArrowDownIcon /></a>
          </div>
          <div className="marketing-hero__trust">
            <span><CheckCircle2 size={16} /> Hazard-first alerts</span>
            <span><CheckCircle2 size={16} /> Heavy-vehicle route planning</span>
            <span><CheckCircle2 size={16} /> Privacy-aware field tracking</span>
          </div>
        </div>

        <div className="marketing-hero__visual" aria-label="Waste-Wise operational workflow illustration">
          <div className="hero-orbit hero-orbit--outer" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--inner" aria-hidden="true" />
          <div className="hero-route-line" aria-hidden="true" />
          <article className="hero-console-card hero-console-card--main">
            <div className="hero-console-card__heading"><span><i /> Operations live</span><MoreDots /></div>
            <strong>12 priority bins</strong>
            <div className="hero-console-card__chart"><span /><span /><span /><span /><span /><span /><span /></div>
            <small>Real-time safety and collection demand</small>
          </article>
          <article className="hero-console-card hero-console-card--alert">
            <span className="hero-console-card__icon hero-console-card__icon--alert"><SirenIcon /></span>
            <div><strong>Critical alert</strong><small>Smoke signal · 2 min ago</small></div>
          </article>
          <article className="hero-console-card hero-console-card--truck">
            <span className="hero-console-card__icon"><Truck size={18} /></span>
            <div><strong>TRK-14 on route</strong><small>5 stops · 2.8 t load</small></div>
          </article>
          <article className="hero-console-card hero-console-card--route">
            <span className="hero-console-card__icon hero-console-card__icon--route"><MapPinned size={18} /></span>
            <div><strong>Road-aware route</strong><small>7.8 km · restrictions applied</small></div>
          </article>
          <div className="hero-map-pin hero-map-pin--one"><CircleAlert size={15} /></div>
          <div className="hero-map-pin hero-map-pin--two"><Truck size={15} /></div>
          <div className="hero-map-pin hero-map-pin--three"><MapPinned size={15} /></div>
        </div>
      </section>

      <section className="marketing-strip" id="workflow">
        <p>Designed for municipalities and collection agencies</p>
        <span aria-hidden="true" />
        <div><MapPinned size={17} /> Dispatchers</div>
        <div><Smartphone size={17} /> Drivers</div>
        <div><ShieldCheck size={17} /> HR & administrators</div>
      </section>

      <section className="capability-section">
        <div className="section-intro">
          <span className="section-kicker">One reliable operational loop</span>
          <h2>From edge signal to verified service.</h2>
          <p>Waste-Wise replaces disconnected tools with one traceable path from sensing to payroll.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <article className="capability-card" key={capability.number}>
                <div className="capability-card__topline"><span>{capability.number}</span><Icon size={20} /></div>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
                <Link href="/login">Explore workspace <ArrowUpRight size={16} /></Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="foundation-section" id="foundation">
        <div className="foundation-card">
          <div>
            <span className="section-kicker">The build now underway</span>
            <h2>One PWA foundation for every role.</h2>
            <p>
              The current delivery slice establishes the shared application shell, role-aware workspaces, PWA capability, typed contracts, and migration-ready data boundary.
            </p>
          </div>
          <ul>
            <li><CheckCircle2 size={17} /> Unified responsive UI foundation</li>
            <li><CheckCircle2 size={17} /> Offline-safe PWA shell</li>
            <li><CheckCircle2 size={17} /> Secure role/data architecture</li>
          </ul>
          <Link className="primary-button" href="/login">Open pilot preview <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="marketing-footer">
        <BrandMark compact />
        <span>Waste-Wise · Integrated municipal operations</span>
        <Link href="/login">Enter workspace <ArrowRight size={15} /></Link>
      </footer>
    </main>
  );
}

function ArrowDownIcon() {
  return <span className="arrow-down-icon" aria-hidden="true">↓</span>;
}

function MoreDots() {
  return <span className="more-dots" aria-hidden="true">•••</span>;
}

function SirenIcon() {
  return <CircleAlert size={18} />;
}
