import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ── API Config ────────────────────────────────────────────────────────────────
const API_BASE = "/api";
const API_KEY  = "hshfd24d7998476hfbvvhfbh";

async function apiFetch(path, opts = {}) {
  const { method = "GET", body, headers: extraHeaders } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "x-api-key": API_KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
    ...(body ? { body } : {}),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || `API error on ${path}`);
  return json.data;
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const themes = {
  dark: {
    // Surfaces
    bg:          "#0b1437",
    bgAlt:       "#111c44",
    panel:       "#111c44",
    panelBright: "#1b2559",
    sidebar:     "#0b1437",
    border:      "#1b2a5e",
    borderHi:    "#243d7a",
    // Brand / Accent
    accent:      "#4318d1",
    accentAlt:   "#7551ff",
    accentSoft:  "rgba(117,81,255,0.15)",
    accentGlow:  "rgba(117,81,255,0.30)",
    // Semantic
    green:       "#05cd99",
    greenSoft:   "rgba(5,205,153,0.12)",
    red:         "#ee5d50",
    redSoft:     "rgba(238,93,80,0.12)",
    orange:      "#ff9500",
    orangeSoft:  "rgba(255,149,0,0.12)",
    blue:        "#39b8ff",
    blueSoft:    "rgba(57,184,255,0.12)",
    purple:      "#868cff",
    purpleSoft:  "rgba(134,140,255,0.12)",
    cyan:        "#21d4fd",
    cyanSoft:    "rgba(33,212,253,0.12)",
    // Text
    text:        "#ffffff",
    textSoft:    "#a3aed0",
    muted:       "#4a6090",
    // Chart helpers
    chart1: "#4318d1", chart2: "#39b8ff", chart3: "#05cd99",
    chart4: "#ff9500", chart5: "#ee5d50",
  },
  light: {
    // Surfaces
    bg:          "#f4f7fe",
    bgAlt:       "#edf0f9",
    panel:       "#ffffff",
    panelBright: "#f9fbff",
    sidebar:     "#ffffff",
    border:      "#e9edf7",
    borderHi:    "#d1d9f0",
    // Brand / Accent
    accent:      "#4318d1",
    accentAlt:   "#7551ff",
    accentSoft:  "rgba(67,24,209,0.08)",
    accentGlow:  "rgba(67,24,209,0.20)",
    // Semantic
    green:       "#01b574",
    greenSoft:   "rgba(1,181,116,0.10)",
    red:         "#ee5d50",
    redSoft:     "rgba(238,93,80,0.10)",
    orange:      "#ff9500",
    orangeSoft:  "rgba(255,149,0,0.10)",
    blue:        "#4299e1",
    blueSoft:    "rgba(66,153,225,0.10)",
    purple:      "#7551ff",
    purpleSoft:  "rgba(117,81,255,0.10)",
    cyan:        "#0bc5ea",
    cyanSoft:    "rgba(11,197,234,0.10)",
    // Text
    text:        "#1b2559",
    textSoft:    "#718096",
    muted:       "#a3aed0",
    // Chart helpers
    chart1: "#4318d1", chart2: "#4299e1", chart3: "#01b574",
    chart4: "#ff9500", chart5: "#ee5d50",
  }
};

const ThemeContext = createContext({ theme: "dark", t: themes.dark, toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon, glow }) {
  const { t } = useTheme();
  color = color || t.accent;
  return (
    <div style={{
      background: t.panel,
      border: `1px solid ${t.border}`,
      borderRadius: 20,
      padding: "22px 24px",
      flex: 1, minWidth: 150,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.06)",
      transition: "transform 0.15s, box-shadow 0.15s",
      cursor: "default",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 28px rgba(0,0,0,0.10)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.06)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: t.textSoft, fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{label}</div>
          <div style={{ color: t.text, fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: -1, fontFamily: "'Inter', sans-serif" }}>{value ?? "—"}</div>
          {sub && <div style={{ color: t.textSoft, fontSize: 12, marginTop: 8, fontWeight: 500 }}>{sub}</div>}
        </div>
        {icon && (
          <div style={{
            background: `${color}18`,
            borderRadius: 14, width: 48, height: 48,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            flexShrink: 0,
          }}>{icon}</div>
        )}
      </div>
    </div>
  );
}

function Badge({ text, color }) {
  const { t } = useTheme();
  color = color || t.textSoft;
  return (
    <span style={{
      background: `${color}15`, color,
      borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700,
    }}>{text}</span>
  );
}

function Panel({ title, children, action, style: extra }) {
  const { t } = useTheme();
  return (
    <div style={{
      background: t.panel,
      border: `1px solid ${t.border}`,
      borderRadius: 20, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.05)",
      ...extra,
    }}>
      {title != null && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "13px 18px", borderBottom: `1px solid ${t.border}`,
          background: `linear-gradient(90deg, ${t.panelBright}, ${t.panel})`,
        }}>
          <div style={{ color: t.text, fontWeight: 700, fontSize: 15 }}>{title}</div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Inp({ label, ...props }) {
  const { t } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ color: t.textSoft, fontSize: 12, fontWeight: 600 }}>{label}</label>}
      <input {...props} style={{
        background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 10,
        padding: "10px 14px", color: t.text, fontSize: 13, outline: "none",
        transition: "border-color 0.15s", fontFamily: "inherit",
        ...props.style,
      }}
        onFocus={e => e.target.style.borderColor = t.accentAlt || t.accent}
        onBlur={e => e.target.style.borderColor = t.border}
      />
    </div>
  );
}

function Sel({ label, children, ...props }) {
  const { t } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ color: t.textSoft, fontSize: 12, fontWeight: 600 }}>{label}</label>}
      <select {...props} style={{
        background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 10,
        padding: "10px 14px", color: t.text, fontSize: 13, outline: "none", cursor: "pointer",
        fontFamily: "inherit",
        ...props.style,
      }}>
        {children}
      </select>
    </div>
  );
}

