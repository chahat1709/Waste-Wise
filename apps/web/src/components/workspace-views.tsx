"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, FormEvent } from "react";

import {
  AlertTriangle,
  ArrowDownToLine,
  BellRing,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crosshair,
  Database,
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
  Timer,
  Truck,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { enqueueOfflineCommand, type OfflineCommandType } from "@/lib/offline/outbox";
import {
  areAllShowcaseStopsResolved,
  createLocalShowcaseRoute,
  getShowcaseStopCounts,
  getShowcaseStopRecord,
  getShowcaseStopStatus,
  isLocatedBin,
  MAX_SHOWCASE_BINS,
  orderedShowcaseBins,
  plannedShowcaseBins,
  routeLifecycleLabel,
  type ShowcaseIncident,
  type ShowcaseRoutePlan,
  type ShowcaseStopStatus,
} from "@/lib/showcase/bins";
import { useShowcaseConfiguration } from "@/lib/showcase/storage";

type ShowcaseExceptionStatus = Extract<ShowcaseStopStatus, "inaccessible" | "damaged">;

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

function StopStatus({ status }: { status: ShowcaseStopStatus }) {
  const labels: Record<ShowcaseStopStatus, string> = {
    pending: "Pending",
    collected: "Collected",
    inaccessible: "Inaccessible",
    damaged: "Damaged",
  };

  return <span className={`stop-status stop-status--${status}`}>{labels[status]}</span>;
}

function CompletionRing({ percent }: { percent: number }) {
  return (
    <div className="completion-ring" style={{ "--completion": `${percent * 3.6}deg` } as CSSProperties}>
      <div>
        <strong>{percent}%</strong>
        <span>resolved</span>
      </div>
    </div>
  );
}

function createOfflineCommandId() {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("This browser cannot create a secure offline command identifier.");
  }
  return globalThis.crypto.randomUUID();
}

