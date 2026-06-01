import { useTheme } from "./theme.jsx";

const STATUS_COLOR = {
  ok: { bg: "rgba(46, 125, 50, 0.12)", border: "#2e7d32", text: "#1b5e20" },
  warn: { bg: "rgba(237, 108, 2, 0.12)", border: "#ed6c02", text: "#e65100" },
  error: { bg: "rgba(211, 47, 47, 0.1)", border: "#d32f2f", text: "#b71c1c" },
  none: { bg: "rgba(120, 130, 140, 0.1)", border: "#9aa5b1", text: "#5c6b7a" },
};

export function MonitorCell({ display, primary, secondary, title }) {
  const { t } = useTheme();
  const st = STATUS_COLOR[display?.status || "none"] || STATUS_COLOR.none;
  return (
    <div
      title={title}
      style={{
        minWidth: 100,
        maxWidth: 200,
        padding: "6px 8px",
        borderRadius: 8,
        border: `1px solid ${st.border}`,
        background: st.bg,
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <div style={{ fontWeight: 700, color: st.text }}>{primary}</div>
      {secondary && (
        <div style={{ color: t.textSoft, marginTop: 2, fontSize: 10 }}>
          last {secondary}
          {display?.stale ? " · stale" : ""}
        </div>
      )}
    </div>
  );
}

export function FuelCell({ row }) {
  const d = row.fuelDisplay;
  const litres = d?.litres ?? row.live?.fuel ?? row.fuel?.endL;
  const primary =
    litres != null && litres !== ""
      ? `${litres} L`
      : "No reading";
  return (
    <MonitorCell
      display={d}
      primary={primary}
      secondary={d?.ageLabel}
      title={d?.updatedAt ? `Updated ${d.updatedAt}` : "No fuel update"}
    />
  );
}

export function GprsCell({ row }) {
  const d = row.gprsDisplay;
  const loc = (d?.location || "—").slice(0, 48);
  return (
    <MonitorCell
      display={d}
      primary={loc}
      secondary={d?.ageLabel}
      title={d?.updatedAt ? `GPS ${d.updatedAt}` : "No GPS"}
    />
  );
}

export function AntennaCell({ row }) {
  const d = row.antennaDisplay;
  const primary = d?.neverUpdated
    ? "Never updated"
    : !d?.online
      ? `Offline ${d?.ageLabel || ""}`
      : "Online";
  return (
    <MonitorCell
      display={d}
      primary={primary}
      secondary={!d?.online && !d?.neverUpdated ? "not reporting" : null}
      title="Antenna / connectivity"
    />
  );
}
