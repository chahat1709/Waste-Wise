"use client";

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
  MoreHorizontal,
  Navigation,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Route,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Timer,
  Truck,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { alerts, fleet, routeStops, shiftRows } from "@/lib/demo-data";
import type { AlertItem, AlertSeverity, RouteStop, RouteStopStatus } from "@/lib/domain";
import { enqueueOfflineCommand, type OfflineCommandType } from "@/lib/offline/outbox";

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

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const labels: Record<AlertSeverity, string> = {
    critical: "Critical",
    high: "High",
    warning: "Warning",
    info: "Info",
  };

  return <span className={`severity-badge severity-badge--${severity}`}>{labels[severity]}</span>;
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
  const [onShift, setOnShift] = useState(false);
  const [stops, setStops] = useState<RouteStop[]>(routeStops);
  const [lastMessage, setLastMessage] = useState("Your shift is not active. Location sharing remains paused.");
  const [sosRaised, setSosRaised] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

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
  const progress = Math.round((completedStops / stops.length) * 100);
  const nextStop = stops.find((stop) => stop.status === "pending") ?? stops[stops.length - 1];

  function toggleShift() {
    const nextState = !onShift;
    setOnShift(nextState);
    setSosRaised(false);
    setLastMessage(
      nextState
        ? "Shift started at 08:42. Location sharing is active while you are on duty."
        : "Shift ended. Location sharing has stopped and your route is locked.",
    );
  }

  async function updateStop(stopId: string, status: RouteStopStatus) {
    if (!onShift) {
      setLastMessage("Start your shift before recording a collection result.");
      return;
    }

    const stop = stops.find((item) => item.id === stopId);
    setStops((current) => current.map((item) => (item.id === stopId ? { ...item, status } : item)));
    const statusCopy: Record<RouteStopStatus, string> = {
      pending: "reset to pending",
      collected: "marked collected after GPS proof",
      inaccessible: "marked inaccessible and sent to dispatch",
      damaged: "marked damaged and escalated to dispatch",
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
    const queued = await queueWhenOffline("sos.raise", { routeReference: "R-2026-091" });
    setLastMessage(
      queued
        ? "SOS preview was queued in the offline outbox. Reconnect immediately so dispatch can receive it."
        : "SOS preview raised. Production will transmit your active route, latest location, accuracy, and timestamp to dispatch.",
    );
  }

  async function reportRoadHazard() {
    const queued = await queueWhenOffline("hazard.report", { kind: "unsafe_access", routeReference: "R-2026-091" });
    setLastMessage(
      queued
        ? "Road-hazard report was queued in the offline outbox for safe replay."
        : "Road-hazard report preview opened. The live map workflow will attach location and create an avoid-area review.",
    );
  }

  return (
    <AppShell
      role="driver"
      eyebrow={onShift ? "Shift active · GPS sharing on" : "Shift ready · GPS sharing paused"}
      title={onShift ? "Route R-2026-091" : "Good morning, Arjun"}
      subtitle={onShift ? "Zone B collection route · 4 planned stops" : "Start your shift to unlock today’s verified collection route."}
    >
      <section className="driver-hero-grid">
        <article className={`shift-card ${onShift ? "shift-card--active" : ""}`}>
          <div className="shift-card__topline">
            <div>
              <span className="section-kicker">Today&apos;s shift</span>
              <h2>{onShift ? "You are on duty" : "Ready when you are"}</h2>
            </div>
            <span className={`live-status ${onShift ? "live-status--active" : ""}`}>
              <i aria-hidden="true" /> {onShift ? "Live" : "Standby"}
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
            <span className="section-kicker">Next verified stop</span>
            <span className="eta-chip"><Timer size={14} /> ETA {nextStop.eta}</span>
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
            <span><Fuel size={15} /> {nextStop.weightKg} kg</span>
            <span><LocateFixed size={15} /> 50 m proof required</span>
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
                    <span><Clock3 size={14} /> {stop.eta}</span>
                    <span><Fuel size={14} /> {stop.weightKg} kg</span>
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
                <h2>Zone B · 7.8 km</h2>
              </div>
              <Navigation size={19} className="muted-icon" />
            </div>
            <div className="mini-map" aria-label="Illustrative route preview">
              <svg viewBox="0 0 300 160" role="img" aria-label="Planned collection route with four stops">
                <path className="mini-map__road" d="M-5 120 C50 105 68 32 126 58 S181 153 231 103 S286 29 312 45" />
                <path className="mini-map__route" d="M14 126 C53 104 70 36 126 59 S180 148 230 105 S279 38 301 45" />
                {[{ x: 14, y: 126 }, { x: 126, y: 59 }, { x: 230, y: 105 }, { x: 301, y: 45 }].map((point, index) => (
                  <g key={index}>
                    <circle className={`mini-map__stop mini-map__stop--${index === 0 ? "start" : "target"}`} cx={point.x} cy={point.y} r="8" />
                    <text x={point.x} y={point.y + 3.5} textAnchor="middle">{index + 1}</text>
                  </g>
                ))}
              </svg>
              <span className="mini-map__label">Provider route geometry connects here in Phase 3</span>
            </div>
          </article>
        </aside>
      </section>
    </AppShell>
  );
}