function formatTimestamp(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShiftDuration(startedAt?: string, endedAt?: string) {
  if (!startedAt || !endedAt) return "—";
  const elapsedMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "—";
  const totalMinutes = Math.round(elapsedMs / 60_000);
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`;
}

function RouteStateChip({ routePlan }: { routePlan: ShowcaseRoutePlan | null }) {
  const lifecycle = routePlan?.lifecycle ?? null;
  return <span className={`route-state-chip route-state-chip--${lifecycle ?? "none"}`}>{routeLifecycleLabel(lifecycle)}</span>;
}

function csvValue(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function DriverWorkspace() {
  const { configuration, updateConfiguration } = useShowcaseConfiguration();
  const [lastMessage, setLastMessage] = useState("Wait for Dispatch to assign and publish a route before starting your shift.");
  const [exceptionDraft, setExceptionDraft] = useState<{ stopId: string; status: ShowcaseExceptionStatus; note: string } | null>(null);
  const [isHazardFormOpen, setIsHazardFormOpen] = useState(false);
  const [hazardNote, setHazardNote] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  const routePlan = configuration.routePlan;
  const routeBins = useMemo(() => plannedShowcaseBins(configuration), [configuration]);
  const stops = useMemo(
    () => routeBins.map((bin, index) => ({
      id: bin.id,
      sequence: index + 1,
      name: bin.name || bin.id,
      address: bin.address,
      fillPercent: bin.fillPercent,
      capacityKg: bin.capacityKg,
      status: getShowcaseStopStatus(routePlan, bin.id),
      record: getShowcaseStopRecord(routePlan, bin.id),
    })),
    [routeBins, routePlan],
  );
  const stopCounts = getShowcaseStopCounts(routePlan);
  const resolvedStops = stopCounts.collected + stopCounts.inaccessible + stopCounts.damaged;
  const progress = Math.round((resolvedStops / Math.max(stops.length, 1)) * 100);
  const nextStop = stops.find((stop) => stop.status === "pending");
  const isShiftActive = routePlan?.lifecycle === "in_progress";
  const isShiftComplete = routePlan?.lifecycle === "completed";
  const hasRaisedSos = Boolean(routePlan?.incidents.some((incident) => incident.type === "sos" && !incident.acknowledgedAt));
  const assignmentReady = Boolean(routePlan?.assignment.driverName.trim() && routePlan?.assignment.vehicleLabel.trim());

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

  function startShift() {
    if (!routePlan || routePlan.lifecycle !== "published" || !assignmentReady) {
      setLastMessage("Dispatch must assign a driver and vehicle, then publish the route before a shift can start.");
      return;
    }

    const startedAt = new Date().toISOString();
    updateConfiguration((current) => {
      const currentPlan = current.routePlan;
      if (!currentPlan || currentPlan.lifecycle !== "published") return current;
      return {
        ...current,
        routePlan: { ...currentPlan, lifecycle: "in_progress", startedAt, endedAt: undefined },
      };
    });
    setLastMessage("Shift started in the local showcase. Stop outcomes are manual/unverified here; production will enforce the 50 m GPS rule.");
  }

  function endShift() {
    if (!routePlan || routePlan.lifecycle !== "in_progress") return;
    if (!areAllShowcaseStopsResolved(routePlan)) {
      setLastMessage(`${stopCounts.pending} stop${stopCounts.pending === 1 ? " is" : "s are"} still pending. Record Collected, Inaccessible, or Damaged for every stop before ending the shift.`);
      return;
    }

    const endedAt = new Date().toISOString();
    updateConfiguration((current) => {
      const currentPlan = current.routePlan;
      if (!currentPlan || currentPlan.lifecycle !== "in_progress") return current;
      return { ...current, routePlan: { ...currentPlan, lifecycle: "completed", endedAt } };
    });
    setLastMessage("Shift completed locally. HR / Admin can now review the route record and download its showcase CSV.");
  }

  async function updateStop(stopId: string, status: Exclude<ShowcaseStopStatus, "pending">, exceptionNote?: string) {
    if (!routePlan || routePlan.lifecycle !== "in_progress") {
      setLastMessage("Start the assigned shift before recording a stop outcome.");
      return;
    }

    const stop = stops.find((item) => item.id === stopId);
    const note = exceptionNote?.trim();
    if ((status === "inaccessible" || status === "damaged") && !note) {
      setLastMessage(`Add a reason before marking ${stop?.name ?? "this stop"} ${status}.`);
      return;
    }

    const recordedAt = new Date().toISOString();
    updateConfiguration((current) => {
      const currentPlan = current.routePlan;
      if (!currentPlan || currentPlan.lifecycle !== "in_progress") return current;
      return {
        ...current,
        routePlan: {
          ...currentPlan,
          stopRecords: {
            ...currentPlan.stopRecords,
            [stopId]: { status, recordedAt, verification: "showcase_unverified", note },
          },
        },
      };
    });
    setExceptionDraft(null);

    const queued = await queueWhenOffline(
      status === "collected" ? "collection.record" : "route-stop.skip",
      { routeStopReference: stopId, outcome: status, note: note ?? null },
    );
    const copy: Record<Exclude<ShowcaseStopStatus, "pending">, string> = {
      collected: "marked Collected",
      inaccessible: "marked Inaccessible",
      damaged: "marked Damaged",
    };
    setLastMessage(
      queued
        ? `${stop?.name ?? "Stop"} was queued in this device's offline outbox.`
        : `${stop?.name ?? "Stop"} was ${copy[status]}. The local showcase record is visible to Dispatch.`,
    );
  }

  async function addIncident(type: ShowcaseIncident["type"], note: string) {
    if (!routePlan || routePlan.lifecycle !== "in_progress") {
      setLastMessage("Start the assigned shift before reporting a road hazard or raising SOS.");
      return;
    }

    const normalizedNote = note.trim();
    if (!normalizedNote) {
      setLastMessage("Add a short road-hazard description before reporting it to Dispatch.");
      return;
    }

    const createdAt = new Date().toISOString();
    const id = createOfflineCommandId();
    updateConfiguration((current) => {
      const currentPlan = current.routePlan;
      if (!currentPlan || currentPlan.lifecycle !== "in_progress") return current;
      return {
        ...current,
        routePlan: {
          ...currentPlan,
          incidents: [...currentPlan.incidents, { id, type, note: normalizedNote, createdAt }],
        },
      };
    });

    const queued = await queueWhenOffline(
      type === "sos" ? "sos.raise" : "hazard.report",
      { routeReference: routePlan.id, note: normalizedNote },
    );
    setLastMessage(
      queued
        ? `${type === "sos" ? "SOS" : "Road-hazard report"} was queued in the offline outbox.`
        : `${type === "sos" ? "SOS" : "Road-hazard report"} is now visible in the local Dispatch safety centre. No real notification was sent.`,
    );
  }

  function raiseSos() {
    if (hasRaisedSos) {
      setLastMessage("An SOS is already awaiting acknowledgement in Dispatch.");
      return;
    }
    void addIncident("sos", "SOS raised from the Driver showcase");
  }

  function reportRoadHazard() {
    if (!routePlan || routePlan.lifecycle !== "in_progress") {
      setLastMessage("Start the assigned shift before reporting a road hazard.");
      return;
    }
    setIsHazardFormOpen(true);
    setLastMessage("Describe the road hazard so Dispatch can review the local record.");
  }

  function submitRoadHazard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = hazardNote.trim();
    if (!note) {
      setLastMessage("A short road-hazard description is required.");
      return;
    }
    setIsHazardFormOpen(false);
    setHazardNote("");
    void addIncident("road_hazard", note);
  }

  if (configuration.bins.length === 0) {
    return (
      <AppShell role="driver" eyebrow="Step 1 of 4 · real bins not configured" title="No route can be assigned yet" subtitle="Add and locate your dustbin addresses before Dispatch can build a driver route.">
        <section className="workspace-empty-state">
          <span className="workspace-empty-state__icon"><MapPinned size={24} /></span>
          <h2>Configure real Ahmedabad dustbins</h2>
          <p>Set up up to 10 real bin addresses, verify their map pins, then move to Dispatch to create a route.</p>
          <Link className="primary-button" href="/setup">Configure real bins <ChevronRight size={17} /></Link>
        </section>
      </AppShell>
    );
  }

  if (!routePlan) {
    return (
      <AppShell role="driver" eyebrow="Step 2 of 4 · waiting for Dispatch" title="Route planning has not started" subtitle="Your configured bins are ready, but a dispatcher still needs to build and assign the route.">
        <section className="route-gate-card">
          <span className="route-gate-card__icon"><Route size={25} /></span>
          <div>
            <span className="section-kicker">Dispatcher action required</span>
            <h2>Build the collection route first</h2>
            <p>Drivers do not receive the raw bin list. Dispatch must create a local route order, enter a driver and vehicle showcase label, and publish it before this view unlocks.</p>
          </div>
          <Link className="primary-button" href="/dispatch">Open Dispatch <ChevronRight size={17} /></Link>
        </section>
      </AppShell>
    );
  }

  if (routePlan.lifecycle === "draft" || !assignmentReady) {
    return (
      <AppShell role="driver" eyebrow="Step 3 of 4 · route awaiting assignment" title="Dispatch has a route draft" subtitle="The stop list remains unavailable until Dispatch assigns a driver and vehicle label, then publishes the route.">
        <section className="route-gate-card">
          <span className="route-gate-card__icon"><UsersRound size={25} /></span>
          <div>
            <span className="section-kicker">Route draft · {routePlan.orderedBinIds.length} planned stops</span>
            <h2>Awaiting driver and vehicle hand-off</h2>
            <p>This protects the route sequence from being treated as an active driver assignment before Dispatch approves it.</p>
          </div>
          <Link className="primary-button" href="/dispatch">Assign in Dispatch <ChevronRight size={17} /></Link>
        </section>
      </AppShell>
    );
  }

  if (routeBins.length === 0) {
    return (
      <AppShell role="driver" eyebrow="Route needs review" title="No valid stops are available" subtitle="The saved route no longer matches your configured bins.">
        <section className="workspace-empty-state">
          <span className="workspace-empty-state__icon"><AlertTriangle size={24} /></span>
          <h2>Return the route to Dispatch</h2>
          <p>Review the bin setup and rebuild the route before a driver starts the shift.</p>
          <Link className="primary-button" href="/dispatch">Review route <ChevronRight size={17} /></Link>
        </section>
      </AppShell>
    );
  }

  if (routePlan.lifecycle === "published") {
    return (
      <AppShell
        role="driver"
        eyebrow="Step 4 of 4 · route assigned"
        title="Start shift to unlock your stops"
        subtitle="Your dispatcher-approved route is assigned locally. Individual stop addresses stay hidden until the shift starts."
      >
        <section className="route-gate-card route-gate-card--assigned">
          <span className="route-gate-card__icon"><Play size={25} fill="currentColor" /></span>
          <div>
            <span className="section-kicker">Assigned route · {routePlan.id}</span>
            <h2>{routePlan.orderedBinIds.length} stops for {routePlan.assignment.driverName}</h2>
            <p>Vehicle: <strong>{routePlan.assignment.vehicleLabel}</strong>. Starting the showcase shift records a local time and unlocks the stop sequence. Live GPS, 50 m proof, and notifications are not connected.</p>
          </div>
          <button className="primary-button" type="button" onClick={startShift}><Play size={17} fill="currentColor" /> Start shift</button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      role="driver"
      eyebrow={isShiftComplete ? "Route completed · local record ready" : "Shift active · local execution record"}
      title={isShiftComplete ? `Completed route ${routePlan.id}` : `Route ${routePlan.id}`}
      subtitle={isShiftComplete
        ? `${stopCounts.collected} collected · ${stopCounts.inaccessible + stopCounts.damaged} exception${stopCounts.inaccessible + stopCounts.damaged === 1 ? "" : "s"} · review in HR / Admin.`
        : `${stops.length} assigned stop${stops.length === 1 ? "" : "s"} · manual showcase outcomes are visible to Dispatch.`}
    >
      <section className="driver-hero-grid">
        <article className={`shift-card ${isShiftActive ? "shift-card--active" : ""}`}>
          <div className="shift-card__topline">
            <div>
              <span className="section-kicker">Assigned showcase shift</span>
              <h2>{isShiftComplete ? "Route record complete" : "You are on duty"}</h2>
            </div>
            <RouteStateChip routePlan={routePlan} />
          </div>
          <p>
            {isShiftActive
              ? "Stop outcomes are saved locally and shared with the Dispatcher view. GPS validation is deliberately not claimed in this prototype."
              : "All route stops have an outcome. Open HR / Admin to review the local execution record and download its CSV."}
          </p>
          <div className="shift-card__actions">
            {isShiftActive ? (
              <button className="primary-button" type="button" onClick={endShift}>
                <Pause size={17} /> End shift
              </button>
            ) : (
              <Link className="primary-button" href="/admin"><ArrowDownToLine size={17} /> Review in HR / Admin</Link>
            )}
            <button className="quiet-button" type="button" onClick={() => setLastMessage("Route refresh is intentionally disabled during execution so the dispatcher hand-off remains stable.") }>
              <RefreshCw size={16} /> Route locked
            </button>
            <span className={`connectivity-chip ${isOnline ? "connectivity-chip--online" : "connectivity-chip--offline"}`}>
              {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
              {isOnline ? "Local record ready" : "Offline outbox on"}
            </span>
          </div>
          <p className="interaction-message" role="status">{lastMessage}</p>
        </article>

        {nextStop ? (
          <article className="next-stop-card">
            <div className="next-stop-card__head">
              <span className="section-kicker">Next assigned stop</span>
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
              <span><Database size={15} /> {nextStop.capacityKg ? `${nextStop.capacityKg} kg bin capacity note` : "bin capacity not set"}</span>
              <span><Crosshair size={15} /> GPS proof not connected</span>
            </div>
          </article>
        ) : (
          <article className="next-stop-card next-stop-card--complete">
            <div className="next-stop-card__head">
              <span className="section-kicker">All stops resolved</span>
              <span className="eta-chip"><Check size={14} /> Ready to finish</span>
            </div>
            <div className="next-stop-card__content">
              <span className="route-number"><Check size={24} /></span>
              <div>
                <h2>{isShiftComplete ? "Shift completed" : "Finish the route"}</h2>
                <p>{stopCounts.collected} collected · {stopCounts.inaccessible} inaccessible · {stopCounts.damaged} damaged</p>
              </div>
            </div>
            {!isShiftComplete && <button className="primary-button" type="button" onClick={endShift}><Pause size={16} /> End shift</button>}
          </article>
        )}
      </section>

      <section className="driver-content-grid">
        <article className="panel route-panel" id="activity">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Route execution</span>
              <h2>Stops in approved service order</h2>
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
                    <span><Database size={14} /> {stop.capacityKg ? `${stop.capacityKg} kg bin capacity note` : "bin capacity not set"}</span>
                    <span><Crosshair size={14} /> manual, unverified showcase record</span>
                  </div>
                  {stop.record?.note && <p className="route-stop__exception"><CircleAlert size={14} /> {stop.record.note}</p>}
                  {stop.record && <p className="route-stop__recorded">Recorded locally · {formatTimestamp(stop.record.recordedAt)}</p>}
                  {stop.status === "pending" && isShiftActive && (
                    exceptionDraft?.stopId === stop.id ? (
                      <div className="route-exception-form">
                        <label className="field-label">
                          Why is this stop {exceptionDraft.status}?
                          <input
                            autoFocus
                            value={exceptionDraft.note}
                            placeholder="Add a short reason for Dispatch"
                            onChange={(event) => setExceptionDraft({ ...exceptionDraft, note: event.target.value })}
                          />
                        </label>
                        <div>
                          <button className="stop-action" type="button" onClick={() => setExceptionDraft(null)}>Cancel</button>
                          <button className="stop-action stop-action--confirm" type="button" disabled={!exceptionDraft.note.trim()} onClick={() => void updateStop(stop.id, exceptionDraft.status, exceptionDraft.note)}>
                            Save {exceptionDraft.status}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="route-stop__actions">
                        <button type="button" className="stop-action stop-action--confirm" onClick={() => void updateStop(stop.id, "collected")}>
                          <Check size={15} /> Mark collected
                        </button>
                        <button type="button" className="stop-action" onClick={() => setExceptionDraft({ stopId: stop.id, status: "inaccessible", note: "" })}>
                          <CircleAlert size={15} /> Inaccessible
                        </button>
                        <button type="button" className="stop-action" onClick={() => setExceptionDraft({ stopId: stop.id, status: "damaged", note: "" })}>
                          <AlertTriangle size={15} /> Damaged
                        </button>
                      </div>
                    )
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
              <span className="section-kicker">Safety hand-off</span>
              <h2>Need dispatcher support?</h2>
              <p>Road hazards and SOS records appear in the local Dispatch safety centre. No live alert is sent from this prototype.</p>
            </div>
            <button className={`sos-button ${hasRaisedSos ? "sos-button--raised" : ""}`} type="button" onClick={raiseSos} disabled={!isShiftActive || hasRaisedSos}>
              <Siren size={18} /> {hasRaisedSos ? "SOS awaiting review" : "Record SOS"}
            </button>
            {isHazardFormOpen ? (
              <form className="incident-entry-form" onSubmit={submitRoadHazard}>
                <label className="field-label">
                  Road-hazard description
                  <input
                    autoFocus
                    value={hazardNote}
                    placeholder="For example, flooded lane or blocked access"
                    onChange={(event) => setHazardNote(event.target.value)}
                  />
                </label>
                <div>
                  <button className="stop-action" type="button" onClick={() => { setIsHazardFormOpen(false); setHazardNote(""); }}>Cancel</button>
                  <button className="stop-action stop-action--confirm" type="submit" disabled={!hazardNote.trim()}>Save hazard</button>
                </div>
              </form>
            ) : (
              <button className="text-button" type="button" onClick={reportRoadHazard} disabled={!isShiftActive}>
                Report road hazard <ChevronRight size={15} />
              </button>
            )}
          </article>

          <article className="panel driver-map-card">
            <div className="panel-heading panel-heading--compact">
              <div>
                <span className="section-kicker">Approved route overview</span>
                <h2>{routePlan.estimatedDistanceKm} km local proximity path</h2>
              </div>
              <Navigation size={19} className="muted-icon" />
            </div>
            <div className="driver-real-map" aria-label="Assigned real-bin route on OpenStreetMap">
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
  const [routeMessage, setRouteMessage] = useState("Start with your real bins, then build a draft route for dispatcher review.");

  const locatedBins = useMemo(() => configuration.bins.filter(isLocatedBin), [configuration.bins]);
  const displayBins = useMemo(() => orderedShowcaseBins(configuration), [configuration]);
  const plannedBins = useMemo(() => plannedShowcaseBins(configuration), [configuration]);
  const priorityBins = useMemo(
    () => configuration.bins.filter((bin) => bin.fillPercent >= 85),
    [configuration.bins],
  );
  const routePlan = configuration.routePlan;
  const stopCounts = getShowcaseStopCounts(routePlan);
  const resolvedStops = stopCounts.collected + stopCounts.inaccessible + stopCounts.damaged;
  const activeIncidents = routePlan?.incidents.filter((incident) => !incident.acknowledgedAt) ?? [];
  const routeLocked = routePlan?.lifecycle === "published" || routePlan?.lifecycle === "in_progress" || routePlan?.lifecycle === "completed";
  const assignmentReady = Boolean(routePlan?.assignment.driverName.trim() && routePlan?.assignment.vehicleLabel.trim());

  function updateCurrentRoute(update: (plan: ShowcaseRoutePlan) => ShowcaseRoutePlan) {
    updateConfiguration((current) => current.routePlan ? { ...current, routePlan: update(current.routePlan) } : current);
  }

  function generateRoutes() {
    if (routeLocked) {
      setRouteMessage(`${routeLifecycleLabel(routePlan?.lifecycle ?? null)} is read-only. Do not rebuild a route after it has been assigned, started, or completed.`);
      return;
    }
    if (configuration.bins.length === 0) {
      setRouteMessage("Add your real bin addresses in Configure real bins before building a route.");
      return;
    }
    if (locatedBins.length !== configuration.bins.length) {
      setRouteMessage(`Locate all ${configuration.bins.length} configured bin${configuration.bins.length === 1 ? "" : "s"} before building a route. ${configuration.bins.length - locatedBins.length} still need location${configuration.bins.length - locatedBins.length === 1 ? "" : "s"}.`);
      return;
    }

    setIsGenerating(true);
    setRouteMessage("Creating a reviewable local proximity order from your saved map coordinates…");
    window.setTimeout(() => {
      const plan = createLocalShowcaseRoute(configuration);
      setIsGenerating(false);
      if (!plan) {
        setRouteMessage("Each mapped bin needs a unique bin ID, name, and address before Dispatch can create unambiguous stop records.");
        return;
      }
      updateConfiguration((current) => {
        if (current.routePlan && current.routePlan.lifecycle !== "draft") return current;
        const freshPlan = createLocalShowcaseRoute(current);
        return freshPlan ? { ...current, routePlan: freshPlan } : current;
      });
      setRouteMessage("Draft route created. Review its stop sequence, add a driver and vehicle label, then publish it to the Driver view.");
    }, 650);
  }

  function updateAssignment(field: "driverName" | "vehicleLabel", value: string) {
    updateCurrentRoute((plan) => plan.lifecycle === "draft"
      ? { ...plan, assignment: { ...plan.assignment, [field]: value } }
      : plan);
  }

  function publishRoute() {
    if (!routePlan || routePlan.lifecycle !== "draft") {
      setRouteMessage("Only a reviewed draft can be assigned and published.");
      return;
    }
    if (!assignmentReady) {
      setRouteMessage("Enter both a driver name and vehicle reference before publishing this route.");
      return;
    }

    const publishedAt = new Date().toISOString();
    updateCurrentRoute((plan) => plan.lifecycle === "draft" ? {
      ...plan,
      assignment: {
        driverName: plan.assignment.driverName.trim(),
        vehicleLabel: plan.assignment.vehicleLabel.trim(),
      },
      lifecycle: "published",
      publishedAt,
    } : plan);
    setRouteMessage(`${routePlan.id} is assigned to ${routePlan.assignment.driverName.trim()} and ready for the Driver to start a shift. No real notification was sent.`);
  }

  function returnRouteToDraft() {
    if (!routePlan || routePlan.lifecycle !== "published") {
      setRouteMessage("Only an assigned route that has not started can be returned to draft.");
      return;
    }
    updateCurrentRoute((plan) => ({
      ...plan,
      lifecycle: "draft",
      publishedAt: undefined,
      startedAt: undefined,
      endedAt: undefined,
      stopRecords: {},
      incidents: [],
    }));
    setRouteMessage("Route returned to draft. You can revise the assignment or unlock bin setup before publishing again.");
  }

  function acknowledgeIncident(incidentId: string) {
    const acknowledgedAt = new Date().toISOString();
    updateCurrentRoute((plan) => ({
      ...plan,
      incidents: plan.incidents.map((incident) => incident.id === incidentId ? { ...incident, acknowledgedAt } : incident),
    }));
    setRouteMessage("Safety report acknowledged in the local showcase. A production system will retain the dispatcher identity and notification audit.");
  }

  const routeActionLabel = !routePlan
    ? "Build local route"
    : routePlan.lifecycle === "draft"
      ? "Rebuild draft route"
      : routePlan.lifecycle === "published"
        ? "Route assigned"
        : routePlan.lifecycle === "in_progress"
          ? "Driver executing route"
          : "Route completed";

  return (
    <AppShell
      role="dispatcher"
      eyebrow={`Dispatcher workflow · ${configuration.bins.length} real bin${configuration.bins.length === 1 ? "" : "s"} configured`}
      title="Plan, assign, and monitor one route"
      subtitle="Follow the showcase sequence: validate bins → draft route → assign driver and vehicle → publish → review execution."
    >
      <section className="metric-grid metric-grid--four">
        <MetricCard label="Real bins added" value={String(configuration.bins.length).padStart(2, "0")} detail={`up to ${MAX_SHOWCASE_BINS} in this showcase`} tone="blue" icon={MapPinned} />
        <MetricCard label="Map pins ready" value={String(locatedBins.length).padStart(2, "0")} detail={locatedBins.length === configuration.bins.length ? "all locations verified" : `${configuration.bins.length - locatedBins.length} need locating`} tone="mint" icon={LocateFixed} />
        <MetricCard label="Priority bins" value={String(priorityBins.length).padStart(2, "0")} detail="manual fill level at 85%+" tone="amber" icon={BellRing} />
        <MetricCard label="Route lifecycle" value={routePlan ? routePlan.lifecycle.replaceAll("_", " ") : "not planned"} detail={routePlan ? routeLifecycleLabel(routePlan.lifecycle) : "create a draft after map review"} tone={routePlan?.lifecycle === "in_progress" ? "rose" : "blue"} icon={Route} />
      </section>

      <section className="dispatch-grid">
        <article className="panel real-map-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Step 1 · validate real locations</span>
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
              <p>Enter an Ahmedabad address and select Locate. Your own dustbin pins will appear here before a route can be planned.</p>
              <Link className="primary-button" href="/setup">Configure real bins <ChevronRight size={17} /></Link>
            </div>
          )}
          <div className="map-footnote">
            <Radio size={15} /> OpenStreetMap displays your configured locations. Fill levels are manual; no live sensor data is connected.
          </div>
        </article>

        <aside className="panel bin-status-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Real bin demand</span>
              <h2>Collection readiness</h2>
            </div>
            <Link className="text-button" href="/setup">Edit bins <ChevronRight size={15} /></Link>
          </div>
          {configuration.bins.length === 0 ? (
            <div className="bin-status-panel__empty"><MapPinned size={20} /><p>Your configured bin details will appear here.</p></div>
          ) : (
            <div className="real-bin-list">
              {displayBins.map((bin, index) => {
                const level = bin.fillPercent >= 90 ? "critical" : bin.fillPercent >= 85 ? "high" : bin.fillPercent >= 70 ? "warning" : "normal";
                const stopStatus = routePlan ? getShowcaseStopStatus(routePlan, bin.id) : null;
                const statusCopy = !routePlan
                  ? "Not routed"
                  : routePlan.lifecycle === "draft" && stopStatus === "pending"
                    ? "Route draft"
                    : routePlan.lifecycle === "published" && stopStatus === "pending"
                      ? "Assigned"
                      : null;
                return (
                  <article className={`real-bin-row real-bin-row--${level}`} key={bin.id}>
                    <span className="real-bin-row__number">{String(index + 1).padStart(2, "0")}</span>
                    <div className="real-bin-row__body">
                      <div><strong>{bin.name || bin.id}</strong><span>{bin.id}</span></div>
                      <p><MapPinned size={13} /> {bin.address}</p>
                      <div className="real-bin-row__meta">
                        <span><Gauge size={13} /> {bin.fillPercent}% full</span>
                        {stopStatus && !statusCopy ? <StopStatus status={stopStatus} /> : <span>{statusCopy ?? (isLocatedBin(bin) ? "Pin ready" : "Needs location")}</span>}
                      </div>
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
              <span className="section-kicker">Step 2 · route review and assignment</span>
              <h2>Build a stable driver hand-off</h2>
              <p>This showcase visits manually marked high-fill bins first, then uses local straight-line proximity. It creates a reviewable draft and never claims to be a road-safe, traffic-aware, capacity-aware, or CVRP route.</p>
            </div>
            <RouteStateChip routePlan={routePlan} />
          </div>
          <div className="planner-panel__inputs">
            <span><MapPinned size={16} /> {configuration.bins.length} real bins entered</span>
            <span><LocateFixed size={16} /> {locatedBins.length} map pins ready</span>
            <span><Gauge size={16} /> {priorityBins.length} high-fill bins</span>
            <span><Navigation size={16} /> {routePlan ? `${plannedBins.length} planned stops` : "no route draft"}</span>
          </div>

          {routePlan && (
            <div className="demo-route-result" aria-live="polite">
              <div className="demo-route-result__heading">
                <span><Check size={15} /> {routeLifecycleLabel(routePlan.lifecycle)}</span>
                <strong>{routePlan.id}</strong>
              </div>
              <div className="demo-route-result__metrics">
                <span><strong>{routePlan.orderedBinIds.length}</strong> real bins sequenced</span>
                <span><strong>{routePlan.estimatedDistanceKm} km</strong> local proximity path</span>
                <span><strong>{resolvedStops}</strong> stop outcomes recorded</span>
                <span><strong>{activeIncidents.length}</strong> safety reports open</span>
              </div>

              {routePlan.lifecycle === "draft" && (
                <div className="route-assignment-form">
                  <div>
                    <span className="section-kicker">Step 3 · assign before publishing</span>
                    <p>Use local showcase labels only—do not enter private employee data.</p>
                  </div>
                  <label className="field-label">Driver label
                    <input value={routePlan.assignment.driverName} onChange={(event) => updateAssignment("driverName", event.target.value)} placeholder="e.g. Driver 1" />
                  </label>
                  <label className="field-label">Vehicle label
                    <input value={routePlan.assignment.vehicleLabel} onChange={(event) => updateAssignment("vehicleLabel", event.target.value)} placeholder="e.g. Truck 01" />
                  </label>
                  <button className="primary-button" type="button" onClick={publishRoute} disabled={!assignmentReady}>
                    <Route size={16} /> Assign & publish to Driver
                  </button>
                </div>
              )}

              {routePlan.lifecycle === "published" && (
                <div className="route-handoff-state">
                  <span><UsersRound size={16} /> Assigned to <strong>{routePlan.assignment.driverName}</strong> · <Truck size={16} /> {routePlan.assignment.vehicleLabel}</span>
                  <button className="text-button" type="button" onClick={returnRouteToDraft}>Return to draft <ChevronRight size={15} /></button>
                </div>
              )}

              {routePlan.lifecycle === "in_progress" && (
                <div className="route-handoff-state route-handoff-state--active">
                  <span><Play size={16} fill="currentColor" /> {routePlan.assignment.driverName} started at {formatTimestamp(routePlan.startedAt)}. The route is now read-only.</span>
                </div>
              )}

              {routePlan.lifecycle === "completed" && (
                <div className="route-handoff-state route-handoff-state--complete">
                  <span><Check size={16} /> Route completed at {formatTimestamp(routePlan.endedAt)}. Review the execution record in HR / Admin.</span>
                  <Link className="text-button" href="/admin">Open HR / Admin <ChevronRight size={15} /></Link>
                </div>
              )}
            </div>
          )}

          <div className="planner-panel__footer">
            <p className="interaction-message" role="status">{routeMessage}</p>
            <button className="primary-button" type="button" onClick={generateRoutes} disabled={isGenerating || routeLocked}>
              {isGenerating ? <RefreshCw className="spin" size={17} /> : <Route size={17} />}
              {isGenerating ? "Creating draft…" : routeActionLabel}
            </button>
          </div>
        </article>

        <article className="panel route-order-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Approved stop sequence</span>
              <h2>{routePlan ? "Driver hand-off" : "Route preview unavailable"}</h2>
            </div>
            <Navigation size={19} className="muted-icon" />
          </div>
          {plannedBins.length === 0 ? (
            <div className="route-order-panel__empty">Map every real bin, then build a draft route before a service sequence appears here.</div>
          ) : (
            <ol className="route-order-list">
              {plannedBins.map((bin, index) => (
                <li key={bin.id}>
                  <span>{index + 1}</span>
                  <div><strong>{bin.name || bin.id}</strong><small>{bin.address}</small></div>
                  {routePlan && <StopStatus status={getShowcaseStopStatus(routePlan, bin.id)} />}
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>

      <section className="dispatch-monitor-grid">
        <article className="panel execution-monitor-panel" id="activity">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Step 4 · execution record</span>
              <h2>Dispatcher route monitor</h2>
            </div>
            <RouteStateChip routePlan={routePlan} />
          </div>
          {!routePlan ? (
            <div className="monitor-empty-state"><Route size={20} /><p>No route has been created. Build a draft after all real bin pins are ready.</p></div>
          ) : (
            <div className="execution-monitor-grid">
              <div><span>Driver</span><strong>{routePlan.assignment.driverName || "Not assigned"}</strong></div>
              <div><span>Vehicle</span><strong>{routePlan.assignment.vehicleLabel || "Not assigned"}</strong></div>
              <div><span>Collected</span><strong>{stopCounts.collected}</strong></div>
              <div><span>Exceptions</span><strong>{stopCounts.inaccessible + stopCounts.damaged}</strong></div>
              <div><span>Pending</span><strong>{stopCounts.pending}</strong></div>
              <div><span>Shift timing</span><strong>{routePlan.startedAt ? `${formatTimestamp(routePlan.startedAt)}${routePlan.endedAt ? ` – ${formatTimestamp(routePlan.endedAt)}` : ""}` : "Not started"}</strong></div>
            </div>
          )}
        </article>

        <aside className="panel incident-panel" id="safety">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Safety centre · local hand-off</span>
              <h2>Driver reports</h2>
            </div>
            <ShieldAlert size={19} className="muted-icon" />
          </div>
          {routePlan?.incidents.length ? (
            <div className="incident-list">
              {[...routePlan.incidents].reverse().map((incident) => (
                <article className={`incident-row incident-row--${incident.type}`} key={incident.id}>
                  <span>{incident.type === "sos" ? <Siren size={16} /> : <AlertTriangle size={16} />}</span>
                  <div>
                    <strong>{incident.type === "sos" ? "SOS" : "Road hazard"}</strong>
                    <p>{incident.note}</p>
                    <small>{formatTimestamp(incident.createdAt)} · {incident.acknowledgedAt ? "acknowledged locally" : "awaiting acknowledgement"}</small>
                  </div>
                  {!incident.acknowledgedAt && <button className="text-button" type="button" onClick={() => acknowledgeIncident(incident.id)}>Acknowledge</button>}
                </article>
              ))}
            </div>
          ) : (
            <div className="monitor-empty-state"><ShieldCheck size={20} /><p>No local driver hazard or SOS record yet. Live notifications are a production integration.</p></div>
          )}
        </aside>
      </section>
    </AppShell>
  );
}

export function AdminWorkspace() {
  const { configuration, updateConfiguration } = useShowcaseConfiguration();
  const [exportStatus, setExportStatus] = useState("Complete one local showcase route to enable its execution CSV.");
  const routePlan = configuration.routePlan;
  const plannedBins = useMemo(() => plannedShowcaseBins(configuration), [configuration]);
  const stopCounts = getShowcaseStopCounts(routePlan);
  const exceptionCount = stopCounts.inaccessible + stopCounts.damaged;
  const canExport = routePlan?.lifecycle === "completed";

  function downloadExecutionCsv() {
    if (!routePlan || routePlan.lifecycle !== "completed") {
      setExportStatus("Finish every stop and end the local showcase shift before downloading its execution CSV.");
      return;
    }

    const rows: Array<Array<string | number>> = [
      ["Waste-Wise local showcase execution record"],
      ["Route", routePlan.id],
      ["Driver label", routePlan.assignment.driverName],
      ["Vehicle label", routePlan.assignment.vehicleLabel],
      ["Route lifecycle", routePlan.lifecycle],
      ["Shift started", routePlan.startedAt ?? ""],
      ["Shift ended", routePlan.endedAt ?? ""],
      ["Collected stops", stopCounts.collected],
      ["Exception stops", exceptionCount],
      [],
      ["Sequence", "Bin ID", "Bin name", "Address", "Outcome", "Recorded at", "Exception note", "Verification"],
      ...plannedBins.map((bin, index) => {
        const record = getShowcaseStopRecord(routePlan, bin.id);
        return [
          index + 1,
          bin.id,
          bin.name,
          bin.address,
          getShowcaseStopStatus(routePlan, bin.id),
          record?.recordedAt ?? "",
          record?.note ?? "",
          record?.verification ?? "pending",
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${routePlan.id.toLowerCase()}-showcase-execution.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus("Local execution CSV downloaded. It is a showcase record, not an approved payroll export.");
  }

  function startNewShowcaseRoute() {
    if (!routePlan || routePlan.lifecycle !== "completed") {
      setExportStatus("Finish the current route before starting a new local showcase route.");
      return;
    }
    if (!window.confirm("Start a new showcase route? The completed local route record will be cleared, while your saved bin locations stay in place.")) return;
    updateConfiguration((current) => current.routePlan?.lifecycle === "completed" ? { ...current, routePlan: null } : current);
    setExportStatus("Completed local route cleared. Your real bin locations remain saved; return to Dispatch to create the next draft.");
  }

  return (
    <AppShell
      role="admin"
      eyebrow="HR / Admin · local showcase records"
      title="Review route execution with an honest admin boundary"
      subtitle="This view uses the same configured bins and route execution record. No account, wage, or fleet record has been supplied for this demo."
    >
      <section className="metric-grid metric-grid--four">
        <MetricCard label="Real bins mapped" value={`${configuration.bins.filter(isLocatedBin).length} / ${configuration.bins.length}`} detail="saved in this browser" tone="mint" icon={MapPinned} />
        <MetricCard label="Route lifecycle" value={routePlan ? routePlan.lifecycle.replaceAll("_", " ") : "not planned"} detail={routePlan ? routeLifecycleLabel(routePlan.lifecycle) : "awaiting Dispatch"} tone="blue" icon={Route} />
        <MetricCard label="Bins collected" value={String(stopCounts.collected).padStart(2, "0")} detail={routePlan ? "local manual outcomes" : "no route record"} tone="amber" icon={Check} />
        <MetricCard label="Exceptions" value={String(exceptionCount).padStart(2, "0")} detail={exceptionCount ? "review with Dispatcher" : "none recorded"} tone="rose" icon={CircleAlert} />
      </section>

      <section className="admin-primary-grid" id="activity">
        <article className="panel payroll-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Current showcase shift</span>
              <h2>Route execution ledger</h2>
            </div>
            <button className="primary-button primary-button--compact" type="button" onClick={downloadExecutionCsv} disabled={!canExport}>
              <ArrowDownToLine size={16} /> Download execution CSV
            </button>
          </div>
          {!routePlan ? (
            <div className="admin-empty-state">
              <Route size={21} />
              <div><strong>No showcase route exists yet</strong><p>Dispatch must build and publish a route; then the Driver can start and complete a local shift.</p></div>
              <Link className="text-button" href="/dispatch">Open Dispatch <ChevronRight size={15} /></Link>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Route</th><th>Driver label</th><th>Vehicle label</th><th>Shift start</th><th>Shift end</th><th>Collected</th><th>Exceptions</th><th>Status</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{routePlan.id}</td>
                    <td>{routePlan.assignment.driverName || "Not assigned"}</td>
                    <td>{routePlan.assignment.vehicleLabel || "Not assigned"}</td>
                    <td>{formatTimestamp(routePlan.startedAt)}</td>
                    <td>{formatTimestamp(routePlan.endedAt)}</td>
                    <td>{stopCounts.collected}</td>
                    <td>{exceptionCount}</td>
                    <td><RouteStateChip routePlan={routePlan} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="interaction-message">{exportStatus}</p>
        </article>

        <aside className="panel admin-handoff-card">
          <span className="section-kicker">Admin hand-off</span>
          <h2>What this demo can verify</h2>
          <div className="admin-handoff-card__facts">
            <span><UsersRound size={16} /><small>Driver label</small><strong>{routePlan?.assignment.driverName || "Not assigned"}</strong></span>
            <span><Truck size={16} /><small>Vehicle label</small><strong>{routePlan?.assignment.vehicleLabel || "Not assigned"}</strong></span>
            <span><Clock3 size={16} /><small>Worked duration</small><strong>{formatShiftDuration(routePlan?.startedAt, routePlan?.endedAt)}</strong></span>
            <span><ShieldAlert size={16} /><small>Safety reports</small><strong>{routePlan?.incidents.length ?? 0}</strong></span>
          </div>
          <p>Labels, route timing, and outcomes are stored locally for this showcase. They are not employee accounts, wage calculations, approved payroll, or a production vehicle registry.</p>
          <Link className="text-button" href="/dispatch">Review with Dispatcher <ChevronRight size={15} /></Link>
          {canExport && <button className="text-button" type="button" onClick={startNewShowcaseRoute}><RefreshCw size={15} /> Start a new local route</button>}
        </aside>
      </section>

      <section className="admin-lower-grid">
        <article className="panel vehicle-registry-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Configured bin registry</span>
              <h2>Real dustbin locations</h2>
            </div>
            <Link className="text-button" href="/setup">Manage bins <ChevronRight size={15} /></Link>
          </div>
          {configuration.bins.length === 0 ? (
            <div className="vehicle-grid__empty">
              <MapPinned size={19} />
              <span>Add real Ahmedabad dustbins before reviewing route or execution records.</span>
              <Link className="text-button" href="/setup">Configure bins <ChevronRight size={15} /></Link>
            </div>
          ) : (
            <div className="vehicle-grid">
              {configuration.bins.slice(0, 3).map((bin) => {
                const status = routePlan ? getShowcaseStopStatus(routePlan, bin.id) : null;
                return (
                  <article className={`vehicle-card ${isLocatedBin(bin) ? "vehicle-card--ready" : "vehicle-card--service"}`} key={bin.id}>
                    <span><MapPinned size={18} /> {bin.name || bin.id}</span>
                    <strong>{bin.id}</strong>
                    <small><i /> {bin.fillPercent}% full · {status ? `route: ${status}` : isLocatedBin(bin) ? "map pin ready" : "needs location"}</small>
                  </article>
                );
              })}
              {configuration.bins.length > 3 && <article className="vehicle-card vehicle-card--more"><span><Plus size={18} /> More real bins</span><strong>+{configuration.bins.length - 3} configured</strong><small>View all locations in Dispatch</small></article>}
            </div>
          )}
        </article>

        <article className="panel roster-panel" id="help">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="section-kicker">Production admin modules</span>
              <h2>What remains intentionally unconnected</h2>
            </div>
            <ShieldCheck size={19} className="muted-icon" />
          </div>
          <div className="admin-readiness-list">
            <div><span><UsersRound size={16} /></span><p><strong>Accounts & roles</strong><small>Require Supabase authentication and server-side authorization.</small></p><em>Planned</em></div>
            <div><span><Truck size={16} /></span><p><strong>Vehicle registry</strong><small>Only the route&apos;s local vehicle label is captured for this demo.</small></p><em>Planned</em></div>
            <div><span><ArrowDownToLine size={16} /></span><p><strong>Payroll export</strong><small>CSV shows showcase execution only; wage approval needs real staff data.</small></p><em>Guarded</em></div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
