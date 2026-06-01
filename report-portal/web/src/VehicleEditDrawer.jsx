import { useTheme } from "./theme.jsx";
import { Btn, Inp } from "./ui/primitives.jsx";
import CameraEditor from "./CameraEditor.jsx";

export default function VehicleEditDrawer({
  selected,
  bundleDraft,
  setBundleDraft,
  cameraDraft,
  setCameraDraft,
  noteDraft,
  setNoteDraft,
  newNote,
  setNewNote,
  manualHistory,
  updateHistory,
  saving,
  onSave,
  onAddNote,
  onClose,
  fmtTs,
  fmtDay,
}) {
  const { t } = useTheme();
  if (!selected) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.35)",
          zIndex: 1000,
        }}
      />
      <div
        role="dialog"
        aria-label={`Edit ${selected.plate}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(400px, 92vw)",
          height: "100vh",
          background: t.panel,
          boxShadow: "-8px 0 32px rgba(0,0,0,0.2)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: t.panelBright,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{selected.plate}</div>
            <div style={{ fontSize: 11, color: t.textSoft }}>{selected.devIdno}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close panel"
            style={{
              border: "none",
              background: t.bg,
              borderRadius: 8,
              width: 36,
              height: 36,
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              color: t.text,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            scrollBehavior: "smooth",
          }}
        >
          <Inp
            label="Data bundle purchased"
            type="date"
            value={bundleDraft}
            onChange={(e) => setBundleDraft(e.target.value)}
          />
          <div style={{ marginTop: 12, fontSize: 11, color: t.textSoft, lineHeight: 1.45 }}>
            {selected.autoNotes}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Cameras (1–6)</div>
            <CameraEditor value={cameraDraft} onChange={setCameraDraft} disabled={saving} />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Notes (today)</div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                padding: 10,
                fontFamily: "inherit",
                fontSize: 12,
              }}
            />
          </div>

          <Btn onClick={onSave} disabled={saving} style={{ marginTop: 12, width: "100%" }}>
            {saving ? "Saving…" : "Save vehicle record"}
          </Btn>

          <div style={{ marginTop: 20, borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Add history entry</div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              placeholder="Separate log entry (kept forever)…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                padding: 8,
                fontFamily: "inherit",
                fontSize: 12,
              }}
            />
            <Btn
              onClick={onAddNote}
              disabled={saving || !newNote.trim()}
              style={{ marginTop: 6, width: "100%" }}
            >
              Add to history
            </Btn>
          </div>

          {manualHistory.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>All records</div>
              {manualHistory.map((ent) => (
                <div
                  key={ent.id}
                  style={{
                    marginBottom: 8,
                    padding: 8,
                    background: t.bg,
                    borderRadius: 8,
                    fontSize: 10,
                    borderLeft: `3px solid ${ent.fields?.type === "cameras" ? t.orange : t.accent}`,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {ent.fields?.type || "note"} · {fmtDay(ent.reportDate)} · {fmtTs(ent.recordedAt)}
                  </div>
                  <div style={{ marginTop: 4 }}>{ent.manualNote || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
