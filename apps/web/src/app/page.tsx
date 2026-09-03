import { ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, MapPinned, Navigation, Route, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

const capabilities = [
  {
    number: "01",
    title: "Map real locations",
    description: "Enter up to 10 Ahmedabad bin addresses, verify their OpenStreetMap pins, and keep the records in your browser.",
    icon: MapPinned,
    href: "/setup",
  },
  {
    number: "02",
    title: "Review before assigning",
    description: "Build a clearly labelled draft that checks manual high-fill bins first, add driver/vehicle showcase labels, then publish the hand-off.",
    icon: Route,
    href: "/dispatch",
  },
  {
    number: "03",
    title: "Record the route outcome",
    description: "Start a local shift, record each stop outcome, surface hazards in Dispatch, and review the execution CSV in Admin.",
    icon: ShieldCheck,
    href: "/driver",
  },
];

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <BrandMark />
        <div className="marketing-nav__links">
          <a href="#workflow">Showcase flow</a>
          <a href="#foundation">Prototype boundary</a>
          <Link className="marketing-nav__login" href="/login">Preview workspaces <ArrowRight size={16} /></Link>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="marketing-hero__glow marketing-hero__glow--one" aria-hidden="true" />
        <div className="marketing-hero__glow marketing-hero__glow--two" aria-hidden="true" />
        <div className="marketing-hero__copy">
          <span className="eyebrow-chip"><Sparkles size={14} /> Ahmedabad showcase · Waste-Wise prototype</span>
          <h1>Real bin locations, <em>one clear workflow.</em></h1>
          <p>
            Configure your own dustbin addresses, review one local collection hand-off, and demonstrate how Dispatcher, Driver, and Admin views connect.
          </p>
          <div className="marketing-hero__actions">
            <Link className="primary-button" href="/setup">Configure real bins first <MapPinned size={18} /></Link>
            <Link className="quiet-button quiet-button--marketing" href="/login">Preview role workspaces <ArrowRight size={17} /></Link>
          </div>
          <div className="marketing-hero__trust">
            <span><CheckCircle2 size={16} /> Up to 10 real bin pins</span>
            <span><CheckCircle2 size={16} /> Local route hand-off</span>
            <span><CheckCircle2 size={16} /> Honest prototype labels</span>
          </div>
        </div>

        <div className="marketing-hero__visual" aria-label="Waste-Wise local showcase workflow illustration">
          <div className="hero-orbit hero-orbit--outer" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--inner" aria-hidden="true" />
          <div className="hero-route-line" aria-hidden="true" />
          <article className="hero-console-card hero-console-card--main">
            <div className="hero-console-card__heading"><span><i /> Showcase flow</span><MoreDots /></div>
            <strong>10 real bins max</strong>
            <div className="hero-console-card__chart"><span /><span /><span /><span /><span /><span /><span /></div>
            <small>Address → pin → route draft</small>
          </article>
          <article className="hero-console-card hero-console-card--alert">
            <span className="hero-console-card__icon hero-console-card__icon--alert"><CircleAlert size={18} /></span>
            <div><strong>Manual fill level</strong><small>Entered for this presentation</small></div>
          </article>
          <article className="hero-console-card hero-console-card--truck">
            <span className="hero-console-card__icon"><Smartphone size={18} /></span>
            <div><strong>Driver hand-off</strong><small>Starts after route publish</small></div>
          </article>
          <article className="hero-console-card hero-console-card--route">
            <span className="hero-console-card__icon hero-console-card__icon--route"><Navigation size={18} /></span>
            <div><strong>Local route draft</strong><small>Not road routing or CVRP</small></div>
          </article>
          <div className="hero-map-pin hero-map-pin--one"><CircleAlert size={15} /></div>
          <div className="hero-map-pin hero-map-pin--two"><Route size={15} /></div>
          <div className="hero-map-pin hero-map-pin--three"><MapPinned size={15} /></div>
        </div>
      </section>

      <section className="marketing-strip" id="workflow">
        <p>One logical NBA showcase story</p>
        <span aria-hidden="true" />
        <div><MapPinned size={17} /> Configure</div>
        <div><Route size={17} /> Assign</div>
        <div><Smartphone size={17} /> Execute</div>
        <div><ShieldCheck size={17} /> Review</div>
      </section>

      <section className="capability-section">
        <div className="section-intro">
          <span className="section-kicker">Four linked steps</span>
          <h2>Start with your bins, then follow one collection workflow.</h2>
          <p>Each screen now has a clear precondition and hand-off, so the story follows one collection workflow from real location setup through execution review.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <article className="capability-card" key={capability.number}>
                <div className="capability-card__topline"><span>{capability.number}</span><Icon size={20} /></div>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
                <Link href={capability.href}>Open this step <ArrowUpRight size={16} /></Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="foundation-section" id="foundation">
        <div className="foundation-card">
          <div>
            <span className="section-kicker">Prototype boundary</span>
            <h2>Useful for a showcase, honest about what comes next.</h2>
            <p>
              The presentation stores user-entered real bins and local execution outcomes only. Map tiles and address lookup need internet; routing, telemetry, GPS proof, notifications, payroll, and authorization remain production work.
            </p>
          </div>
          <ul>
            <li><CheckCircle2 size={17} /> Your real bin addresses and map pins</li>
            <li><CheckCircle2 size={17} /> Explicit draft → assigned → active → complete lifecycle</li>
            <li><CheckCircle2 size={17} /> No claim of live sensors or road-aware routing</li>
          </ul>
          <Link className="primary-button" href="/setup">Start at setup <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="marketing-footer">
        <BrandMark compact />
        <span>Waste-Wise · Ahmedabad showcase prototype</span>
        <Link href="/setup">Configure bins <ArrowRight size={15} /></Link>
      </footer>
    </main>
  );
}

function MoreDots() {
  return <span className="more-dots" aria-hidden="true">•••</span>;
}
