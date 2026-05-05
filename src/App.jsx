import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot, setDoc, updateDoc,
  deleteDoc, addDoc, serverTimestamp, getDoc
} from "firebase/firestore";

// ── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  charger: {
    name: "Charger Purple",
    vars: {
      "--bg": "#0a0008", "--bg2": "#130011", "--bg3": "#1e0020",
      "--card": "#1a001c", "--border": "#4a1060", "--accent": "#9b30d9",
      "--accent2": "#c96fff", "--accent3": "#6600aa", "--text": "#f0e6ff",
      "--text2": "#c8a8e8", "--text3": "#8060a0", "--yes": "#7c3aed",
      "--no": "#e040fb", "--gold": "#d4af37", "--danger": "#ff2d6b",
      "--glow": "rgba(155,48,217,0.35)",
      "--font-display": "'Bebas Neue', cursive",
      "--font-body": "'DM Mono', monospace",
    },
  },
  colonial: {
    name: "Colonial Blue",
    vars: {
      "--bg": "#040e1a", "--bg2": "#071828", "--bg3": "#0c2238",
      "--card": "#081a2e", "--border": "#1a4a6a", "--accent": "#1e6fa8",
      "--accent2": "#4fbce6", "--accent3": "#0d5a8a", "--text": "#e8f4ff",
      "--text2": "#90c8e8", "--text3": "#4a7a9b", "--yes": "#1e90d0",
      "--no": "#008080", "--gold": "#e8c84a", "--danger": "#ff5252",
      "--glow": "rgba(30,111,168,0.35)",
      "--font-display": "'Playfair Display SC', serif",
      "--font-body": "'Source Serif 4', serif",
    },
  },
  saxon: {
    name: "Saxon Green",
    vars: {
      "--bg": "#020d04", "--bg2": "#041508", "--bg3": "#081e0c",
      "--card": "#061209", "--border": "#1a4a20", "--accent": "#2d7a3a",
      "--accent2": "#6abf5a", "--accent3": "#1a5c24", "--text": "#e8ffe8",
      "--text2": "#90d890", "--text3": "#406040", "--yes": "#4caf50",
      "--no": "#8bc34a", "--gold": "#c8a400", "--danger": "#ff6b35",
      "--glow": "rgba(45,122,58,0.35)",
      "--font-display": "'Cinzel', serif",
      "--font-body": "'Crimson Pro', serif",
    },
  },
  der: {
    name: "Der Red",
    vars: {
      "--bg": "#0e0000", "--bg2": "#180000", "--bg3": "#220000",
      "--card": "#140000", "--border": "#5a1010", "--accent": "#cc1a1a",
      "--accent2": "#ff4444", "--accent3": "#990000", "--text": "#fff5f5",
      "--text2": "#ffaaaa", "--text3": "#884444", "--yes": "#e53935",
      "--no": "#b71c1c", "--gold": "#ffd700", "--danger": "#ff6b00",
      "--glow": "rgba(204,26,26,0.35)",
      "--font-display": "'Anton', sans-serif",
      "--font-body": "'IBM Plex Sans Condensed', sans-serif",
    },
  },
};

const MARKET_TYPES = [
  { id: "best_delegate", label: "Best Delegate", icon: "🏅" },
  { id: "outstanding_delegate", label: "Outstanding Delegate", icon: "⭐" },
  { id: "honorable_mention", label: "Honorable Mention", icon: "📜" },
  { id: "verbal_commendation", label: "Verbal Commendation", icon: "🗣️" },
  { id: "best_position_paper", label: "Best Position Paper", icon: "📄" },
  { id: "sponsor", label: "Sponsor Resolution", icon: "✍️" },
  { id: "signatory", label: "Signatory", icon: "🖊️" },
  { id: "pres_commendation", label: "Presidential Commendation", icon: "🏛️" },
  { id: "qna", label: "Q&A Recognition", icon: "❓" },
  { id: "dq", label: "Disqualification (DQ)", icon: "🚫" },
  { id: "delegation_award", label: "Delegation Award", icon: "🏆" },
  { id: "gavel", label: "Gavel / Chair Position", icon: "🔨" },
  { id: "officer", label: "Officer Position", icon: "📋" },
  { id: "custom", label: "Custom Market", icon: "🎯" },
];

