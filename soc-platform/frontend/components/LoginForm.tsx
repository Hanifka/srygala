"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useTypewriter } from "@/lib/useTypewriter";

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
interface CityPoint { lat: number; lon: number; name: string; }
interface Attack {
  src: CityPoint; dst: CityPoint;
  progress: number; speed: number;
  trail: { x: number; y: number }[];
  color: string;
}
interface Pulse { cx: number; cy: number; r: number; maxR: number; alpha: number; color: string; }

/* ══════════════════════════════════════════════
   CONTINENT OUTLINES  (lat/lon polygons, simplified)
   Each array is a closed polygon of [lat, lon] pairs
══════════════════════════════════════════════ */
const CONTINENTS: [number, number][][] = [
  // ── North America (mainland) ──
  [
    [71,-141],[70,-156],[60,-162],[58,-152],[55,-130],[48,-124],[38,-122],
    [30,-117],[22,-106],[18,-96],[16,-88],[14,-86],[12,-84],[10,-84],
    [8,-78],[9,-77],[12,-83],[14,-87],[17,-92],[20,-90],[20,-87],
    [24,-80],[26,-80],[30,-80],[35,-76],[40,-74],[45,-66],[47,-54],
    [50,-56],[53,-56],[58,-62],[60,-64],[63,-68],[65,-72],[68,-78],
    [70,-80],[72,-82],[74,-88],[72,-100],[70,-106],[68,-116],[70,-122],
    [70,-132],[71,-141],
  ],
  // ── Alaska ──
  [
    [60,-146],[58,-152],[55,-162],[58,-166],[60,-166],
    [62,-166],[64,-166],[66,-166],[68,-162],[70,-156],
    [71,-150],[71,-141],[70,-132],[65,-140],[60,-146],
  ],
  // ── Greenland ──
  [
    [76,-70],[72,-54],[68,-52],[64,-52],[60,-44],[64,-42],[68,-34],
    [72,-26],[76,-20],[80,-20],[83,-30],[83,-50],[80,-58],[76,-70],
  ],
  // ── Cuba ──
  [
    [23,-84],[22,-80],[20,-76],[20,-78],[22,-82],[23,-84],
  ],
  // ── Hispaniola ──
  [
    [20,-74],[19,-70],[18,-70],[18,-72],[20,-74],
  ],
  // ── South America ──
  [
    [12,-72],[10,-62],[8,-60],[4,-52],[2,-50],[0,-50],[-5,-35],
    [-10,-37],[-14,-39],[-20,-40],[-23,-43],[-30,-50],[-34,-54],
    [-38,-58],[-42,-62],[-46,-67],[-50,-68],[-54,-68],[-56,-68],
    [-54,-65],[-52,-58],[-46,-52],[-40,-48],[-34,-53],[-28,-49],
    [-22,-42],[-18,-40],[-12,-38],[-6,-35],[-2,-40],[0,-48],
    [4,-52],[6,-58],[8,-62],[12,-72],
  ],
  // ── Europe (mainland) ──
  [
    [36,-6],[38,-4],[40,-2],[42,0],[44,2],[44,8],[46,14],[44,20],
    [46,18],[48,18],[50,14],[52,14],[54,10],[54,18],[56,22],
    [58,22],[60,24],[60,28],[64,26],[68,28],[70,26],[72,22],
    [70,16],[68,14],[64,10],[60,6],[58,2],[56,6],[54,8],
    [52,6],[50,4],[50,2],[48,-2],[46,-2],[44,0],[42,-6],
    [40,-8],[38,-8],[36,-6],
  ],
  // ── Iberian Peninsula ──
  [
    [44,-2],[42,-8],[40,-8],[38,-8],[36,-6],[36,-4],[38,0],
    [40,0],[42,2],[44,0],[44,-2],
  ],
  // ── Italy ──
  [
    [46,12],[44,12],[42,14],[40,16],[38,16],[38,14],[40,12],
    [42,10],[44,8],[46,12],
  ],
  // ── UK ──
  [
    [50,-6],[52,-4],[54,-2],[56,-2],[58,-4],[58,0],[56,2],[54,0],
    [52,2],[51,2],[50,0],[50,-6],
  ],
  // ── Ireland ──
  [
    [52,-10],[54,-10],[54,-6],[52,-6],[52,-10],
  ],
  // ── Iceland ──
  [
    [64,-24],[66,-18],[66,-14],[64,-14],[62,-20],[62,-24],[64,-24],
  ],
  // ── Scandinavia ──
  [
    [58,6],[60,4],[62,4],[64,10],[66,14],[68,14],[70,16],[72,22],
    [70,26],[68,28],[66,22],[64,18],[62,16],[60,18],[58,18],
    [56,14],[56,10],[58,6],
  ],
  // ── Africa ──
  [
    [36,8],[36,12],[32,32],[26,34],[18,38],[12,44],[8,48],[4,40],
    [0,42],[-4,40],[-10,40],[-18,36],[-26,34],[-30,30],[-34,26],
    [-36,18],[-34,18],[-26,16],[-18,12],[-10,14],[-2,8],[4,4],
    [6,2],[4,-6],[4,-8],[6,-4],[10,-4],[14,-18],[18,-16],[22,-16],
    [26,-14],[32,-10],[36,8],
  ],
  // ── Madagascar ──
  [
    [-12,49],[-14,48],[-18,44],[-22,44],[-24,46],[-26,47],
    [-24,48],[-20,50],[-16,50],[-12,49],
  ],
  // ── Turkey / Anatolia ──
  [
    [42,26],[40,26],[38,28],[36,30],[36,36],[38,40],[40,42],
    [42,44],[42,40],[40,36],[40,32],[42,28],[42,26],
  ],
  // ── Arabian Peninsula ──
  [
    [30,36],[28,36],[24,38],[22,40],[18,42],[14,44],[12,44],
    [12,48],[14,52],[16,56],[18,56],[20,58],[22,60],[24,58],
    [26,56],[28,50],[30,48],[32,48],[30,36],
  ],
  // ── Iran / Central Asia ──
  [
    [40,52],[38,56],[36,52],[34,48],[32,48],[30,48],[28,50],
    [26,56],[24,58],[26,62],[28,62],[30,60],[32,60],[34,58],
    [36,56],[38,56],[40,52],
  ],
  // ── Asia (main mass: Central → North → East coast) ──
  [
    [72,22],[68,28],[64,32],[60,30],[56,38],[52,42],[48,46],
    [44,50],[42,52],[40,52],[38,56],[36,56],[34,58],[32,60],
    [30,60],[28,62],[26,64],[24,68],[22,70],[20,72],
    // South Asia - Pakistan / India top
    [28,66],[30,68],[32,72],[34,74],[36,76],[34,78],
    [32,76],[30,80],[28,84],[26,86],
    // Nepal / Himalayan ridge
    [28,84],[30,84],[32,80],[34,78],[36,80],[38,82],
    // China interior
    [40,80],[42,76],[44,80],[46,86],[48,88],[46,92],
    [44,90],[42,96],[40,98],[38,98],[36,100],[34,100],
    [32,100],[30,100],[28,98],[26,100],[24,102],
    // Southeast Asia / Vietnam border
    [22,104],[20,106],[18,106],[16,108],[14,108],[12,108],
    [10,106],[8,106],[6,104],
    // South China coast
    [8,108],[10,110],[14,110],[18,110],[20,110],
    [22,114],[24,118],[26,120],[28,122],
    [30,122],[32,122],[34,120],[36,122],
    // Korea peninsula
    [38,126],[36,128],[34,130],[34,132],
    // North to Kamchatka
    [38,140],[42,140],[46,142],[50,140],[54,136],
    [56,134],[58,130],[60,132],[62,136],[64,140],
    [66,170],[68,180],[68,160],[70,140],[70,120],[70,100],
    [72,80],[74,60],[74,40],[72,22],
  ],
  // ── Indian Subcontinent ──
  [
    [34,74],[32,72],[30,68],[28,66],[26,64],[24,68],[22,70],
    [20,72],[18,72],[16,73],[14,74],[12,74],[10,76],[8,77],
    // Southern tip of India
    [8,78],[6,78],[8,78],
    // East coast going north
    [8,80],[10,80],[12,80],[14,80],[16,80],
    [18,84],[20,88],[22,88],[24,88],
    // Bangladesh
    [22,90],[22,92],[24,92],[26,90],[26,88],
    // Back up through NE India
    [28,90],[28,88],[28,84],[30,80],[32,76],[34,74],
  ],
  // ── Sri Lanka ──
  [
    [10,80],[8,80],[6,80],[6,82],[8,82],[10,80],
  ],
  // ── Myanmar / Thailand / Indochina ──
  [
    [28,96],[26,96],[24,98],[22,100],[20,100],[18,100],
    [16,98],[14,98],[12,100],[10,100],[8,100],[6,100],
    [4,100],[2,102],[1,104],[2,104],[4,104],
    [6,102],[8,100],[10,100],[12,100],[14,100],
    [16,100],[18,102],[20,106],[22,104],
    [24,102],[26,100],[28,98],[28,96],
  ],
  // ── Malay Peninsula ──
  [
    [8,100],[6,100],[4,102],[2,104],[1,104],
    [2,102],[4,100],[6,100],[8,100],
  ],
  // ── Sumatra ──
  [
    [4,98],[2,100],[0,102],[-2,104],[-4,104],[-6,106],
    [-4,102],[-2,100],[0,98],[2,96],[4,98],
  ],
  // ── Borneo ──
  [
    [6,116],[4,118],[2,118],[0,116],[-2,114],[-2,110],
    [0,110],[2,112],[4,114],[6,116],
  ],
  // ── Java ──
  [
    [-6,106],[-6,108],[-7,110],[-8,112],[-8,114],
    [-7,112],[-6,110],[-6,108],[-6,106],
  ],
  // ── Sulawesi (simplified) ──
  [
    [2,122],[0,122],[-2,120],[-4,122],[-6,122],
    [-4,120],[-2,120],[0,120],[2,122],
  ],
  // ── Philippines ──
  [
    [18,120],[16,120],[14,122],[12,124],[10,126],
    [12,124],[14,122],[16,122],[18,122],[18,120],
  ],
  // ── Taiwan ──
  [
    [26,122],[24,120],[22,120],[24,122],[26,122],
  ],
  // ── Japan (Honshu/Shikoku/Kyushu) ──
  [
    [46,142],[44,144],[42,142],[40,140],[36,136],[34,131],[34,130],
    [36,132],[38,140],[42,142],[46,142],
  ],
  // ── Hokkaido ──
  [
    [46,142],[44,144],[42,146],[44,146],[46,144],[46,142],
  ],
  // ── Papua New Guinea ──
  [
    [-2,140],[-4,144],[-6,148],[-8,148],[-8,146],[-6,144],
    [-4,142],[-2,140],
  ],
  // ── Australia ──
  [
    [-14,128],[-16,136],[-18,140],[-22,144],[-26,152],[-28,154],
    [-32,152],[-36,150],[-38,146],[-38,140],[-36,136],[-32,134],
    [-28,126],[-22,114],[-18,122],[-14,128],
  ],
  // ── Tasmania ──
  [
    [-40,146],[-42,146],[-44,148],[-42,148],[-40,146],
  ],
  // ── New Zealand (North Island) ──
  [
    [-34,172],[-36,174],[-38,176],[-40,176],[-38,178],
    [-36,178],[-34,176],[-34,172],
  ],
  // ── New Zealand (South Island) ──
  [
    [-40,172],[-42,172],[-46,168],[-44,168],[-42,170],[-40,172],
  ],
  // ── Kamchatka ──
  [
    [52,158],[54,156],[56,160],[58,162],[60,164],[62,166],
    [60,166],[58,164],[56,162],[54,160],[52,158],
  ],
];

