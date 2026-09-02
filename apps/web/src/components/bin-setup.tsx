"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Database,
  Download,
  LoaderCircle,
  MapPinned,
  Navigation,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { FormEvent, useState } from "react";

import { AppShell } from "@/components/app-shell";
import {
  blankShowcaseBin,
  isLocatedBin,
  MAX_SHOWCASE_BINS,
  type ShowcaseBin,
  type ShowcaseConfiguration,
  type ShowcaseDepot,
} from "@/lib/showcase/bins";
import {
  clearShowcaseConfiguration,
  useShowcaseConfiguration,
} from "@/lib/showcase/storage";

const OpenStreetMapBinMap = dynamic(
  () => import("@/components/open-street-map-bin-map").then((module) => module.OpenStreetMapBinMap),
  {
    ssr: false,
    loading: () => <div className="map-loading-state"><LoaderCircle size={20} className="spin" /> Loading your map…</div>,
  },
);

interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

function inputNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function BinSetup() {
  const router = useRouter();
  const { configuration, updateConfiguration } = useShowcaseConfiguration();
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const [isLocatingAll, setIsLocatingAll] = useState(false);
  const [message, setMessage] = useState("Add your real Ahmedabad bin addresses, then locate and save them.");

  const locatedCount = configuration.bins.filter(isLocatedBin).length;

  function completeBins() {
    return configuration.bins.filter((bin) => bin.id.trim() && bin.name.trim() && bin.address.trim());
  }

  function hasDuplicateBinIds(bins: ShowcaseBin[]) {
    const ids = new Set<string>();
    return bins.some((bin) => {
      const id = bin.id.trim().toLowerCase();
      if (ids.has(id)) return true;
      ids.add(id);
      return false;
    });
  }

  function invalidateRoute(current: ShowcaseConfiguration): ShowcaseConfiguration {
    return { ...current, routePlan: null };
  }

  function updateDepot(patch: Partial<ShowcaseDepot>) {
    updateConfiguration((current) => invalidateRoute({ ...current, depot: { ...current.depot, ...patch } }));
  }

  function updateBin(id: string, patch: Partial<ShowcaseBin>) {
    updateConfiguration((current) => invalidateRoute({
      ...current,
      bins: current.bins.map((bin) => (bin.id === id ? { ...bin, ...patch } : bin)),
    }));
  }

  function addBin() {
    if (configuration.bins.length >= MAX_SHOWCASE_BINS) {
      setMessage(`This showcase supports up to ${MAX_SHOWCASE_BINS} bins.`);
      return;
    }
    updateConfiguration((current) => invalidateRoute({
      ...current,
      bins: [...current.bins, blankShowcaseBin(current.bins.length + 1)],
    }));
  }

  function removeBin(id: string) {
    updateConfiguration((current) => invalidateRoute({
      ...current,
      bins: current.bins.filter((bin) => bin.id !== id),
    }));
  }

  async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
    const response = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const body = await response.json().catch(() => null) as
      | { result?: GeocodeResult | null; error?: { message?: string } }
      | null;

    if (!response.ok) {
      throw new Error(body?.error?.message ?? "Location search failed.");
    }
    return body?.result ?? null;
  }

  async function locateBin(bin: ShowcaseBin) {
    if (!bin.address.trim()) {
      setMessage(`Add an address for ${bin.id} before locating it.`);
      return;
    }

    setLocatingId(bin.id);
    try {
      const result = await geocodeAddress(bin.address);
      if (!result) {
        setMessage(`No Ahmedabad location was found for ${bin.name || bin.id}. Refine the address or enter coordinates manually.`);
        return;
      }
      updateBin(bin.id, { latitude: result.latitude, longitude: result.longitude });
      setMessage(`${bin.name || bin.id} was located: ${result.displayName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Location search failed.");
    } finally {
      setLocatingId(null);
    }
  }

  async function locateAllBins() {
    const pendingBins = configuration.bins.filter((bin) => bin.address.trim() && !isLocatedBin(bin));
    if (pendingBins.length === 0) {
      setMessage("Every entered address is already located, or needs an address.");
      return;
    }

    setIsLocatingAll(true);
    let located = 0;
    try {
      for (const bin of pendingBins) {
        setLocatingId(bin.id);
        const result = await geocodeAddress(bin.address);
        if (result) {
          located += 1;
          updateBin(bin.id, { latitude: result.latitude, longitude: result.longitude });
        }
      }
      setMessage(`${located} of ${pendingBins.length} entered addresses were located. Review any remaining coordinates, then save.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Location search paused. You can retry individual bins.");
    } finally {
      setLocatingId(null);
      setIsLocatingAll(false);
    }
  }

  function saveBins(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const usableBins = completeBins();
    if (usableBins.length === 0) {
      setMessage("Add at least one bin ID, name, and address before saving.");
      return;
    }
    if (hasDuplicateBinIds(usableBins)) {
      setMessage("Each bin needs a unique ID before you save the real-bin setup.");
      return;
    }
    updateConfiguration((current) => ({ ...current, bins: usableBins, routePlan: null }));
    setMessage(`${usableBins.length} real bin record${usableBins.length === 1 ? "" : "s"} saved in this browser. Open Dispatch to show the map.`);
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(configuration, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "waste-wise-ahmedabad-bins.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("A local backup of your configured bin records was downloaded.");
  }

  function resetSetup() {
    if (!window.confirm("Remove all locally saved bin locations and route plans from this browser?")) return;
    clearShowcaseConfiguration();
    setMessage("Local bin setup was cleared. No remote data was changed.");
  }

  return (
    <AppShell
      role="admin"
      eyebrow="Ahmedabad prototype setup · private browser storage"
      title="Configure your real dustbins"
      subtitle={`Add and locate up to ${MAX_SHOWCASE_BINS} of your real bin locations for the presentation.`}
    >
      <section className="setup-intro-card">
        <div className="setup-intro-card__icon"><MapPinned size={21} /></div>
        <div>
          <span className="section-kicker">Your data, your presentation</span>
          <h2>Turn your actual bin addresses into a working map.</h2>
          <p>Addresses are looked up one at a time through OpenStreetMap search; saved coordinates stay only in this browser unless you download a backup.</p>
        </div>
        <Link className="quiet-button" href="/dispatch"><Navigation size={16} /> View dispatcher map</Link>
      </section>

      <section className="setup-workspace">
        <form className="setup-form panel" onSubmit={saveBins}>
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Optional · route starting point</span>
              <h2>Collection depot</h2>
            </div>
            <span className="setup-progress">{locatedCount} / {configuration.bins.length} bins located</span>
          </div>
          <div className="setup-form__body">
            <div className="setup-field-grid setup-field-grid--depot">
              <label className="field-label">Depot name (optional)
                <input value={configuration.depot.name} onChange={(event) => updateDepot({ name: event.target.value })} placeholder="Your collection depot" />
              </label>
              <label className="field-label">Depot address (optional)
                <input value={configuration.depot.address} onChange={(event) => updateDepot({ address: event.target.value })} placeholder="Your Ahmedabad depot address" />
              </label>
              <label className="field-label">Latitude
                <input type="number" min="-90" max="90" step="any" value={configuration.depot.latitude ?? ""} onChange={(event) => updateDepot({ latitude: inputNumber(event.target.value) })} placeholder="23.0225" />
              </label>
              <label className="field-label">Longitude
                <input type="number" min="-180" max="180" step="any" value={configuration.depot.longitude ?? ""} onChange={(event) => updateDepot({ longitude: inputNumber(event.target.value) })} placeholder="72.5714" />
              </label>
            </div>
            <p className="setup-depot-note">Add depot coordinates only if you want the showcase route to begin and end there. Without them, local ordering begins from the first mapped bin.</p>

            <div className="setup-section-heading">
              <div>
                <span className="section-kicker">Step 2 · real locations</span>
                <h2>Your dustbins</h2>
                <p>Add an address first, then use Locate to pin it on the Ahmedabad map.</p>
              </div>
              <div className="setup-section-heading__actions">
                <button className="quiet-button" type="button" onClick={locateAllBins} disabled={isLocatingAll || configuration.bins.length === 0}>
                  {isLocatingAll ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
                  Locate entered addresses
                </button>
                <button className="primary-button primary-button--compact" type="button" onClick={addBin} disabled={configuration.bins.length >= MAX_SHOWCASE_BINS}>
                  <Plus size={16} /> Add bin
                </button>
              </div>
            </div>

            {configuration.bins.length === 0 ? (
              <div className="empty-bin-state">
                <Database size={24} />
                <div><strong>No dustbin locations added yet</strong><span>Start with your first real Ahmedabad bin address. You can add up to {MAX_SHOWCASE_BINS}.</span></div>
                <button className="primary-button" type="button" onClick={addBin}><Plus size={16} /> Add first bin</button>
              </div>
            ) : (
              <div className="bin-editor-list">
                {configuration.bins.map((bin, index) => (
                  <article className="bin-editor-card" key={`bin-${index}`}>
                    <div className="bin-editor-card__heading">
                      <span className="bin-editor-card__number">{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{bin.name || `Dustbin ${index + 1}`}</strong><small>{isLocatedBin(bin) ? "Map pin ready" : "Address needs location"}</small></div>
                      <button className="bin-remove-button" type="button" onClick={() => removeBin(bin.id)} aria-label={`Remove dustbin ${index + 1}`}><Trash2 size={16} /></button>
                    </div>
                    <div className="setup-field-grid">
                      <label className="field-label">Bin ID
                        <input value={bin.id} onChange={(event) => updateBin(bin.id, { id: event.target.value })} placeholder="BIN-AMD-01" />
                      </label>
                      <label className="field-label">Bin name
                        <input value={bin.name} onChange={(event) => updateBin(bin.id, { name: event.target.value })} placeholder="e.g. Navrangpura market bin" />
                      </label>
                      <label className="field-label setup-field-grid__wide">Full address / area
                        <span className="setup-address-input"><input value={bin.address} onChange={(event) => updateBin(bin.id, { address: event.target.value })} placeholder="Street, area, Ahmedabad" /><button className="locate-button" type="button" onClick={() => locateBin(bin)} disabled={locatingId === bin.id || !bin.address.trim()}>{locatingId === bin.id ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />} Locate</button></span>
                      </label>
                      <label className="field-label">Latitude <small>or add manually</small>
                        <input type="number" min="-90" max="90" step="any" value={bin.latitude ?? ""} onChange={(event) => updateBin(bin.id, { latitude: inputNumber(event.target.value) })} placeholder="23.xxxxxx" />
                      </label>
                      <label className="field-label">Longitude <small>or add manually</small>
                        <input type="number" min="-180" max="180" step="any" value={bin.longitude ?? ""} onChange={(event) => updateBin(bin.id, { longitude: inputNumber(event.target.value) })} placeholder="72.xxxxxx" />
                      </label>
                      <label className="field-label">Current fill level
                        <span className="number-suffix"><input type="number" min="0" max="100" value={bin.fillPercent} onChange={(event) => updateBin(bin.id, { fillPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /><b>%</b></span>
                      </label>
                      <label className="field-label">Capacity <small>optional</small>
                        <span className="number-suffix"><input type="number" min="0" step="any" value={bin.capacityKg ?? ""} onChange={(event) => updateBin(bin.id, { capacityKg: inputNumber(event.target.value) })} placeholder="120" /><b>kg</b></span>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p className="setup-message" role="status"><AlertCircle size={15} /> {message}</p>
            <div className="setup-form__footer">
              <button className="text-button" type="button" onClick={resetSetup}><Trash2 size={15} /> Clear local setup</button>
              <div>
                <button className="quiet-button" type="button" onClick={downloadBackup} disabled={configuration.bins.length === 0}><Download size={16} /> Download backup</button>
                <button className="primary-button" type="submit"><Save size={16} /> Save real bins</button>
                <button className="primary-button" type="button" onClick={() => {
                  const usableBins = completeBins();
                  if (usableBins.length === 0) { setMessage("Add at least one complete bin before opening the map."); return; }
                  if (hasDuplicateBinIds(usableBins)) { setMessage("Each bin needs a unique ID before you open the map."); return; }
                  updateConfiguration((current) => ({ ...current, bins: usableBins, routePlan: null }));
                  router.push("/dispatch");
                }}><ArrowRight size={16} /> Save & open map</button>
              </div>
            </div>
          </div>
        </form>

        <aside className="setup-map-column">
          <article className="setup-map-card panel">
            <div className="panel-heading panel-heading--compact">
              <div><span className="section-kicker">Step 3 · verify map pins</span><h2>Ahmedabad bin map</h2></div>
              <span className="setup-map-card__count"><Check size={14} /> {locatedCount} located</span>
            </div>
            <div className="setup-map-card__map"><OpenStreetMapBinMap configuration={configuration} /></div>
          </article>
          <article className="setup-help-card">
            <strong>For the best demo</strong>
            <ul>
              <li>Enter specific addresses with area names, not only a landmark.</li>
              <li>Check each map pin before presenting.</li>
              <li>Use manual latitude/longitude if address lookup is ambiguous.</li>
              <li>Save a JSON backup before you change browsers or devices.</li>
            </ul>
          </article>
        </aside>
      </section>
    </AppShell>
  );
}
