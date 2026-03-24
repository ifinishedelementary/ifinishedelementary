import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ── Orbital Elements (J2000 epoch) — JPL/Meeus ──
const BODIES = [
  { name: "Sun", color: "#FDB813", radius: 5, orbital: null },
  { name: "Mercury", color: "#B5B5B5", radius: 2.5, orbital: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.25032350, 149472.67411175], wBar: [77.45779628, 0.16047689], Omega: [48.33076593, -0.12534081] } },
  { name: "Venus", color: "#E8CDA0", radius: 3, orbital: { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729], wBar: [131.60246718, 0.00268329], Omega: [76.67984255, -0.27769418] } },
  { name: "Earth", color: "#6B93D6", radius: 3, orbital: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], wBar: [102.93768193, 0.32327364], Omega: [0.0, 0.0] } },
  { name: "Mars", color: "#C1440E", radius: 2.8, orbital: { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131], L: [355.44656895, 19140.30268499], wBar: [336.05637041, 0.44441088], Omega: [49.55953891, -0.29257343] } },
  { name: "Jupiter", color: "#C88B3A", radius: 4, orbital: { a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], wBar: [14.72847983, 0.21252668], Omega: [100.47390909, 0.20469106] } },
  { name: "Saturn", color: "#EAD6B8", radius: 3.8, orbital: { a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], wBar: [92.59887831, -0.41897216], Omega: [113.66242448, -0.28867794] } },
  { name: "Uranus", color: "#73C2C6", radius: 3.4, orbital: { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], wBar: [170.95427630, 0.40805281], Omega: [74.01692503, 0.04240589] } },
  { name: "Neptune", color: "#3F54BA", radius: 3.4, orbital: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372], L: [304.87997031, 218.45945325], wBar: [44.96476227, -0.32241464], Omega: [131.78422574, -0.00508664] } },
  { name: "Pluto", color: "#D2B48C", radius: 2.2, orbital: { a: [39.48211675, -0.00031596], e: [0.24882730, 0.00005170], I: [17.14001206, 0.00004818], L: [238.92903833, 145.20780515], wBar: [224.06891629, -0.04062942], Omega: [110.30393684, -0.01183482] } }
];
const N = BODIES.length;

function pairKey(i, j) { return i < j ? `${i}-${j}` : `${j}-${i}`; }

const ALL_PAIRS = [];
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) ALL_PAIRS.push(pairKey(i, j));

function solveKepler(M, e, tol = 1e-10) {
  let E = M;
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

function computePosition(body, jd) {
  if (!body.orbital) return { x: 0, y: 0 };
  const T = (jd - 2451545.0) / 36525.0;
  const o = body.orbital;
  const a = o.a[0] + o.a[1] * T, e = o.e[0] + o.e[1] * T;
  const I = (o.I[0] + o.I[1] * T) * Math.PI / 180;
  const L = o.L[0] + o.L[1] * T;
  const wBar = o.wBar[0] + o.wBar[1] * T;
  const Omega = (o.Omega[0] + o.Omega[1] * T) * Math.PI / 180;
  const w = (wBar - o.Omega[0] - o.Omega[1] * T) * Math.PI / 180;
  let M = ((L - wBar) % 360 + 360) % 360 * Math.PI / 180;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cosW = Math.cos(w), sinW = Math.sin(w), cosO = Math.cos(Omega), sinO = Math.sin(Omega), cosI = Math.cos(I);
  return {
    x: (cosW * cosO - sinW * sinO * cosI) * xp + (-sinW * cosO - cosW * sinO * cosI) * yp,
    y: (cosW * sinO + sinW * cosO * cosI) * xp + (-sinW * sinO + cosW * cosO * cosI) * yp
  };
}

function dateToJD(date) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24;
  let Y = y, M = m;
  if (M <= 2) { Y--; M += 12; }
  const A = Math.floor(Y / 100);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + 2 - A + Math.floor(A / 4) - 1524.5;
}

function jdToDate(jd) {
  const z = Math.floor(jd + 0.5), f = jd + 0.5 - z;
  let A = z;
  if (z >= 2299161) { const al = Math.floor((z - 1867216.25) / 36524.25); A = z + 1 + al - Math.floor(al / 4); }
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
  const day = B - D - Math.floor(30.6001 * E) + f;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  return new Date(Date.UTC(year, month - 1, Math.floor(day)));
}