/* ── City nodes ── */
const CITIES: CityPoint[] = [
  { lat: 40.71,  lon: -74.01, name: "New York" },
  { lat: 51.51,  lon:  -0.13, name: "London" },
  { lat: 48.85,  lon:   2.35, name: "Paris" },
  { lat: 52.52,  lon:  13.40, name: "Berlin" },
  { lat: 55.75,  lon:  37.62, name: "Moscow" },
  { lat: 39.91,  lon: 116.39, name: "Beijing" },
  { lat: 35.68,  lon: 139.69, name: "Tokyo" },
  { lat: 28.61,  lon:  77.21, name: "Delhi" },
  { lat: -33.87, lon: 151.21, name: "Sydney" },
  { lat: -23.55, lon: -46.63, name: "São Paulo" },
  { lat: 19.43,  lon: -99.13, name: "Mexico City" },
  { lat: 37.77,  lon:-122.42, name: "San Francisco" },
  { lat: 41.88,  lon: -87.63, name: "Chicago" },
  { lat: 1.35,   lon: 103.82, name: "Singapore" },
  { lat: 25.20,  lon:  55.27, name: "Dubai" },
  { lat: 30.04,  lon:  31.24, name: "Cairo" },
  { lat: -26.20, lon:  28.04, name: "Johannesburg" },
  { lat: 59.33,  lon:  18.06, name: "Stockholm" },
  { lat: 37.57,  lon: 126.98, name: "Seoul" },
  { lat: 22.33,  lon: 114.17, name: "Hong Kong" },
  { lat: 43.65,  lon: -79.38, name: "Toronto" },
  { lat: 31.23,  lon: 121.47, name: "Shanghai" },
  { lat: 55.75,  lon:  37.62, name: "Moscow" },
  { lat: -33.87, lon:  18.42, name: "Cape Town" },
  { lat: 6.52,   lon:   3.38, name: "Lagos" },
  { lat: 19.08,  lon:  72.88, name: "Mumbai" },
  { lat: 13.08,  lon:  80.27, name: "Chennai" },
  { lat: 23.81,  lon:  90.41, name: "Dhaka" },
  { lat: 13.76,  lon: 100.50, name: "Bangkok" },
  { lat: 21.03,  lon: 105.85, name: "Hanoi" },
  { lat: 14.60,  lon: 120.98, name: "Manila" },
  { lat: -6.21,  lon: 106.85, name: "Jakarta" },
  { lat: 3.14,   lon: 101.69, name: "Kuala Lumpur" },
  { lat: 27.72,  lon:  85.32, name: "Kathmandu" },
  { lat: 33.69,  lon:  73.04, name: "Islamabad" },
  { lat: 24.47,  lon:  54.37, name: "Abu Dhabi" },
  { lat: 41.01,  lon:  28.98, name: "Istanbul" },
  { lat: 35.69,  lon:  51.39, name: "Tehran" },
];

