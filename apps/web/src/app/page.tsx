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
          <span className="eyebrow-chip"><Sparkles size={14} /> Ahmedabad showcase · Waste-Wise prototype</span>
          <h1>Ahmedabad waste, <em>made visible.</em></h1>
          <p>
            A polished, interactive prototype for showing how Ahmedabad teams can track bins, optimize collection routes, and verify field work.
          </p>
          <div className="marketing-hero__actions">
            <Link className="primary-button" href="/login">Start the 3-minute demo <ArrowRight size={18} /></Link>
            <Link className="quiet-button quiet-button--marketing" href="/setup">Add your real bins <MapPinned size={17} /></Link>
          </div>
          <div className="marketing-hero__trust">
            <span><CheckCircle2 size={16} /> Safety alerts</span>
            <span><CheckCircle2 size={16} /> Route optimization</span>
            <span><CheckCircle2 size={16} /> Driver proof of service</span>
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
        <p>Built for an Ahmedabad smart-waste showcase</p>
        <span aria-hidden="true" />
        <div><MapPinned size={17} /> Dispatchers</div>
        <div><Smartphone size={17} /> Drivers</div>
        <div><ShieldCheck size={17} /> HR & administrators</div>
      </section>

      <section className="capability-section">
        <div className="section-intro">
          <span className="section-kicker">One simple showcase story</span>
          <h2>From bin alert to cleaner streets.</h2>
          <p>Walk reviewers through a clear story: identify urgent bins, optimize collection, and verify the completed shift.</p>
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
            <span className="section-kicker">Ready for the presentation</span>
            <h2>One clickable prototype for every role.</h2>
            <p>
              Add up to 10 of your own Ahmedabad dustbin addresses, verify their pins on OpenStreetMap, and show their local visit order across Dispatcher and Driver views.
            </p>
          </div>
          <ul>
            <li><CheckCircle2 size={17} /> Dispatcher, Driver & Admin views</li>
            <li><CheckCircle2 size={17} /> Your real bin addresses and map pins</li>
            <li><CheckCircle2 size={17} /> Local visit ordering for up to 10 bins</li>
          </ul>
          <Link className="primary-button" href="/login">Open showcase workspace <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="marketing-footer">
        <BrandMark compact />
        <span>Waste-Wise · Ahmedabad showcase prototype</span>
        <Link href="/login">Start demo <ArrowRight size={15} /></Link>
      </footer>
    </main>
  );
}

function MoreDots() {
  return <span className="more-dots" aria-hidden="true">•••</span>;
}

function SirenIcon() {
  return <CircleAlert size={18} />;
}
