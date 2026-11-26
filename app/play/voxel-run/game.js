"use client";
// Voxel parkour runner. The course is procedural (lib/game/track.js), the
// physics is fixed-timestep and pure (lib/game/physics.js), and everything you
// see is boxes — so the game ships with no art assets and no licensing.
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { buildTrack, segBox, LANE, PLAT_H } from "../../../lib/game/track.js";
import { newPlayer, step, CFG, progressOf } from "../../../lib/game/physics.js";
import { seedFromDate } from "../../../lib/game/rng.js";

import Ads, { useInterstitial } from "./ads.js";

const STORE = "vr.v1";

function loadBest() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || "{}");
    return { best: Number(v.best) || Infinity, runs: Number(v.runs) || 0 };
  } catch {
    return { best: Infinity, runs: 0 };
  }
}
function saveBest(best, runs) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ best: best === Infinity ? null : best, runs }));
  } catch {}
}

// Today's board. A finish posts the time automatically; the name is optional and
// remembered, so the first run costs nothing and the second one is competitive.
function Board({ board, name, setName, daily }) {
  if (!daily && !board.length) return null;
  return (
    <div className="board">
      <div className="board-head">
        <span>{daily ? "Today's fastest" : "Fastest on this course"}</span>
        <input
          className="board-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 14))}
          placeholder="your name"
          aria-label="Name for the leaderboard"
        />
      </div>
      {board.length === 0 ? (
        <p className="board-empty">Nobody has finished this course yet. Be first.</p>
      ) : (
        <ol className="board-list">
          {board.slice(0, 5).map((r) => (
            <li key={r.rank}>
              <span className="board-rank">{r.rank}</span>
              <span className="board-name-cell">{r.name}</span>
              <span className="board-time">{r.time.toFixed(2)}s</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function Game() {
  const mountRef = useRef(null);
  const [phase, setPhase] = useState("intro");   // intro | run | dead | won
  const [hud, setHud] = useState({ time: 0, prog: 0, pct: 0, lives: 3, best: Infinity, runs: 0, coins: 0 });
  const [seed, setSeed] = useState(() => seedFromDate());
  const [daily, setDaily] = useState(true);
  const [isTouch, setIsTouch] = useState(false);
  const api = useRef({});
  const interstitial = useRef(() => false);
  const [board, setBoard] = useState([]);
  const [name, setName] = useState("");
  const playerName = useRef("");
  playerName.current = name;
  const phaseRef = useRef("intro");
  phaseRef.current = phase;

  useEffect(() => {
    const saved = loadBest();
    setHud((h) => ({ ...h, best: saved.best, runs: saved.runs }));
  }, []);

  // ------------------------------------------------------------------ setup
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xb3cfe8, 0.0125);

    // sky gradient as a big inverted sphere — cheap, and it gives the course depth
    const skyGeo = new THREE.SphereGeometry(400, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x2f6fb0) },
        mid: { value: new THREE.Color(0x9fc6e8) },
        bot: { value: new THREE.Color(0xe4d9c4) },
      },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;" +
        "void main(){ float h = clamp(vP.y/400.0*0.5+0.5, 0.0, 1.0);" +
        " vec3 c = h > 0.52 ? mix(mid, top, (h-0.52)/0.48) : mix(bot, mid, h/0.52);" +
        " gl_FragColor = vec4(c, 1.0); }",
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    const camera = new THREE.PerspectiveCamera(76, mount.clientWidth / mount.clientHeight, 0.1, 600);

    // --- light: warm sun from the side, cool sky fill ---
    scene.add(new THREE.HemisphereLight(0xdcecff, 0x4a6a55, 1.0));
    const sun = new THREE.DirectionalLight(0xfff0cf, 2.0);
    sun.position.set(-30, 50, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    const sc = sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    scene.add(sun.target);

    // --- reusable geometry: every platform is the same unit box, scaled ---
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const mats = {
      start: new THREE.MeshStandardMaterial({ color: 0xa8bfd6, roughness: 0.95 }),
      plat: new THREE.MeshStandardMaterial({ color: 0x9ee0b4, roughness: 0.9 }),
      finish: new THREE.MeshStandardMaterial({ color: 0xffcf5c, roughness: 0.5, emissive: 0x4a3300 }),
      move: new THREE.MeshStandardMaterial({ color: 0x7fb0ff, roughness: 0.6, emissive: 0x0a2340 }),
      crumble: new THREE.MeshStandardMaterial({ color: 0xd9a06a, roughness: 0.95 }),
      crumbleHot: new THREE.MeshStandardMaterial({ color: 0xff8f5c, roughness: 0.9, emissive: 0x5a2200, emissiveIntensity: 0.8 }),
      lava: new THREE.MeshStandardMaterial({ color: 0xff7a5c, roughness: 0.55, emissive: 0x5a1400 }),
      alt: new THREE.MeshStandardMaterial({ color: 0xb6ecc9, roughness: 0.9 }),
    };
    // a darker "dirt" material for the block below each platform top
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5d8f6f, roughness: 1 });

    // --- decorative island geometry (clouds + far mountains), free parallax ---
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeaf5, emissiveIntensity: 0.65, roughness: 1, transparent: true, opacity: 0.85 });
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const clouds = new THREE.Group();
    for (let i = 0; i < 46; i++) {
      const c = new THREE.Mesh(cloudGeo, cloudMat);
      const s2 = 5 + Math.random() * 12;
      const side = Math.random() < 0.5 ? -1 : 1;
      c.position.set(side * (18 + Math.random() * 130), 22 + Math.random() * 30, -20 - Math.random() * 300);
      c.scale.set(s2 * (1 + Math.random()), s2 * 0.42, s2);
      clouds.add(c);
    }
    scene.add(clouds);

    const hillMat = new THREE.MeshStandardMaterial({ color: 0x69879b, roughness: 1 });
    const hills = new THREE.Group();
    for (let i = 0; i < 34; i++) {
      const hgt = 12 + Math.random() * 26;
      const h = new THREE.Mesh(unitBox, hillMat);
      const side = Math.random() < 0.5 ? -1 : 1;
      h.position.set(side * (210 + Math.random() * 200), hgt / 2 - 62, 0 - Math.random() * 520);
      h.scale.set(42 + Math.random() * 55, hgt, 42 + Math.random() * 55);
      hills.add(h);
    }
    scene.add(hills);

    // --- world ---
    let world = null;          // { segs, meshes, group }
    let player = null;
    let state = { lives: 3, coins: 0, time: 0, running: false, won: false, crumbled: new Map() };
    const keys = new Set();
    let jumpQueued = false;
    let pointerLocked = false;
    const isTouch = "ontouchstart" in window;
    setIsTouch(isTouch);
    const touch = { fwd: 0, strafe: 0, sprint: false, jump: false };

    function clearWorld() {
      if (!world) return;
      scene.remove(world.group);
      world.meshes.forEach((m) => { m.geometry.dispose?.(); });
      world = null;
    }

    function buildWorld(useSeed) {
      clearWorld();
      const segs = buildTrack(useSeed);
      const group = new THREE.Group();
      scene.add(group);

      const meshes = segs.map((s) => {
        const m = new THREE.Mesh(unitBox, mats[s.alt ? "alt" : s.kind] || mats.plat);
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.seg = s;
        group.add(m);
        // a tapered dirt block under the top so platforms read as solid ground
        if (s.kind !== "lava") {
          const skirt = new THREE.Mesh(unitBox, dirtMat);
          const depth = s.kind === "start" || s.kind === "finish" ? 1.2 : 0.7;
          skirt.scale.set(s.w * 0.94, depth, s.d * 0.94);
          skirt.position.set(0, -PLAT_H / 2 - depth / 2, 0);
          skirt.castShadow = true;
          m.add(skirt);
        }
        return m;
      });
      world = { segs, group, meshes, useSeed };
      state.crumbled = new Map();

      // start line banner
      const bannerMat = new THREE.MeshStandardMaterial({ color: 0x12263a, emissive: 0x0a6f4f, emissiveIntensity: 0.5 });
      for (const px of [-2.2, 2.2]) {
        const post = new THREE.Mesh(unitBox, dirtMat);
        post.scale.set(0.22, 3.4, 0.22);
        post.position.set(px, 1.7, segs[0].z + segs[0].d / 2 - 0.3);
        post.castShadow = true;
        group.add(post);
      }
      const banner = new THREE.Mesh(unitBox, bannerMat);
      banner.scale.set(4.6, 0.7, 0.16);
      banner.position.set(0, 3.4, segs[0].z + segs[0].d / 2 - 0.3);
      group.add(banner);

      player = newPlayer(segs);
      console.log("BUILT", segs.length); window.__p = player; window.__w = world;
      state.time = 0;
      state.won = false;
      syncMeshes(0);
    }

    function syncMeshes(t) {
      if (!world) return;
      for (const m of world.meshes) {
        const s = m.userData.seg;
        const b = segBox(s, t);
        const due = state.crumbled.get(s);
        const gone = due !== undefined && due < t;
        m.visible = !gone;
        let jx = 0, jy = 0;
        if (due !== undefined && !gone) {
          // warning shake in the last half second before it falls
          const left = due - t;
          if (left < 0.55) {
            const k = (0.55 - left) * 34;
            jx = Math.sin(t * 62) * 0.05 * k * 0.6;
            jy = Math.cos(t * 51) * 0.02 * k * 0.6;
            m.material = mats.crumbleHot;
          }
        } else if (m.material === mats.crumbleHot) m.material = mats.crumble;
        m.position.set(b.x + jx, b.top - PLAT_H / 2 + jy, b.z);
        m.scale.set(b.w, PLAT_H, b.d);
      }
    }

    // ---------------------------------------------------------------- input
    const onKey = (e, down) => {
      const k = e.code;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(k)) e.preventDefault();
      if (down) keys.add(k); else keys.delete(k);
      if (down && (k === "Space" || k === "KeyW" || k === "ArrowUp")) jumpQueued = true;
      if (down && k === "KeyR") restart(false);
      if (down && (k === "Escape" || k === "KeyP")) pause();
    };
    const kd = (e) => onKey(e, true);
    const ku = (e) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    // mouse look
    const onMouse = (e) => {
      if (phaseRef.current !== "run") return;
      player && (player.yaw -= e.movementX * 0.0022);
      if (player) player.pitch = Math.max(-0.5, Math.min(0.5, player.pitch - e.movementY * 0.0018));
    };
    const onClick = () => {
      if (phaseRef.current === "run" && !isTouch) {
        if (document.pointerLockElement !== renderer.domElement) {
          renderer.domElement.requestPointerLock?.();
        } else {
          jumpQueued = true;
        }
      }
    };
    document.addEventListener("mousemove", onMouse);
    renderer.domElement.addEventListener("click", onClick);

    // ------------------------------------------------------------- gameplay
    function restart(label = true) {
      if (label) { api.current.reset?.(); }
      buildWorld(seed);
      setPhase("run");
      if (!isTouch) beat();
    }

    function beat() {
      renderer.domElement.requestPointerLock?.();
    }

    function die() {
      state.lives -= 1;
      if (state.lives <= 0) {
        finishRun(false);
      } else {
        // respawn at the last safe platform with momentum cleared
        const segs = world.segs;
        const idx = Math.max(0, Math.min(segs.length - 1, player.seg));
        player.x = segs[idx].lane * LANE;
        player.y = segs[idx].y + 0.4;
        player.z = segs[idx].z;
        player.vx = player.vy = player.vz = 0;
        player.alive = true;
        state.time = Math.max(0, state.time - 3);
      }
      setHud((h) => ({ ...h, lives: Math.max(0, state.lives) }));
    }

    function revive() {
      state.lives = 3;
      const segs = world.segs;
      const idx = Math.max(0, Math.min(segs.length - 1, player.seg));
      const s = segs[idx];
      player.x = s.lane * LANE;
      player.y = s.y + 0.35;
      player.z = s.z;
      player.vx = player.vy = player.vz = 0;
      player.alive = true;
      player.onGround = true;
      setHud((h) => ({ ...h, lives: 3 }));
      jumpQueued = false;
    }

    function finishRun(won) {
      state.running = false;
      state.won = won;
      phaseRef.current = won ? "won" : "dead";
      setPhase(won ? "won" : "dead");
      document.exitPointerLock?.();
      const saved = loadBest();
      const best = won ? Math.min(saved.best, state.time) : saved.best;
      saveBest(best, saved.runs + 1);
      setHud((h) => ({ ...h, best, runs: saved.runs + 1, pct: state.lives > 0 ? h.pct : h.pct }));
      api.current.gameover?.({ won, time: state.time, seed });
      if (won) submitScore(state.time, true);
      if (!won) setTimeout(() => interstitial.current(), 650);
    }

    let acc = 0;
    let bob = 0;

    // first platform strictly ahead of the player
    function nextSegIndex(segs, p) {
      for (let i = p.seg; i < segs.length; i++) {
        if (segs[i].z + segs[i].d / 2 < p.z) return i;
      }
      return -1;
    }
    // One fixed-step updater. Called from the rAF loop below.
    function update(dtReal) {
      if (!world || !player) return;
      // keyboard + touch into one intent. Jump is edge-triggered: holding Space
      // must not bunny-hop, or the whole course blurs past.
      const fwd = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) || touch.fwd;
      const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) || touch.strafe;
      const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.sprint;
      const wantJump = jumpQueued || touch.jump;
      jumpQueued = false;

      // Fixed-timestep accumulator. Physics must advance in exact CFG.step
      // slices or jump arcs drift with frame rate; the cap only guards a stall.
      acc = Math.min(acc + dtReal, 0.25);
      let first = true;
      while (acc >= CFG.step) {
        acc -= CFG.step;
        step(player, { fwd, strafe, jump: wantJump && first, sprint }, world.segs, state.time);
        first = false;
        state.time += CFG.step;

        // crumble timers
        if (player.onGround && world.segs[player.seg]?.kind === "crumble") {
          const s = world.segs[player.seg];
          if (!state.crumbled.has(s)) state.crumbled.set(s, state.time + (s.fuse || 0.42));
        }

        if (!player.alive) { die(); break; }
        if (player.seg === world.segs.length - 1 && player.onGround) { finishRun(true); break; }
      }
      syncMeshes(state.time);

      // Gentle aim assist: with no lateral input held, ease the yaw toward the
      // middle of the next platform. Casual players steer with the mouse; this
      // keeps the course honest for phone play and stops a stray lane shuffle
      // from feeling like a bug.
      if (!strafe && fwd > 0) {
        const ahead = nextSegIndex(world.segs, player);
        if (ahead > 0) {
          const s2 = world.segs[ahead];
          const tx = s2.lane * LANE - player.x;
          const tz = s2.z - player.z;
          const want = Math.atan2(-tx, -tz);
          let d = ((want - player.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          player.yaw += d * Math.min(1, dtReal * 2.4);
        }
      }

      // camera follows the eye, with a little run bob
      const eyeY = player.y + CFG.eye;
      player.pitch = Math.max(-0.5, Math.min(0.5, player.pitch));
      const spd = Math.hypot(player.vx, player.vz);
      bob += spd * dtReal * 1.9;
      const bobY = player.onGround ? Math.sin(bob * 2) * 0.035 * Math.min(1, spd / 4) : 0;
      camera.position.set(player.x, eyeY + bobY, player.z);
      camera.rotation.set(player.pitch - 0.10, player.yaw, 0, "YXZ");

      sun.target.position.set(player.x, player.y, player.z);
      sun.position.set(player.x - 30, player.y + 50, player.z + 20);
      clouds.position.z = player.z + 120;

      const prog = progressOf(player, world.segs);
      const pct = Math.min(100, (prog / Math.abs(world.segs[world.segs.length - 1].z)) * 100);
      setHud((h) => ({ ...h, time: state.time, prog, pct, lives: state.lives }));
    }

    // --------------------------------------------------------------- render
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      onResize();
      if (phaseRef.current === "run") update(dt);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    // -------------------------------------------------------------- resize
    let lastW = 0, lastH = 0;
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h || (w === lastW && h === lastH)) return;
      lastW = w; lastH = h;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    function pause() {
      if (phaseRef.current === "run") { phaseRef.current = "paused"; setPhase("paused"); document.exitPointerLock?.(); }
      else if (phaseRef.current === "paused") { phaseRef.current = "run"; setPhase("run"); }
    }

    console.log("EFFECT START"); buildWorld(seed);
    // park the camera at the start line during the intro
    camera.position.set(0, 2.4, 6);
    camera.rotation.set(-0.1, 0, 0);

    async function loadBoard(s2) {
      try {
        const r = await fetch(`/api/arcade?game=voxel-run&seed=${s2}`, { cache: "no-store" });
        const j = await r.json();
        setBoard(j.board || []);
      } catch { setBoard([]); }
    }

    async function submitScore(t, won) {
      try {
        const r = await fetch("/api/arcade", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ game: "voxel-run", seed, time: t, won, name: playerName.current }),
        });
        const j = await r.json();
        if (j.board) setBoard(j.board);
      } catch {}
    }

    function resume() {
      phaseRef.current = "run";
      setPhase("run");
      if (!isTouch) renderer.domElement.requestPointerLock?.();
    }

    api.current = { restart, die, finishRun, revive, resume, loadBoard, setSeedWorld: (s) => { setSeed(s); buildWorld(s); } };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      document.removeEventListener("mousemove", onMouse);
      renderer.domElement.removeEventListener("click", onClick);
      clearWorld();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  interstitial.current = useInterstitial();

  // touch controls
  const press = useCallback((k, v) => { if (api.current.touch) api.current.touch[k] = v; }, []);

  const start = (asDaily) => {
    const s = asDaily ? seedFromDate() : (Math.random() * 4294967296) >>> 0;
    setSeed(s);
    setDaily(asDaily);
    api.current.setSeedWorld?.(s);
    setHud((h) => ({ ...h, lives: 3, time: 0, pct: 0 }));
    api.current.restart?.();
    api.current.loadBoard?.(s);
  };

  const fmt = (t) => {
    if (!Number.isFinite(t)) return "—";
    const m = Math.floor(t / 60), s = t % 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  };

  return (
    <div className="game-wrap">
      <div className="game-canvas" ref={mountRef} />

      <div className="game-hud">
        <div className="ghud-left">
          <span className="ghud-time">{fmt(hud.time)}</span>
          <span className="ghud-pct">{hud.pct.toFixed(0)}%</span>
        </div>
        <div className="ghud-bar"><i style={{ width: `${hud.pct}%` }} /></div>
        <div className="ghud-right">
          <span title="lives">{"❤".repeat(Math.max(0, hud.lives))}{"🖤".repeat(Math.max(0, 3 - hud.lives))}</span>
          <span className="ghud-best">best {fmt(hud.best)}</span>
        </div>
      </div>

      {phase === "intro" && (
        <div className="game-overlay">
          <div className="game-card">
            <p className="eyebrow">TIPLAB ARCADE</p>
            <h1>Voxel Run</h1>
            <p className="game-sub">A fresh course every day. Sprint the platforms, dodge the lava, don&apos;t stop.</p>
            <ul className="game-keys">
              {isTouch ? (
                <>
                  <li><b>◀ ▲ ▶</b> move</li>
                  <li><b>JUMP</b> to hop · <b>RUN</b> to sprint</li>
                </>
              ) : (
                <>
              <li><b>W A S D</b> move</li>
              <li><b>Space</b> jump</li>
              <li><b>Shift</b> sprint · <b>mouse</b> look</li>
              <li><b>R</b> restart · <b>Esc</b> pause</li>
                </>
              )}
            </ul>
            <div className="game-cta">
              <button onClick={() => start(true)} className="btn-big">▶ Daily course</button>
              <button onClick={() => start(false)} className="btn-ghost">Random course</button>
            </div>
            <Board board={board} name={name} setName={setName} daily />
            <p className="game-note">{hud.runs} runs played on this browser.</p>
          </div>
        </div>
      )}

      {phase === "dead" && (
        <div className="game-overlay">
          <div className="game-card">
            <p className="eyebrow">OUT OF LIVES</p>
            <h1>{hud.pct.toFixed(0)}%</h1>
            <p className="game-sub">{hud.time.toFixed(1)}s survived · best {fmt(hud.best)}</p>
            <Ads onReward={() => api.current.revive?.()} />
            <div className="game-cta">
              <button onClick={() => (hud.lives > 0 ? api.current.resume?.() : api.current.revive?.())} className="btn-ghost">
                {hud.lives > 0 ? "Continue" : "Continue without ad"}
              </button>
              <button onClick={() => start(daily)} className="btn-big">▶ Run it again</button>
              <button onClick={() => start(false)} className="btn-ghost">New course</button>
            </div>
          </div>
        </div>
      )}

      {phase === "won" && (
        <div className="game-overlay">
          <div className="game-card">
            <p className="eyebrow">FINISHED</p>
            <h1>{fmt(hud.time)}</h1>
            <p className="game-sub">Course cleared. {hud.best === hud.time ? "That's your record." : `Best ${fmt(hud.best)}.`}</p>
            <Board board={board} name={name} setName={setName} daily={daily} />
            <div className="game-cta">
              <button onClick={() => start(daily)} className="btn-big">▶ {daily ? "Run it again" : "Replay"}</button>
              <button onClick={() => start(false)} className="btn-ghost">New course</button>
            </div>
          </div>
        </div>
      )}

      {phase === "paused" && (
        <div className="game-overlay">
          <div className="game-card">
            <h1>Paused</h1>
            <div className="game-cta">
              <button onClick={() => setPhase("run")} className="btn-big">Resume</button>
              <button onClick={() => start(daily)} className="btn-ghost">Restart</button>
            </div>
          </div>
        </div>
      )}

      {isTouch && phase === "run" && (
        <div className="touchpad">
          <div className="tp-left">
            <button onPointerDown={(e) => { e.preventDefault(); press("strafe", -1); }} onPointerUp={() => press("strafe", 0)} onPointerLeave={() => press("strafe", 0)} onPointerCancel={() => press("strafe", 0)}>◀</button>
            <button onPointerDown={(e) => { e.preventDefault(); press("fwd", 1); }} onPointerUp={() => press("fwd", 0)} onPointerLeave={() => press("fwd", 0)} onPointerCancel={() => press("fwd", 0)}>▲</button>
            <button onPointerDown={(e) => { e.preventDefault(); press("strafe", 1); }} onPointerUp={() => press("strafe", 0)} onPointerLeave={() => press("strafe", 0)} onPointerCancel={() => press("strafe", 0)}>▶</button>
          </div>
          <div className="tp-right">
            <button onPointerDown={(e) => { e.preventDefault(); press("sprint", true); }} onPointerUp={() => press("sprint", false)} onPointerLeave={() => press("sprint", false)}>RUN</button>
            <button className="tp-jump" onPointerDown={(e) => { e.preventDefault(); press("jump", true); }} onPointerUp={() => press("jump", false)} onPointerLeave={() => press("jump", false)}>JUMP</button>
          </div>
        </div>
      )}
    </div>
  );
}