export function DispatchWorkspace() {
  const [alertItems, setAlertItems] = useState<AlertItem[]>(alerts);
  const [isGenerating, setIsGenerating] = useState(false);
  const [routeMessage, setRouteMessage] = useState("Route planner is ready for a provider-backed matrix.");

  const openAlerts = alertItems.filter((alert) => !alert.acknowledged).length;

  function acknowledgeAlert(id: string) {
    setAlertItems((current) => current.map((alert) => (alert.id === id ? { ...alert, acknowledged: true } : alert)));
  }

  function generateRoutes() {
    setIsGenerating(true);
    setRouteMessage("Validating fleet, bin priorities, capacities, and avoid areas…");
    window.setTimeout(() => {
      setIsGenerating(false);
      setRouteMessage("Preview complete. Connect the selected road-matrix provider before publishing an operational route.");
    }, 800);
  }

  return (
    <AppShell
      role="dispatcher"
      eyebrow="Control centre · 3 trucks active"
      title="Operations command centre"
      subtitle="Prioritize safety signals, coordinate the fleet, and publish only feasible routes."
    >
      <section className="metric-grid metric-grid--four">
        <MetricCard label="Priority alerts" value={openAlerts.toString().padStart(2, "0")} detail="2 need acknowledgement" tone="rose" icon={BellRing} />
        <MetricCard label="Bins due today" value="48" detail="12 above 90% fill" tone="amber" icon={Gauge} />
        <MetricCard label="Fleet on route" value="03 / 05" detail="2 vehicles available" tone="blue" icon={Truck} />
        <MetricCard label="Collections verified" value="76" detail="+18% vs last shift" tone="mint" icon={Check} />
      </section>

      <section className="dispatch-grid" id="activity">
        <article className="panel operations-map-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Live operations map</span>
              <h2>Safety-first collection demand</h2>
            </div>
            <div className="map-controls">
              <button className="map-control" type="button"><LocateFixed size={16} /> Re-centre</button>
              <button className="map-control" type="button"><MapPinned size={16} /> Avoid areas</button>
            </div>
          </div>
          <div className="operations-map" aria-label="Illustrative municipal operations map">
            <span className="map-label map-label--one">Ward 02</span>
            <span className="map-label map-label--two">Market zone</span>
            <span className="map-label map-label--three">Transit corridor</span>
            <svg className="operations-map__roads" viewBox="0 0 700 375" preserveAspectRatio="none" aria-hidden="true">
              <path d="M-20 310 C110 250 140 30 310 95 S400 330 512 248 S590 65 735 88" />
              <path d="M30 40 C150 128 192 109 267 159 S434 134 529 84 S610 182 731 270" />
              <path d="M-10 200 C136 169 224 248 342 218 S558 158 708 190" />
            </svg>
            <svg className="operations-map__route" viewBox="0 0 700 375" preserveAspectRatio="none" aria-hidden="true">
              <path d="M80 292 C178 229 190 90 312 117 S395 309 515 247 S594 100 663 107" />
            </svg>
            <span className="truck-marker truck-marker--one"><Truck size={15} /></span>
            <span className="truck-marker truck-marker--two"><Truck size={15} /></span>
            <button className="bin-marker bin-marker--critical" type="button" aria-label="Critical smoke alert at BIN-1098"><Siren size={13} /></button>
            <button className="bin-marker bin-marker--high" type="button" aria-label="High fill alert at BIN-1024"><Gauge size={13} /></button>
            <button className="bin-marker bin-marker--warning" type="button" aria-label="Warning bin"><Gauge size={13} /></button>
            <button className="bin-marker bin-marker--normal" type="button" aria-label="Normal bin"><Gauge size={13} /></button>
            <div className="map-legend">
              <span><i className="map-legend__dot map-legend__dot--critical" /> Critical</span>
              <span><i className="map-legend__dot map-legend__dot--high" /> High</span>
              <span><i className="map-legend__dot map-legend__dot--normal" /> Normal</span>
              <span><i className="map-legend__line" /> Active route</span>
            </div>
          </div>
          <div className="map-footnote">
            <Radio size={15} /> Live telemetry transport and production map geometry are the next connected milestones.
          </div>
        </article>

        <aside className="panel alert-panel" id="safety">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Safety centre</span>
              <h2>Needs attention</h2>
            </div>
            <button className="text-button" type="button">View all <ChevronRight size={15} /></button>
          </div>
          <div className="alert-list">
            {alertItems.map((alert) => (
              <article className={`alert-row alert-row--${alert.severity}`} key={alert.id}>
                <div className="alert-row__indicator" aria-hidden="true">
                  {alert.severity === "critical" ? <Siren size={17} /> : <AlertTriangle size={17} />}
                </div>
                <div className="alert-row__body">
                  <div className="alert-row__meta"><SeverityBadge severity={alert.severity} /><span>{alert.time}</span></div>
                  <h3>{alert.title}</h3>
                  <p>{alert.description}</p>
                  <span className="alert-row__location"><MapPinned size={13} /> {alert.location}</span>
                  {!alert.acknowledged ? (
                    <button className="inline-action" type="button" onClick={() => acknowledgeAlert(alert.id)}>Acknowledge <ChevronRight size={14} /></button>
                  ) : (
                    <span className="acknowledged"><Check size={13} /> Acknowledged</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="dispatch-lower-grid">
        <article className="panel planner-panel">
          <div className="planner-panel__topline">
            <div>
              <span className="section-kicker">CVRP shift planner</span>
              <h2>Generate feasible collection routes</h2>
              <p>Uses real road cost, truck profile, load limits, and dispatcher avoid areas before a route can be published.</p>
            </div>
            <div className="planner-status"><Sparkles size={16} /> Provider spike pending</div>
          </div>
          <div className="planner-panel__inputs">
            <span><Truck size={16} /> 5 eligible vehicles</span>
            <span><Gauge size={16} /> 48 eligible bins</span>
            <span><MapPinned size={16} /> 2 active avoid areas</span>
            <span><Clock3 size={16} /> Shift ends 16:30</span>
          </div>
          <div className="planner-panel__footer">
            <p className="interaction-message" role="status">{routeMessage}</p>
            <button className="primary-button" type="button" onClick={generateRoutes} disabled={isGenerating}>
              {isGenerating ? <RefreshCw className="spin" size={17} /> : <Route size={17} />}
              {isGenerating ? "Preparing…" : "Generate shift routes"}
            </button>
          </div>
        </article>

        <article className="panel fleet-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Fleet pulse</span>
              <h2>Vehicle availability</h2>
            </div>
            <button className="icon-button" type="button" aria-label="More fleet options"><MoreHorizontal size={20} /></button>
          </div>
          <div className="fleet-list">
            {fleet.map((vehicle) => (
              <article className="fleet-row" key={vehicle.id}>
                <span className={`fleet-row__vehicle fleet-row__vehicle--${vehicle.status.toLowerCase().replace(" ", "-")}`}><Truck size={16} /></span>
                <div className="fleet-row__details">
                  <div><strong>{vehicle.id}</strong><span>{vehicle.driver}</span></div>
                  <RouteProgress progress={vehicle.progress} />
                </div>
                <div className="fleet-row__status"><strong>{vehicle.status}</strong><span>{vehicle.load}</span></div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}

export function AdminWorkspace() {
  const [exportStatus, setExportStatus] = useState("Payroll data is ready for an approved export.");

  return (
    <AppShell
      role="admin"
      eyebrow="Administration · September payroll cycle"
      title="People, fleet & payroll"
      subtitle="Keep municipal operations staffed, equipped, and transparently accounted for."
    >
      <section className="metric-grid metric-grid--four">
        <MetricCard label="Active staff" value="42" detail="39 on active roster" tone="mint" icon={UsersRound} />
        <MetricCard label="Open shifts" value="06" detail="3 routes in progress" tone="blue" icon={Clock3} />
        <MetricCard label="Payroll pending" value="₹ 84,260" detail="11 shifts await approval" tone="amber" icon={ArrowDownToLine} />
        <MetricCard label="Vehicles healthy" value="08 / 10" detail="2 need maintenance review" tone="rose" icon={Truck} />
      </section>

      <section className="admin-primary-grid" id="activity">
        <article className="panel payroll-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Shift & payroll ledger</span>
              <h2>Today&apos;s field activity</h2>
            </div>
            <button className="primary-button primary-button--compact" type="button" onClick={() => setExportStatus("CSV preview generated. Production exports will include only approved shifts and the configured municipal format.") }>
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
          <p>Estimated approved wage total across 31 verified shifts.</p>
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
              <span className="section-kicker">Vehicle registry</span>
              <h2>Fleet capability</h2>
            </div>
            <button className="text-button" type="button">Manage vehicles <ChevronRight size={15} /></button>
          </div>
          <div className="vehicle-grid">
            <article className="vehicle-card vehicle-card--ready"><span><Truck size={18} /> TRK-14</span><strong>5.0 t · 18 m³</strong><small><i /> Ready for dispatch</small></article>
            <article className="vehicle-card vehicle-card--ready"><span><Truck size={18} /> TRK-21</span><strong>4.0 t · 14 m³</strong><small><i /> Ready for dispatch</small></article>
            <article className="vehicle-card vehicle-card--service"><span><Truck size={18} /> TRK-03</span><strong>4.5 t · 16 m³</strong><small><i /> Service due Friday</small></article>
          </div>
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
