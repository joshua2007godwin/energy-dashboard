"use client";
import { useEffect, useState } from "react";
import { IBM_Plex_Sans, Barlow_Condensed } from "next/font/google";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceArea,
} from "recharts";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"] });

const API = process.env.NEXT_PUBLIC_API_URL;

const C = {
  bg: "#0B1620", panel: "#112331", line: "#213647", track: "#2B4457",
  grid: "rgba(120,160,190,0.07)",
  ink: "#E8EFF3", muted: "#8CA0AE",
  ok: "#2DD4BF", bad: "#FF6B6B",
  volt: "#5EA1FF", amp: "#F5B94A", pow: "#FF7A6B",
};

const FAULTS = {
  OVERVOLTAGE: ["Overvoltage", "Voltage above 250 V"],
  UNDERVOLTAGE: ["Undervoltage", "Voltage below 200 V"],
  OVERLOAD: ["Overload", "Current above 20 A"],
  LOW_PF: ["Low power factor", "Power factor below 0.85"],
};

const V_MIN = 160, V_MAX = 280;

function pt(v, r) {
  const c = Math.min(Math.max(v, V_MIN), V_MAX);
  const a = Math.PI * (1 - (c - V_MIN) / (V_MAX - V_MIN));
  const x = 150 + r * Math.cos(a);
  const y = 150 - r * Math.sin(a);
  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
}

function arc(v1, v2, r) {
  const [x1, y1] = pt(v1, r);
  const [x2, y2] = pt(v2, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

function Gauge({ v, bad }) {
  const [nx, ny] = pt(v, 92);
  const needle = bad ? C.bad : C.ink;
  return (
    <svg viewBox="0 0 300 175" className="w-full max-w-md">
      <path d={arc(V_MIN, V_MAX, 118)} fill="none" stroke={C.track} strokeWidth="16" />
      <path d={arc(200, 250, 118)} fill="none" stroke={C.ok} strokeWidth="16" opacity="0.9" />
      {[160, 200, 230, 250, 280].map((t) => {
        const [x, y] = pt(t, 138);
        return (
          <text key={t} x={x} y={y} fontSize="11" fill={C.muted}
            textAnchor="middle" dominantBaseline="middle">{t}</text>
        );
      })}
      <line x1="150" y1="150" x2={nx} y2={ny} stroke={needle}
        strokeWidth="3" strokeLinecap="round" />
      <circle cx="150" cy="150" r="6" fill={needle} />
    </svg>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-md p-5"
      style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <h2 className="font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${API}/readings?deviceId=meter-01&limit=40`)
        .then((r) => r.json())
        .then((d) => { if (alive) { setRows(d); setError(false); } })
        .catch(() => alive && setError(true))
        .finally(() => alive && setNow(Date.now()));
    load();
    const t = setInterval(load, 6000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const t = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const last = rows[rows.length - 1];
  const live = last && now - last.timestamp < 30000;
  const bad = !!last?.alerts?.length;
  const voltBad = last && (last.voltage > 250 || last.voltage < 200);
  const data = rows.map((r) => ({ ...r, time: t(r.timestamp) }));
  const faultList = rows
    .filter((r) => r.alerts?.length)
    .slice(-6).reverse()
    .flatMap((r) => r.alerts.map((a) => ({ ts: r.timestamp, a })));

  const stats = last ? [
    ["Current", last.current, "A"],
    ["Real power", last.power_kw, "kW"],
    ["Power factor", last.pf, ""],
    ["Energy used", last.kwh, "kWh"],
    ["Cost so far", `₹${last.cost}`, ""],
  ] : [];

  const status = error ? "Can't reach the API"
    : !last ? "Loading readings"
    : !live ? "No recent readings"
    : bad ? "Fault detected"
    : "All values normal";
  const dot = error || !live ? C.muted : bad ? C.bad : C.ok;

  const axis = { fontSize: 11, fill: C.muted };
  const tip = {
    contentStyle: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, color: C.ink },
    labelStyle: { color: C.muted },
  };

  return (
    <div
      className={`${plex.className} min-h-screen`}
      style={{
        background: C.bg,
        backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        color: C.ink,
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5"
        style={{ borderBottom: `1px solid ${C.line}` }}>
        <div>
          <h1 className={`${barlow.className} text-3xl font-semibold`}>Smart energy monitor</h1>
          <p className="text-sm" style={{ color: C.muted }}>Meter 01, refreshed every 6 seconds</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
          {status}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Supply voltage">
            <div className="flex flex-col items-center">
              <Gauge v={last ? last.voltage : V_MIN} bad={voltBad} />
              <div className={`${barlow.className} text-6xl font-semibold -mt-2`}
                style={{ color: voltBad ? C.bad : C.ink }}>
                {last ? last.voltage : "--"}
                <span className="text-2xl ml-1" style={{ color: C.muted }}>V</span>
              </div>
              <p className="text-sm mt-1" style={{ color: C.muted }}>
                Safe band is 200 to 250 V
              </p>
            </div>
          </Panel>

          <Panel title="Latest reading">
            <ul>
              {stats.map(([label, value, unit]) => (
                <li key={label}
                  className="flex items-baseline justify-between py-3 border-b last:border-b-0"
                  style={{ borderColor: C.line }}>
                  <span style={{ color: C.muted }}>{label}</span>
                  <span className={`${barlow.className} text-3xl font-semibold`}>
                    {value}
                    {unit && <span className="text-base ml-1" style={{ color: C.muted }}>{unit}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Recent faults">
          {faultList.length === 0 ? (
            <p style={{ color: C.muted }}>No faults in the last 40 readings.</p>
          ) : (
            <ul>
              {faultList.map(({ ts, a }) => (
                <li key={ts + a}
                  className="flex justify-between gap-4 py-2 border-b last:border-b-0"
                  style={{ borderColor: C.line }}>
                  <span>
                    <span className="font-medium" style={{ color: C.bad }}>{FAULTS[a]?.[0] || a}</span>
                    <span className="ml-2" style={{ color: C.muted }}>{FAULTS[a]?.[1]}</span>
                  </span>
                  <span style={{ color: C.muted }}>{t(ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Voltage against the safe band">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                <ReferenceArea y1={200} y2={250} fill={C.ok} fillOpacity={0.12} />
                <XAxis dataKey="time" tick={axis} minTickGap={40} stroke={C.line} />
                <YAxis domain={[160, 280]} tick={axis} stroke={C.line} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="voltage" name="Voltage (V)"
                  stroke={C.volt} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Current and power">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="time" tick={axis} minTickGap={40} stroke={C.line} />
                <YAxis tick={axis} stroke={C.line} />
                <Tooltip {...tip} />
                <Legend />
                <Line type="monotone" dataKey="current" name="Current (A)"
                  stroke={C.amp} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="power_kw" name="Power (kW)"
                  stroke={C.pow} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      </main>
    </div>
  );
}