function calcProb(yes, no) {
  const total = yes + no;
  if (total === 0) return 0.5;
  return yes / total;
}
function fmtPct(p) { return `${Math.round(p * 100)}%`; }
function uid() { return Math.random().toString(36).slice(2, 10); }
function loadLocal(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── UI PRIMITIVES ─────────────────────────────────────────────────────────────
function ProbBar({ yes, no }) {
  const p = calcProb(yes, no);
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ height: 10, background: "var(--bg3)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${p * 100}%`,
          background: "linear-gradient(90deg, var(--accent3), var(--accent))",
          borderRadius: 99, transition: "width 0.5s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text3)" }}>
        <span style={{ color: "var(--accent2)", fontWeight: 700 }}>{fmtPct(p)}</span>
        <span>{yes + no} shares</span>
      </div>
    </div>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      border: `1px solid ${color || "var(--accent)"}`, color: color || "var(--accent2)",
    }}>{children}</span>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 99,
      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
      background: active ? "var(--accent3)" : "transparent",
      color: active ? "var(--accent2)" : "var(--text3)",
      fontSize: 13, cursor: "pointer", fontFamily: "var(--font-body)",
      transition: "all 0.2s", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28, maxWidth: 560, width: "100%",
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 0 60px var(--glow)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", color: "var(--accent2)", fontSize: 22 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 12, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>}
      <input {...props} style={{
        background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8,
        padding: "10px 14px", color: "var(--text)", fontFamily: "var(--font-body)",
        fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", ...props.style,
      }} />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 12, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>}
      <select {...props} style={{
        background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8,
        padding: "10px 14px", color: "var(--text)", fontFamily: "var(--font-body)",
        fontSize: 14, outline: "none", width: "100%", ...props.style,
      }}>{children}</select>
    </div>
  );
}

