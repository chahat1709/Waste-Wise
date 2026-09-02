"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

import {
  AlertTriangle,
  ArrowDownToLine,
  BellRing,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crosshair,
  Fuel,
  Gauge,
  LocateFixed,
  MapPinned,
  Navigation,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Route,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Timer,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { shiftRows } from "@/lib/demo-data";
import type { RouteStopStatus } from "@/lib/domain";
import { enqueueOfflineCommand, type OfflineCommandType } from "@/lib/offline/outbox";
import {
  createLocalShowcaseRoute,
  isLocatedBin,
  MAX_SHOWCASE_BINS,
  orderedShowcaseBins,
} from "@/lib/showcase/bins";
import { useShowcaseConfiguration } from "@/lib/showcase/storage";

const OpenStreetMapBinMap = dynamic(
  () => import("@/components/open-street-map-bin-map").then((module) => module.OpenStreetMapBinMap),
  {
    ssr: false,
    loading: () => <div className="map-loading-state">Loading OpenStreetMap…</div>,
  },
);

function MetricCard({
  label,
  value,
  detail,
  tone = "mint",
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "mint" | "blue" | "amber" | "rose";
  icon: LucideIcon;
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__icon" aria-hidden="true">
        <Icon size={19} strokeWidth={2.2} />
      </div>
      <div>
        <span className="metric-card__label">{label}</span>
        <strong className="metric-card__value">{value}</strong>
        <span className="metric-card__detail">{detail}</span>
      </div>
    </article>
  );
}

function StopStatus({ status }: { status: RouteStopStatus }) {
  const labels: Record<RouteStopStatus, string> = {
    pending: "Pending",
    collected: "Collected",
    inaccessible: "Skipped",
    damaged: "Damaged",
  };

  return <span className={`stop-status stop-status--${status}`}>{labels[status]}</span>;
}

function CompletionRing({ percent }: { percent: number }) {
  return (
    <div className="completion-ring" style={{ "--completion": `${percent * 3.6}deg` } as CSSProperties}>
      <div>
        <strong>{percent}%</strong>
        <span>complete</span>
      </div>
    </div>
  );
}

function RouteProgress({ progress }: { progress: number }) {
  return (
    <div className="progress-track" aria-label={`${progress}% complete`}>
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}

function createOfflineCommandId() {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("This browser cannot create a secure offline command identifier.");
  }
  return globalThis.crypto.randomUUID();
}

export function DriverWorkspace() {
  const { configuration } = useShowcaseConfiguration();
  const [onShift, setOnShift] = useState(false);
  const [stopStatuses, setStopStatuses] = useState<Record<string, RouteStopStatus>>({});
  const [lastMessage, setLastMessage] = useState("Your shift is not active. Location sharing remains paused.");
  const [sosRaised, setSosRaised] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const orderedBins = useMemo(() => orderedShowcaseBins(configuration), [configuration]);
  const stops = useMemo(
    () => orderedBins.map((bin, index) => ({
      id: bin.id,
      sequence: index + 1,
      name: bin.name || bin.id,
      address: bin.address,
      fillPercent: bin.fillPercent,
      capacityKg: bin.capacityKg,
      status: stopStatuses[bin.id] ?? "pending",
    })),
    [orderedBins, stopStatuses],
  );

  useEffect(() => {
    const updateConnectivity = () => setIsOnline(navigator.onLine);
    updateConnectivity();
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, []);

  async function queueWhenOffline(type: OfflineCommandType, payload: Record<string, unknown>) {
    if (navigator.onLine) return false;

    try {
      const id = createOfflineCommandId();
      await enqueueOfflineCommand({ id, type, idempotencyKey: id, payload });
      return true;
    } catch {
      setLastMessage("This browser could not save the offline action. Reconnect before leaving this screen.");
      return false;
    }
  }

  const completedStops = stops.filter((stop) => stop.status === "collected").length;
  const progress = Math.round((completedStops / Math.max(stops.length, 1)) * 100);
  const nextStop = stops.find((stop) => stop.status === "pending") ?? stops[stops.length - 1];

  function toggleShift() {
    const nextState = !onShift;
    setOnShift(nextState);
    setSosRaised(false);
    setLastMessage(
      nextState
        ? "Shift preview started. The location-sharing indicator is active, but no live GPS is transmitted in this prototype."
        : "Shift preview ended. The location-sharing indicator is paused and your route is locked.",
    );
  }

  async function updateStop(stopId: string, status: RouteStopStatus) {
    if (!onShift) {
      setLastMessage("Start your shift before recording a collection result.");
      return;
    }

    const stop = stops.find((item) => item.id === stopId);
    setStopStatuses((current) => ({ ...current, [stopId]: status }));
    const statusCopy: Record<RouteStopStatus, string> = {
      pending: "reset to pending",
      collected: "marked collected in this local showcase",
      inaccessible: "marked inaccessible in this local showcase",
      damaged: "marked damaged in this local showcase",
    };
    const queued = await queueWhenOffline(
      status === "collected" ? "collection.record" : "route-stop.skip",
      { routeStopReference: stopId, outcome: status },
    );
    setLastMessage(
      queued
        ? `${stop?.name ?? "Stop"} was queued securely in this device's offline outbox.`
        : `${stop?.name ?? "Stop"} was ${statusCopy[status]}. Preview changes are stored locally only.`,
    );
  }

  async function raiseSos() {
    if (!onShift) {
      setLastMessage("SOS becomes available when an active shift begins.");
      return;
    }
    setSosRaised(true);
    const queued = await queueWhenOffline("sos.raise", { routeReference: "R-AMD-091" });
    setLastMessage(
      queued
        ? "SOS preview was queued in the offline outbox. Reconnect immediately so dispatch can receive it."
        : "SOS preview raised. Production will transmit your active route, latest location, accuracy, and timestamp to dispatch.",
    );
  }

  async function reportRoadHazard() {
    const queued = await queueWhenOffline("hazard.report", { kind: "unsafe_access", routeReference: "R-AMD-091" });
    setLastMessage(
      queued
        ? "Road-hazard report was queued in the offline outbox for safe replay."
        : "Road-hazard report preview opened. The live map workflow will attach location and create an avoid-area review.",
    );
  }

  if (!nextStop) {
    return (
      <AppShell role="driver" eyebrow="Real bins not configured" title="Your route is ready for setup" subtitle="Add your dustbin addresses first, then return here to demonstrate the driver experience.">
        <section className="workspace-empty-state">
          <span className="workspace-empty-state__icon"><MapPinned size={24} /></span>
          <h2>Add your real Ahmedabad dustbins</h2>
          <p>Configure up to 10 bin addresses, locate them on OpenStreetMap, and the route will appear here in the saved order.</p>
          <Link className="primary-button" href="/setup">Configure real bins <ChevronRight size={17} /></Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      role="driver"
      eyebrow={onShift ? "Shift preview active · GPS indicator on" : "Real bin route · GPS indicator paused"}
      title={onShift ? `Route ${configuration.routePlan?.id ?? "R-AMD-DEMO-01"}` : "Your Ahmedabad route"}
      subtitle={onShift ? `${stops.length} real bin stop${stops.length === 1 ? "" : "s"} · local showcase route` : "Start your shift to demonstrate service verification on your real bin locations."}
    >
      <section className="driver-hero-grid">
        <article className={`shift-card ${onShift ? "shift-card--active" : ""}`}>
          <div className="shift-card__topline">
            <div>
              <span className="section-kicker">Today&apos;s shift</span>
              <h2>{onShift ? "You are on duty" : "Ready when you are"}</h2>
            </div>
            <span className={`live-status ${onShift ? "live-status--active" : ""}`}>
              <i aria-hidden="true" /> {onShift ? "Preview" : "Standby"}
            </span>
          </div>
          <p>
            {onShift
              ? "Your location is shared only during this active shift. Keep the app open while driving between stops."
              : "Starting a shift records your clock-in time and turns on route location sharing."}
          </p>
          <div className="shift-card__actions">
            <button className="primary-button" type="button" onClick={toggleShift}>
              {onShift ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
              {onShift ? "End shift" : "Start shift"}
            </button>
            <button className="quiet-button" type="button" onClick={() => setLastMessage("Route refresh requested. Live API connection is the next foundation milestone.") }>
              <RefreshCw size={16} /> Refresh route
            </button>
            <span className={`connectivity-chip ${isOnline ? "connectivity-chip--online" : "connectivity-chip--offline"}`}>
              {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
              {isOnline ? "Ready to sync" : "Offline outbox on"}
            </span>
          </div>
          <p className="interaction-message" role="status">{lastMessage}</p>
        </article>

        <article className="next-stop-card">
          <div className="next-stop-card__head">
            <span className="section-kicker">Next real bin stop</span>
            <span className="eta-chip"><Timer size={14} /> Stop {nextStop.sequence} of {stops.length}</span>
          </div>
          <div className="next-stop-card__content">
            <span className="route-number">{nextStop.sequence.toString().padStart(2, "0")}</span>
            <div>
              <h2>{nextStop.name}</h2>
              <p><MapPinned size={15} /> {nextStop.address}</p>
            </div>
          </div>
          <div className="next-stop-card__measurements">
            <span><Gauge size={15} /> {nextStop.fillPercent}% full</span>
            <span><Fuel size={15} /> {nextStop.capacityKg ? `${nextStop.capacityKg} kg capacity` : "capacity not set"}</span>
            <span><LocateFixed size={15} /> real address saved</span>
          </div>
        </article>
      </section>

      <section className="driver-content-grid">
        <article className="panel route-panel" id="activity">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Route execution</span>
              <h2>Stops in service order</h2>
            </div>
            <CompletionRing percent={progress} />
          </div>

          <div className="route-timeline">
            {stops.map((stop, index) => (
              <article className={`route-stop route-stop--${stop.status}`} key={stop.id}>
                <div className="route-stop__rail" aria-hidden="true">
                  <span>{stop.sequence}</span>
                  {index !== stops.length - 1 && <i />}
                </div>
                <div className="route-stop__body">
                  <div className="route-stop__title-row">
                    <div>
                      <h3>{stop.name}</h3>
                      <p>{stop.address} · <strong>{stop.fillPercent}% full</strong></p>
                    </div>
                    <StopStatus status={stop.status} />
                  </div>
                  <div className="route-stop__meta">
                    <span><Route size={14} /> Stop {stop.sequence} of {stops.length}</span>
                    <span><Fuel size={14} /> {stop.capacityKg ? `${stop.capacityKg} kg capacity` : "capacity not set"}</span>
                    <span><Crosshair size={14} /> Verify within 50 m</span>
                  </div>
                  {stop.status === "pending" && (
                    <div className="route-stop__actions">
                      <button type="button" className="stop-action stop-action--confirm" onClick={() => updateStop(stop.id, "collected")}>
                        <Check size={15} /> Collect
                      </button>
                      <button type="button" className="stop-action" onClick={() => updateStop(stop.id, "inaccessible")}>
                        <CircleAlert size={15} /> Skip
                      </button>
                      <button type="button" className="stop-action" onClick={() => updateStop(stop.id, "damaged")}>
                        <AlertTriangle size={15} /> Damaged
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="driver-side-stack">
          <article className="panel safety-card" id="safety">
            <div className="safety-card__icon"><ShieldAlert size={20} /></div>
            <div>
              <span className="section-kicker">Safety line</span>
              <h2>Need urgent support?</h2>
              <p>Report road hazards or send an SOS to the dispatcher from your active shift.</p>
            </div>
            <button className={`sos-button ${sosRaised ? "sos-button--raised" : ""}`} type="button" onClick={raiseSos}>
              <Siren size={18} /> {sosRaised ? "SOS preview sent" : "Trigger SOS"}
            </button>
            <button className="text-button" type="button" onClick={reportRoadHazard}>
              Report road hazard <ChevronRight size={15} />
            </button>
          </article>

          <article className="panel driver-map-card">
            <div className="panel-heading panel-heading--compact">
              <div>
                <span className="section-kicker">Route overview</span>
                <h2>{configuration.routePlan ? `${configuration.routePlan.estimatedDistanceKm} km local route` : `${stops.length} configured stops`}</h2>
              </div>
              <Navigation size={19} className="muted-icon" />
            </div>
            <div className="driver-real-map" aria-label="Your real bin route on OpenStreetMap">
              <OpenStreetMapBinMap configuration={configuration} compact />
            </div>
          </article>
        </aside>
      </section>
    </AppShell>
  );
}

export function DispatchWorkspace() {
  const { configuration, updateConfiguration } = useShowcaseConfiguration();
  const [isGenerating, setIsGenerating] = useState(false);
  const [routeMessage, setRouteMessage] = useState("Configure and locate your real Ahmedabad bin addresses to build a route.");

  const locatedBins = useMemo(() => configuration.bins.filter(isLocatedBin), [configuration.bins]);
  const orderedBins = useMemo(() => orderedShowcaseBins(configuration), [configuration]);
  const priorityBins = useMemo(
    () => configuration.bins.filter((bin) => bin.fillPercent >= 85),
    [configuration.bins],
  );
  const routePlan = configuration.routePlan;

  function generateRoutes() {
    if (configuration.bins.length === 0) {
      setRouteMessage("Add your real bin addresses in Configure real bins before building a route.");
      return;
    }
    if (locatedBins.length === 0) {
      setRouteMessage("Locate at least one real bin address on the map before building a route.");
      return;
    }
    if (locatedBins.length !== configuration.bins.length) {
      setRouteMessage(`Locate the remaining ${configuration.bins.length - locatedBins.length} bin address${configuration.bins.length - locatedBins.length === 1 ? "" : "es"} before building the final route.`);
      return;
    }

    setIsGenerating(true);
    setRouteMessage("Ordering your real Ahmedabad bin locations by local proximity…");
    window.setTimeout(() => {
      const plan = createLocalShowcaseRoute(configuration);
      setIsGenerating(false);
      if (!plan) {
        setRouteMessage("No mapped bin locations were available. Check your address lookup or coordinates.");
        return;
      }
      updateConfiguration({ ...configuration, routePlan: plan });
      setRouteMessage("Your real bin visit order is ready. This prototype uses local straight-line proximity, not a live road-routing API.");
    }, 650);
  }

  function publishDemoRoute() {
    if (!routePlan) {
      setRouteMessage("Build the local route order before publishing it to the driver showcase.");
      return;
    }
    updateConfiguration({
      ...configuration,
      routePlan: { ...routePlan, publishedAt: new Date().toISOString() },
    });
    setRouteMessage(`${routePlan.id} is now available in the driver showcase. No real driver was notified.`);
  }

  return (
    <AppShell
      role="dispatcher"
      eyebrow={`Ahmedabad control centre · ${configuration.bins.length} real bin${configuration.bins.length === 1 ? "" : "s"} configured`}
      title="Your real bin operations map"
      subtitle="Display your own dustbin locations, review fill levels, and demonstrate the collection workflow."
    >
      <section className="metric-grid metric-grid--four">
        <MetricCard label="Real bins added" value={String(configuration.bins.length).padStart(2, "0")} detail={`up to ${MAX_SHOWCASE_BINS} for this prototype`} tone="blue" icon={MapPinned} />
        <MetricCard label="Locations on map" value={String(locatedBins.length).padStart(2, "0")} detail={`${Math.max(configuration.bins.length - locatedBins.length, 0)} still need locating`} tone="mint" icon={LocateFixed} />
        <MetricCard label="Priority bins" value={String(priorityBins.length).padStart(2, "0")} detail="manual fill level at 85%+" tone="amber" icon={BellRing} />
        <MetricCard label="Route status" value={routePlan?.publishedAt ? "Shared" : routePlan ? "Ready" : "Setup"} detail={routePlan?.publishedAt ? "shown in Driver view" : "build when locations are ready"} tone={routePlan?.publishedAt ? "mint" : "rose"} icon={Route} />
      </section>

      <section className="dispatch-grid" id="activity">
        <article className="panel real-map-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Your locations on OpenStreetMap</span>
              <h2>Ahmedabad dustbin map</h2>
            </div>
            <Link className="map-control" href="/setup"><MapPinned size={16} /> Configure bins</Link>
          </div>
          {locatedBins.length > 0 ? (
            <OpenStreetMapBinMap configuration={configuration} />
          ) : (
            <div className="real-map-empty-state">
              <span><MapPinned size={25} /></span>
              <h3>Add your first real bin location</h3>
              <p>Enter an Ahmedabad address and select Locate. Your own dustbin pins will appear here.</p>
              <Link className="primary-button" href="/setup">Configure real bins <ChevronRight size={17} /></Link>
            </div>
          )}
          <div className="map-footnote">
            <Radio size={15} /> OpenStreetMap displays your configured locations. Fill levels are entered manually; no live sensor data is connected.
          </div>
        </article>

        <aside className="panel bin-status-panel" id="safety">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Real bin status</span>
              <h2>Collection demand</h2>
            </div>
            <Link className="text-button" href="/setup">Edit bins <ChevronRight size={15} /></Link>
          </div>
          {configuration.bins.length === 0 ? (
            <div className="bin-status-panel__empty"><MapPinned size={20} /><p>Your configured bin details will appear here.</p></div>
          ) : (
            <div className="real-bin-list">
              {orderedBins.map((bin, index) => {
                const level = bin.fillPercent >= 90 ? "critical" : bin.fillPercent >= 85 ? "high" : bin.fillPercent >= 70 ? "warning" : "normal";
                return (
                  <article className={`real-bin-row real-bin-row--${level}`} key={bin.id}>
                    <span className="real-bin-row__number">{String(index + 1).padStart(2, "0")}</span>
                    <div className="real-bin-row__body">
                      <div><strong>{bin.name || bin.id}</strong><span>{bin.id}</span></div>
                      <p><MapPinned size={13} /> {bin.address}</p>
                      <div className="real-bin-row__meta"><span><Gauge size={13} /> {bin.fillPercent}% full</span><span>{isLocatedBin(bin) ? "Pin ready" : "Needs location"}</span></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </section>

      <section className="dispatch-lower-grid">
        <article className="panel planner-panel">
          <div className="planner-panel__topline">
            <div>
              <span className="section-kicker">Local route ordering</span>
              <h2>Build a visit sequence for your bins</h2>
              <p>For this offline-friendly prototype, the route order is calculated from your actual map-pin proximity. Connect a road-routing API later for traffic-aware distance and ETA.</p>
            </div>
            <div className="planner-status"><Sparkles size={16} /> No API key required</div>
          </div>
          <div className="planner-panel__inputs">
            <span><MapPinned size={16} /> {configuration.bins.length} real bins entered</span>
            <span><LocateFixed size={16} /> {locatedBins.length} locations ready</span>
            <span><Gauge size={16} /> {priorityBins.length} priority bins</span>
            <span><Navigation size={16} /> {routePlan ? "route sequence built" : "route not built"}</span>
          </div>

          {routePlan && (
            <div className="demo-route-result" aria-live="polite">
              <div className="demo-route-result__heading">
                <span><Check size={15} /> Your real bin order is ready</span>
                <strong>{routePlan.id}</strong>
              </div>
              <div className="demo-route-result__metrics">
                <span><strong>{routePlan.orderedBinIds.length}</strong> real bins sequenced</span>
                <span><strong>{routePlan.estimatedDistanceKm} km</strong> approx. local proximity path</span>
                <span><strong>{priorityBins.length}</strong> high-fill bins checked</span>
                <span><strong>{routePlan.publishedAt ? "Shared" : "Draft"}</strong> driver demo status</span>
              </div>
              <div className="demo-route-result__footer">
                <span><Clock3 size={14} /> Generated from stored map coordinates</span>
                <button className={`publish-demo-button ${routePlan.publishedAt ? "publish-demo-button--published" : ""}`} type="button" onClick={publishDemoRoute}>
                  {routePlan.publishedAt ? <Check size={15} /> : <Route size={15} />}
                  {routePlan.publishedAt ? "Published to Driver view" : "Publish to Driver view"}
                </button>
              </div>
            </div>
          )}

          <div className="planner-panel__footer">
            <p className="interaction-message" role="status">{routeMessage}</p>
            <button className="primary-button" type="button" onClick={generateRoutes} disabled={isGenerating}>
              {isGenerating ? <RefreshCw className="spin" size={17} /> : <Route size={17} />}
              {isGenerating ? "Ordering locations…" : routePlan ? "Rebuild local route" : "Build local route"}
            </button>
          </div>
        </article>

        <article className="panel route-order-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Driver hand-off</span>
              <h2>{routePlan ? "Visit sequence" : "What the Driver sees"}</h2>
            </div>
            <Navigation size={19} className="muted-icon" />
          </div>
          {orderedBins.length === 0 ? (
            <div className="route-order-panel__empty">Add and save your real bins to preview the driver route.</div>
          ) : (
            <ol className="route-order-list">
              {orderedBins.map((bin, index) => (
                <li key={bin.id}><span>{index + 1}</span><div><strong>{bin.name || bin.id}</strong><small>{bin.address}</small></div><Gauge size={15} /></li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </AppShell>
  );
}

export function AdminWorkspace() {
  const { configuration } = useShowcaseConfiguration();
  const [exportStatus, setExportStatus] = useState("Showcase payroll data is ready for a local CSV preview.");
  const locatedBinCount = configuration.bins.filter(isLocatedBin).length;

  return (
    <AppShell
      role="admin"
      eyebrow="Ahmedabad administration · September payroll cycle"
      title="People, fleet & payroll"
      subtitle="A presentation-ready view of people, fleet, payroll, and accountable field work."
    >
      <section className="metric-grid metric-grid--four">
        <MetricCard label="Active staff" value="42" detail="39 on active roster" tone="mint" icon={UsersRound} />
        <MetricCard label="Open shifts" value="06" detail="3 routes in progress" tone="blue" icon={Clock3} />
        <MetricCard label="Payroll pending" value="₹ 84,260" detail="11 shifts await approval" tone="amber" icon={ArrowDownToLine} />
        <MetricCard label="Real bins mapped" value={`${locatedBinCount} / ${configuration.bins.length}`} detail="saved in this browser" tone="rose" icon={MapPinned} />
      </section>

      <section className="admin-primary-grid" id="activity">
        <article className="panel payroll-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Shift & payroll ledger</span>
              <h2>Today&apos;s field activity</h2>
            </div>
            <button className="primary-button primary-button--compact" type="button" onClick={() => setExportStatus("CSV showcase preview generated. No real payroll or employee data is exported.") }>
              <ArrowDownToLine size={16} /> Export CSV
            </button>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Driver</th><th>Route</th><th>Clock in</th><th>Bins</th><th>Status</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {shiftRows.map((shift) => (
                  <tr key={shift.route}>
                    <td><span className="table-person"><i>{shift.driver.split(" ").map((word) => word[0]).join("")}</i>{shift.driver}</span></td>
                    <td>{shift.route}</td>
                    <td>{shift.clockIn}</td>
                    <td>{shift.bins}</td>
                    <td><span className={`table-status table-status--${shift.status.toLowerCase()}`}>{shift.status}</span></td>
                    <td><button className="row-button" type="button">Review <ChevronRight size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="interaction-message">{exportStatus}</p>
        </article>

        <aside className="panel payroll-summary-card">
          <span className="section-kicker">Current cycle</span>
          <h2>Payroll readiness</h2>
          <div className="payroll-amount">₹ 84,260</div>
          <p>Showcase-only estimated wage total across 31 sample shifts.</p>
          <div className="payroll-summary-card__progress">
            <div><span>Approval progress</span><strong>74%</strong></div>
            <RouteProgress progress={74} />
          </div>
          <div className="payroll-summary-card__facts">
            <span><Check size={15} /> 31 approved</span>
            <span><Clock3 size={15} /> 11 to review</span>
          </div>
          <button className="text-button" type="button">Review payroll queue <ChevronRight size={15} /></button>
        </aside>
      </section>

      <section className="admin-lower-grid">
        <article className="panel vehicle-registry-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Your real bin registry</span>
              <h2>Configured dustbin locations</h2>
            </div>
            <Link className="text-button" href="/setup">Manage bins <ChevronRight size={15} /></Link>
          </div>
          {configuration.bins.length === 0 ? (
            <div className="vehicle-grid__empty">
              <MapPinned size={19} />
              <span>Add your real Ahmedabad dustbins to show them across Dispatcher and Driver views.</span>
              <Link className="text-button" href="/setup">Configure bins <ChevronRight size={15} /></Link>
            </div>
          ) : (
            <div className="vehicle-grid">
              {configuration.bins.slice(0, 3).map((bin) => (
                <article className={`vehicle-card ${isLocatedBin(bin) ? "vehicle-card--ready" : "vehicle-card--service"}`} key={bin.id}>
                  <span><MapPinned size={18} /> {bin.name || bin.id}</span>
                  <strong>{bin.id}</strong>
                  <small><i /> {bin.fillPercent}% full · {isLocatedBin(bin) ? "map pin ready" : "needs location"}</small>
                </article>
              ))}
              {configuration.bins.length > 3 && <article className="vehicle-card vehicle-card--more"><span><Plus size={18} /> More real bins</span><strong>+{configuration.bins.length - 3} configured</strong><small>View all locations in Dispatcher</small></article>}
            </div>
          )}
        </article>

        <article className="panel roster-panel" id="help">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Access & roster</span>
              <h2>Role coverage</h2>
            </div>
            <ShieldCheck size={19} className="muted-icon" />
          </div>
          <div className="role-coverage">
            <div><span className="role-coverage__icon"><UsersRound size={16} /></span><p><strong>34 drivers</strong><small>4 scheduled off duty</small></p><span className="role-coverage__tag">Covered</span></div>
            <div><span className="role-coverage__icon"><Radio size={16} /></span><p><strong>5 dispatchers</strong><small>2 in the control centre</small></p><span className="role-coverage__tag">Covered</span></div>
            <div><span className="role-coverage__icon"><ShieldCheck size={16} /></span><p><strong>3 administrators</strong><small>Payroll review enabled</small></p><span className="role-coverage__tag">Active</span></div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