export default function SolarSystemGeometry() {
  const canvasRef = useRef(null);
  const [connections, setConnections] = useState(() => new Set());
  const now = useMemo(() => new Date(), []);
  const baseJD = useMemo(() => dateToJD(now), [now]);
  const [dayOffset, setDayOffset] = useState(0);
  const [dateInput, setDateInput] = useState(() => now.toISOString().split("T")[0]);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [animating, setAnimating] = useState(false);
  const animRef = useRef(null);
  const animSpeed = useRef(1);
  const [speedVal, setSpeedVal] = useState(1);

  const currentJD = baseJD + dayOffset;
  const currentDate = jdToDate(currentJD);

  useEffect(() => { setDateInput(currentDate.toISOString().split("T")[0]); }, [dayOffset]);

  const handleDateChange = (val) => {
    setDateInput(val);
    const d = new Date(val + "T12:00:00Z");
    if (!isNaN(d.getTime())) setDayOffset(dateToJD(d) - baseJD);
  };

  const toggleConnection = (i, j) => {
    const key = pairKey(i, j);
    setConnections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAllForBody = (bodyIdx) => {
    setConnections(prev => {
      const next = new Set(prev);
      for (let j = 0; j < N; j++) if (j !== bodyIdx) next.add(pairKey(bodyIdx, j));
      return next;
    });
  };

  const clearAllForBody = (bodyIdx) => {
    setConnections(prev => {
      const next = new Set(prev);
      for (let j = 0; j < N; j++) if (j !== bodyIdx) next.delete(pairKey(bodyIdx, j));
      return next;
    });
  };

  useEffect(() => {
    if (animating) {
      const tick = () => { setDayOffset(d => d + animSpeed.current); animRef.current = requestAnimationFrame(tick); };
      animRef.current = requestAnimationFrame(tick);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [animating]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cx = W / 2 + panOffset.x, cy = H / 2 + panOffset.y;
    const scale = Math.min(W, H) / 100 * zoom;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const gridAU = zoom < 3 ? 10 : zoom < 10 ? 5 : 1;
    for (let r = gridAU; r <= 60; r += gridAU) {
      ctx.beginPath(); ctx.arc(cx, cy, r * scale, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = "10px monospace";
    for (let r = gridAU; r <= 50; r += gridAU) ctx.fillText(r + " AU", cx + r * scale + 3, cy - 3);

    const jd = baseJD + dayOffset;
    const positions = BODIES.map(b => computePosition(b, jd));

    // Orbit paths
    if (showOrbits) {
      BODIES.forEach(body => {
        if (!body.orbital) return;
        ctx.strokeStyle = body.color + "40";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        const T = (jd - 2451545.0) / 36525.0, o = body.orbital;
        const a = o.a[0] + o.a[1] * T, e = o.e[0] + o.e[1] * T;
        const Iv = (o.I[0] + o.I[1] * T) * Math.PI / 180;
        const wBar = o.wBar[0] + o.wBar[1] * T;
        const Omega = (o.Omega[0] + o.Omega[1] * T) * Math.PI / 180;
        const w = (wBar - o.Omega[0] - o.Omega[1] * T) * Math.PI / 180;
        const cosW = Math.cos(w), sinW = Math.sin(w), cosO = Math.cos(Omega), sinO = Math.sin(Omega), cosI = Math.cos(Iv);
        for (let s = 0; s <= 360; s++) {
          const Mv = (s / 360) * 2 * Math.PI, E = solveKepler(Mv, e);
          const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
          const x = (cosW * cosO - sinW * sinO * cosI) * xp + (-sinW * cosO - cosW * sinO * cosI) * yp;
          const y = (cosW * sinO + sinW * cosO * cosI) * xp + (-sinW * sinO + cosW * cosO * cosI) * yp;
          s === 0 ? ctx.moveTo(cx + x * scale, cy - y * scale) : ctx.lineTo(cx + x * scale, cy - y * scale);
        }
        ctx.closePath(); ctx.stroke();
      });
    }

    // Gravity lines — SOLID
    connections.forEach(key => {
      const [ai, bi] = key.split("-").map(Number);
      const pa = positions[ai], pb = positions[bi];
      const ax = cx + pa.x * scale, ay = cy - pa.y * scale;
      const bx = cx + pb.x * scale, by = cy - pb.y * scale;
      const grad = ctx.createLinearGradient(ax, ay, bx, by);
      grad.addColorStop(0, BODIES[ai].color + "CC");
      grad.addColorStop(1, BODIES[bi].color + "CC");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const dist = Math.sqrt((pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "8px monospace";
      ctx.fillText(dist.toFixed(2), (ax + bx) / 2 + 3, (ay + by) / 2 - 3);
    });

    // Bodies
    BODIES.forEach((body, i) => {
      const pos = positions[i];
      const sx = cx + pos.x * scale, sy = cy - pos.y * scale;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, body.radius * 3);
      grad.addColorStop(0, body.color + "60"); grad.addColorStop(1, body.color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, body.radius * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = body.color;
      ctx.beginPath(); ctx.arc(sx, sy, body.radius, 0, Math.PI * 2); ctx.fill();
      let hasConn = false;
      for (let j = 0; j < N; j++) { if (j !== i && connections.has(pairKey(i, j))) { hasConn = true; break; } }
      if (hasConn) {
        ctx.strokeStyle = body.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, sy, body.radius + 4, 0, Math.PI * 2); ctx.stroke();
      }
      if (showLabels) {
        ctx.fillStyle = body.color + "CC"; ctx.font = "bold 10px monospace";
        ctx.fillText(body.name, sx + body.radius + 5, sy + 3);
      }
    });
  }, [dayOffset, connections, zoom, panOffset, showOrbits, showLabels, baseJD]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { const p = canvas.parentElement; canvas.width = p.clientWidth; canvas.height = p.clientHeight; draw(); };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);
  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e) => { isPanning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
  const handleMouseMove = (e) => {
    if (!isPanning.current) return;
    setPanOffset(p => ({ x: p.x + e.clientX - lastMouse.current.x, y: p.y + e.clientY - lastMouse.current.y }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => { isPanning.current = false; };
  const handleWheel = (e) => { e.preventDefault(); setZoom(z => Math.max(0.2, Math.min(80, z * (e.deltaY < 0 ? 1.15 : 0.87)))); };

  const minDay = -200 * 365.25, maxDay = 200 * 365.25;
  const presets = [
    { label: "Inner", zoom: 12 },
    { label: "Full", zoom: 1 },
    { label: "Giants", zoom: 3 },
  ];
  const btnStyle = {
    background: "#1a1a2e", color: "#aaa", border: "1px solid #2a2a3e",
    borderRadius: 3, padding: "1px 5px", cursor: "pointer", fontSize: 8, fontFamily: "inherit"
  };
  const SHORT = ["Sun", "Mer", "Ven", "Ear", "Mar", "Jup", "Sat", "Ura", "Nep", "Plu"];

  return (
    <div style={{
      width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      background: "#0a0a0f", color: "#c8c8d0"
    }}>
      {/* Description */}
      <div style={{
        background: "#0d0d15", borderBottom: "1px solid #1a1a2e",
        padding: "16px 24px", flexShrink: 0
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h1 style={{
            fontSize: 18, fontWeight: 700, color: "#e0e0e8", letterSpacing: 1.5,
            margin: "0 0 10px", textTransform: "uppercase"
          }}>
            Solar System Geometry
          </h1>
          <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.7, color: "#a0a0b0" }}>
            This is a <span style={{ color: "#6B93D6" }}>to-scale</span> model of the solar system showing all nine planetary orbits plus the Sun, computed from real JPL Keplerian orbital elements at the J2000 epoch with secular drift rates. Every orbit is drawn with its actual eccentricity — notice how nearly circular Venus is compared to the elongated ellipses of Mercury and Pluto. Kepler's equation is solved numerically for each body every frame.
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.7, color: "#a0a0b0" }}>
            The <span style={{ color: "#FDB813" }}>gravity line system</span> is what makes this tool unique. Below the viewport, each of the 10 bodies has its own column with 9 checkboxes — one for every other body it can be connected to. Check any pair and a solid line appears between them showing the real-time distance in AU. With all 45 possible connections drawn, you see the complete gravitational geometry of the solar system: every body pulling on every other body, the web of forces that holds it together. Animate forward in time and watch this geometric web breathe — triangles form and dissolve, distances stretch and compress, alignments come and go.
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.7, color: "#a0a0b0" }}>
            The <span style={{ color: "#73C2C6" }}>time controls</span> let you slide ±200 years from today, type a specific date, or animate forward at adjustable speed. The orbital element model is accurate within this range — beyond that, perturbation effects accumulate and the simple Keplerian model diverges from reality.
          </p>
          <p style={{ margin: 0, color: "#666", fontSize: 10, lineHeight: 1.5 }}>
            Scroll to zoom · Drag to pan · Use the view presets to jump between inner system, gas giant, and full system scales. Built for widescreen displays.
          </p>
        </div>
      </div>

      {/* Canvas — fixed height so it doesn't collapse */}
      <div style={{ height: "calc(100vh - 310px)", minHeight: 400, position: "relative", flexShrink: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", cursor: "grab" }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
        />
        <div style={{
          position: "absolute", top: 8, right: 12,
          background: "rgba(10,10,15,0.85)", border: "1px solid #1a1a2e",
          borderRadius: 4, padding: "5px 10px", fontSize: 10, color: "#888"
        }}>
          {currentDate.toISOString().split("T")[0]} &nbsp;|&nbsp; JD {currentJD.toFixed(1)} &nbsp;|&nbsp; {zoom.toFixed(1)}x &nbsp;|&nbsp; {connections.size}/45 lines
        </div>
      </div>

      {/* Bottom Panel */}
      <div style={{
        background: "#101018", borderTop: "1px solid #1a1a2e",
        padding: "5px 8px 6px", flexShrink: 0
      }}>
        {/* Controls row */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5, flexWrap: "nowrap" }}>
          <span style={{ fontSize: 8, color: "#666" }}>DATE</span>
          <input type="date" value={dateInput} onChange={e => handleDateChange(e.target.value)}
            style={{ background: "#14141f", color: "#e0e0e8", border: "1px solid #2a2a3e", borderRadius: 3, padding: "2px 4px", fontSize: 9, fontFamily: "inherit", width: 105 }}
          />
          <input type="range" min={minDay} max={maxDay} value={dayOffset}
            onChange={e => setDayOffset(Number(e.target.value))}
            style={{ width: 180, accentColor: "#6B93D6", flexShrink: 1 }}
          />
          <span style={{ fontSize: 7, color: "#555", whiteSpace: "nowrap" }}>±200yr</span>
          <div style={{ width: 1, height: 14, background: "#2a2a3e", flexShrink: 0 }} />
          <button onClick={() => setAnimating(!animating)} style={{
            background: animating ? "#6B93D6" : "#1a1a2e", color: "#e0e0e8",
            border: "1px solid #2a2a3e", borderRadius: 3, padding: "2px 7px",
            cursor: "pointer", fontSize: 9, fontFamily: "inherit"
          }}>
            {animating ? "■ Stop" : "▶ Play"}
          </button>
          <input type="number" value={speedVal} min={0.1} max={365} step={0.5}
            onChange={e => { const v = parseFloat(e.target.value) || 1; setSpeedVal(v); animSpeed.current = v; }}
            style={{ background: "#14141f", color: "#e0e0e8", border: "1px solid #2a2a3e", borderRadius: 3, padding: "2px 3px", fontSize: 9, width: 38, fontFamily: "inherit" }}
          />
          <span style={{ fontSize: 7, color: "#555" }}>d/f</span>
          <div style={{ width: 1, height: 14, background: "#2a2a3e", flexShrink: 0 }} />
          {presets.map(p => (
            <button key={p.label} onClick={() => { setZoom(p.zoom); setPanOffset({ x: 0, y: 0 }); }} style={btnStyle}>{p.label}</button>
          ))}
          <div style={{ width: 1, height: 14, background: "#2a2a3e", flexShrink: 0 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 2, cursor: "pointer", fontSize: 8, color: "#888" }}>
            <input type="checkbox" checked={showOrbits} onChange={() => setShowOrbits(!showOrbits)} style={{ width: 10, height: 10 }} /> Orbits
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 2, cursor: "pointer", fontSize: 8, color: "#888" }}>
            <input type="checkbox" checked={showLabels} onChange={() => setShowLabels(!showLabels)} style={{ width: 10, height: 10 }} /> Labels
          </label>
          <div style={{ width: 1, height: 14, background: "#2a2a3e", flexShrink: 0 }} />
          <button onClick={() => setConnections(new Set(ALL_PAIRS))} style={{ ...btnStyle, color: "#8a8" }}>All 45</button>
          <button onClick={() => setConnections(new Set())} style={{ ...btnStyle, color: "#a88" }}>Clear</button>
        </div>

        {/* 10-column connection grid */}
        <div style={{ display: "flex", gap: 0 }}>
          {BODIES.map((body, i) => {
            const others = [];
            for (let j = 0; j < N; j++) if (j !== i) others.push(j);
            return (
              <div key={i} style={{
                flex: "1 1 0", minWidth: 0,
                borderRight: i < N - 1 ? "1px solid #1a1a2e" : "none",
                padding: "0 3px"
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 2, marginBottom: 2,
                  borderBottom: `2px solid ${body.color}55`, paddingBottom: 2
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: body.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 8, fontWeight: 700, color: body.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {body.name}
                  </span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 1 }}>
                    <button onClick={() => selectAllForBody(i)} style={{ ...btnStyle, padding: "0 2px", fontSize: 7, lineHeight: "11px" }}>+</button>
                    <button onClick={() => clearAllForBody(i)} style={{ ...btnStyle, padding: "0 2px", fontSize: 7, lineHeight: "11px" }}>−</button>
                  </span>
                </div>
                {others.map(j => {
                  const key = pairKey(i, j);
                  const on = connections.has(key);
                  return (
                    <label key={j} style={{
                      display: "flex", alignItems: "center", gap: 2,
                      padding: "0.5px 0", cursor: "pointer",
                      opacity: on ? 1 : 0.35, fontSize: 8, lineHeight: "13px"
                    }}>
                      <input type="checkbox" checked={on}
                        onChange={() => toggleConnection(i, j)}
                        style={{ accentColor: BODIES[j].color, width: 9, height: 9, margin: 0, flexShrink: 0 }}
                      />
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: BODIES[j].color, flexShrink: 0 }} />
                      <span style={{ whiteSpace: "nowrap" }}>{SHORT[j]}</span>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