function Btn({ children, variant = "primary", small, ...props }) {
  const styles = {
    primary: { background: "var(--accent)", color: "var(--bg)", borderColor: "var(--accent)" },
    secondary: { background: "transparent", color: "var(--accent2)", borderColor: "var(--accent)" },
    danger: { background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" },
    ghost: { background: "transparent", color: "var(--text3)", borderColor: "var(--border)" },
  };
  return (
    <button {...props} style={{
      padding: small ? "6px 14px" : "10px 22px", borderRadius: 8, border: "1px solid",
      fontFamily: "var(--font-display)", fontSize: small ? 13 : 15,
      letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.2s",
      ...styles[variant], ...props.style,
    }}>{children}</button>
  );
}

// ── MARKET CARD ───────────────────────────────────────────────────────────────
function MarketCard({ market, onBet, isAdmin, onResolve, onDelete }) {
  const type = MARKET_TYPES.find(t => t.id === market.type);
  const isResolved = market.status === "resolved";
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
      padding: 22, display: "flex", flexDirection: "column", gap: 16,
      boxShadow: isResolved ? "none" : "0 2px 20px var(--glow)", opacity: isResolved ? 0.8 : 1,
      transition: "transform 0.2s",
    }}
      onMouseEnter={e => { if (!isResolved) e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <span style={{ fontSize: 24 }}>{type?.icon || "🎯"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)", lineHeight: 1.2 }}>{market.title}</div>
          <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 4 }}>{market.conference} · {market.committee}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge color={isResolved ? "var(--gold)" : "var(--accent)"}>{isResolved ? "Resolved" : "Open"}</Badge>
          {type && <Badge>{type.label}</Badge>}
        </div>
      </div>

      {market.description && (
        <p style={{ margin: 0, color: "var(--text2)", fontSize: 13, lineHeight: 1.6 }}>{market.description}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(market.options || []).map(opt => {
          const isWinner = market.resolvedOption === opt.id;
          return (
            <div key={opt.id} style={{
              padding: "12px 14px", borderRadius: 10,
              background: isWinner ? "rgba(212,175,55,0.08)" : "var(--bg3)",
              border: isWinner ? "1px solid var(--gold)" : "1px solid transparent",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{opt.label}</span>
                  {opt.school && <span style={{ color: "var(--text3)", fontSize: 12, marginLeft: 8 }}>({opt.school})</span>}
                  {isWinner && <span style={{ marginLeft: 8, color: "var(--gold)", fontSize: 12 }}>🏆 Winner</span>}
                </div>
                <span style={{ color: "var(--accent2)", fontWeight: 700, fontSize: 16 }}>{fmtPct(calcProb(opt.yesShares, opt.noShares))}</span>
              </div>
              <ProbBar yes={opt.yesShares} no={opt.noShares} />
              {!isResolved && (
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <Btn small variant="secondary" onClick={() => onBet(market, opt, "yes")}>
                    ↑ Yes {fmtPct(calcProb(opt.yesShares, opt.noShares))}
                  </Btn>
                  <Btn small variant="ghost" onClick={() => onBet(market, opt, "no")}>
                    ↓ No {fmtPct(1 - calcProb(opt.yesShares, opt.noShares))}
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text3)", fontSize: 12, alignSelf: "center", flex: 1 }}>Admin</span>
          {!isResolved && <Btn small variant="secondary" onClick={() => onResolve(market)}>Resolve</Btn>}
          <Btn small variant="danger" onClick={() => onDelete(market.id)}>Delete</Btn>
        </div>
      )}
    </div>
  );
}

// ── BET MODAL ─────────────────────────────────────────────────────────────────
function BetModal({ open, onClose, market, option, side, profile, onConfirm }) {
  const [amount, setAmount] = useState(10);
  if (!open || !market || !option) return null;
  const p = side === "yes"
    ? calcProb(option.yesShares, option.noShares)
    : 1 - calcProb(option.yesShares, option.noShares);
  const payout = amount / p;
  return (
    <Modal open={open} onClose={onClose} title={`Place Bet · ${side === "yes" ? "↑ YES" : "↓ NO"}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ padding: 14, background: "var(--bg3)", borderRadius: 10, fontSize: 14 }}>
          <div style={{ fontWeight: 700, color: "var(--text)" }}>{option.label}</div>
          <div style={{ color: "var(--text3)", fontSize: 12 }}>{market.title}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 12, background: "var(--bg3)", borderRadius: 8, textAlign: "center" }}>
            <div style={{ color: "var(--text3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current prob</div>
            <div style={{ color: "var(--accent2)", fontSize: 22, fontWeight: 700 }}>{fmtPct(p)}</div>
          </div>
          <div style={{ padding: 12, background: "var(--bg3)", borderRadius: 8, textAlign: "center" }}>
            <div style={{ color: "var(--text3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>If correct</div>
            <div style={{ color: "var(--gold)", fontSize: 22, fontWeight: 700 }}>+{Math.round(payout - amount)}</div>
          </div>
        </div>
        <Input label="Shares to buy" type="number" min={1} max={profile?.balance || 100} value={amount} onChange={e => setAmount(Number(e.target.value))} />
        <div style={{ fontSize: 13, color: "var(--text3)" }}>Balance: <span style={{ color: "var(--gold)" }}>{profile?.balance ?? "—"} coins</span></div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
          <Btn variant="primary" onClick={() => onConfirm(amount)} style={{ flex: 1 }}>
            Bet {amount} → {Math.round(payout)} if correct
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── CREATE MARKET MODAL ───────────────────────────────────────────────────────
function CreateMarketModal({ open, onClose, onCreate }) {
  const empty = {
    title: "", type: "best_delegate", conference: "", committee: "",
    description: "", closes: "",
    options: [{ id: uid(), label: "", school: "" }, { id: uid(), label: "", school: "" }],
  };
  const [form, setForm] = useState(empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setOpt = (i, k, v) => setForm(f => {
    const opts = [...f.options]; opts[i] = { ...opts[i], [k]: v }; return { ...f, options: opts };
  });
  const addOpt = () => setForm(f => ({ ...f, options: [...f.options, { id: uid(), label: "", school: "" }] }));
  const removeOpt = i => setForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }));
  const submit = () => {
    if (!form.title || !form.conference || form.options.filter(o => o.label).length < 2) return;
    onCreate({
      ...form,
      options: form.options.filter(o => o.label).map(o => ({ ...o, yesShares: 50, noShares: 50 })),
      status: "open",
    });
    setForm(empty);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Create Market">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Market Title" value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. SOCHUM Best Delegate" />
        <Select label="Market Type" value={form.type} onChange={e => set("type", e.target.value)}>
          {MARKET_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </Select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Conference" value={form.conference} onChange={e => set("conference", e.target.value)} placeholder="WMHSMUN 2025" />
          <Input label="Committee" value={form.committee} onChange={e => set("committee", e.target.value)} placeholder="SOCHUM" />
        </div>
        <Input label="Description (optional)" value={form.description} onChange={e => set("description", e.target.value)} />
        <Input label="Closes" type="date" value={form.closes} onChange={e => set("closes", e.target.value)} />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Options / Candidates</div>
          {form.options.map((opt, i) => (
            <div key={opt.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
              <input placeholder="Name / Label" value={opt.label} onChange={e => setOpt(i, "label", e.target.value)}
                style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14 }} />
              <input placeholder="School (optional)" value={opt.school} onChange={e => setOpt(i, "school", e.target.value)}
                style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14 }} />
              <button onClick={() => removeOpt(i)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--danger)", cursor: "pointer", padding: "0 12px" }}>✕</button>
            </div>
          ))}
          <Btn small variant="ghost" onClick={addOpt}>+ Add Option</Btn>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} style={{ flex: 1 }}>Create Market</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── RESOLVE MODAL ─────────────────────────────────────────────────────────────
function ResolveModal({ open, onClose, market, onResolve }) {
  const [selected, setSelected] = useState("");
  if (!open || !market) return null;
  return (
    <Modal open={open} onClose={onClose} title="Resolve Market">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ color: "var(--text2)", margin: 0 }}>Select the winning option for <strong style={{ color: "var(--text)" }}>{market.title}</strong>.</p>
        {(market.options || []).map(opt => (
          <label key={opt.id} style={{
            display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
            padding: "10px 14px", borderRadius: 10,
            background: selected === opt.id ? "var(--bg3)" : "transparent",
            border: selected === opt.id ? "1px solid var(--accent)" : "1px solid transparent",
          }}>
            <input type="radio" name="winner" value={opt.id} checked={selected === opt.id} onChange={() => setSelected(opt.id)} style={{ accentColor: "var(--accent)" }} />
            <span style={{ color: "var(--text)" }}>{opt.label}</span>
            {opt.school && <span style={{ color: "var(--text3)", fontSize: 12 }}>({opt.school})</span>}
          </label>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
          <Btn variant="primary" onClick={() => { if (selected) { onResolve(market.id, selected); onClose(); } }} style={{ flex: 1 }}>Confirm</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── PROFILE PANEL ─────────────────────────────────────────────────────────────
function ProfilePanel({ profiles, activeProfile, onSelect, onCreate, onClose }) {
  const [name, setName] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, color: "var(--text2)", fontSize: 14 }}>Profiles are saved to this device. Each profile tracks bets and coin balance.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {profiles.map(p => (
          <div key={p.id} onClick={() => { onSelect(p.id); onClose(); }} style={{
            padding: "12px 16px", borderRadius: 10, cursor: "pointer",
            background: activeProfile?.id === p.id ? "var(--bg3)" : "transparent",
            border: activeProfile?.id === p.id ? "1px solid var(--accent)" : "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text)" }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>{(p.bets || []).length} bets</div>
            </div>
            <div style={{ color: "var(--gold)", fontWeight: 700 }}>{p.balance} 🪙</div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", gap: 10 }}>
        <input placeholder="New profile name…" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && (onCreate(name.trim()), setName(""))}
          style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14 }} />
        <Btn variant="primary" onClick={() => { if (name.trim()) { onCreate(name.trim()); setName(""); } }}>Create</Btn>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(() => loadLocal("mun_theme", "charger"));
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profiles stay local per device
  const [profiles, setProfiles] = useState(() => loadLocal("mun_profiles", []));
  const [activeProfileId, setActiveProfileId] = useState(() => loadLocal("mun_active_profile", null));
  const [isAdmin, setIsAdmin] = useState(() => loadLocal("mun_is_admin", false));

  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [betState, setBetState] = useState({ open: false, market: null, option: null, side: null });
  const [resolveState, setResolveState] = useState({ open: false, market: null });
  const [showProfiles, setShowProfiles] = useState(false);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterConf, setFilterConf] = useState("all");
  const [search, setSearch] = useState("");

  // Persist local prefs
  useEffect(() => { saveLocal("mun_theme", theme); }, [theme]);
  useEffect(() => { saveLocal("mun_profiles", profiles); }, [profiles]);
  useEffect(() => { saveLocal("mun_active_profile", activeProfileId); }, [activeProfileId]);
  useEffect(() => { saveLocal("mun_is_admin", isAdmin); }, [isAdmin]);

  // Apply theme
  useEffect(() => {
    const t = THEMES[theme];
    if (!t) return;
    Object.entries(t.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }, [theme]);

  // Live Firestore listener for markets
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "markets"), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMarkets(docs);
      setLoading(false);
    });
    return unsub;
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;
  const conferences = ["all", ...new Set(markets.map(m => m.conference).filter(Boolean))];

  const filteredMarkets = markets.filter(m => {
    if (filterType !== "all" && m.type !== filterType) return false;
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (filterConf !== "all" && m.conference !== filterConf) return false;
    if (search && !m.title?.toLowerCase().includes(search.toLowerCase()) &&
      !m.committee?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── FIREBASE HANDLERS ──
  const handleCreateMarket = async (market) => {
    await addDoc(collection(db, "markets"), { ...market, createdAt: serverTimestamp() });
  };

  const handleResolve = async (marketId, optionId) => {
    await updateDoc(doc(db, "markets", marketId), { status: "resolved", resolvedOption: optionId });
  };

  const handleDelete = async (marketId) => {
    await deleteDoc(doc(db, "markets", marketId));
  };

  const handleBet = (market, option, side) => {
    if (!activeProfile) { setShowProfiles(true); return; }
    setBetState({ open: true, market, option, side });
  };

  const confirmBet = useCallback(async (amount) => {
    const { market, option, side } = betState;
    if (!activeProfile || amount <= 0 || amount > activeProfile.balance) return;

    // Update market option shares in Firestore
    const marketRef = doc(db, "markets", market.id);
    const snap = await getDoc(marketRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const updatedOptions = data.options.map(o => {
      if (o.id !== option.id) return o;
      return {
        ...o,
        yesShares: side === "yes" ? o.yesShares + amount : o.yesShares,
        noShares: side === "no" ? o.noShares + amount : o.noShares,
      };
    });
    await updateDoc(marketRef, { options: updatedOptions });

    // Update local profile
    setProfiles(ps => ps.map(p => {
      if (p.id !== activeProfileId) return p;
      return {
        ...p,
        balance: p.balance - amount,
        bets: [...(p.bets || []), {
          id: uid(), marketId: market.id, marketTitle: market.title,
          optionId: option.id, optionLabel: option.label,
          side, amount, timestamp: Date.now(),
        }],
      };
    }));

    setBetState({ open: false, market: null, option: null, side: null });
  }, [betState, activeProfile, activeProfileId]);

  const handleCreateProfile = (name) => {
    const p = { id: uid(), name, balance: 1000, bets: [] };
    setProfiles(ps => [...ps, p]);
    setActiveProfileId(p.id);
  };

  const t = THEMES[theme];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Playfair+Display+SC:wght@400;700&family=Source+Serif+4:wght@400;600&family=Cinzel:wght@400;700&family=Crimson+Pro:wght@400;600&family=Anton&family=IBM+Plex+Sans+Condensed:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg2); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
        .market-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
        @media (max-width: 600px) { .market-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* HEADER */}
      <header style={{
        borderBottom: "1px solid var(--border)", padding: "0 24px",
        display: "flex", alignItems: "center", gap: 16, height: 64,
        position: "sticky", top: 0, zIndex: 100, background: "var(--bg)",
      }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--accent2)", letterSpacing: "0.04em" }}>🏛️ MUNMarket</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {Object.entries(THEMES).map(([key, th]) => (
              <button key={key} title={th.name} onClick={() => setTheme(key)} style={{
                width: 28, height: 28, borderRadius: 99,
                border: theme === key ? "2px solid var(--accent2)" : "2px solid transparent",
                background: th.vars["--accent"], cursor: "pointer", transition: "border 0.2s",
              }} />
            ))}
          </div>
          <Btn small variant={activeProfile ? "secondary" : "ghost"} onClick={() => setShowProfiles(true)}>
            {activeProfile ? `${activeProfile.name} · ${activeProfile.balance}🪙` : "Sign In"}
          </Btn>
          <Btn small variant={isAdmin ? "primary" : "ghost"} onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminPin(true)}>
            {isAdmin ? "⚙ Admin" : "Admin"}
          </Btn>
          {isAdmin && <Btn small variant="primary" onClick={() => setShowCreateMarket(true)}>+ Market</Btn>}
        </div>
      </header>

      {/* TICKER */}
      <div style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)", padding: "8px 24px", overflow: "hidden", whiteSpace: "nowrap" }}>
        <span style={{ color: "var(--text3)", fontSize: 12, fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
          {markets.filter(m => m.status === "open").map(m => {
            const top = [...(m.options || [])].sort((a, b) => calcProb(b.yesShares, b.noShares) - calcProb(a.yesShares, a.noShares))[0];
            return top ? `${m.title}: ${top.label} ${fmtPct(calcProb(top.yesShares, top.noShares))}` : null;
          }).filter(Boolean).join("  ·  ")}
          {markets.filter(m => m.status === "resolved").map(m => {
            const w = (m.options || []).find(o => o.id === m.resolvedOption);
            return w ? `  ·  ✅ ${m.title}: ${w.label}` : null;
          }).filter(Boolean).join("")}
        </span>
      </div>

      {/* MAIN */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Open Markets", value: markets.filter(m => m.status === "open").length, icon: "📊" },
            { label: "Resolved", value: markets.filter(m => m.status === "resolved").length, icon: "✅" },
            { label: "Total Bets", value: profiles.reduce((s, p) => s + (p.bets || []).length, 0), icon: "💰" },
            { label: "Betters", value: profiles.length, icon: "👥" },
          ].map(s => (
            <div key={s.label} style={{ padding: "14px 18px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--accent2)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <input placeholder="Search markets…" value={search} onChange={e => setSearch(e.target.value)} style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10,
            padding: "12px 18px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 15, outline: "none", width: "100%",
          }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["all", "open", "resolved"].map(s => (
              <Pill key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)}>
                {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Pill>
            ))}
            <span style={{ width: 1, background: "var(--border)", margin: "0 4px" }} />
            {conferences.map(c => (
              <Pill key={c} active={filterConf === c} onClick={() => setFilterConf(c)}>
                {c === "all" ? "All Conferences" : c}
              </Pill>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill active={filterType === "all"} onClick={() => setFilterType("all")}>All Types</Pill>
            {MARKET_TYPES.map(t => (
              <Pill key={t.id} active={filterType === t.id} onClick={() => setFilterType(t.id)}>{t.icon} {t.label}</Pill>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text3)" }}>
            <div style={{ fontSize: 36 }}>⏳</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, marginTop: 12 }}>Loading markets…</div>
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text3)" }}>
            <div style={{ fontSize: 48 }}>🏛️</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 24, marginTop: 12 }}>No markets found</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>{isAdmin ? "Create a market to get started." : "Check back soon or change your filters."}</div>
          </div>
        ) : (
          <div className="market-grid">
            {filteredMarkets.map(m => (
              <MarketCard key={m.id} market={m} onBet={handleBet} isAdmin={isAdmin}
                onResolve={m => setResolveState({ open: true, market: m })}
                onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* My Bets */}
        {activeProfile && (activeProfile.bets || []).length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: "var(--font-display)", color: "var(--accent2)", fontSize: 22, marginBottom: 16 }}>My Bets · {activeProfile.name}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...(activeProfile.bets || [])].reverse().map(bet => {
                const m = markets.find(m => m.id === bet.marketId);
                const isWinner = m?.status === "resolved" && m.resolvedOption === bet.optionId;
                const isLoser = m?.status === "resolved" && m.resolvedOption && m.resolvedOption !== bet.optionId;
                return (
                  <div key={bet.id} style={{
                    padding: "12px 16px", background: "var(--card)",
                    border: `1px solid ${isWinner ? "var(--gold)" : "var(--border)"}`,
                    borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
                  }}>
                    <div>
                      <span style={{ color: bet.side === "yes" ? "var(--accent2)" : "var(--text3)", fontWeight: 700, fontSize: 12, textTransform: "uppercase", marginRight: 8 }}>{bet.side}</span>
                      <span style={{ color: "var(--text)" }}>{bet.optionLabel}</span>
                      <span style={{ color: "var(--text3)", fontSize: 12, marginLeft: 8 }}>in {bet.marketTitle}</span>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ color: "var(--gold)" }}>{bet.amount} 🪙</span>
                      {isWinner && <Badge color="var(--gold)">Won 🏆</Badge>}
                      {isLoser && <Badge color="var(--text3)">Lost</Badge>}
                      {!m || m.status === "open" ? <Badge>Pending</Badge> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "20px 24px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", color: "var(--accent)", marginRight: 8 }}>MUNMarket</span>
        Play-money prediction markets for Model UN · No real money involved
      </footer>

      {/* MODALS */}
      <Modal open={showProfiles} onClose={() => setShowProfiles(false)} title="Profiles">
        <ProfilePanel profiles={profiles} activeProfile={activeProfile}
          onSelect={setActiveProfileId} onCreate={handleCreateProfile} onClose={() => setShowProfiles(false)} />
      </Modal>

      <Modal open={showAdminPin} onClose={() => { setShowAdminPin(false); setAdminPin(""); setPinError(false); }} title="Admin Access">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "var(--text2)", margin: 0, fontSize: 14 }}>Enter the admin PIN.</p>
          <Input label="PIN" type="password" value={adminPin}
            onChange={e => { setAdminPin(e.target.value); setPinError(false); }}
            placeholder="••••"
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (adminPin === "8268") { setIsAdmin(true); setShowAdminPin(false); setAdminPin(""); }
                else setPinError(true);
              }
            }} />
          {pinError && <div style={{ color: "var(--danger)", fontSize: 13 }}>Incorrect PIN.</div>}
          <div style={{ fontSize: 12, color: "var(--text3)" }}>Default PIN: 1234 — change in App.jsx</div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setShowAdminPin(false); setAdminPin(""); setPinError(false); }} style={{ flex: 1 }}>Cancel</Btn>
            <Btn variant="primary" style={{ flex: 1 }} onClick={() => {
              if (adminPin === "8268") { setIsAdmin(true); setShowAdminPin(false); setAdminPin(""); }
              else setPinError(true);
            }}>Enter</Btn>
          </div>
        </div>
      </Modal>

      <CreateMarketModal open={showCreateMarket} onClose={() => setShowCreateMarket(false)} onCreate={handleCreateMarket} />
      <BetModal open={betState.open} onClose={() => setBetState({ open: false, market: null, option: null, side: null })}
        market={betState.market} option={betState.option} side={betState.side}
        profile={activeProfile} onConfirm={confirmBet} />
      <ResolveModal open={resolveState.open} onClose={() => setResolveState({ open: false, market: null })}
        market={resolveState.market} onResolve={handleResolve} />
    </div>
  );
}