function Btn({ children, color, outline, disabled, ...props }) {
  const { t } = useTheme();
  color = color || t.accentAlt || t.accent;
  const bg = outline ? "transparent" : color;
  const fg = outline ? color : "#fff";
  return (
    <button {...props} disabled={disabled} style={{
      background: bg, border: `1.5px solid ${outline ? color : "transparent"}`,
      borderRadius: 10, padding: "10px 22px", color: fg, fontWeight: 700, fontSize: 13,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
      transition: "all 0.15s", fontFamily: "inherit",
      boxShadow: outline ? "none" : `0 4px 16px ${color}40`,
      ...props.style,
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(1.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
    >
      {children}
    </button>
  );
}

function ErrorBanner({ message, onRetry }) {
  const { t } = useTheme();
  return (
    <div style={{
      background: t.redSoft, border: `1px solid ${t.red}40`, borderRadius: 10,
      padding: "14px 18px", color: t.red, display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span>⚠ {message}</span>
      {onRetry && <Btn color={t.red} outline onClick={onRetry} style={{ padding: "5px 14px", fontSize: 12 }}>Retry</Btn>}
    </div>
  );
}

function Spinner({ label = "Loading…" }) {
  const { t } = useTheme();
  return (
    <div style={{ padding: 48, textAlign: "center", color: t.textSoft }}>
      <div style={{ fontSize: 28, marginBottom: 10, animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
      <div style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}

function Empty({ icon = "📭", text }) {
  const { t } = useTheme();
  return (
    <div style={{ padding: "32px 20px", textAlign: "center", color: t.muted }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}

// ── Line Chart ────────────────────────────────────────────────────────────────
// series: [{ label, color, fill, data: [{x: ms, y: number}] }]
// annotations: [{ x: ms, type: 'refuel'|'drop'|'speed', label, value }]

function smoothPath(pts) {
  if (pts.length < 2) return `M ${pts[0]?.x ?? 0} ${pts[0]?.y ?? 0}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C ${cx} ${pts[i - 1].y}, ${cx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

function LineChart({ series = [], height = 240, annotations = [], yLabel = "", y2Series = null, y2Color }) {
  const { t } = useTheme();
  y2Color = y2Color || t.cyan;
  const containerRef = useRef(null);
  const [W, setW]       = useState(700);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ob = new ResizeObserver(e => setW(e[0].contentRect.width));
    ob.observe(containerRef.current);
    return () => ob.disconnect();
  }, []);

  const pad = { top: 18, right: y2Series ? 52 : 16, bottom: 38, left: 56 };
  const cW = Math.max(W - pad.left - pad.right, 10);
  const cH = Math.max(height - pad.top - pad.bottom, 10);

  const allPts = series.flatMap(s => s.data || []);
  if (allPts.length === 0) {
    return (
      <div ref={containerRef} style={{ width: "100%" }}>
        <Empty icon="📉" text="No data to display" />
      </div>
    );
  }

  const xMin = Math.min(...allPts.map(p => p.x));
  const xMax = Math.max(...allPts.map(p => p.x));
  const yVals = allPts.map(p => p.y);
  const yMin  = Math.floor(Math.min(...yVals) * 0.97);
  const yMax  = Math.ceil(Math.max(...yVals)  * 1.03);

  const sx = x => xMin === xMax ? cW / 2 : ((x - xMin) / (xMax - xMin)) * cW;
  const sy = y => yMin === yMax ? cH / 2 : cH - ((y - yMin) / (yMax - yMin)) * cH;

  // Y2 scale for secondary series (e.g. speed)
  let sy2, y2Min, y2Max;
  if (y2Series?.data?.length) {
    const v2 = y2Series.data.map(p => p.y);
    y2Min = 0;
    y2Max = Math.ceil(Math.max(...v2) * 1.1) || 1;
    sy2 = y => cH - ((y - y2Min) / (y2Max - y2Min)) * cH;
  }

  // X axis ticks
  const xTicks = 6;
  const xTickPts = Array.from({ length: xTicks + 1 }, (_, i) => {
    const x = xMin + (xMax - xMin) * (i / xTicks);
    return { x, label: new Date(x).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
  });

  // Y axis ticks
  const yTicks = 5;
  const yTickPts = Array.from({ length: yTicks + 1 }, (_, i) => {
    const y = yMin + (yMax - yMin) * (i / yTicks);
    return { y, label: Math.round(y) };
  });

  // Hover logic — find nearest x point
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left - pad.left;
    const xVal = xMin + (mx / cW) * (xMax - xMin);
    // Find closest point in first series
    const pts = series[0]?.data || [];
    if (!pts.length) return;
    let best = pts[0], bestD = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.x - xVal);
      if (d < bestD) { bestD = d; best = p; }
    }
    const allSeriesVals = series.map(s => {
      const closest = (s.data || []).reduce((a, b) => Math.abs(b.x - best.x) < Math.abs(a.x - best.x) ? b : a, s.data?.[0]);
      return { label: s.label, color: s.color, y: closest?.y };
    });
    if (y2Series?.data?.length) {
      const c2 = y2Series.data.reduce((a, b) => Math.abs(b.x - best.x) < Math.abs(a.x - best.x) ? b : a, y2Series.data[0]);
      allSeriesVals.push({ label: y2Series.label, color: y2Color, y: c2?.y });
    }
    setHover({ x: sx(best.x), y: sy(best.y), time: best.x, vals: allSeriesVals });
  };

  const svgId = useRef(`lc_${Math.random().toString(36).slice(2)}`).current;

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      <svg
        width={W} height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: "block", cursor: "crosshair" }}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${svgId}_fill_${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
          <linearGradient id={`${svgId}_fill_y2`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={y2Color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={y2Color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <g transform={`translate(${pad.left},${pad.top})`}>
          {/* Grid */}
          {yTickPts.map((tp, i) => (
            <line key={i} x1={0} y1={sy(tp.y)} x2={cW} y2={sy(tp.y)}
              stroke={t.border} strokeWidth={1} strokeDasharray="4,4" />
          ))}

          {/* Y axis labels */}
          {yTickPts.map((tp, i) => (
            <text key={i} x={-8} y={sy(tp.y) + 4} textAnchor="end"
              fill={t.muted} fontSize={11} fontFamily="Inter, sans-serif">{tp.label}</text>
          ))}
          {yLabel && (
            <text x={-42} y={cH / 2} textAnchor="middle"
              fill={t.textSoft} fontSize={11}
              transform={`rotate(-90, -42, ${cH / 2})`}>{yLabel}</text>
          )}

          {/* Y2 axis labels */}
          {sy2 && Array.from({ length: yTicks + 1 }, (_, i) => {
            const y = y2Min + (y2Max - y2Min) * (i / yTicks);
            return (
              <text key={i} x={cW + 8} y={sy2(y) + 4} textAnchor="start"
                fill={y2Color} fontSize={10} fontFamily="Inter, sans-serif" opacity={0.7}>
                {Math.round(y)}
              </text>
            );
          })}

          {/* X axis labels */}
          {xTickPts.map((tp, i) => (
            <text key={i} x={sx(tp.x)} y={cH + 22} textAnchor="middle"
              fill={t.muted} fontSize={10} fontFamily="Inter, sans-serif">{tp.label}</text>
          ))}

          {/* Annotation vertical lines */}
          {annotations.map((a, i) => {
            const x = sx(a.x);
            const color = a.type === "refuel" ? t.green : a.type === "drop" ? t.red : t.accent;
            return (
              <g key={i}>
                <line x1={x} y1={0} x2={x} y2={cH} stroke={color} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.8} />
                <circle cx={x} cy={a.type === "refuel" ? 12 : 12} r={7} fill={color} opacity={0.9} />
                <text x={x} y={15} textAnchor="middle" fill="#000" fontSize={10} fontWeight="bold">
                  {a.type === "refuel" ? "↑" : "↓"}
                </text>
              </g>
            );
          })}

          {/* Y2 series (speed — dashed, behind main) */}
          {sy2 && y2Series?.data?.length > 1 && (() => {
            const pts = y2Series.data.map(p => ({ x: sx(p.x), y: sy2(p.y) }));
            const areaBottom = pts.map(p => ({ x: p.x, y: cH }));
            const areaPath = smoothPath(pts) + ` L ${pts[pts.length - 1].x} ${cH} L ${pts[0].x} ${cH} Z`;
            return (
              <g>
                <path d={areaPath} fill={`url(#${svgId}_fill_y2)`} />
                <path d={smoothPath(pts)} fill="none" stroke={y2Color} strokeWidth={1.5} strokeDasharray="5,3" opacity={0.6} />
              </g>
            );
          })()}

          {/* Main series */}
          {series.map((s, si) => {
            const pts = (s.data || []).map(p => ({ x: sx(p.x), y: sy(p.y) }));
            if (pts.length < 2) return null;
            const areaPath = smoothPath(pts) + ` L ${pts[pts.length - 1].x} ${cH} L ${pts[0].x} ${cH} Z`;
            return (
              <g key={si}>
                {s.fill !== false && (
                  <path d={areaPath} fill={`url(#${svgId}_fill_${si})`} />
                )}
                <path d={smoothPath(pts)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                {/* Dot at each point if data is sparse */}
                {pts.length <= 30 && pts.map((p, pi) => (
                  <circle key={pi} cx={p.x} cy={p.y} r={3} fill={s.color} opacity={0.8} />
                ))}
              </g>
            );
          })}

          {/* Hover crosshair */}
          {hover && (
            <g>
              <line x1={hover.x} y1={0} x2={hover.x} y2={cH} stroke={t.textSoft} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
              <circle cx={hover.x} cy={hover.y} r={5} fill={series[0]?.color ?? t.accent} stroke={t.bg} strokeWidth={2} />
            </g>
          )}
        </g>

        {/* Axes border */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={t.borderHi} strokeWidth={1} />
        <line x1={pad.left} y1={height - pad.bottom} x2={W - pad.right} y2={height - pad.bottom} stroke={t.borderHi} strokeWidth={1} />
      </svg>

      {/* Tooltip */}
      {hover && (
        <div style={{
          position: "absolute", top: 8,
          left: hover.x + pad.left + 10 > W - 180 ? hover.x + pad.left - 165 : hover.x + pad.left + 10,
          background: `${t.panelBright}f0`, border: `1px solid ${t.borderHi}`,
          borderRadius: 8, padding: "8px 12px", pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)", zIndex: 10,
        }}>
          <div style={{ color: t.textSoft, fontSize: 11, marginBottom: 4, fontFamily: "inherit" }}>
            {new Date(hover.time).toLocaleString()}
          </div>
          {hover.vals.map((v, i) => v?.y != null && (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontFamily: "inherit" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, display: "inline-block" }} />
              <span style={{ color: t.textSoft }}>{v.label}:</span>
              <span style={{ color: t.text, fontWeight: 700 }}>{typeof v.y === "number" ? v.y.toFixed(1) : v.y}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fuel data helpers ─────────────────────────────────────────────────────────

function normalizeFuelData(raw) {
  const infos = raw?.infos || raw?.list || raw?.obj || (Array.isArray(raw) ? raw : []);
  return infos
    .map(r => {
      const timeStr = r.gt || r.gpsTime || r.time || r.t || "";
      const ts = timeStr ? new Date(timeStr.replace(" ", "T")).getTime() : NaN;
      const accRaw = r.ac != null ? r.ac : (r.accOn != null ? (r.accOn ? 1 : 0) : null);
      return {
        time:    ts,
        timeStr,
        fuel:    r.yl != null ? r.yl / 100 : (r.fuelValue ?? r.oil ?? null),
        speed:   r.sp != null ? r.sp / 10  : (r.speed ?? 0),
        mileage: r.lc != null ? r.lc / 1000 : (r.mileage ?? 0),
        accOn:   accRaw != null ? (accRaw & 1) === 1 : null,
      };
    })
    .filter(r => !isNaN(r.time) && r.fuel != null)
    .sort((a, b) => a.time - b.time);
}

function detectFuelEvents(data, refuelThreshold = 20, dropThreshold = 20) {
  const events = [];
  for (let i = 1; i < data.length; i++) {
    const delta = data[i].fuel - data[i - 1].fuel;
    if (delta >= refuelThreshold) {
      events.push({ x: data[i].time, type: "refuel", value: Math.round(delta * 10) / 10, label: `+${Math.round(delta * 10) / 10}L` });
    } else if (Math.abs(delta) >= dropThreshold && delta < 0) {
      events.push({ x: data[i].time, type: "drop",   value: Math.round(Math.abs(delta) * 10) / 10, label: `-${Math.round(Math.abs(delta) * 10) / 10}L` });
    }
  }
  return events;
}

function totalConsumption(data) {
  if (data.length < 2) return 0;
  let used = 0;
  for (let i = 1; i < data.length; i++) {
    const delta = data[i - 1].fuel - data[i].fuel; // positive = consumed
    if (delta > 0) used += delta;
  }
  return Math.round(used * 10) / 10;
}

// ── View: HELION (Companies / Categories / Vehicle Assignment) ────────────────

const ERP_COLORS = ['#4318d1','#7551ff','#05cd99','#39b8ff','#ff9500','#ee5d50','#868cff','#21d4fd'];

function ColorPicker({ value, onChange }) {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {ERP_COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          width: 26, height: 26, borderRadius: '50%', background: c, border: 'none',
          cursor: 'pointer', outline: value === c ? `3px solid ${t.text}` : '3px solid transparent',
          outlineOffset: 2, transition: 'outline 0.1s',
        }} />
      ))}
    </div>
  );
}

function ErpModal({ title, onClose, children }) {
  const { t } = useTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: t.panel, borderRadius: 18, width: 440, maxWidth: '95vw', boxShadow: '0 16px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: t.panelBright, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ flex: 1, fontWeight: 800, fontSize: 16, color: t.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function FleetERPView({ vehicles, onCompanySelect, activeCompanyId: activeCoid }) {
  const { t } = useTheme();
  const [tab,       setTab]       = useState('board');
  const [summary,   setSummary]   = useState(null);   // { companies, categories, unassigned }
  const [companies, setCompanies] = useState([]);
  const [categories,setCategories]= useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Modals
  const [coModal,     setCoModal]     = useState(null); // null | { id?, name, color, phone }
  const [catModal,    setCatModal]    = useState(null); // null | { id?, name, color }
  const [assignModal, setAssignModal] = useState(null); // null | { devIdno, plate, companyId, categoryId }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // null | { type, id, name, vehicleCount }
  const [bulkSel,     setBulkSel]     = useState([]);   // devIdnos selected for bulk assign
  const [bulkModal,   setBulkModal]   = useState(false);
  const [vehFilter,   setVehFilter]   = useState('all'); // 'all'|'assigned'|'unassigned'
  const [search,      setSearch]      = useState('');

  const reload = async () => {
    setLoading(true); setError(null);
    try {
      const [sum, cos, cats] = await Promise.all([
        apiFetch('/erp/summary'),
        apiFetch('/erp/companies'),
        apiFetch('/erp/categories'),
      ]);
      setSummary(sum); setCompanies(cos); setCategories(cats);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  // ── Company CRUD ──────────────────────────────────────────────────────────

  const saveCompany = async () => {
    const { id, name, color, phone } = coModal;
    if (!name.trim()) return;
    try {
      if (id) await apiFetch(`/erp/companies/${id}`, { method: 'PUT', body: JSON.stringify({ name, color, phone }) });
      else    await apiFetch('/erp/companies',        { method: 'POST', body: JSON.stringify({ name, color, phone }) });
      setCoModal(null); reload();
    } catch (e) { alert(e.message); }
  };

  const deleteCompany = async (id) => {
    try {
      const r = await apiFetch(`/erp/companies/${id}`, { method: 'DELETE' });
      if (r.vehiclesUnassigned > 0) alert(`${r.vehiclesUnassigned} vehicle(s) have been unassigned.`);
      setDeleteConfirm(null); reload();
    } catch (e) { alert(e.message); }
  };

  // ── Category CRUD ─────────────────────────────────────────────────────────

  const saveCategory = async () => {
    const { id, name, color } = catModal;
    if (!name.trim()) return;
    try {
      if (id) await apiFetch(`/erp/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name, color }) });
      else    await apiFetch('/erp/categories',        { method: 'POST', body: JSON.stringify({ name, color }) });
      setCatModal(null); reload();
    } catch (e) { alert(e.message); }
  };

  const deleteCategory = async (id) => {
    try { await apiFetch(`/erp/categories/${id}`, { method: 'DELETE' }); setDeleteConfirm(null); reload(); }
    catch (e) { alert(e.message); }
  };

  // ── Assignments ───────────────────────────────────────────────────────────

  const saveAssign = async (devIdno, companyId, categoryId) => {
    try {
      await apiFetch('/erp/assignments', { method: 'POST', body: JSON.stringify({ devIdno, companyId, categoryId }) });
      setAssignModal(null); reload();
    } catch (e) { alert(e.message); }
  };

  const unassign = async (devIdno) => {
    try { await apiFetch(`/erp/assignments/${devIdno}`, { method: 'DELETE' }); setAssignModal(null); reload(); }
    catch (e) { alert(e.message); }
  };

  const saveBulkAssign = async (companyId, categoryId) => {
    try {
      await apiFetch('/erp/assignments/bulk', { method: 'POST', body: JSON.stringify({ devIdnos: bulkSel, companyId, categoryId }) });
      setBulkModal(false); setBulkSel([]); reload();
    } catch (e) { alert(e.message); }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const catMap = Object.fromEntries((categories || []).map(c => [c.id, c]));
  const coMap  = Object.fromEntries((companies  || []).map(c => [c.id, c]));

  // Enrich vehicles list with assignment info
  const vehiclesEnriched = vehicles.map(v => {
    const a = summary ? (summary.companies.flatMap(c => c.vehicles).find(sv => sv.devIdno === v.devIdno) || null) : null;
    return {
      ...v,
      companyId:  a?.companyId  || null,
      categoryId: a?.categoryId || null,
      plate: v.plate || v.nm || v.devIdno,
    };
  });

  const filteredVehicles = vehiclesEnriched.filter(v => {
    if (vehFilter === 'assigned'   && !v.companyId) return false;
    if (vehFilter === 'unassigned' && v.companyId)  return false;
    if (search && !v.plate.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Shared style helpers ──────────────────────────────────────────────────

  const tabBtnStyle = (id) => ({
    background: tab === id ? t.accent : 'transparent',
    border: `1px solid ${tab === id ? t.accent : t.border}`,
    borderRadius: 10, padding: '8px 18px', color: tab === id ? '#fff' : t.textSoft,
    cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
  });

  if (loading) return <Spinner label="Loading HELION…" />;
  if (error)   return <div style={{ padding: 24 }}><ErrorBanner message={error} onRetry={reload} /></div>;

  const unassignedCount = summary?.unassigned?.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text }}>🏢 HELION</h2>
          <div style={{ color: t.muted, fontSize: 13, marginTop: 3 }}>
            {companies.length} compan{companies.length === 1 ? 'y' : 'ies'} · {categories.length} categories
            {unassignedCount > 0 && <span style={{ color: t.orange, marginLeft: 10, fontWeight: 700 }}>⚠ {unassignedCount} unassigned</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => setCatModal({ name: '', color: ERP_COLORS[2] })} color={t.green} outline style={{ fontSize: 12, padding: '7px 16px' }}>+ Category</Btn>
          <Btn onClick={() => setCoModal({ name: '', color: ERP_COLORS[0], phone: '' })} style={{ fontSize: 12, padding: '7px 16px' }}>+ Company</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
        {[['board','🗂 Board'],['vehicles','🚌 Vehicles'],['companies','🏢 Companies'],['categories','🏷 Categories']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === id ? t.accent : 'transparent'}`,
            padding: '10px 18px', color: tab === id ? t.accent : t.textSoft,
            cursor: 'pointer', fontSize: 13, fontWeight: tab === id ? 700 : 500,
            fontFamily: 'inherit', marginBottom: -1, transition: 'all 0.15s',
          }}>{lbl}</button>
        ))}
        {unassignedCount > 0 && (
          <span style={{ alignSelf: 'center', marginLeft: 8, background: t.orange, color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
            {unassignedCount} unassigned
          </span>
        )}
      </div>

      {/* ── BOARD TAB ── */}
      {tab === 'board' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Unassigned strip */}
          {unassignedCount > 0 && (
            <div style={{
              background: `linear-gradient(135deg, ${t.orange}12, ${t.orange}06)`,
              borderRadius: 16, padding: '16px 20px',
              border: `1px dashed ${t.orange}66`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ color: t.orange, fontWeight: 800, fontSize: 14 }}>Unassigned Vehicles ({unassignedCount})</span>
                <span style={{ color: t.muted, fontSize: 12, marginLeft: 4 }}>— not linked to any company</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(summary?.unassigned || []).map(v => (
                  <div key={v.devIdno} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: t.panel, borderRadius: 20, padding: '6px 14px',
                    border: `1px solid ${t.orange}44`, cursor: 'pointer',
                  }} onClick={() => setAssignModal({ devIdno: v.devIdno, plate: v.plate, companyId: '', categoryId: '' })}>
                    <span style={{ fontSize: 9, color: v.online ? t.green : t.muted }}>{v.online ? '●' : '○'}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{v.plate}</span>
                    <span style={{ fontSize: 11, color: t.accent, fontWeight: 700 }}>Assign →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
            {(summary?.companies || []).map(co => {
              const coOnline  = co.vehicles.filter(v => v.online).length;
              const coOffline = co.vehicles.length - coOnline;
              const coAccOn   = co.vehicles.filter(v => v.accOn).length;
              const isActive  = activeCoid === co.id;

              // Group vehicles by category
              const groups = {};
              for (const v of co.vehicles) {
                const key = v.categoryId || '__none__';
                if (!groups[key]) groups[key] = [];
                groups[key].push(v);
              }

              return (
                <div key={co.id} style={{
                  borderRadius: 18, overflow: 'hidden',
                  border: `1.5px solid ${isActive ? co.color : co.color + '44'}`,
                  boxShadow: isActive ? `0 4px 24px ${co.color}33` : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.2s',
                }}>
                  {/* Gradient header */}
                  <div style={{
                    background: `linear-gradient(135deg, ${co.color}ee, ${co.color}99)`,
                    padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏢</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{co.name}</div>
                        {co.phone && <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>📞 {co.phone}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => onCompanySelect && onCompanySelect(isActive ? null : co.id)} style={{
                          background: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
                          border: 'none', borderRadius: 8, padding: '5px 11px',
                          color: isActive ? co.color : '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                        }}>{isActive ? '✓ Active' : 'Focus'}</button>
                        <button onClick={() => setCoModal({ id: co.id, name: co.name, color: co.color, phone: co.phone || '' })} style={{
                          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '5px 11px',
                          color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                        }}>Edit</button>
                      </div>
                    </div>
                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      {[
                        { icon: '🚌', val: co.vehicles.length, lbl: 'Total' },
                        { icon: '🟢', val: coOnline,           lbl: 'Online' },
                        { icon: '⚫', val: coOffline,          lbl: 'Offline' },
                        { icon: '🔑', val: coAccOn,            lbl: 'Engine On' },
                      ].map(({ icon, val, lbl }) => (
                        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 12 }}>{icon}</span>
                          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{val}</span>
                          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{lbl}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vehicles body */}
                  <div style={{ padding: '14px 16px', background: t.panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {co.vehicles.length === 0 ? (
                      <div style={{ color: t.muted, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                        No vehicles assigned —
                        <span style={{ color: t.accent, cursor: 'pointer', marginLeft: 4 }} onClick={() => setTab('vehicles')}>add from Vehicles tab</span>
                      </div>
                    ) : Object.entries(groups).map(([catId, vlist]) => {
                      const cat = catId !== '__none__' ? catMap[catId] : null;
                      return (
                        <div key={catId}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            {cat && <div style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color }} />}
                            <span style={{ color: cat ? cat.color : t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.9 }}>
                              {cat ? cat.name : 'No Category'}
                            </span>
                            <span style={{ color: t.muted, fontSize: 11 }}>({vlist.length})</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {vlist.map(v => (
                              <div key={v.devIdno}
                                onClick={() => setAssignModal({ devIdno: v.devIdno, plate: v.plate, companyId: v.companyId, categoryId: v.categoryId || '' })}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  background: v.online ? t.greenSoft : t.bgAlt,
                                  border: `1px solid ${v.online ? t.green + '55' : t.border}`,
                                  borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                                  transition: 'all 0.15s',
                                }}>
                                <span style={{ fontSize: 8, color: v.online ? t.green : t.muted, lineHeight: 1 }}>{v.online ? '●' : '●'}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: v.online ? t.text : t.textSoft }}>{v.plate}</span>
                                {v.accOn && <span style={{ fontSize: 9, color: t.green, fontWeight: 800 }}>ACC</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {companies.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 40px',
              background: `linear-gradient(135deg, ${t.accentSoft}, ${t.panel})`,
              borderRadius: 20, border: `1px dashed ${t.border}`,
            }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🏢</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 6 }}>No companies yet</div>
              <div style={{ fontSize: 13, color: t.muted, marginBottom: 20 }}>Create your first company to start organising your fleet</div>
              <Btn onClick={() => setCoModal({ name: '', color: ERP_COLORS[0], phone: '' })}>+ Create First Company</Btn>
            </div>
          )}
        </div>
      )}

      {/* ── VEHICLES TAB ── */}
      {tab === 'vehicles' && (
        <Panel>
          <div style={{ padding: 18 }}>
            {/* Controls row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plate…"
                style={{ background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 14px', color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 180 }} />
              {[['all','All'],['assigned','Assigned'],['unassigned','Unassigned']].map(([val,lbl]) => (
                <button key={val} onClick={() => setVehFilter(val)} style={{
                  background: vehFilter === val ? t.accentSoft : 'transparent',
                  border: `1px solid ${vehFilter === val ? t.accent : t.border}`,
                  borderRadius: 8, padding: '7px 14px', color: vehFilter === val ? t.accent : t.textSoft,
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                }}>{lbl}</button>
              ))}
              <div style={{ flex: 1 }} />
              {bulkSel.length > 0 && (
                <Btn onClick={() => setBulkModal(true)} color={t.green}>Assign {bulkSel.length} selected →</Btn>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: t.bgAlt }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: `1px solid ${t.border}`, width: 36 }}>
                      <input type="checkbox"
                        checked={bulkSel.length === filteredVehicles.length && filteredVehicles.length > 0}
                        onChange={e => setBulkSel(e.target.checked ? filteredVehicles.map(v => v.devIdno) : [])}
                      />
                    </th>
                    {['Vehicle','Status','Company','Category',''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v, i) => {
                    const co  = v.companyId  ? coMap[v.companyId]   : null;
                    const cat = v.categoryId ? catMap[v.categoryId] : null;
                    return (
                      <tr key={v.devIdno} style={{ background: i % 2 ? t.bgAlt + '55' : 'transparent', borderBottom: `1px solid ${t.border}55` }}>
                        <td style={{ padding: '10px 12px' }}>
                          <input type="checkbox" checked={bulkSel.includes(v.devIdno)}
                            onChange={e => setBulkSel(p => e.target.checked ? [...p, v.devIdno] : p.filter(x => x !== v.devIdno))} />
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: t.text }}>{v.plate}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ color: v.online ? t.green : t.muted, fontWeight: 700, fontSize: 12 }}>{v.online ? '● Online' : '○ Offline'}</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {co ? <Badge text={co.name} color={co.color} /> : <span style={{ color: t.muted, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {cat ? <Badge text={cat.name} color={cat.color} /> : <span style={{ color: t.muted, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button onClick={() => setAssignModal({ devIdno: v.devIdno, plate: v.plate, companyId: v.companyId || '', categoryId: v.categoryId || '' })}
                            style={{ background: v.companyId ? 'transparent' : t.accent, border: `1px solid ${v.companyId ? t.border : t.accent}`, borderRadius: 8, padding: '5px 14px', color: v.companyId ? t.textSoft : '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
                            {v.companyId ? 'Move' : 'Assign'}
                          </button>
                          {v.companyId && (
                            <button onClick={() => unassign(v.devIdno)} style={{ background: 'transparent', border: 'none', color: t.red, cursor: 'pointer', fontSize: 12, marginLeft: 6, fontFamily: 'inherit' }}>Remove</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredVehicles.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: t.muted }}>No vehicles match filter</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      )}

      {/* ── COMPANIES TAB ── */}
      {tab === 'companies' && (
        <Panel>
          <div style={{ padding: 18 }}>
            {companies.length === 0
              ? <div style={{ textAlign: 'center', padding: 32, color: t.muted }}>No companies yet — click <b>+ Company</b> above</div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: t.bgAlt }}>
                      {['Color','Name','Phone','Vehicles',''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: `1px solid ${t.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((co, i) => (
                      <tr key={co.id} style={{ background: i % 2 ? t.bgAlt + '55' : 'transparent', borderBottom: `1px solid ${t.border}55` }}>
                        <td style={{ padding: '10px 14px' }}><div style={{ width: 18, height: 18, borderRadius: '50%', background: co.color }} /></td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: t.text }}>{co.name}</td>
                        <td style={{ padding: '10px 14px', color: t.textSoft }}>{co.phone || '—'}</td>
                        <td style={{ padding: '10px 14px', color: t.accent, fontWeight: 700 }}>{co.vehicleCount}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => setCoModal({ id: co.id, name: co.name, color: co.color, phone: co.phone || '' })}
                            style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '5px 14px', color: t.textSoft, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Edit</button>
                          <button onClick={() => setDeleteConfirm({ type: 'company', id: co.id, name: co.name, vehicleCount: co.vehicleCount })}
                            style={{ background: 'transparent', border: `1px solid ${t.red}55`, borderRadius: 8, padding: '5px 14px', color: t.red, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </Panel>
      )}

      {/* ── CATEGORIES TAB ── */}
      {tab === 'categories' && (
        <Panel>
          <div style={{ padding: 18 }}>
            {categories.length === 0
              ? <div style={{ textAlign: 'center', padding: 32, color: t.muted }}>No categories yet — click <b>+ Category</b> above</div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: t.bgAlt }}>
                      {['Color','Name','Vehicles Assigned',''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: `1px solid ${t.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat, i) => (
                      <tr key={cat.id} style={{ background: i % 2 ? t.bgAlt + '55' : 'transparent', borderBottom: `1px solid ${t.border}55` }}>
                        <td style={{ padding: '10px 14px' }}><div style={{ width: 18, height: 18, borderRadius: '50%', background: cat.color }} /></td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: t.text }}>{cat.name}</td>
                        <td style={{ padding: '10px 14px', color: t.accent, fontWeight: 700 }}>{cat.vehicleCount}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => setCatModal({ id: cat.id, name: cat.name, color: cat.color })}
                            style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '5px 14px', color: t.textSoft, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Edit</button>
                          <button onClick={() => setDeleteConfirm({ type: 'category', id: cat.id, name: cat.name, vehicleCount: cat.vehicleCount })}
                            style={{ background: 'transparent', border: `1px solid ${t.red}55`, borderRadius: 8, padding: '5px 14px', color: t.red, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </Panel>
      )}

      {/* ── MODALS ── */}

      {/* Company form */}
      {coModal && (
        <ErpModal title={coModal.id ? 'Edit Company' : 'New Company'} onClose={() => setCoModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp label="Company Name *" value={coModal.name} onChange={e => setCoModal(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Star Link Express" />
            <Inp label="Phone" value={coModal.phone} onChange={e => setCoModal(p => ({ ...p, phone: e.target.value }))} placeholder="255712345678" />
            <div>
              <div style={{ color: t.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Colour</div>
              <ColorPicker value={coModal.color} onChange={c => setCoModal(p => ({ ...p, color: c }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <Btn onClick={saveCompany} disabled={!coModal.name.trim()}>{coModal.id ? 'Save Changes' : 'Create Company'}</Btn>
              <Btn onClick={() => setCoModal(null)} outline color={t.muted}>Cancel</Btn>
            </div>
          </div>
        </ErpModal>
      )}

      {/* Category form */}
      {catModal && (
        <ErpModal title={catModal.id ? 'Edit Category' : 'New Category'} onClose={() => setCatModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp label="Category Name *" value={catModal.name} onChange={e => setCatModal(p => ({ ...p, name: e.target.value }))} placeholder="e.g. School Buses" />
            <div>
              <div style={{ color: t.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Colour</div>
              <ColorPicker value={catModal.color} onChange={c => setCatModal(p => ({ ...p, color: c }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <Btn onClick={saveCategory} disabled={!catModal.name.trim()} color={t.green}>{catModal.id ? 'Save Changes' : 'Create Category'}</Btn>
              <Btn onClick={() => setCatModal(null)} outline color={t.muted}>Cancel</Btn>
            </div>
          </div>
        </ErpModal>
      )}

      {/* Assign / Move vehicle modal */}
      {assignModal && (
        <AssignVehicleModal
          plate={assignModal.plate}
          devIdno={assignModal.devIdno}
          currentCompanyId={assignModal.companyId}
          currentCategoryId={assignModal.categoryId}
          companies={companies}
          categories={categories}
          onSave={saveAssign}
          onUnassign={unassign}
          onClose={() => setAssignModal(null)}
        />
      )}

      {/* Bulk assign modal */}
      {bulkModal && (
        <BulkAssignModal
          count={bulkSel.length}
          companies={companies}
          categories={categories}
          onSave={saveBulkAssign}
          onClose={() => setBulkModal(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <ErpModal title={`Delete ${deleteConfirm.type === 'company' ? 'Company' : 'Category'}`} onClose={() => setDeleteConfirm(null)}>
          <div style={{ color: t.textSoft, fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            {deleteConfirm.type === 'company'
              ? <>Delete <b>{deleteConfirm.name}</b>? {deleteConfirm.vehicleCount > 0 && <span style={{ color: t.orange }}>{deleteConfirm.vehicleCount} vehicle(s) will become unassigned.</span>}</>
              : <>Delete category <b>{deleteConfirm.name}</b>? {deleteConfirm.vehicleCount > 0 && <span style={{ color: t.orange }}>{deleteConfirm.vehicleCount} vehicle(s) will lose this category (they stay in their company).</span>}</>
            }
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn color={t.red} onClick={() => deleteConfirm.type === 'company' ? deleteCompany(deleteConfirm.id) : deleteCategory(deleteConfirm.id)}>Yes, Delete</Btn>
            <Btn outline color={t.muted} onClick={() => setDeleteConfirm(null)}>Cancel</Btn>
          </div>
        </ErpModal>
      )}
    </div>
  );
}

function AssignVehicleModal({ plate, devIdno, currentCompanyId, currentCategoryId, companies, categories, onSave, onUnassign, onClose }) {
  const { t } = useTheme();
  const [companyId,  setCompanyId]  = useState(currentCompanyId  || '');
  const [categoryId, setCategoryId] = useState(currentCategoryId || '');
  const isMove = !!currentCompanyId;
  return (
    <ErpModal title={isMove ? `Move ${plate}` : `Assign ${plate}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Sel label="Company *" value={companyId} onChange={e => setCompanyId(e.target.value)}>
          <option value="">— Select company —</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Sel>
        <Sel label="Category (optional)" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">— No category —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Sel>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Btn onClick={() => onSave(devIdno, companyId, categoryId || null)} disabled={!companyId}>
            {isMove ? 'Move Vehicle' : 'Assign Vehicle'}
          </Btn>
          {isMove && <Btn color={t.red} outline onClick={() => onUnassign(devIdno)}>Unassign</Btn>}
          <Btn outline color={t.muted} onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ErpModal>
  );
}

function BulkAssignModal({ count, companies, categories, onSave, onClose }) {
  const [companyId,  setCompanyId]  = useState('');
  const [categoryId, setCategoryId] = useState('');
  return (
    <ErpModal title={`Assign ${count} vehicles`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Sel label="Company *" value={companyId} onChange={e => setCompanyId(e.target.value)}>
          <option value="">— Select company —</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Sel>
        <Sel label="Category (optional)" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">— No category —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Sel>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Btn onClick={() => onSave(companyId, categoryId || null)} disabled={!companyId}>Assign All</Btn>
          <Btn outline color="#888" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ErpModal>
  );
}

// ── View: Fuel Consumption Report ─────────────────────────────────────────────

const THRESHOLD_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];
const today = () => new Date().toISOString().slice(0, 10);

function FuelConsumptionView({ vehicles, erpSummary }) {
  const { t } = useTheme();
  const todayStr = today();
  const [begintime, setBegintime] = useState(`${todayStr} 00:00:00`);
  const [endtime,   setEndtime]   = useState(`${todayStr} 23:59:59`);
  const [vehicle,   setVehicle]   = useState("");
  const [spacing,   setSpacing]   = useState(0);
  const [threshold, setThreshold] = useState(20);
  const [speedThreshold, setSpeedThreshold] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [fuelData,  setFuelData]  = useState(null);
  const [events,    setEvents]    = useState([]);
  const [preset,    setPreset]    = useState("custom");
  const { filterBar, filtered: erpFiltered } = useFleetFilter(vehicles, erpSummary);

  const applyPreset = (p) => {
    setPreset(p);
    const now = new Date();
    if (p === "today") {
      const d = now.toISOString().slice(0, 10);
      setBegintime(`${d} 00:00:00`); setEndtime(`${d} 23:59:59`);
    } else if (p === "yesterday") {
      const d = new Date(now - 86400000).toISOString().slice(0, 10);
      setBegintime(`${d} 00:00:00`); setEndtime(`${d} 23:59:59`);
    } else if (p === "week") {
      const e = now.toISOString().slice(0, 10);
      const s = new Date(now - 6 * 86400000).toISOString().slice(0, 10);
      setBegintime(`${s} 00:00:00`); setEndtime(`${e} 23:59:59`);
    }
  };

  const query = async () => {
    if (!vehicle) { setError("Please select a vehicle"); return; }
    setLoading(true); setError(null); setFuelData(null);
    try {
      const veh = vehicles.find(v => v.plate === vehicle || v.devIdno === vehicle);
      const id  = veh?.plate || vehicle;
      const raw = await apiFetch(`/fuel/${encodeURIComponent(id)}/report?begintime=${encodeURIComponent(begintime)}&endtime=${encodeURIComponent(endtime)}&type=dynamic`);
      const normalized = normalizeFuelData(raw);
      const detected   = detectFuelEvents(normalized, threshold, threshold);
      setFuelData(normalized);
      setEvents(detected);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const exportCSV = () => {
    if (!fuelData?.length) return;
    const rows = ["Time,Fuel (units),Speed (km/h),Mileage (km),Event"];
    for (const r of fuelData) {
      const ev = events.find(e => e.x === r.time);
      rows.push(`${r.timeStr},${r.fuel},${r.speed},${r.mileage.toFixed(2)},${ev ? (ev.type === "refuel" ? `Refuel +${ev.value}` : `Drop -${ev.value}`) : ""}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `fuel_${vehicle}_${todayStr}.csv` });
    a.click();
  };

  const refuels = events.filter(e => e.type === "refuel");
  const drops   = events.filter(e => e.type === "drop");
  const totalUsed = fuelData ? totalConsumption(fuelData) : null;
  const distanceTravelled = fuelData?.length ? (fuelData[fuelData.length - 1].mileage - fuelData[0].mileage).toFixed(1) : null;

  const chartSeries = fuelData ? [{
    label: "Fuel Level",
    color: t.accent,
    data: fuelData.map(r => ({ x: r.time, y: r.fuel })),
  }] : [];

  const speedSeries = fuelData?.some(r => r.speed > 0) ? {
    label: "Speed (km/h)",
    data: fuelData.map(r => ({ x: r.time, y: r.speed })),
  } : null;

  const visibleAnnotations = (speedThreshold && Number(speedThreshold) > 0)
    ? [...events, ...fuelData.filter(r => r.speed > Number(speedThreshold)).map(r => ({ x: r.time, type: "speed", label: `${r.speed}km/h` }))]
    : events;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Query form */}
      <Panel title="⛽ Fuel Consumption Report — Query">
        <div style={{ padding: 18 }}>
          {filterBar}
          {/* Preset row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <span style={{ color: t.textSoft, fontSize: 12, alignSelf: "center" }}>Sel Time:</span>
            {[["custom","Custom"],["today","Today"],["yesterday","Yesterday"],["week","This Week"]].map(([val, lbl]) => (
              <button key={val} onClick={() => applyPreset(val)} style={{
                background: preset === val ? t.accentSoft : "transparent",
                border: `1px solid ${preset === val ? t.accent : t.border}`,
                borderRadius: 6, padding: "5px 12px", color: preset === val ? t.accent : t.textSoft,
                cursor: "pointer", fontSize: 12, fontWeight: preset === val ? 700 : 400,
              }}>{lbl}</button>
            ))}
          </div>

          {/* Fields grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
            <Inp label="Starting Time" type="text" value={begintime} onChange={e => { setPreset("custom"); setBegintime(e.target.value); }}
              placeholder="YYYY-MM-DD HH:mm:ss" />
            <Inp label="End Time" type="text" value={endtime} onChange={e => { setPreset("custom"); setEndtime(e.target.value); }}
              placeholder="YYYY-MM-DD HH:mm:ss" />
            <Sel label="Vehicle" value={vehicle} onChange={e => setVehicle(e.target.value)}>
              <option value="">Please Select</option>
              {erpFiltered.map(v => (
                <option key={v.devIdno} value={v.plate || v.devIdno}>{v.plate || v.nm || v.devIdno}</option>
              ))}
            </Sel>
            <Inp label="Spacing (KM)" type="number" value={spacing} onChange={e => setSpacing(e.target.value)} min={0} placeholder="0" />
            <Sel label="Change ≥ (Regarded as refueling)" value={threshold} onChange={e => setThreshold(Number(e.target.value))}>
              {THRESHOLD_OPTIONS.map(v => <option key={v} value={v}>{v}L</option>)}
            </Sel>
            <Inp label="Speed threshold > (km/h) — optional" type="number" value={speedThreshold}
              onChange={e => setSpeedThreshold(e.target.value)} placeholder="Not judging speed" />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={query} disabled={loading || !vehicle}>{loading ? "Querying…" : "Query"}</Btn>
            <Btn onClick={exportCSV} disabled={!fuelData?.length} color={t.blue} outline>Export CSV</Btn>
          </div>
          {error && <div style={{ marginTop: 12 }}><ErrorBanner message={error} /></div>}
        </div>
      </Panel>

      {loading && <Spinner label="Fetching fuel data…" />}

      {fuelData && !loading && (
        <>
          {/* Summary KPIs */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard label="Fuel Consumed" value={totalUsed} sub="sensor units" color={t.accent} icon="🔥" />
            <StatCard label="Refueling Events" value={refuels.length} sub={refuels.map(r => `+${r.value}`).join(", ") || "none"} color={t.green} icon="⛽" />
            <StatCard label="Drop Events" value={drops.length} sub={drops.map(r => `-${r.value}`).join(", ") || "none"} color={t.red} icon="⚠" />
            <StatCard label="Distance" value={distanceTravelled != null ? `${distanceTravelled} km` : "—"} sub="total travelled" color={t.blue} icon="📍" />
            <StatCard label="Data Points" value={fuelData.length} sub={`${vehicle}`} color={t.purple} icon="📊" />
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, padding: "8px 0", flexWrap: "wrap" }}>
            {[
              { color: t.accent,  label: "Fuel Level" },
              speedSeries ? { color: t.cyan, label: "Speed (dashed)", dashed: true } : null,
              { color: t.green, label: "↑ Refueling", dot: true },
              { color: t.red,   label: "↓ Fuel Drop",  dot: true },
            ].filter(Boolean).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {item.dot
                  ? <div style={{ width: 18, height: 3, background: item.color, borderRadius: 2, position: "relative" }}>
                      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                    </div>
                  : <div style={{ width: 24, height: 3, background: item.color, borderRadius: 2, ...(item.dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0, ${item.color} 4px, transparent 4px, transparent 8px)`, background: "none" } : {}) }} />
                }
                <span style={{ color: t.textSoft, fontSize: 12 }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Fuel curve chart */}
          <Panel title="Fuel Level Over Time">
            <div style={{ padding: "12px 8px 0" }}>
              <LineChart
                series={chartSeries}
                annotations={visibleAnnotations}
                y2Series={speedSeries}
                y2Color={t.cyan}
                height={280}
                yLabel="Fuel (units)"
              />
            </div>
          </Panel>

          {/* Data table */}
          <Panel title={`Data Table (${fuelData.length} records)`}>
            <div style={{ overflowX: "auto", maxHeight: 380, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: t.bgAlt, position: "sticky", top: 0 }}>
                    {["Time", "Fuel (units)", "Δ Fuel", "Speed (km/h)", "Mileage (km)", "ACC", "Event"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: t.textSoft, fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fuelData.map((r, i) => {
                    const delta  = i > 0 ? r.fuel - fuelData[i - 1].fuel : null;
                    const ev     = events.find(e => e.x === r.time);
                    const rowBg  = ev?.type === "refuel" ? t.greenSoft : ev?.type === "drop" ? t.redSoft : i % 2 === 0 ? "transparent" : `${t.panelBright}66`;
                    return (
                      <tr key={i} style={{ background: rowBg }}>
                        <td style={{ padding: "8px 14px", fontFamily: "inherit", color: t.textSoft }}>{r.timeStr}</td>
                        <td style={{ padding: "8px 14px", fontFamily: "inherit", color: t.text, fontWeight: 600 }}>{r.fuel.toFixed(1)}</td>
                        <td style={{ padding: "8px 14px", fontFamily: "inherit", color: delta == null ? t.muted : delta > 0 ? t.green : delta < -0.5 ? t.red : t.textSoft, fontWeight: 600 }}>
                          {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                        </td>
                        <td style={{ padding: "8px 14px", fontFamily: "inherit", color: r.speed > (Number(speedThreshold) || 999) ? t.red : t.text }}>
                          {r.speed.toFixed(1)}
                        </td>
                        <td style={{ padding: "8px 14px", fontFamily: "inherit", color: t.textSoft }}>{r.mileage.toFixed(2)}</td>
                        <td style={{ padding: "8px 14px", fontFamily: "inherit", fontWeight: 700, color: r.accOn === true ? "#00b341" : r.accOn === false ? "#e53e3e" : t.muted }}>
                          {r.accOn === true ? "ON" : r.accOn === false ? "OFF" : "—"}
                        </td>
                        <td style={{ padding: "8px 14px" }}>
                          {ev && <Badge text={ev.type === "refuel" ? `⛽ +${ev.value}L` : `⚠ -${ev.value}L`} color={ev.type === "refuel" ? t.green : t.red} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

// ── View: Daily / Monthly Fuel Report ─────────────────────────────────────────

function FuelDailyMonthlyView({ vehicles, erpSummary }) {
  const { t } = useTheme();
  const nowDate = today();
  const monthAgo = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
  const [startDate,  setStartDate]  = useState(monthAgo);
  const [endDate,    setEndDate]    = useState(nowDate);
  const [vehicle,    setVehicle]    = useState("all");
  const [groupBy,    setGroupBy]    = useState("daily");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [report,     setReport]     = useState(null);
  const { filterBar, filtered: erpFiltered } = useFleetFilter(vehicles, erpSummary);

  const query = async () => {
    setLoading(true); setError(null); setReport(null);
    try {
      const vehsToQuery = vehicle === "all"
        ? vehicles.slice(0, 10)
        : vehicles.filter(v => v.plate === vehicle || v.devIdno === vehicle);

      if (!vehsToQuery.length) throw new Error("No vehicles selected");

      const begintime = `${startDate} 00:00:00`;
      const endtime   = `${endDate} 23:59:59`;

      const results = await Promise.allSettled(
        vehsToQuery.map(v =>
          apiFetch(`/reports/trips/${encodeURIComponent(v.plate || v.devIdno)}?begintime=${encodeURIComponent(begintime)}&endtime=${encodeURIComponent(endtime)}&pageSize=500`)
            .then(data => ({ plate: v.plate || v.devIdno, trips: Array.isArray(data) ? data : [] }))
        )
      );

      // Aggregate per day or month
      const bucket = {};
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { plate, trips } = r.value;
        for (const trip of trips) {
          const dateStr = (trip.btimeStr || trip.startTime || "").slice(0, groupBy === "daily" ? 10 : 7);
          if (!dateStr) continue;
          if (!bucket[dateStr]) bucket[dateStr] = { date: dateStr, distance: 0, fuel: 0, trips: 0, vehicles: new Set() };
          bucket[dateStr].distance += (trip.liCheng || 0) / 1000;
          bucket[dateStr].fuel     += (trip.youLiang || 0) / 100;
          bucket[dateStr].trips    += 1;
          bucket[dateStr].vehicles.add(plate);
        }
      }

      const rows = Object.values(bucket)
        .map(b => ({ ...b, vehicles: b.vehicles.size }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setReport(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const exportCSV = () => {
    if (!report?.length) return;
    const rows = ["Date,Distance (km),Fuel Used,Trips,Vehicles"];
    for (const r of report) rows.push(`${r.date},${r.distance.toFixed(2)},${r.fuel.toFixed(2)},${r.trips},${r.vehicles}`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `fuel_${groupBy}_${startDate}_${endDate}.csv` });
    a.click();
  };

  const chartSeries = report ? [
    { label: "Fuel Used",   color: t.accent, data: report.map(r => ({ x: new Date(r.date).getTime(), y: r.fuel })) },
    { label: "Distance km", color: t.blue,   data: report.map(r => ({ x: new Date(r.date).getTime(), y: r.distance })), fill: false },
  ] : [];

  const totalFuel     = report?.reduce((s, r) => s + r.fuel, 0).toFixed(1) ?? "—";
  const totalDistance = report?.reduce((s, r) => s + r.distance, 0).toFixed(1) ?? "—";
  const totalTrips    = report?.reduce((s, r) => s + r.trips, 0) ?? "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Panel title="📅 Fuel Daily / Monthly Report — Query">
        <div style={{ padding: 18 }}>
          {filterBar}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14, marginBottom: 16 }}>
            <Inp label="Starting Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Inp label="End Date"      type="date" value={endDate}   onChange={e => setEndDate(e.target.value)} />
            <Sel label="Vehicle" value={vehicle} onChange={e => setVehicle(e.target.value)}>
              <option value="all">All Vehicles</option>
              {erpFiltered.map(v => (
                <option key={v.devIdno} value={v.plate || v.devIdno}>{v.plate || v.nm || v.devIdno}</option>
              ))}
            </Sel>
            <Sel label="Group By" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </Sel>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={query} disabled={loading}>{loading ? "Querying…" : "Query"}</Btn>
            <Btn onClick={exportCSV} disabled={!report?.length} color={t.blue} outline>Export CSV</Btn>
          </div>
          {error && <div style={{ marginTop: 12 }}><ErrorBanner message={error} /></div>}
        </div>
      </Panel>

      {loading && <Spinner label="Fetching trip data…" />}

      {report && !loading && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard label="Total Fuel Used"  value={totalFuel}     sub="sensor units"    color={t.accent} icon="🔥" />
            <StatCard label="Total Distance"   value={`${totalDistance} km`} sub="all trips"    color={t.blue}   icon="🛣" />
            <StatCard label="Total Trips"      value={totalTrips}    sub={`${report.length} ${groupBy === "daily" ? "days" : "months"}`} color={t.purple} icon="🗓" />
          </div>

          {report.length > 0 ? (
            <>
              <Panel title={`${groupBy === "daily" ? "Daily" : "Monthly"} Fuel & Distance Trend`}>
                <div style={{ display: "flex", gap: 16, padding: "10px 16px 0", flexWrap: "wrap" }}>
                  {[{ color: t.accent, label: "Fuel Used" }, { color: t.blue, label: "Distance (km)", dashed: true }].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 24, height: 3, background: item.color, borderRadius: 2 }} />
                      <span style={{ color: t.textSoft, fontSize: 12 }}>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "8px 8px 0" }}>
                  <LineChart series={chartSeries} height={260} yLabel="Value" />
                </div>
              </Panel>

              <Panel title={`${groupBy === "daily" ? "Daily" : "Monthly"} Breakdown (${report.length} rows)`}>
                <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: t.bgAlt, position: "sticky", top: 0 }}>
                        {["Date", "Fuel Used", "Distance (km)", "Trips", "Vehicles", "Avg L/100km"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: t.textSoft, fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((r, i) => {
                        const avg = r.distance > 0 ? ((r.fuel / r.distance) * 100).toFixed(1) : "—";
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : `${t.panelBright}55` }}>
                            <td style={{ padding: "10px 16px", fontFamily: "inherit", color: t.text, fontWeight: 600 }}>{r.date}</td>
                            <td style={{ padding: "10px 16px", fontFamily: "inherit", color: t.accent, fontWeight: 700 }}>{r.fuel.toFixed(2)}</td>
                            <td style={{ padding: "10px 16px", fontFamily: "inherit", color: t.blue }}>{r.distance.toFixed(2)}</td>
                            <td style={{ padding: "10px 16px", fontFamily: "inherit", color: t.text }}>{r.trips}</td>
                            <td style={{ padding: "10px 16px", fontFamily: "inherit", color: t.textSoft }}>{r.vehicles}</td>
                            <td style={{ padding: "10px 16px", fontFamily: "inherit", color: avg !== "—" && Number(avg) > 20 ? t.red : t.green }}>{avg}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          ) : (
            <Empty icon="📭" text="No trip data found for this period." />
          )}
        </>
      )}
    </div>
  );
}

// ── View: Dashboard ───────────────────────────────────────────────────────────

function DashboardView({ snapshot, activeCompany, filteredVehicles = [] }) {
  const { t } = useTheme();
  const { totals = {}, alerts = {}, topSpeeds = [] } = snapshot;
  const speeding = alerts.speeding || [];
  const alarming = alerts.alarming || [];
  const offline  = alerts.offline  || [];

  // When a company is active, derive stats from filteredVehicles
  const companyOnline  = filteredVehicles.filter(v => (v.online ?? 0) !== 0).length;
  const companyOffline = filteredVehicles.filter(v => (v.online ?? 0) === 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Company context banner */}
      {activeCompany && (
        <div style={{
          background: `linear-gradient(135deg, ${activeCompany.color}22, ${activeCompany.color}0a)`,
          border: `1px solid ${activeCompany.color}44`,
          borderRadius: 16, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: activeCompany.color, boxShadow: `0 0 12px ${activeCompany.color}` }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: t.text }}>{activeCompany.name}</div>
            <div style={{ color: t.textSoft, fontSize: 12, marginTop: 2 }}>Showing data for this company only</div>
          </div>
          {activeCompany.phone && <div style={{ color: t.muted, fontSize: 13 }}>📞 {activeCompany.phone}</div>}
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: t.green, fontWeight: 800, fontSize: 20 }}>{companyOnline}</div>
              <div style={{ color: t.muted, fontSize: 11 }}>Online</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: t.red, fontWeight: 800, fontSize: 20 }}>{companyOffline}</div>
              <div style={{ color: t.muted, fontSize: 11 }}>Offline</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: t.purple, fontWeight: 800, fontSize: 20 }}>{filteredVehicles.length}</div>
              <div style={{ color: t.muted, fontSize: 11 }}>Total</div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <StatCard label={activeCompany ? "Company Fleet" : "Total Fleet"}
          value={activeCompany ? filteredVehicles.length : totals.vehicles} sub="registered"  color={t.blue}   icon="🚌" />
        <StatCard label="Online"
          value={activeCompany ? companyOnline : totals.online}
          sub={filteredVehicles.length ? `${Math.round(((activeCompany ? companyOnline : (totals.online||0)) / (activeCompany ? filteredVehicles.length : (totals.vehicles||1))) * 100)}% availability` : ""}
          color={t.green}  icon="🟢" />
        <StatCard label="Alarming"     value={totals.alarming} sub="need attention" color={t.red}    icon="🚨" />
        <StatCard label="Offline"
          value={activeCompany ? companyOffline : totals.offline} sub="not reporting"  color={t.muted}  icon="⚫" />
        <StatCard label="Moving"       value={totals.moving}   sub="right now"      color={t.accent} icon="▶" />
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        <Panel title={`⚡ SPEEDING NOW (${speeding.length})`} style={{ flex: 1 }}>
          {speeding.length === 0
            ? <Empty icon="✅" text="No vehicles speeding" />
            : speeding.map((v, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${t.border}` }}>
                <span style={{ fontFamily: "inherit", color: t.text, fontWeight: 700 }}>{v.plate}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: t.red, fontWeight: 800, fontFamily: "inherit" }}>{v.speed} km/h</span>
                  <Badge text={`limit ${v.limit}`} color={t.muted} />
                </div>
              </div>
            ))}
        </Panel>

        <Panel title={`🚨 ACTIVE ALARMS (${alarming.length})`} style={{ flex: 1 }}>
          {alarming.length === 0
            ? <Empty icon="✅" text="No active alarms" />
            : alarming.map((v, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${t.border}` }}>
                <span style={{ fontFamily: "inherit", color: t.text, fontWeight: 700 }}>{v.plate}</span>
                <Badge text="ALARMING" color={t.red} />
              </div>
            ))}
        </Panel>

        <Panel title="📊 TOP SPEEDS TODAY" style={{ flex: 1 }}>
          {topSpeeds.length === 0
            ? <Empty icon="📭" text="No speed data" />
            : topSpeeds.map((v, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: t.muted, fontFamily: "inherit", fontSize: 11, width: 20 }}>#{i + 1}</span>
                  <span style={{ fontFamily: "inherit", color: t.text }}>{v.plate}</span>
                </div>
                <span style={{ fontFamily: "inherit", fontWeight: 700, color: v.speed > 100 ? t.red : v.speed > 80 ? t.accent : t.green }}>
                  {v.speed} km/h
                </span>
              </div>
            ))}
        </Panel>
      </div>

      {offline.length > 0 && (
        <Panel title={`⚫ OFFLINE VEHICLES (${offline.length})`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 16 }}>
            {offline.map((v, i) => <Badge key={i} text={v.plate} color={t.muted} />)}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ── Shared: Fleet Filter Bar ──────────────────────────────────────────────────
// Returns JSX filter bar + a filteredList derived from vehicles prop.
// Usage: const { filterBar, filtered } = useFleetFilter(vehicles, erpSummary);

function useFleetFilter(vehicles, erpSummary) {
  const { t } = useTheme();
  const [companyId,  setCompanyId]  = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search,     setSearch]     = useState('');

  const companies  = erpSummary?.companies  || [];
  const categories = erpSummary?.categories || [];

  // Build a map: devIdno → { companyId, categoryId } from erpSummary
  const assignMap = {};
  for (const co of companies) {
    for (const v of (co.vehicles || [])) {
      assignMap[v.devIdno] = { companyId: co.id, categoryId: v.categoryId || null };
    }
  }

  const filtered = vehicles.filter(v => {
    const a = assignMap[v.devIdno] || {};
    if (companyId  && a.companyId  !== companyId)  return false;
    if (categoryId && a.categoryId !== categoryId) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(v.plate || '').toLowerCase().includes(q) && !(v.devIdno || '').includes(q)) return false;
    }
    return true;
  });

  const filterBar = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search plate or device ID…"
        style={{ background: t.panel, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: '9px 14px', color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 200, flex: 1 }}
      />
      {companies.length > 0 && (
        <select value={companyId} onChange={e => { setCompanyId(e.target.value); setCategoryId(''); }}
          style={{ background: t.panel, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: '9px 14px', color: companyId ? t.text : t.muted, fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {categories.length > 0 && (
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          style={{ background: t.panel, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: '9px 14px', color: categoryId ? t.text : t.muted, fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {(search || companyId || categoryId) && (
        <button onClick={() => { setSearch(''); setCompanyId(''); setCategoryId(''); }}
          style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 10, padding: '9px 14px', color: t.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
          ✕ Clear
        </button>
      )}
      <span style={{ color: t.muted, fontSize: 12, whiteSpace: 'nowrap' }}>{filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}</span>
    </div>
  );

  return { filterBar, filtered };
}

// ── View: Vehicles ────────────────────────────────────────────────────────────

function VehiclesView({ vehicles, loading, error, onRetry, onSelect, erpSummary }) {
  const { t } = useTheme();
  const [statusFilter, setStatusFilter] = useState("all");
  const { filterBar, filtered: fleetFiltered } = useFleetFilter(vehicles, erpSummary);

  if (loading) return <Spinner label="Loading vehicles…" />;
  if (error)   return <ErrorBanner message={error} onRetry={onRetry} />;

  const filtered = fleetFiltered.filter(v => {
    if (statusFilter === "online")  return v.online === 1;
    if (statusFilter === "offline") return v.online === 0;
    if (statusFilter === "alarm")   return v.online === 2;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {filterBar}
      <div style={{ display: "flex", gap: 8 }}>
        {["all", "online", "offline", "alarm"].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)} style={{
            background: statusFilter === f ? `linear-gradient(135deg, ${t.accent}, ${t.accentAlt})` : t.panel,
            border: `1.5px solid ${statusFilter === f ? "transparent" : t.border}`,
            borderRadius: 10, padding: "8px 16px",
            color: statusFilter === f ? "#fff" : t.textSoft,
            cursor: "pointer", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1,
            fontFamily: "inherit",
            boxShadow: statusFilter === f ? `0 4px 14px ${t.accentGlow}` : "none",
          }}>{f}</button>
        ))}
      </div>
      <Panel title={`VEHICLES (${filtered.length})`}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: t.bgAlt }}>
                {["Status","Plate","Device ID","Speed","Fuel","ACC","Action"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: t.textSoft, fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1px solid ${t.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr key={v.devIdno || i} style={{ background: i % 2 === 0 ? "transparent" : `${t.panelBright}55` }}
                  onMouseEnter={e => e.currentTarget.style.background = t.accentSoft}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : `${t.panelBright}55`}>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: v.online === 1 ? t.green : v.online === 2 ? t.red : t.muted, boxShadow: v.online === 1 ? `0 0 8px ${t.green}` : "none" }} />
                  </td>
                  <td style={{ padding: "10px 16px", fontFamily: "inherit", color: t.text, fontWeight: 700 }}>{v.plate || v.nm || "—"}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "inherit", color: t.textSoft, fontSize: 12 }}>{v.devIdno || "—"}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "inherit", color: v.speed > 100 ? t.red : t.text }}>{v.speed ? `${v.speed} km/h` : "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {v.fuel != null && v.fuel > 0
                      ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: t.green, fontSize: 11, fontFamily: "inherit" }}>⛽ {Math.round(v.fuel)}</span>
                          {v.fuelEstimated && <span style={{ color: t.muted, fontSize: 9 }}>~</span>}
                        </div>
                      : v.fuel === 0
                        ? <span style={{ color: t.muted, fontSize: 12 }}>No signal</span>
                        : <span style={{ color: t.muted, fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <Badge text={v.accOn ? "ON" : "OFF"} color={v.accOn ? t.green : t.muted} />
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <Btn onClick={() => onSelect(v)} color={t.blue} outline style={{ padding: "4px 12px", fontSize: 12 }}>Details</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ── View: Alarms ──────────────────────────────────────────────────────────────

function AlarmsView({ alarms, loading, error, onRetry }) {
  const { t } = useTheme();
  const [typeFilter, setTypeFilter] = useState("all");
  if (loading) return <Spinner label="Loading alarms…" />;
  if (error)   return <ErrorBanner message={error} onRetry={onRetry} />;

  const types    = ["all", ...new Set(alarms.map(a => a.alarmTypeName).filter(Boolean))];
  const filtered = typeFilter === "all" ? alarms : alarms.filter(a => a.alarmTypeName === typeFilter);

  const color = (type = "") => {
    if (type.includes("Fuel"))    return t.purple;
    if (type.includes("Speed") || type.includes("speed")) return t.red;
    if (type.includes("Fatigue")) return t.accent;
    if (type.includes("Fence"))   return t.blue;
    return t.textSoft;
  };

  const alarmIcon = (type = "") => {
    if (type.includes("Speed")) return "🚨";
    if (type.includes("Fuel"))  return "⛽";
    if (type.includes("Fence")) return "📍";
    if (type.includes("Fatigue")) return "😴";
    return "⚡";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* What are alarms? */}
      <div style={{
        background: t.blueSoft, border: `1px solid ${t.blue}44`, borderRadius: 14,
        padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>ℹ️</span>
        <div style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.7 }}>
          <b style={{ color: t.text }}>What are alarms?</b> Alarms are triggered automatically by your GPS devices when
          certain conditions are detected — for example a vehicle exceeding the speed limit, crossing a geo-fence boundary,
          a fuel drop, or driver fatigue. The list below shows all alarms recorded <b>today</b>.
          Configure alarm rules in <b>CMSV6 → Alert Rules</b>.
        </div>
      </div>

      {/* Type filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {types.map(tp => (
          <button key={tp} onClick={() => setTypeFilter(tp)} style={{
            background: typeFilter === tp ? t.accent : t.panel,
            border: `1px solid ${typeFilter === tp ? t.accent : t.border}`,
            borderRadius: 20, padding: "6px 14px",
            color: typeFilter === tp ? "#fff" : t.textSoft,
            cursor: "pointer", fontSize: 12, fontWeight: typeFilter === tp ? 700 : 400,
            fontFamily: "inherit",
          }}>{tp === "all" ? `All (${alarms.length})` : tp}</button>
        ))}
      </div>

      <Panel title={`ALARMS TODAY (${filtered.length})`}>
        {filtered.length === 0
          ? <Empty icon="✅" text="No alarms found for selected type" />
          : filtered.map((a, i) => (
            <div key={a.id || i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "13px 18px", borderBottom: `1px solid ${t.border}`,
              background: i % 2 ? `${t.bgAlt}55` : "transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18 }}>{alarmIcon(a.alarmTypeName || "")}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge text={a.alarmTypeName || `Type ${a.atp}`} color={color(a.alarmTypeName || "")} />
                    <span style={{ fontFamily: "inherit", color: t.text, fontWeight: 700 }}>{a.plate || a.nm || a.devIdno}</span>
                  </div>
                  {a.speed > 0 && (
                    <div style={{ color: t.red, fontSize: 12, marginTop: 3 }}>Speed: {a.speed} km/h</div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: t.textSoft, fontSize: 12, fontFamily: "inherit" }}>
                  {a.alarmTime ? new Date(a.alarmTime).toLocaleTimeString("en-TZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : (a.at || "—")}
                </div>
                {a.alarmTime && (
                  <div style={{ color: t.muted, fontSize: 11 }}>
                    {new Date(a.alarmTime).toLocaleDateString("en-TZ")}
                  </div>
                )}
              </div>
            </div>
          ))}
      </Panel>
    </div>
  );
}

// ── View: Live Cameras ────────────────────────────────────────────────────────

function LiveCamerasView({ vehicles, erpSummary }) {
  const { t } = useTheme();
  const [streamVehicle, setStreamVehicle] = useState(null);
  const [channel, setChannel]             = useState(1);
  const { filterBar, filtered: erpFiltered } = useFleetFilter(vehicles, erpSummary);
  const [onlineOnly, setOnlineOnly]       = useState(true);

  // Only show vehicles that are online (can stream)
  const displayVehicles = erpFiltered.filter(v => !onlineOnly || (v.online !== 0 && v.online != null));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filter bar */}
      {filterBar}

      {/* Online-only toggle + count */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => setOnlineOnly(p => !p)} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: onlineOnly ? t.greenSoft : t.panel,
          border: `1.5px solid ${onlineOnly ? t.green : t.border}`,
          borderRadius: 10, padding: "8px 16px",
          color: onlineOnly ? t.green : t.textSoft,
          cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit",
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: onlineOnly ? t.green : t.muted, boxShadow: onlineOnly ? `0 0 6px ${t.green}` : "none" }} />
          {onlineOnly ? "Online Only" : "All Vehicles"}
        </button>
        <span style={{ color: t.muted, fontSize: 13 }}>
          {displayVehicles.length} vehicle{displayVehicles.length !== 1 ? "s" : ""} available to stream
        </span>
      </div>

      {displayVehicles.length === 0 && (
        <div style={{
          textAlign: "center", padding: "60px 40px",
          background: t.panel, borderRadius: 16, border: `1px solid ${t.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>
            {onlineOnly ? "No vehicles online right now" : "No vehicles found"}
          </div>
          <div style={{ fontSize: 13, color: t.muted, marginBottom: 16 }}>
            {onlineOnly ? "Live camera streaming requires the vehicle to be online and connected." : "Try adjusting your filters."}
          </div>
          {onlineOnly && (
            <button onClick={() => setOnlineOnly(false)} style={{
              background: t.accentSoft, border: `1px solid ${t.accent}`, borderRadius: 10,
              padding: "8px 18px", color: t.accent, cursor: "pointer", fontSize: 13, fontWeight: 700,
              fontFamily: "inherit",
            }}>Show All Vehicles</button>
          )}
        </div>
      )}

      {/* Vehicle camera cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {displayVehicles.map(v => {
          const isStreaming = streamVehicle?.devIdno === v.devIdno;
          const isOnline = v.online !== 0 && v.online != null;
          return (
            <div key={v.devIdno} style={{
              borderRadius: 14, overflow: "hidden",
              border: `1.5px solid ${isStreaming ? t.accent : t.border}`,
              background: t.panel,
              boxShadow: isStreaming ? `0 4px 20px ${t.accentGlow}` : "0 2px 8px rgba(0,0,0,0.05)",
              transition: "all 0.2s",
            }}>
              {/* Camera preview area */}
              <div style={{
                height: 140, background: isStreaming ? "#000" : t.bgAlt,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
              }}>
                {isStreaming ? (
                  <SidebarVideoPlayer
                    vehicle={v} channel={channel}
                    onClose={() => setStreamVehicle(null)}
                    onChannelChange={setChannel}
                    embedded
                  />
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>📷</div>
                    <div style={{ color: isOnline ? t.textSoft : t.muted, fontSize: 12 }}>
                      {isOnline ? "Click to stream" : "Offline"}
                    </div>
                  </div>
                )}
                {/* Online indicator */}
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  width: 8, height: 8, borderRadius: "50%",
                  background: isOnline ? t.green : t.muted,
                  boxShadow: isOnline ? `0 0 6px ${t.green}` : "none",
                }} />
              </div>
              {/* Card footer */}
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.plate || v.nm || v.devIdno}
                  </div>
                  <div style={{ color: isOnline ? t.green : t.muted, fontSize: 11, marginTop: 2 }}>
                    {isOnline ? "● Online" : "○ Offline"}
                    {v.accOn && <span style={{ color: t.green, marginLeft: 8 }}>ACC ON</span>}
                  </div>
                </div>
                <button
                  onClick={() => { setStreamVehicle(isStreaming ? null : v); setChannel(1); }}
                  disabled={!isOnline}
                  style={{
                    background: isStreaming ? t.red : isOnline ? `linear-gradient(135deg, ${t.accent}, ${t.accentAlt})` : t.bgAlt,
                    border: "none", borderRadius: 9, padding: "6px 14px",
                    color: isOnline ? "#fff" : t.muted, cursor: isOnline ? "pointer" : "not-allowed",
                    fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                    boxShadow: isStreaming || !isOnline ? "none" : `0 2px 10px ${t.accentGlow}`,
                  }}>
                  {isStreaming ? "■ Stop" : "▶ Stream"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-screen video button when streaming */}
      {streamVehicle && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 500 }}>
          <button style={{
            background: `linear-gradient(135deg, ${t.accent}, ${t.accentAlt})`,
            border: "none", borderRadius: 12, padding: "12px 20px",
            color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700,
            fontFamily: "inherit", boxShadow: `0 4px 20px ${t.accentGlow}`,
          }}>📹 {streamVehicle.plate} — Ch {channel}</button>
        </div>
      )}
    </div>
  );
}

// ── View: Chat ────────────────────────────────────────────────────────────────

function ChatMessage({ role, content }) {
  const { t } = useTheme();
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12, padding: "0 16px" }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8, flexShrink: 0, marginTop: 4 }}>🤖</div>
      )}
      <div style={{
        maxWidth: "80%",
        background: isUser ? t.blueSoft : t.panelBright,
        border: `1px solid ${isUser ? `${t.blue}40` : t.border}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
        padding: "10px 14px", color: t.text, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
      }}>{content}</div>
    </div>
  );
}

function ChatView() {
  const { t } = useTheme();
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Hello! I'm FleetBot, your AI fleet assistant with live access to your fleet data.\n\nAsk me things like:\n• \"Which vehicles are speeding right now?\"\n• \"How many vehicles are online?\"\n• \"Show all alarms from today\"\n• \"What's the fleet status?\"",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const QUICK = ["Which vehicles are speeding now?", "How many are online?", "Any active alarms?", "Fleet status?"];

  const send = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: "Thinking…" }]);
    setInput(""); setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ message: text, history }),
      });
      const json = await res.json();
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: json.success ? json.reply : `Error: ${json.message}` }]);
    } catch (e) {
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: `Network error: ${e.message}` }]);
    }
    setLoading(false);
  }, [messages, loading]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "72vh", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10, background: `linear-gradient(90deg, ${t.panelBright}, ${t.panel})` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.green, boxShadow: `0 0 8px ${t.green}` }} />
        <span style={{ color: t.text, fontWeight: 700 }}>FleetBot — AI Assistant</span>
        <span style={{ color: t.textSoft, fontSize: 12, marginLeft: "auto" }}>Live fleet data</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
        {messages.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "8px 16px", flexWrap: "wrap", borderTop: `1px solid ${t.border}` }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => send(q)} disabled={loading} style={{
            background: "transparent", border: `1px solid ${t.border}`, borderRadius: 20,
            padding: "4px 12px", color: t.textSoft, cursor: "pointer", fontSize: 12,
          }}>{q}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 16, borderTop: `1px solid ${t.border}` }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="Ask about your fleet…" disabled={loading}
          style={{ flex: 1, background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 14px", color: t.text, fontSize: 14, outline: "none" }} />
        <Btn onClick={() => send(input)} disabled={loading}>{loading ? "…" : "Send"}</Btn>
      </div>
    </div>
  );
}

// ── Vehicle Modal ─────────────────────────────────────────────────────────────

function VehicleModal({ vehicle, onClose, onViewVideo }) {
  const { t } = useTheme();
  if (!vehicle) return null;
  const statusColor = vehicle.online === 1 ? t.green : vehicle.online === 2 ? t.red : t.muted;
  const statusLabel = vehicle.online === 1 ? "ONLINE" : vehicle.online === 2 ? "ALARMING" : "OFFLINE";
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: t.panel, border: `1px solid ${t.borderHi}`, borderRadius: 16, padding: 32, width: 480, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "inherit", fontSize: 22, fontWeight: 800, color: t.text }}>{vehicle.plate || vehicle.nm}</div>
            <div style={{ color: t.textSoft, fontSize: 12, fontFamily: "inherit" }}>ID: {vehicle.devIdno}</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Badge text={statusLabel} color={statusColor} />
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.textSoft, cursor: "pointer", fontSize: 22 }}>×</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Speed",    value: vehicle.speed ? `${vehicle.speed} km/h` : "Parked" },
            { label: "Fuel",     value: vehicle.fuel  != null ? `${vehicle.fuel} units` : "No sensor" },
            { label: "ACC",      value: vehicle.accOn ? "ON" : "OFF" },
            { label: "Location", value: (vehicle.lat && vehicle.lng) ? `${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}` : "No GPS" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: t.bgAlt, borderRadius: 10, padding: 14, border: `1px solid ${t.border}` }}>
              <div style={{ color: t.textSoft, fontSize: 11, fontFamily: "inherit", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
              <div style={{ color: t.text, fontFamily: "inherit", fontWeight: 700, marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Btn color={t.blue} outline style={{ flex: 1 }} onClick={onViewVideo}>📹 Live Camera</Btn>
          <Btn color={t.accent} outline style={{ flex: 1 }}>📍 Track History</Btn>
        </div>
      </div>
    </div>
  );
}

const CHANNEL_COUNT = 6;

// ── Sidebar live stream player ─────────────────────────────────────────────────

function useHlsJs() {
  const [Hls, setHls] = useState(null);
  useEffect(() => {
    if (window.Hls) { setHls(() => window.Hls); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js';
    s.onload = () => setHls(() => window.Hls);
    s.onerror = () => {};
    document.head.appendChild(s);
  }, []);
  return Hls;
}

function SidebarVideoPlayer({ vehicle, channel, onClose, onChannelChange }) {
  const { t } = useTheme();
  const Hls = useHlsJs();
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const [streamData,  setStreamData]  = useState(null);
  const [streamType,  setStreamType]  = useState('sub');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Fetch stream URL whenever vehicle / channel / streamType changes
  useEffect(() => {
    if (!vehicle) return;
    setLoading(true); setError(null); setStreamData(null);
    apiFetch(`/cameras/${encodeURIComponent(vehicle.devIdno)}/stream?channel=${channel}&streamType=${streamType}`)
      .then(d => { setStreamData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [vehicle?.devIdno, channel, streamType]);

  // Attach HLS.js once we have the stream URL
  useEffect(() => {
    if (!streamData?.hlsUrl || !videoRef.current) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (Hls?.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, enableWorker: true });
      hls.loadSource(streamData.hlsUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setError(`Stream error: ${d.type}`); });
      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = streamData.hlsUrl;
      videoRef.current.play().catch(() => {});
    } else {
      // HLS not supported — fall through to iframe fallback below
      setError('hls_not_supported');
    }
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [streamData, Hls]);

  const label = vehicle.plate || vehicle.nm || vehicle.devIdno;
  const showIframe = error === 'hls_not_supported' || (!loading && !error && !Hls && streamData?.playerUrl);

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, width: 360, zIndex: 9999,
      background: t.panel, border: `1px solid ${t.borderHi}`, borderRadius: 16,
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)', overflow: 'hidden', fontFamily: 'inherit',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: t.panelBright, borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 16 }}>📷</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ color: t.muted, fontSize: 11, flexShrink: 0 }}>Ch {channel} · {streamType === 'sub' ? 'Sub' : 'Main'}</span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.red, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      {/* Video area */}
      <div style={{ background: '#000', aspectRatio: '16/9', position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ fontSize: 32 }}>📡</div>
            <div style={{ color: '#888', fontSize: 12 }}>Connecting…</div>
          </div>
        )}
        {!loading && error && error !== 'hls_not_supported' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>⚠</div>
            <div style={{ color: t.red, fontSize: 11 }}>{error}</div>
            {streamData?.playerUrl && (
              <button onClick={() => window.open(streamData.playerUrl, '_blank')} style={{ marginTop: 4, background: t.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Open in new tab</button>
            )}
          </div>
        )}
        {showIframe && streamData?.playerUrl
          ? <iframe src={streamData.playerUrl} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} allow="autoplay; fullscreen" title="Live camera" />
          : <video ref={videoRef} autoPlay muted playsInline controls style={{ width: '100%', height: '100%', display: loading || error ? 'none' : 'block' }} />
        }
      </div>

      {/* Controls */}
      <div style={{ padding: '8px 10px', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', background: t.panelBright, borderTop: `1px solid ${t.border}` }}>
        {[1,2,3,4,5,6].map(ch => (
          <button key={ch} onClick={() => onChannelChange(ch)} style={{
            background: ch === channel ? t.accent : t.bgAlt,
            border: `1px solid ${ch === channel ? t.accent : t.border}`,
            borderRadius: 7, padding: '3px 9px', fontSize: 11, fontWeight: 700,
            color: ch === channel ? '#fff' : t.textSoft,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
          }}>Ch{ch}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setStreamType(p => p === 'sub' ? 'main' : 'sub')} style={{
          background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 7,
          padding: '3px 9px', fontSize: 11, color: t.textSoft, cursor: 'pointer', fontFamily: 'inherit',
        }}>{streamType === 'sub' ? 'Sub ▸' : 'Main ▸'}</button>
        {streamData?.playerUrl && (
          <button onClick={() => window.open(streamData.playerUrl, '_blank')} style={{
            background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 7,
            padding: '3px 9px', fontSize: 11, color: t.blue, cursor: 'pointer', fontFamily: 'inherit',
          }}>⧉ Tab</button>
        )}
      </div>
    </div>
  );
}

function VideoModal({ vehicle, onClose }) {
  const { t } = useTheme();
  const [channel,    setChannel]    = useState(1);
  const [streamType, setStreamType] = useState("sub");
  const [streamData, setStreamData] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!vehicle) return;
    setLoading(true); setError(null); setStreamData(null);
    apiFetch(`/cameras/${encodeURIComponent(vehicle.devIdno)}/stream?channel=${channel}&streamType=${streamType}`)
      .then(setStreamData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [vehicle, channel, streamType]);

  if (!vehicle) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000ee", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "95vw", maxWidth: 1000, background: t.panel, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.border}`, background: `linear-gradient(90deg, ${t.panelBright}, ${t.panel})` }}>
          <div>
            <div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>📹 {vehicle.plate || vehicle.nm}</div>
            <div style={{ color: t.textSoft, fontSize: 11 }}>Ch {channel} · {streamType === "main" ? "Main Stream" : "Sub Stream"} · {vehicle.devIdno}</div>
          </div>
          <button onClick={onClose} style={{ background: t.bgAlt, border: "none", color: t.text, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Channel + stream type selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${t.border}`, background: t.bgAlt, flexWrap: "wrap" }}>
          <span style={{ color: t.muted, fontSize: 12, fontWeight: 600 }}>CHANNEL:</span>
          {Array.from({ length: CHANNEL_COUNT }, (_, i) => i + 1).map(ch => (
            <button key={ch} onClick={() => setChannel(ch)} style={{
              background: channel === ch ? `linear-gradient(135deg, ${t.accent}, ${t.accentAlt})` : t.panel,
              border: `1px solid ${channel === ch ? "transparent" : t.border}`,
              borderRadius: 8, padding: "5px 14px", color: channel === ch ? "#fff" : t.textSoft,
              cursor: "pointer", fontWeight: channel === ch ? 700 : 400, fontSize: 13,
              boxShadow: channel === ch ? `0 2px 10px ${t.accentGlow}` : "none",
              fontFamily: "inherit",
            }}>CH {ch}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {["sub", "main"].map(st => (
              <button key={st} onClick={() => setStreamType(st)} style={{
                background: streamType === st ? t.accentSoft : "transparent",
                border: `1px solid ${streamType === st ? t.accent : t.border}`,
                borderRadius: 8, padding: "5px 12px", color: streamType === st ? t.accent : t.muted,
                cursor: "pointer", fontSize: 12, fontWeight: streamType === st ? 700 : 400,
                fontFamily: "inherit",
              }}>{st === "sub" ? "Sub" : "Main"}</button>
            ))}
          </div>
        </div>

        {/* Video area */}
        <div style={{ position: "relative", minHeight: 480, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {loading && <Spinner label={`Connecting to channel ${channel}…`} />}
          {error && <div style={{ padding: 40 }}><ErrorBanner message={error} /></div>}

          {!loading && !error && streamData?.playerUrl && (
            <iframe
              key={`${channel}-${streamType}`}
              src={streamData.playerUrl}
              style={{ width: "100%", height: "68vh", border: "none" }}
              allow="autoplay; fullscreen"
              title={`Camera Ch${channel}`}
            />
          )}

          {!loading && !error && !streamData?.playerUrl && (
            <div style={{ color: "#aaa", padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📷</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Channel {channel} unavailable</div>
              <div style={{ fontSize: 12 }}>Vehicle may be offline or this channel has no camera installed.</div>
            </div>
          )}
        </div>

        {/* Footer links */}
        <div style={{ padding: "12px 20px", background: t.bgAlt, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {streamData?.hlsPageUrl && (
            <Btn color={t.blue} outline onClick={() => window.open(streamData.hlsPageUrl, "_blank")} style={{ fontSize: 11 }}>📱 Mobile HLS</Btn>
          )}
          {streamData?.hlsUrl && (
            <Btn color={t.purple} outline onClick={() => navigator.clipboard?.writeText(streamData.hlsUrl)} style={{ fontSize: 11 }}>📋 Copy HLS URL</Btn>
          )}
          {streamData?.rtspUrl && (
            <Btn color={t.green} outline onClick={() => navigator.clipboard?.writeText(streamData.rtspUrl)} style={{ fontSize: 11 }}>📋 Copy RTSP</Btn>
          )}
          <Btn onClick={onClose} style={{ fontSize: 11 }}>Close</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Toast / Notifications ─────────────────────────────────────────────────────

function Toast({ event, onDismiss }) {
  const { t } = useTheme();
  const [vis, setVis] = useState(true);
  const dismissAfter = event.type === "hourly_report" ? 12000 : 7000;
  useEffect(() => {
    const h = setTimeout(() => setVis(false), dismissAfter);
    const c = setTimeout(() => onDismiss(event.id), dismissAfter + 350);
    return () => { clearTimeout(h); clearTimeout(c); };
  }, []); // eslint-disable-line

  const wrapStyle = {
    background: t.panelBright, borderRadius: 10, padding: "12px 14px",
    opacity: vis ? 1 : 0, transform: vis ? "translateX(0)" : "translateX(40px)",
    transition: "opacity 0.3s, transform 0.3s", pointerEvents: vis ? "auto" : "none",
  };

  // ── Hourly report toast ──────────────────────────────────────────────────
  if (event.type === "hourly_report") {
    const { totals = {}, timeStr } = event;
    return (
      <div style={{ ...wrapStyle, border: `1px solid ${t.blue}44`, borderLeft: `3px solid ${t.blue}`, boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 16px ${t.blue}20` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <div>
              <div style={{ fontFamily: "inherit", fontWeight: 800, color: t.blue, fontSize: 13 }}>HOURLY REPORT</div>
              <div style={{ fontFamily: "inherit", color: t.textSoft, fontSize: 10 }}>{timeStr}</div>
            </div>
          </div>
          <button onClick={() => onDismiss(event.id)} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, fontFamily: "inherit" }}>
          <span style={{ color: t.textSoft }}>🟢 ON: <b style={{ color: t.green }}>{totals.on}</b></span>
          <span style={{ color: t.textSoft }}>🔴 OFF: <b style={{ color: t.accent }}>{totals.off}</b></span>
          <span style={{ color: t.textSoft }}>⚫ Offline: <b style={{ color: t.muted }}>{totals.offline}</b></span>
          <span style={{ color: t.textSoft }}>🔥 Fuel used: <b style={{ color: t.red }}>{totals.totalFuelUsed}</b></span>
        </div>
        <div style={{ fontSize: 10, color: t.muted, fontFamily: "inherit", marginTop: 6 }}>
          <span style={{ color: t.blue, fontWeight: 700 }}>● AUTO</span> — tap 🔔 for full details
        </div>
      </div>
    );
  }

  // ── Fuel theft toast ─────────────────────────────────────────────────────
  if (event.type === "fuel_theft_suspected") {
    return (
      <div style={{ ...wrapStyle, border: `1px solid ${t.red}66`, borderLeft: `3px solid ${t.red}`, boxShadow: `0 8px 30px rgba(0,0,0,0.6), 0 0 20px ${t.red}30` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🚨</span>
            <span style={{ fontFamily: "inherit", fontWeight: 800, color: t.red, fontSize: 13 }}>{event.plate}</span>
            <span style={{ fontFamily: "inherit", fontWeight: 700, color: t.red, fontSize: 11 }}>FUEL THEFT SUSPECTED</span>
          </div>
          <button onClick={() => onDismiss(event.id)} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, fontFamily: "inherit" }}>
          <span style={{ color: t.textSoft }}>Before: <b style={{ color: t.text }}>{event.fuelBefore}</b></span>
          <span style={{ color: t.textSoft }}>Now: <b style={{ color: t.text }}>{event.fuelNow}</b></span>
          <span style={{ color: t.red }}>▼ Missing: <b>-{event.fuelDrop}</b></span>
          {event.offlineStr && <span style={{ color: t.textSoft }}>Offline: <b style={{ color: t.text }}>{event.offlineStr}</b></span>}
          {event.accOnAtOffline && <span style={{ color: t.accent }}>⚠ ACC was ON</span>}
        </div>
        <div style={{ fontSize: 10, color: t.muted, fontFamily: "inherit", marginTop: 6 }}>
          {new Date(event.time).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>
    );
  }

  // ── Vehicle online/offline toast ──────────────────────────────────────────
  if (event.type === "vehicle_online" || event.type === "vehicle_offline") {
    const isOnline = event.type === "vehicle_online";
    const color    = isOnline ? t.accent : t.muted;
    return (
      <div style={{ ...wrapStyle, border: `1px solid ${color}44`, borderLeft: `3px solid ${color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{isOnline ? "🟡" : "⚫"}</span>
            <span style={{ fontFamily: "inherit", fontWeight: 800, color, fontSize: 13 }}>{event.plate}</span>
            <span style={{ fontFamily: "inherit", fontWeight: 700, color, fontSize: 11 }}>{isOnline ? "BACK ONLINE" : "WENT OFFLINE"}</span>
          </div>
          <button onClick={() => onDismiss(event.id)} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, fontFamily: "inherit" }}>
          {event.fuel      != null && <span style={{ color: t.textSoft }}>⛽ <b style={{ color: t.text }}>{event.fuel}</b></span>}
          {isOnline && event.offlineStr && <span style={{ color: t.textSoft }}>Was offline: <b style={{ color: t.text }}>{event.offlineStr}</b></span>}
        </div>
        <div style={{ fontSize: 10, color: t.muted, fontFamily: "inherit", marginTop: 6 }}>
          {new Date(event.time).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>
    );
  }

  // ── ACC on/off toast ─────────────────────────────────────────────────────
  const isOn  = event.type === "acc_on";
  const color = isOn ? t.green : t.accent;
  return (
    <div style={{ ...wrapStyle, border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 16px ${color}20` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>{isOn ? "🟢" : "🔴"}</span>
          <span style={{ fontFamily: "inherit", fontWeight: 800, color, fontSize: 13 }}>{event.plate}</span>
          <span style={{ fontFamily: "inherit", fontWeight: 700, color, fontSize: 11 }}>{isOn ? "ENGINE ON" : "ENGINE OFF"}</span>
        </div>
        <button onClick={() => onDismiss(event.id)} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, fontFamily: "inherit" }}>
        {event.fuel != null && <span style={{ color: t.textSoft }}>⛽ <b style={{ color: t.text }}>{event.fuel}</b></span>}
        {isOn  && event.downtimeStr && <span style={{ color: t.textSoft }}>⏸ Parked: <b style={{ color: t.text }}>{event.downtimeStr}</b></span>}
        {!isOn && event.uptimeStr   && <span style={{ color: t.textSoft }}>▶ Ran: <b style={{ color: t.text }}>{event.uptimeStr}</b></span>}
        {!isOn && event.fuelUsed != null && <span style={{ color: t.textSoft }}>🔥 Used: <b style={{ color: t.purple }}>{event.fuelUsed}</b></span>}
      </div>
      <div style={{ fontSize: 10, color: t.muted, fontFamily: "inherit", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: t.green, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>● AUTO</span>
        <span>{new Date(event.time).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9000, display: "flex", flexDirection: "column", gap: 10, width: 340, pointerEvents: "none" }}>
      {toasts.map(tk => <div key={tk.id} style={{ pointerEvents: "auto" }}><Toast event={tk} onDismiss={onDismiss} /></div>)}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmtDurJs(secs) {
  if (secs == null) return "—";
  if (secs <= 0) return "0m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function fmtTime(iso) {
  const d = new Date(iso);
  return {
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    date: d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }),
    full: d.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}

// ── Engine Event Card (ACC on/off) ────────────────────────────────────────────

function EngineEventCard({ e }) {
  const { t } = useTheme();
  const ts = fmtTime(e.time);

  // ── Fuel theft card ───────────────────────────────────────────────────────
  if (e.type === "fuel_theft_suspected") {
    return (
      <div style={{ background: t.panelBright, border: `1px solid ${t.red}40`, borderLeft: `4px solid ${t.red}`, borderRadius: 12, padding: "16px 18px", marginBottom: 10, boxShadow: `0 2px 12px rgba(0,0,0,0.3), 0 0 20px ${t.red}10` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.red}18`, border: `1.5px solid ${t.red}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚨</div>
            <div>
              <div style={{ fontWeight: 800, color: t.red, fontSize: 14 }}>{e.vehicleName && e.vehicleName !== e.plate ? e.vehicleName : e.plate}</div>
              {e.vehicleName && e.vehicleName !== e.plate && <div style={{ color: t.muted, fontSize: 11 }}>{e.plate}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "inline-block", background: `${t.red}18`, border: `1px solid ${t.red}50`, borderRadius: 6, padding: "3px 10px", color: t.red, fontWeight: 800, fontSize: 12, marginBottom: 4 }}>FUEL THEFT SUSPECTED</div>
            <div style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>{ts.time}</div>
            <div style={{ color: t.muted, fontSize: 10 }}>{ts.date}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 10 }}>
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>FUEL WHEN OFFLINE</div>
            <div style={{ color: t.textSoft, fontWeight: 700, fontSize: 13 }}>⛽ {e.fuelBefore}</div>
          </div>
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>FUEL NOW (ONLINE)</div>
            <div style={{ color: t.textSoft, fontWeight: 700, fontSize: 13 }}>⛽ {e.fuelNow}</div>
          </div>
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.red}30` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>MISSING FUEL</div>
            <div style={{ color: t.red, fontWeight: 700, fontSize: 13 }}>▼ -{e.fuelDrop} (lost while offline)</div>
          </div>
          {e.offlineStr && (
            <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
              <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>WAS OFFLINE FOR</div>
              <div style={{ color: t.accent, fontWeight: 700, fontSize: 13 }}>⏱ {e.offlineStr}</div>
            </div>
          )}
          {e.accOnAtOffline && (
            <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.accent}30` }}>
              <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>NOTE</div>
              <div style={{ color: t.accent, fontWeight: 700, fontSize: 12 }}>⚠ Engine was ON when disconnected</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Vehicle online / offline card ─────────────────────────────────────────
  if (e.type === "vehicle_online" || e.type === "vehicle_offline") {
    const isOnline = e.type === "vehicle_online";
    const color    = isOnline ? t.accent : t.muted;
    return (
      <div style={{ background: t.panelBright, border: `1px solid ${color}30`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: "16px 18px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, border: `1.5px solid ${color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{isOnline ? "🟡" : "⚫"}</div>
            <div>
              <div style={{ fontWeight: 800, color: t.text, fontSize: 14 }}>{e.vehicleName && e.vehicleName !== e.plate ? e.vehicleName : e.plate}</div>
              {e.vehicleName && e.vehicleName !== e.plate && <div style={{ color: t.muted, fontSize: 11 }}>{e.plate}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "inline-block", background: `${color}18`, border: `1px solid ${color}50`, borderRadius: 6, padding: "3px 10px", color, fontWeight: 800, fontSize: 12, marginBottom: 4 }}>{isOnline ? "BACK ONLINE" : "WENT OFFLINE"}</div>
            <div style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>{ts.time}</div>
            <div style={{ color: t.muted, fontSize: 10 }}>{ts.date}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {e.fuel != null && (
            <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
              <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>FUEL</div>
              <div style={{ color: t.textSoft, fontWeight: 700, fontSize: 13 }}>⛽ {e.fuel}</div>
            </div>
          )}
          {isOnline && e.offlineStr && (
            <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
              <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>WAS OFFLINE FOR</div>
              <div style={{ color: t.accent, fontWeight: 700, fontSize: 13 }}>⏱ {e.offlineStr}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ACC on/off card ───────────────────────────────────────────────────────
  const isOn  = e.type === "acc_on";
  const color = isOn ? t.green : t.accent;
  const ts2   = ts;

  return (
    <div style={{
      background: t.panelBright,
      border: `1px solid ${color}30`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 10,
      boxShadow: `0 2px 12px rgba(0,0,0,0.3), 0 0 20px ${color}08`,
    }}>
      {/* Top row: status badge + vehicle + time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${color}18`,
            border: `1.5px solid ${color}50`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            {isOn ? "🟢" : "🔴"}
          </div>
          <div>
            <div style={{ fontFamily: "inherit", fontWeight: 800, color: t.text, fontSize: 14 }}>
              {e.vehicleName && e.vehicleName !== e.plate ? e.vehicleName : e.plate}
            </div>
            {e.vehicleName && e.vehicleName !== e.plate && (
              <div style={{ color: t.muted, fontSize: 11, fontFamily: "inherit" }}>{e.plate}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            display: "inline-block",
            background: `${color}18`, border: `1px solid ${color}50`,
            borderRadius: 6, padding: "3px 10px",
            color, fontFamily: "inherit", fontWeight: 800, fontSize: 12,
            marginBottom: 4,
          }}>
            ENGINE {isOn ? "ON" : "OFF"}
          </div>
          <div style={{ color: t.text, fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>{ts.time}</div>
          <div style={{ color: t.muted, fontSize: 10, fontFamily: "inherit" }}>{ts.date}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: 8, marginBottom: 10,
      }}>
        {e.fuel != null && (
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>FUEL NOW</div>
            <div style={{ color: t.text, fontWeight: 700, fontSize: 13 }}>⛽ {e.fuel}</div>
          </div>
        )}
        {isOn && e.downtimeStr && (
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>WAS PARKED</div>
            <div style={{ color: t.blue, fontWeight: 700, fontSize: 13 }}>⏸ {e.downtimeStr}</div>
          </div>
        )}
        {!isOn && e.uptimeStr && (
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>RAN FOR</div>
            <div style={{ color: t.green, fontWeight: 700, fontSize: 13 }}>▶ {e.uptimeStr}</div>
          </div>
        )}
        {!isOn && e.fuelAtStart != null && (
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>FUEL AT START</div>
            <div style={{ color: t.textSoft, fontWeight: 700, fontSize: 13 }}>⛽ {e.fuelAtStart}</div>
          </div>
        )}
        {!isOn && e.fuelUsed != null && (
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.red}30` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>FUEL CONSUMED</div>
            <div style={{ color: t.red, fontWeight: 700, fontSize: 13 }}>🔥 {e.fuelUsed}</div>
          </div>
        )}
        {e.speed != null && e.speed > 0 && (
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.border}` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>SPEED</div>
            <div style={{ color: t.accent, fontWeight: 700, fontSize: 13 }}>🚀 {e.speed} km/h</div>
          </div>
        )}
        {e.type === "acc_on" && e.fuelConsumedDuringOff != null && e.fuelConsumedDuringOff > 0 && (
          <div style={{ background: t.bg, borderRadius: 8, padding: "8px 10px", border: `1px solid ${t.orange}30` }}>
            <div style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>OFF-CONSUMPTION</div>
            <div style={{ color: t.orange, fontWeight: 700, fontSize: 13 }}>⛽ -{e.fuelConsumedDuringOff}L</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.green, display: "inline-block", animation: "pulse 2.5s infinite" }} />
        <span style={{ color: t.green, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>AUTO · REAL-TIME</span>
      </div>
    </div>
  );
}

// ── Fleet Report Card (hourly or manual) ─────────────────────────────────────

function FleetReportCard({ report }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const { timeStr, vehicleReports = [], totals = {}, _manual, phaseName } = report;
  const isManual = !!_manual;
  const accentColor = isManual ? t.purple : t.blue;

  return (
    <div style={{
      background: t.panelBright,
      border: `1px solid ${accentColor}30`,
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 12,
      marginBottom: 10,
      overflow: "hidden",
      boxShadow: `0 2px 12px rgba(0,0,0,0.3), 0 0 20px ${accentColor}08`,
    }}>
      {/* Header */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: "none", border: "none", cursor: "pointer",
        padding: "16px 18px", textAlign: "left",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${accentColor}18`, border: `1.5px solid ${accentColor}50`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            flexShrink: 0,
          }}>
            {isManual ? "📋" : "📊"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ color: accentColor, fontFamily: "inherit", fontWeight: 800, fontSize: 13 }}>
                {isManual ? `MANUAL PULL REPORT — From 00:00 to ${timeStr ? timeStr.slice(-5) : "now"}` : (phaseName || "FLEET REPORT")}
              </span>
              <span style={{
                background: `${accentColor}20`, color: accentColor,
                borderRadius: 4, padding: "1px 6px", fontSize: 10, fontFamily: "inherit",
              }}>
                {isManual ? "ON-DEMAND" : "AUTO"}
              </span>
            </div>
            <div style={{ color: t.textSoft, fontSize: 11, fontFamily: "inherit" }}>{timeStr}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 4 }}>
              <span style={{ color: t.green,  fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>ON {totals.on ?? 0}</span>
              <span style={{ color: t.accent, fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>OFF {totals.off ?? 0}</span>
              <span style={{ color: t.muted,  fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>OFFLN {totals.offline ?? 0}</span>
            </div>
            <div style={{ color: t.textSoft, fontSize: 10 }}>
              ⏱ {fmtDurJs(totals.totalUptimeSecs)} · 🔥 {totals.totalFuelUsed ?? 0}
            </div>
          </div>
          <span style={{ color: t.muted, fontSize: 16, marginLeft: 8 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Summary stat bar */}
      <div style={{ display: "flex", borderTop: `1px solid ${t.border}`, borderBottom: open ? `1px solid ${t.border}` : "none" }}>
        {[
          { label: "VEHICLES",  value: totals.vehicles ?? vehicleReports.length, color: t.text },
          { label: "RUNNING",   value: totals.on ?? 0,        color: t.green  },
          { label: "PARKED",    value: totals.off ?? 0,       color: t.accent },
          { label: "OFFLINE",   value: totals.offline ?? 0,   color: t.muted  },
          { label: "FUEL USED", value: `${totals.totalFuelUsed ?? 0} L`, color: t.red },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1, padding: "10px 6px", textAlign: "center",
            borderRight: `1px solid ${t.border}`,
          }}>
            <div style={{ color, fontFamily: "inherit", fontWeight: 800, fontSize: 15 }}>{value}</div>
            <div style={{ color: t.muted, fontSize: 9, fontFamily: "inherit", letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Expanded vehicle list */}
      {open && (
        <div style={{ padding: "12px 16px" }}>
          {vehicleReports.map((v, i) => {
            const sc = v.online === 0 ? t.muted : v.accOn ? t.green : t.accent;
            const sl = v.online === 0 ? "OFFLINE" : v.accOn ? "ON" : "OFF";
            return (
              <div key={i} style={{
                background: t.bg, borderRadius: 10, padding: "12px 14px",
                marginBottom: 8, border: `1px solid ${sc}25`,
                display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px",
              }}>
                {/* Left: name + stats */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: "inherit", fontWeight: 800, color: t.text, fontSize: 13 }}>{v.name}</span>
                    {v.name !== v.plate && <span style={{ color: t.muted, fontSize: 10, fontFamily: "inherit" }}>({v.plate})</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 11 }}>
                    <span style={{ color: t.textSoft }}>⏱ Uptime: <b style={{ color: v.uptimeSecs > 60 ? t.green : t.muted }}>{v.uptimeSecs > 0 ? fmtDurJs(v.uptimeSecs) : "—"}</b></span>
                    {v.fuelStart != null && v.fuelStart > 0 && <span style={{ color: t.textSoft }}>⛽ Start: <b style={{ color: t.text }}>{Math.round(v.fuelStart)}</b></span>}
                    {v.fuel != null && v.fuel > 0 && <span style={{ color: t.textSoft }}>⛽ Now: <b style={{ color: t.text }}>{Math.round(v.fuel)}{v.fuelEstimated && <span style={{ color: t.muted, fontSize: 9 }}> ~</span>}</b></span>}
                    {v.fuelUsed != null && <span style={{ color: t.textSoft }}>🔥 Consumed: <b style={{ color: t.red }}>{v.fuelUsed}</b></span>}
                    {v.fuelDuringOff > 0 && <span style={{ color: t.textSoft }}>⛽ Off: <b style={{ color: t.orange }}>-{v.fuelDuringOff}L (off)</b></span>}
                    {v.todayKm != null && v.todayKm > 0 && <span style={{ color: t.textSoft }}>🛣 Today: <b style={{ color: t.blue }}>{v.todayKm.toFixed(1)} km</b></span>}
                    {v.speed > 0 && <span style={{ color: t.textSoft }}>🚀 Speed: <b style={{ color: t.text }}>{v.speed} km/h</b></span>}
                    {(!v.fuel || v.fuel === 0) && <span style={{ color: t.muted, fontSize: 10 }}>⛽ No sensor</span>}
                  </div>
                </div>
                {/* Right: status badge */}
                <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 2 }}>
                  <span style={{
                    background: `${sc}18`, color: sc,
                    border: `1px solid ${sc}50`,
                    borderRadius: 6, padding: "4px 10px",
                    fontFamily: "inherit", fontWeight: 800, fontSize: 11,
                  }}>{sl}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Notifications Page ────────────────────────────────────────────────────────

function NotificationsView({ events, onClear }) {
  const { t } = useTheme();
  const [tab,           setTab]           = useState("all");
  const [selectedPlate, setSelectedPlate] = useState("all");
  const [sendSms,       setSendSms]       = useState(false);
  const [fetching,      setFetching]      = useState(false);
  const [fetchMsg,      setFetchMsg]      = useState(null);

  const engineEvents  = events.filter(e => e.type === "acc_on" || e.type === "acc_off");
  const alertEvents   = events.filter(e => e.type === "vehicle_online" || e.type === "vehicle_offline" || e.type === "fuel_theft_suspected");
  const hourlyReports = events.filter(e => e.type === "hourly_report" && !e._manual);
  const manualReports = events.filter(e => e.type === "hourly_report" && e._manual);

  const tabList = [
    { id: "all",     label: "All",            count: events.length        },
    { id: "engine",  label: "Engine Events",  count: engineEvents.length  },
    { id: "alerts",  label: "Alerts",         count: alertEvents.length   },
    { id: "hourly",  label: "Shift Reports",  count: hourlyReports.length },
    { id: "manual",  label: "Manual Reports", count: manualReports.length },
  ];

  const baseEvents = tab === "engine" ? engineEvents
                   : tab === "alerts" ? alertEvents
                   : tab === "hourly" ? hourlyReports
                   : tab === "manual" ? manualReports
                   : events;

  const plates  = ["all", ...Array.from(new Set(events.map(e => e.plate).filter(Boolean))).sort()];
  const visible = selectedPlate === "all" ? baseEvents
                : baseEvents.filter(e => e.plate === selectedPlate || e.type === "hourly_report");

  const triggerReport = async () => {
    if (fetching) return;
    setFetching(true); setFetchMsg(null);
    try {
      await apiFetch("/fleet/report/trigger", { method: "POST", body: JSON.stringify({ sendSms }) });
      setFetchMsg({ ok: true, text: sendSms ? "Report sent — check notifications + SMS" : "Report generated — check notifications" });
    } catch (e) {
      setFetchMsg({ ok: false, text: e.message });
    }
    setFetching(false);
    setTimeout(() => setFetchMsg(null), 5000);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "inherit", fontWeight: 800, color: t.text, fontSize: 20, marginBottom: 4 }}>
            🔔 Notifications
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.green, display: "inline-block", animation: "pulse 2.5s infinite", boxShadow: `0 0 6px ${t.green}` }} />
            <span style={{ color: t.green, fontSize: 11, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1 }}>LIVE · AUTO-UPDATING</span>
            {events.length > 0 && onClear && (
              <button onClick={onClear} style={{
                background: t.redSoft, border: `1px solid ${t.red}40`,
                borderRadius: 6, padding: "2px 10px", cursor: "pointer",
                color: t.red, fontSize: 11, fontWeight: 700, fontFamily: "inherit",
              }}>✕ Clear</button>
            )}
          </div>
        </div>

        {/* ── Manual Report Trigger ── */}
        <div style={{
          background: t.panelBright, border: `1px solid ${t.border}`,
          borderRadius: 12, padding: "14px 18px", minWidth: 240,
        }}>
          <div style={{ color: t.text, fontFamily: "inherit", fontWeight: 700, fontSize: 12, marginBottom: 10 }}>
            📋 Manual Report
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
            <div style={{
              width: 36, height: 20, borderRadius: 10, position: "relative", cursor: "pointer",
              background: sendSms ? t.green : t.border, transition: "background 0.2s",
            }} onClick={() => setSendSms(s => !s)}>
              <div style={{
                position: "absolute", top: 2, left: sendSms ? 18 : 2,
                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s",
              }} />
            </div>
            <span style={{ color: t.textSoft, fontSize: 12, fontFamily: "inherit" }}>
              {sendSms ? "📱 Include SMS" : "No SMS"}
            </span>
          </label>
          <button onClick={triggerReport} disabled={fetching} style={{
            width: "100%", padding: "9px 0",
            background: fetching ? t.border : `linear-gradient(135deg, ${t.blue}, ${t.purple}55)`,
            border: `1px solid ${t.blue}60`, borderRadius: 8,
            color: t.text, fontFamily: "inherit", fontWeight: 700, fontSize: 12,
            cursor: fetching ? "default" : "pointer",
          }}>
            {fetching ? "⏳ Generating…" : "⚡ Fetch Report Now"}
          </button>
          {fetchMsg && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 6, fontSize: 11,
              fontFamily: "inherit",
              background: fetchMsg.ok ? `${t.green}18` : `${t.red}18`,
              color: fetchMsg.ok ? t.green : t.red,
              border: `1px solid ${fetchMsg.ok ? t.green : t.red}40`,
            }}>
              {fetchMsg.ok ? "✓" : "✗"} {fetchMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { icon: "⚡", label: "Engine Events",   value: engineEvents.length,  color: t.accent },
          { icon: "📊", label: "Hourly Reports",  value: hourlyReports.length, color: t.blue   },
          { icon: "📋", label: "Manual Reports",  value: manualReports.length, color: t.purple },
          { icon: "🔔", label: "Total Today",     value: events.length,        color: t.text   },
        ].map(({ icon, label, value, color }) => (
          <div key={label} style={{
            background: t.panelBright, border: `1px solid ${t.border}`,
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ color, fontFamily: "inherit", fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{value}</div>
            <div style={{ color: t.muted, fontSize: 10, fontFamily: "inherit", letterSpacing: 0.5 }}>{icon} {label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `1px solid ${t.border}`, paddingBottom: 12 }}>
        {tabList.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            padding: "7px 16px", borderRadius: 8, cursor: "pointer",
            background: tab === tb.id ? `${t.blue}20` : "transparent",
            border: `1px solid ${tab === tb.id ? t.blue : t.border}`,
            color: tab === tb.id ? t.blue : t.textSoft,
            fontFamily: "inherit", fontWeight: tab === tb.id ? 800 : 400, fontSize: 12,
            transition: "all 0.15s",
          }}>
            {tb.label}
            <span style={{
              marginLeft: 6, background: tab === tb.id ? t.blue : t.border,
              color: tab === tb.id ? t.bg : t.muted,
              borderRadius: 10, padding: "1px 7px", fontSize: 10,
            }}>{tb.count}</span>
          </button>
        ))}
      </div>

      {/* ── Vehicle Filter (only for engine tab or all) ── */}
      {(tab === "all" || tab === "engine") && plates.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {plates.map(p => (
            <button key={p} onClick={() => setSelectedPlate(p)} style={{
              padding: "5px 14px", borderRadius: 20, cursor: "pointer",
              background: selectedPlate === p ? `${t.accent}20` : "transparent",
              border: `1px solid ${selectedPlate === p ? t.accent : t.border}`,
              color: selectedPlate === p ? t.accent : t.textSoft,
              fontFamily: "inherit", fontSize: 11, fontWeight: selectedPlate === p ? 800 : 400,
            }}>
              {p === "all" ? `All Vehicles` : p}
            </button>
          ))}
        </div>
      )}

      {/* ── Event Feed ── */}
      {visible.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          color: t.muted, fontFamily: "inherit",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>No notifications yet</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>Waiting for engine events or reports…</div>
        </div>
      ) : (
        <div>
          {visible.map((e, i) =>
            e.type === "hourly_report"
              ? <FleetReportCard key={i} report={e} />
              : <EngineEventCard  key={i} e={e}    />
          )}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard",   icon: "◈",  label: "Dashboard"     },
  { id: "vehicles",    icon: "🚌", label: "Vehicles"      },
  { id: "cameras",     icon: "📷", label: "Live Cameras"  },
  { id: "erp",         icon: "🏢", label: "HELION"     },
  { id: "alarms",      icon: "⚡", label: "Alarms"        },
  { id: "notifs",      icon: "🔔", label: "Notifications" },
  { id: "fuel",        icon: "⛽", label: "Fuel Report"   },
  { id: "fuelrpt",     icon: "📅", label: "Daily/Monthly" },
  { id: "chat",        icon: "🤖", label: "FleetBot AI"   },
];

function FleetDashboardContent() {
  const { t, theme, toggleTheme } = useTheme();
  const [view, setView] = useState("dashboard");
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [videoVehicle,    setVideoVehicle]    = useState(null);
  const [sideStreamVehicle, setSideStreamVehicle] = useState(null);
  const [sideChannel,       setSideChannel]       = useState(1);

  const [snapshot,     setSnapshot]     = useState(null);
  const [snapLoading,  setSnapLoading]  = useState(true);
  const [snapError,    setSnapError]    = useState(null);

  const [vehicles,     setVehicles]     = useState([]);
  const [vehLoading,   setVehLoading]   = useState(false);
  const [vehError,     setVehError]     = useState(null);
  const vehiclesFetched = useRef(false);

  const [erpSummary,      setErpSummary]      = useState(null);
  const [activeCompanyId, setActiveCompanyId] = useState(null);

  const [alarms,       setAlarms]       = useState([]);
  const [alarmLoading, setAlarmLoading] = useState(false);
  const [alarmError,   setAlarmError]   = useState(null);
  const alarmsFetched = useRef(false);

  const [lastUpdated, setLastUpdated]   = useState(new Date());

  // ── ACC notifications ────────────────────────────────────────────────────
  const [accEvents,      setAccEvents]      = useState(() => {
    try { const stored = JSON.parse(localStorage.getItem("fleet-notifications") || "[]"); return Array.isArray(stored) ? stored : []; } catch (_) { return []; }
  });
  const [toasts,         setToasts]         = useState([]);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const toastIdRef = useRef(0);

  const dismissToast = useCallback((id) => setToasts(p => p.filter(tk => tk.id !== id)), []);

  const clearNotifications = useCallback(() => {
    setAccEvents([]);
    localStorage.removeItem("fleet-notifications");
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/events?api_key=${API_KEY}`);
    es.addEventListener("history", e => {
      try {
        const h = JSON.parse(e.data);
        if (Array.isArray(h)) {
          setAccEvents(prev => {
            // Merge history with existing localStorage events (history takes precedence if same ids)
            const merged = [...h, ...prev].slice(0, 200);
            localStorage.setItem("fleet-notifications", JSON.stringify(merged.slice(0, 200)));
            return merged;
          });
        }
      } catch (_) {}
    });
    es.onmessage = e => {
      try {
        const evt = JSON.parse(e.data);
        if (!evt.type) return;
        const id     = ++toastIdRef.current;
        const tagged = { ...evt, id };
        setAccEvents(p => {
          const updated = [tagged, ...p].slice(0, 200);
          localStorage.setItem("fleet-notifications", JSON.stringify(updated));
          return updated;
        });
        // Hourly report: always show toast; ACC events: up to 5 stacked
        setToasts(p => [...p, tagged].slice(-5));
        setUnreadCount(n => n + 1);
      } catch (_) {}
    };
    return () => es.close();
  }, []);

  // ── Snapshot ─────────────────────────────────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    setSnapError(null);
    try {
      const data = await apiFetch("/fleet/snapshot");
      setSnapshot(data); setLastUpdated(new Date());
    } catch (e) { setSnapError(e.message); }
    finally { setSnapLoading(false); }
  }, []);

  useEffect(() => {
    fetchSnapshot();
    const iv = setInterval(fetchSnapshot, 30000);
    return () => clearInterval(iv);
  }, [fetchSnapshot]);

  // ── Lazy fetches ──────────────────────────────────────────────────────────
  const fetchVehicles = useCallback(async () => {
    if (vehiclesFetched.current) return;
    vehiclesFetched.current = true;
    setVehLoading(true); setVehError(null);
    try {
      const data = await apiFetch("/fleet/vehicles");
      setVehicles(Array.isArray(data) ? data : []);
    } catch (e) { setVehError(e.message); vehiclesFetched.current = false; }
    finally { setVehLoading(false); }
  }, []);

  const fetchAlarms = useCallback(async () => {
    if (alarmsFetched.current) return;
    alarmsFetched.current = true;
    setAlarmLoading(true); setAlarmError(null);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const data = await apiFetch(`/alarms?date=${todayStr}&pageSize=200`);
      setAlarms(Array.isArray(data) ? data : []);
    } catch (e) { setAlarmError(e.message); alarmsFetched.current = false; }
    finally { setAlarmLoading(false); }
  }, []);

  const fetchErpSummary = useCallback(async () => {
    try { setErpSummary(await apiFetch('/erp/summary')); } catch (_) {}
  }, []);

  useEffect(() => {
    fetchErpSummary();
    const iv = setInterval(fetchErpSummary, 60000);
    return () => clearInterval(iv);
  }, [fetchErpSummary]);

  // Always load vehicles on mount — needed for sidebar live cameras
  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  useEffect(() => {
    if (view === "vehicles" || view === "cameras" || view === "fuel" || view === "fuelrpt" || view === "erp") fetchVehicles();
    if (view === "alarms") fetchAlarms();
  }, [view, fetchVehicles, fetchAlarms]);

  const totals = snapshot?.totals || {};

  // ERP context — filter vehicles by the active company
  const activeCompany = erpSummary?.companies?.find(c => c.id === activeCompanyId) ?? null;
  const filteredVehicles = (activeCompanyId && activeCompany)
    ? vehicles.filter(v => activeCompany.vehicles.some(sv => sv.devIdno === v.devIdno))
    : vehicles;
  const filteredOnline  = filteredVehicles.filter(v => (v.online ?? 0) !== 0).length;
  const filteredOffline = filteredVehicles.filter(v => (v.online ?? 0) === 0).length;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      <div style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 240,
        background: t.sidebar,
        borderRight: `1px solid ${t.border}`,
        display: "flex", flexDirection: "column", zIndex: 100,
        boxShadow: "4px 0 24px rgba(0,0,0,0.06)",
      }}>
        {/* Logo */}
        <div style={{ padding: "28px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              background: `linear-gradient(135deg, ${t.accent}, ${t.accentAlt})`,
              borderRadius: 14, width: 44, height: 44,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: `0 6px 20px ${t.accentGlow}`,
            }}>🚌</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: t.text, letterSpacing: -0.3 }}>Star Link</div>
              <div style={{ color: t.textSoft, fontSize: 12, fontWeight: 400 }}>Fleet Management</div>
            </div>
          </div>
        </div>

        {/* ERP Company Switcher */}
        <div style={{ margin: "0 10px 10px" }}>
          <div style={{ color: t.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, padding: "0 4px 7px", textTransform: "uppercase" }}>HELION</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 180, overflowY: "auto" }}>
            {/* All Companies */}
            <button onClick={() => setActiveCompanyId(null)} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "8px 10px", borderRadius: 10,
              background: !activeCompanyId ? t.accentSoft : t.panelBright,
              border: `1px solid ${!activeCompanyId ? t.accent : t.border}`,
              cursor: "pointer", fontFamily: "inherit",
              color: !activeCompanyId ? t.accent : t.textSoft,
              fontSize: 12, fontWeight: !activeCompanyId ? 700 : 500,
            }}>
              <span style={{ fontSize: 14 }}>🌐</span>
              <span style={{ flex: 1, textAlign: "left" }}>All Companies</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: !activeCompanyId ? t.accent : t.muted }}>{totals.vehicles ?? "—"}</span>
            </button>
            {/* Per-company pills */}
            {(erpSummary?.companies || []).map(co => {
              const isActive = activeCompanyId === co.id;
              const coOnline = co.vehicles.filter(v => v.online).length;
              return (
                <button key={co.id} onClick={() => setActiveCompanyId(co.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "8px 10px", borderRadius: 10,
                  background: isActive ? `${co.color}18` : t.panelBright,
                  border: `1px solid ${isActive ? co.color + "66" : t.border}`,
                  cursor: "pointer", fontFamily: "inherit",
                  color: isActive ? t.text : t.textSoft,
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: co.color, flexShrink: 0, boxShadow: isActive ? `0 0 6px ${co.color}` : "none" }} />
                  <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{co.name}</span>
                  <span style={{ fontSize: 10, color: t.green, fontWeight: 700 }}>{coOnline}</span>
                  <span style={{ fontSize: 10, color: t.muted }}>/{co.vehicles.length}</span>
                </button>
              );
            })}
          </div>
          {/* Mini stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginTop: 8 }}>
            {[
              { label: "Online",  value: activeCompanyId ? filteredOnline  : (totals.online  ?? "—"), color: t.green  },
              { label: "Offline", value: activeCompanyId ? filteredOffline : (totals.offline ?? "—"), color: t.red    },
              { label: "Total",   value: activeCompanyId ? filteredVehicles.length : (totals.vehicles ?? "—"), color: t.purple },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: t.panelBright, borderRadius: 10,
                padding: "8px 4px", textAlign: "center",
                border: `1px solid ${t.border}`,
              }}>
                <div style={{ color, fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{value}</div>
                <div style={{ color: t.muted, fontSize: 10, fontWeight: 600, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Nav */}
        <div style={{ paddingLeft: 8, paddingRight: 8, marginBottom: 4 }}>
          <div style={{ color: t.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: "4px 12px 8px", textTransform: "uppercase" }}>Menu</div>
        </div>
        <nav style={{ padding: "0 10px", flex: 1, overflowY: "auto" }}>
          {NAV.map(item => {
            const active = view === item.id;
            return (
              <button key={item.id} onClick={() => setView(item.id)} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "11px 14px", marginBottom: 2,
                background: active ? `linear-gradient(90deg, ${t.accentAlt}, ${t.accent})` : "transparent",
                border: "none",
                borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                color: active ? "#fff" : t.textSoft,
                fontSize: 14, fontWeight: active ? 700 : 500,
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = t.panelBright; e.currentTarget.style.color = t.text; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = t.textSoft; } }}
              >
                <span style={{ fontSize: 18, width: 22, textAlign: "center", opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.id === "alarms" && totals.alarming > 0 && (
                  <span style={{ background: t.red, color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>{totals.alarming}</span>
                )}
                {item.id === "notifs" && unreadCount > 0 && (
                  <span style={{ background: t.orange, color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}` }}>
          <button onClick={toggleTheme} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            background: t.panelBright, border: `1px solid ${t.border}`, borderRadius: 12,
            padding: "10px 14px", color: t.textSoft, cursor: "pointer", fontSize: 13, fontWeight: 600,
            fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 16 }}>{theme === "dark" ? "🌙" : "☀️"}</span>
            <span style={{ flex: 1, textAlign: "left" }}>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
            <div style={{
              width: 34, height: 20, borderRadius: 10, flexShrink: 0,
              background: theme === "dark" ? t.accentAlt : t.green,
              position: "relative", transition: "background 0.3s",
            }}>
              <div style={{
                position: "absolute", top: 3, left: theme === "dark" ? 3 : 17,
                width: 14, height: 14, borderRadius: "50%", background: "#fff",
                transition: "left 0.3s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }} />
            </div>
          </button>
        </div>

        {/* Live status */}
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${t.border}` }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: snapError ? t.red : t.green,
            boxShadow: snapError ? "none" : `0 0 8px ${t.green}`,
            animation: snapError ? "none" : "pulse 2.5s infinite",
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: snapError ? t.red : t.green, fontSize: 12, fontWeight: 700 }}>{snapError ? "Connection Error" : "Live Feed Active"}</div>
            <div style={{ color: t.muted, fontSize: 11, marginTop: 1 }}>Updated {lastUpdated.toLocaleTimeString()}</div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ marginLeft: 240, minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 28px 0",
          marginBottom: 24,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>
                {NAV.find(n => n.id === view)?.label}
              </h1>
              {activeCompany && (
                <div style={{ display: "flex", alignItems: "center", gap: 6,
                  background: `${activeCompany.color}18`, border: `1px solid ${activeCompany.color}55`,
                  borderRadius: 8, padding: "4px 10px",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: activeCompany.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: activeCompany.color }}>{activeCompany.name}</span>
                  <button onClick={() => setActiveCompanyId(null)} style={{
                    background: "transparent", border: "none", color: t.muted, cursor: "pointer",
                    fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2, fontFamily: "inherit",
                  }}>×</button>
                </div>
              )}
            </div>
            <div style={{ color: t.muted, fontSize: 13, marginTop: 2, fontWeight: 400 }}>
              {new Date().toLocaleDateString("en-TZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {activeCompany && <span style={{ marginLeft: 10, color: t.green, fontWeight: 600 }}>{filteredVehicles.length} vehicles</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {totals.alarming > 0 && (
              <div style={{
                background: t.redSoft, borderRadius: 10, padding: "8px 16px",
                color: t.red, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>⚡</span> {totals.alarming} alarm{totals.alarming > 1 ? "s" : ""}
              </div>
            )}
            <div style={{
              background: t.panel, border: `1px solid ${t.border}`,
              borderRadius: 10, padding: "8px 16px",
              color: t.green, fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.green, boxShadow: `0 0 6px ${t.green}` }} />
              {totals.online ?? "—"} Online
            </div>
            <button onClick={() => { setView("notifs"); setUnreadCount(0); }} style={{
              position: "relative",
              background: view === "notifs" ? `linear-gradient(135deg, ${t.accent}, ${t.accentAlt})` : t.panel,
              border: `1px solid ${view === "notifs" ? "transparent" : t.border}`,
              borderRadius: 10, padding: "8px 16px",
              color: view === "notifs" ? "#fff" : t.text,
              cursor: "pointer", fontSize: 14, lineHeight: 1,
              display: "flex", alignItems: "center", gap: 8, fontWeight: 600,
              boxShadow: view === "notifs" ? `0 4px 16px ${t.accentGlow}` : "0 1px 4px rgba(0,0,0,0.05)",
              fontFamily: "inherit",
            }}>
              <span style={{ fontSize: 17 }}>🔔</span>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: t.red, color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Views */}
        <div style={{ padding: "0 28px 32px" }}>
          {view === "dashboard" && (
            snapLoading ? <Spinner label="Fetching live fleet data…" /> :
            snapError   ? <ErrorBanner message={snapError} onRetry={fetchSnapshot} /> :
            snapshot    ? <DashboardView snapshot={snapshot} activeCompany={activeCompany} filteredVehicles={filteredVehicles} /> : null
          )}
          {view === "vehicles" && (
            <VehiclesView vehicles={filteredVehicles} loading={vehLoading} error={vehError}
              onRetry={() => { vehiclesFetched.current = false; fetchVehicles(); }}
              onSelect={setSelectedVehicle} erpSummary={erpSummary} />
          )}
          {view === "alarms" && (
            <AlarmsView alarms={alarms} loading={alarmLoading} error={alarmError}
              onRetry={() => { alarmsFetched.current = false; fetchAlarms(); }} />
          )}
          {view === "erp"         && <FleetERPView vehicles={filteredVehicles} onCompanySelect={setActiveCompanyId} activeCompanyId={activeCompanyId} />}
          {view === "notifs"      && <NotificationsView events={accEvents} onClear={clearNotifications} />}
          {view === "cameras"     && <LiveCamerasView vehicles={filteredVehicles} erpSummary={erpSummary} />}
          {view === "fuel"        && <FuelConsumptionView vehicles={filteredVehicles} erpSummary={erpSummary} />}
          {view === "fuelrpt"     && <FuelDailyMonthlyView vehicles={filteredVehicles} erpSummary={erpSummary} />}
          {view === "chat"        && <ChatView />}
        </div>
      </div>

      {selectedVehicle && (
        <VehicleModal 
          vehicle={selectedVehicle} 
          onClose={() => setSelectedVehicle(null)} 
          onViewVideo={() => {
            setVideoVehicle(selectedVehicle);
            setSelectedVehicle(null);
          }}
        />
      )}
      {videoVehicle && (
        <VideoModal
          vehicle={videoVehicle}
          onClose={() => setVideoVehicle(null)}
        />
      )}
      {sideStreamVehicle && (
        <SidebarVideoPlayer
          vehicle={sideStreamVehicle}
          channel={sideChannel}
          onClose={() => setSideStreamVehicle(null)}
          onChannelChange={setSideChannel}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        body { font-family: 'DM Sans', 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        button, input, select, textarea { font-family: inherit; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(67,24,209,0.25); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(117,81,255,0.45); }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
        select option { background: #ffffff; color: #1b2559; }
        .fleet-table th, .fleet-table td { font-family: 'DM Sans', 'Inter', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default function FleetDashboard() {
  const [theme, setTheme] = useState("dark");
  const t = themes[theme] || themes.dark;

  const toggleTheme = useCallback(() => {
    setTheme(p => p === "dark" ? "light" : "dark");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, t, toggleTheme }}>
      <FleetDashboardContent />
    </ThemeContext.Provider>
  );
}