const ATTACK_COLORS = ["#ff2244", "#ff4422", "#ff6600", "#ff0088", "#00ddff", "#ffcc00", "#ff3300"];

/* ── Orthographic projection ── */
function project(
  lat: number, lon: number,
  cx: number, cy: number, rx: number, ry: number,
  rotY: number
): { x: number; y: number; z: number; visible: boolean } {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  const x0 = Math.cos(φ) * Math.cos(λ);
  const y0 = Math.sin(φ);
  const z0 = Math.cos(φ) * Math.sin(λ);

  const cr = Math.cos(rotY), sr = Math.sin(rotY);
  const xr = x0 * cr - z0 * sr;
  const yr = y0;
  const zr = x0 * sr + z0 * cr;

  const tilt = 0.22;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const yr2 = yr * ct - zr * st;
  const zr2 = yr * st + zr * ct;

  return { x: cx + xr * rx, y: cy - yr2 * ry, z: zr2, visible: zr2 > -0.08 };
}

function hexAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/* ══════════════════════════════════════════════
   GLOBE CANVAS
══════════════════════════════════════════════ */
function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width  = r.width  * dpr;
      canvas.height = r.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const attacks: Attack[] = [];
    const pulses: Pulse[]   = [];
    let rotY = 0;
    let t    = 0;

    /* ── Spawn a random attack ── */
    const spawnAttack = () => {
      const si = Math.floor(Math.random() * CITIES.length);
      let di   = Math.floor(Math.random() * CITIES.length);
      while (di === si) di = Math.floor(Math.random() * CITIES.length);
      attacks.push({
        src: CITIES[si], dst: CITIES[di],
        progress: 0,
        speed: 0.0028 + Math.random() * 0.0038,
        trail: [],
        color: ATTACK_COLORS[Math.floor(Math.random() * ATTACK_COLORS.length)],
      });
    };

    for (let i = 0; i < 5; i++) setTimeout(spawnAttack, i * 600);
    const spawnTimer = setInterval(() => { if (attacks.length < 10) spawnAttack(); }, 1000);

    /* ── Grid ── */
    const LAT_LINES = [-60,-45,-30,-15,0,15,30,45,60];

    /* ── Draw a continent polygon ── */
    const drawContinent = (poly: [number,number][], cx: number, cy: number, rx: number, ry: number) => {
      ctx.beginPath();
      let penDown = false;
      let prevVisible = false;
      for (let i = 0; i <= poly.length; i++) {
        const [lat, lon] = poly[i % poly.length];
        const p = project(lat, lon, cx, cy, rx, ry, rotY);
        if (p.visible) {
          if (!penDown || !prevVisible) { ctx.moveTo(p.x, p.y); penDown = true; }
          else ctx.lineTo(p.x, p.y);
        }
        prevVisible = p.visible;
      }
      ctx.closePath();
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      ctx.clearRect(0, 0, W, H);
      t    += 0.007;
      rotY += 0.0013;

      const cx = W * 0.5;
      const cy = H * 0.5;
      const rB = Math.min(W, H) * 0.41;
      const rx = rB;
      const ry = rB * 0.95;

      /* ── Globe base ── */
      const gFill = ctx.createRadialGradient(cx - rx*0.2, cy - ry*0.25, 0, cx, cy, rB * 1.02);
      gFill.addColorStop(0,   "rgba(0,22,42,0.90)");
      gFill.addColorStop(0.65,"rgba(0,10,22,0.95)");
      gFill.addColorStop(1,   "rgba(0,180,216,0.04)");
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = gFill;
      ctx.fill();

      /* ── Atmosphere glow ── */
      const atmo = ctx.createRadialGradient(cx, cy, rB * 0.84, cx, cy, rB * 1.30);
      atmo.addColorStop(0,    "rgba(0,180,216,0.14)");
      atmo.addColorStop(0.4,  "rgba(0,180,216,0.06)");
      atmo.addColorStop(1,    "rgba(0,180,216,0)");
      ctx.beginPath();
      ctx.ellipse(cx, cy, rB * 1.30, rB * 1.20, 0, 0, Math.PI * 2);
      ctx.fillStyle = atmo;
      ctx.fill();

      /* ── Lat/Lon grid (very faint) ── */
      LAT_LINES.forEach((lat) => {
        ctx.beginPath();
        let first = true;
        for (let lon = -180; lon <= 180; lon += 3) {
          const p = project(lat, lon, cx, cy, rx, ry, rotY);
          if (!p.visible) { first = true; continue; }
          first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          first = false;
        }
        ctx.strokeStyle = lat === 0 ? "rgba(0,180,216,0.12)" : "rgba(0,180,216,0.04)";
        ctx.lineWidth   = lat === 0 ? 0.7 : 0.3;
        ctx.stroke();
      });
      for (let li = 0; li < 24; li++) {
        const lon = -180 + li * 15;
        ctx.beginPath();
        let first = true;
        for (let lat = -90; lat <= 90; lat += 3) {
          const p = project(lat, lon, cx, cy, rx, ry, rotY);
          if (!p.visible) { first = true; continue; }
          first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          first = false;
        }
        ctx.strokeStyle = "rgba(0,180,216,0.04)";
        ctx.lineWidth   = 0.3;
        ctx.stroke();
      }

      /* ── Continents filled ── */
      CONTINENTS.forEach((poly) => {
        drawContinent(poly, cx, cy, rx, ry);
        // Fill (ocean-contrast land colour)
        ctx.fillStyle   = "rgba(0,55,80,0.55)";
        ctx.fill();
        // Outline
        ctx.strokeStyle = "rgba(0,200,230,0.30)";
        ctx.lineWidth   = 0.8;
        ctx.stroke();
      });

      /* ── Globe border ── */
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,180,216,0.30)";
      ctx.lineWidth   = 1.4;
      ctx.stroke();

      /* ── Specular highlight ── */
      const spec = ctx.createRadialGradient(cx - rx*0.38, cy - ry*0.44, 0, cx - rx*0.18, cy - ry*0.18, rx*0.54);
      spec.addColorStop(0,   "rgba(255,255,255,0.08)");
      spec.addColorStop(0.55,"rgba(255,255,255,0.02)");
      spec.addColorStop(1,   "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();

      /* ── City dots ── */
      CITIES.forEach((city) => {
        const p = project(city.lat, city.lon, cx, cy, rx, ry, rotY);
        if (!p.visible) return;
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * 2 + city.lat * 0.1));
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,220,255,${0.08 * pulse})`; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,230,255,${0.7 * pulse})`; ctx.fill();
      });

      /* ── Attack arcs ── */
      for (let i = attacks.length - 1; i >= 0; i--) {
        const atk = attacks[i];
        atk.progress += atk.speed;
        const pg = Math.min(atk.progress, 1);

        const sp = project(atk.src.lat, atk.src.lon, cx, cy, rx, ry, rotY);
        const dp = project(atk.dst.lat, atk.dst.lon, cx, cy, rx, ry, rotY);

        const mx    = (sp.x + dp.x) / 2;
        const my    = (sp.y + dp.y) / 2;
        const dist  = Math.hypot(dp.x - sp.x, dp.y - sp.y);
        const lift  = -Math.min(dist * 0.52, rB * 0.6);
        const ctrlX = mx;
        const ctrlY = my + lift;

        const bx = (1-pg)*(1-pg)*sp.x + 2*(1-pg)*pg*ctrlX + pg*pg*dp.x;
        const by = (1-pg)*(1-pg)*sp.y + 2*(1-pg)*pg*ctrlY + pg*pg*dp.y;

        atk.trail.push({ x: bx, y: by });
        if (atk.trail.length > 50) atk.trail.shift();

        /* Ghost arc */
        if (sp.visible || dp.visible) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.quadraticCurveTo(ctrlX, ctrlY, dp.x, dp.y);
          ctx.setLineDash([3, 7]);
          ctx.strokeStyle = hexAlpha(atk.color, 0.08);
          ctx.lineWidth   = 0.6;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        /* Trail */
        for (let j = 1; j < atk.trail.length; j++) {
          const a = j / atk.trail.length;
          ctx.beginPath();
          ctx.moveTo(atk.trail[j-1].x, atk.trail[j-1].y);
          ctx.lineTo(atk.trail[j].x,   atk.trail[j].y);
          ctx.strokeStyle = hexAlpha(atk.color, a * 0.92);
          ctx.lineWidth   = 1.6 * a;
          ctx.stroke();
        }

        /* Head glow */
        ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(atk.color, 0.15); ctx.fill();
        /* Head core */
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = atk.color; ctx.fill();

        /* Source pulse ring */
        if (sp.visible) {
          const sr2 = 3 + 3 * Math.abs(Math.sin(t * 4 + i));
          ctx.beginPath(); ctx.arc(sp.x, sp.y, sr2, 0, Math.PI * 2);
          ctx.strokeStyle = hexAlpha(atk.color, 0.4);
          ctx.lineWidth = 1.2; ctx.stroke();
        }

        /* Impact */
        if (atk.progress >= 1) {
          if (dp.visible) {
            for (let k = 0; k < 4; k++) {
              pulses.push({ cx: dp.x, cy: dp.y, r: 2, maxR: 20 + k * 10, alpha: 1.0, color: atk.color });
            }
          }
          attacks.splice(i, 1);
        }
      }

      /* ── Impact pulses ── */
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.r += 0.6; p.alpha -= 0.019;
        if (p.alpha <= 0 || p.r > p.maxR) { pulses.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = hexAlpha(p.color, p.alpha);
        ctx.lineWidth = 1.5; ctx.stroke();
      }

      /* ── Scan line ── */
      const sy = ((t * 25) % (H + 60)) - 30;
      const sg = ctx.createLinearGradient(0, sy - 20, 0, sy + 20);
      sg.addColorStop(0,   "rgba(0,180,216,0)");
      sg.addColorStop(0.5, "rgba(0,180,216,0.022)");
      sg.addColorStop(1,   "rgba(0,180,216,0)");
      ctx.fillStyle = sg; ctx.fillRect(0, sy - 20, W, 40);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
      clearInterval(spawnTimer);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

/* ─── Hex Grid overlay ─── */
function HexGrid() {
  const coords: [number, number][] = [
    [60,0],[180,0],[300,0],[420,0],
    [0,138],[120,138],[240,138],[360,138],[480,138],
    [60,276],[180,276],[300,276],[420,276],
    [0,414],[120,414],[240,414],[360,414],[480,414],
  ];
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.018]"
      viewBox="0 0 480 560" preserveAspectRatio="xMidYMid slice">
      {coords.map(([x, y], i) => (
        <polygon key={i}
          points={`${x+60},${y+34} ${x+120},${y+68} ${x+120},${y+138} ${x+60},${y+172} ${x},${y+138} ${x},${y+68}`}
          fill="none" stroke="#00b4d8" strokeWidth="0.5" />
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { displayed: soc, showCursor } = useTypewriter(["SryGala", "SOC"], {
    delay: 1200, typeSpeed: 120, deleteSpeed: 70,
    pauseAfterType: 2000, pauseAfterDelete: 500,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError("Please enter both fields"); return; }
    setLoading(true); setError("");
    const ok = await login(username, password);
    if (!ok) setError("Invalid credentials or cannot connect");
    setLoading(false);
  };

  return (
    <div className="h-screen flex bg-[#080c12] overflow-hidden min-w-0">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ══ LEFT: Login Form ══ */}
      <div
        style={{ width: "420px", minWidth: "420px", background: "#080c12" }}
        className="flex items-center justify-center flex-shrink-0 px-12 relative z-10 h-full"
      >
        <div className="absolute right-0 top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-[rgba(0,180,216,0.18)] to-transparent" />
        <div className="w-full">
          <p className="font-mono text-[9px] tracking-[4px] uppercase text-[rgba(0,180,216,0.45)] mb-1.5">Welcome back</p>
          <h2 className="text-[22px] font-bold text-white/90 tracking-tight leading-tight mb-1">
            Sign in to your<br />account
          </h2>
          <p className="text-[12px] text-white/[0.28] mb-7">Access the security operations center</p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Username */}
            <div>
              <label className="font-mono text-[9px] tracking-[2.5px] uppercase text-white/30 block mb-1.5">Username</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20"
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <circle cx="8" cy="5" r="3"/><path d="M2,15 Q2,10 8,10 Q14,10 14,15"/>
                </svg>
                <input
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin" autoFocus
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg py-2.5 pl-9 pr-4 font-mono text-[13px] text-white/75 placeholder-white/[0.18] outline-none transition-all duration-200 focus:border-[rgba(0,180,216,0.35)] focus:bg-white/[0.06] hover:border-white/[0.13]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-mono text-[9px] tracking-[2.5px] uppercase text-white/30">Password</label>
                <button type="button" className="font-mono text-[9px] tracking-[1px] text-[rgba(0,180,216,0.4)] hover:text-[rgba(0,180,216,0.7)] transition-colors">Forgot?</button>
              </div>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20"
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <rect x="3" y="7" width="10" height="8" rx="2"/><path d="M5,7 V5 Q5,2 8,2 Q11,2 11,5 V7"/>
                </svg>
                <input
                  type={showPass ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg py-2.5 pl-9 pr-10 font-mono text-[13px] text-white/75 placeholder-white/[0.18] outline-none transition-all duration-200 focus:border-[rgba(0,180,216,0.35)] focus:bg-white/[0.06] hover:border-white/[0.13]"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/45 transition-colors">
                  <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                    {showPass
                      ? (<><path d="M1,8 Q4,3 8,3 Q12,3 15,8 Q12,13 8,13 Q4,13 1,8"/><circle cx="8" cy="8" r="2.5"/></>)
                      : (<><path d="M1,8 Q4,3 8,3 Q12,3 15,8 Q12,13 8,13 Q4,13 1,8"/><circle cx="8" cy="8" r="2.5"/><line x1="3" y1="14" x2="13" y2="2"/></>)}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-400/90 text-[11px] text-center bg-red-500/[0.07] border border-red-500/[0.15] rounded-lg py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full mt-1 py-[11px] rounded-lg font-mono text-[11px] font-medium tracking-[2.5px] uppercase text-[#080c12] disabled:opacity-50 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #00b4d8, #06d6a0)", boxShadow: "0 4px 24px rgba(0,180,216,0.22)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
                  </svg>
                  Authenticating…
                </span>
              ) : "Login"}
            </button>
          </form>

          <p className="font-mono text-center mt-5 text-[8px] text-white/[0.12] tracking-[3px] uppercase">
            SIEM · XDR · Threat Detection
          </p>
        </div>
      </div>

      {/* ══ RIGHT: Globe Panel ══ */}
      <div
        style={{ flex: 1, minWidth: 0, background: "#040710" }}
        className="relative overflow-hidden flex items-center justify-center h-full"
      >
        <HexGrid />
        <GlobeCanvas />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 28%, rgba(4,7,16,0.75) 100%)" }} />

        {/* Corner brackets */}
        <div className="absolute top-3.5 left-3.5 w-[22px] h-[22px] border-t border-l border-[rgba(0,180,216,0.3)]" />
        <div className="absolute top-3.5 right-3.5 w-[22px] h-[22px] border-t border-r border-[rgba(0,180,216,0.3)]" />
        <div className="absolute bottom-3.5 left-3.5 w-[22px] h-[22px] border-b border-l border-[rgba(0,180,216,0.3)]" />
        <div className="absolute bottom-3.5 right-3.5 w-[22px] h-[22px] border-b border-r border-[rgba(0,180,216,0.3)]" />

        {/* Top bar */}
        <div className="absolute top-5 left-10 right-10 flex items-center justify-between">
          <span className="font-mono text-[8px] tracking-[3px] uppercase text-[rgba(0,180,216,0.25)]">SryGala · v2.4.1</span>
          <span className="font-mono text-[7px] tracking-[2px] uppercase text-[rgba(255,34,68,0.55)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500/70 animate-pulse inline-block" />
          </span>
        </div>

        {/* Brand center */}
        <div className="relative z-10 text-center px-8 pointer-events-none">
          <div className="relative mx-auto mb-6" style={{ width: 120, height: 120 }}>
            <div className="absolute rounded-full border border-dashed border-[rgba(0,180,216,0.15)]"
              style={{ inset: "-20px", animation: "spin 20s linear infinite" }} />
            <div className="absolute inset-[-8px] rounded-3xl border border-[rgba(0,180,216,0.08)]" />
            <div className="w-full h-full rounded-[24px] border border-[rgba(0,180,216,0.18)] bg-[rgba(0,0,0,0.55)] flex items-center justify-center backdrop-blur-md">
              <Image src="/logo.png" alt="SryGala SOC" width={96} height={96} className="rounded-2xl" />
            </div>
          </div>

          <h1 className="text-[26px] font-extrabold tracking-tight text-white/90 leading-none mb-7">
            <span className="text-[#00b4d8]">{soc}</span>
            {showCursor && <span className="animate-pulse text-[#00b4d8]">|</span>}
          </h1>

          <div className="flex items-center justify-center gap-5">
            {["SIEM", "XDR", "EDR"].map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="block w-[5px] h-[5px] rounded-full bg-emerald-400/70 animate-pulse"
                  style={{ animationDelay: `${i * 0.6}s` }} />
                <span className="font-mono text-[8px] tracking-[2px] uppercase text-white/[0.22]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-[rgba(0,180,216,0.18)] to-transparent" />
      </div>
    </div>
  );
}
