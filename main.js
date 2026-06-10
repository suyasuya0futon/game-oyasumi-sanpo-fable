    import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
    import { createAudioSystem } from "./audio.js";
    import * as tuning from "./tuning.js";
    import {
      submitScore,
      getMyRank,
      getTopRanking,
      setName,
      getDeveloperSession,
      getDeveloperStatus,
      onDeveloperAuthChange,
      signInDeveloper,
      signOutDeveloper
    } from "./supabase.js";

    const canvas = document.querySelector("#game");
    const scoreEl = document.querySelector("#score");
    const debugInfoEl = document.querySelector("#debugInfo");
    const debugStatsEl = document.querySelector("#debugStats");
    const debugAutoEl = document.querySelector("#debugAuto");
    const menu = document.querySelector("#menu");
    const startBtn = document.querySelector("#start");
    const soundBtn = document.querySelector("#sound");
    const flash = document.querySelector("#flash");
    const stick = document.querySelector("#stick");
    const knob = document.querySelector("#knob");
    const touchBoost = document.querySelector("#touchBoost");
    const helpBtn = document.querySelector("#help");
    const helpOverlay = document.querySelector("#helpOverlay");
    const helpClose = document.querySelector("#helpClose");
    const pauseOverlay = document.querySelector("#pauseOverlay");
    const rankingOverlay = document.querySelector("#rankingOverlay");
    const devAuth = document.querySelector("#devAuth");
    const devAuthForm = document.querySelector("#devAuthForm");
    const devAuthBadge = document.querySelector("#devAuthBadge");
    const devAuthSubmit = document.querySelector("#devAuthSubmit");
    const devAuthError = document.querySelector("#devAuthError");

    function blockTouchDefault(event) {
      if (isTextEntryTarget(event.target)) return;
      event.preventDefault();
    }

    function isTextEntryTarget(target) {
      return !!target?.closest?.("input, textarea, select, [contenteditable='true']");
    }

    function preventCancelableDefault(event) {
      if (event.cancelable) event.preventDefault();
    }

    function blockGameplayTouchDefault(event) {
      const target = event.target;
      if (isTextEntryTarget(target)) return;
      if (target?.closest?.("button:not(.boost), a, label")) return;
      if (target?.closest?.(".help-overlay, .ranking-overlay")) return;
      preventCancelableDefault(event);
    }

    document.addEventListener("selectstart", blockTouchDefault);
    document.addEventListener("dragstart", blockTouchDefault);
    document.addEventListener("contextmenu", blockTouchDefault);
    document.addEventListener("touchstart", blockGameplayTouchDefault, { passive: false });
    document.addEventListener("touchmove", blockGameplayTouchDefault, { passive: false });

    let devAuthUiSeq = 0;
    let devAuthSession = null;

    async function setDevAuthUi(session) {
      const seq = ++devAuthUiSeq;
      const signedIn = !!session?.user;
      devAuthSession = session;
      devAuth.classList.toggle("is-signed-in", signedIn);
      devAuthSubmit.disabled = false;
      devAuthSubmit.setAttribute("aria-label", signedIn ? "GitHubログアウト" : "GitHubでログイン");
      devAuthBadge.hidden = true;
      devAuthError.hidden = true;
      devAuthError.textContent = "";
      if (!signedIn) {
        setDebugMode(tuning.DEBUG_MODE);
        return;
      }
      try {
        const isDeveloper = await getDeveloperStatus();
        if (seq === devAuthUiSeq) {
          devAuthBadge.hidden = !isDeveloper;
          setDebugMode(tuning.DEBUG_MODE || isDeveloper);
        }
      } catch (e) {
        console.warn("開発者権限を確認できません", e);
        if (seq === devAuthUiSeq) {
          devAuthError.textContent = "status error";
          devAuthError.hidden = false;
          setDebugMode(tuning.DEBUG_MODE);
        }
      }
    }

    async function initDevAuth(urlParams) {
      if (!urlParams.has("dev")) return;
      devAuth.hidden = false;
      try {
        await setDevAuthUi(await getDeveloperSession());
        onDeveloperAuthChange(setDevAuthUi);
      } catch (e) {
        console.warn("開発者ログイン状態を取得できません", e);
        devAuthError.textContent = "session error";
        devAuthError.hidden = false;
      }
    }

    devAuthForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      devAuthError.hidden = true;
      devAuthSubmit.disabled = true;
      try {
        if (devAuthSession?.user) {
          await signOutDeveloper();
          await setDevAuthUi(null);
        } else {
          await signInDeveloper(`${window.location.origin}${window.location.pathname}?dev`);
        }
      } catch (e) {
        console.warn("開発者ログイン操作に失敗", e);
        devAuthError.textContent = "auth failed";
        devAuthError.hidden = false;
      } finally {
        devAuthSubmit.disabled = false;
      }
    });

    document.querySelector("#helpContent").innerHTML = [
      "リングをくぐるとブースト燃料が貯まっていきます。",
      "ブースト中は、高速移動＋次のリングへのガイドが表示されます。<br>",
      "機体周りの「輪っか」が燃料タンクです。燃料が切れるとブーストできません。<br>",
      "障害物に当たるとゲームオーバーです。羽とタンクには当たり判定はありません。<br>",
      "<big>スコアについて</big>",
      `・金リング・・・${tuning.NORMAL_RING_SCORE}点`,
      `・レインボーリング・・・${tuning.RAINBOW_RING_SCORE}点`,
      `・ブーストしながらくぐる・・・× ${tuning.BOOST_SCORE_MULTIPLIER}倍`,
      "・連続でくぐる・・・× チェイン数倍",
    ].join("<br>");

    function refreshPauseState() {
      const helpOpen = !helpOverlay.hidden;
      const rankingOpen = !rankingOverlay.hidden;
      const overlayOpen = helpOpen || rankingOpen;
      const wasPaused = state.paused;
      state.paused = state.manualPaused || overlayOpen;
      pauseOverlay.hidden = !(state.manualPaused && !overlayOpen);
      if (state.running && state.paused !== wasPaused) {
        if (state.paused) audio.stopBgm();
        else audio.startBgm();
      }
    }

    function setManualPause(value) {
      state.manualPaused = value;
      refreshPauseState();
    }

    function setHelpOpen(open) {
      helpOverlay.hidden = !open;
      refreshPauseState();
    }

    helpBtn.addEventListener("click", () => setHelpOpen(true));
    helpClose.addEventListener("click", () => setHelpOpen(false));
    helpOverlay.addEventListener("click", (event) => {
      if (event.target === helpOverlay) setHelpOpen(false);
    });

    document.querySelector("#touchSwap").addEventListener("change", (event) => {
      document.body.classList.toggle("touch-swap", event.target.checked);
    });

    const SKY_SNOW_GRADIENT_STOPS = [
      [0, "#0a1322"],
      [0.18, "#152244"],
      [0.38, "#324270"],
      [0.62, "#6d7a98"],
      [0.82, "#a9a4b4"],
      [1, "#c5bcc0"]
    ];
    let redMoonBaseSky = false;

    function createSkyTexture() {
      const sky = document.createElement("canvas");
      sky.width = 32;
      sky.height = 512;
      const ctx = sky.getContext("2d");
      const texture = new THREE.CanvasTexture(sky);
      texture.colorSpace = THREE.SRGBColorSpace;

      function buildGradient(lowStops, high) {
        const gradient = ctx.createLinearGradient(0, 0, 0, sky.height);
        for (let i = 0; i < lowStops.length; i += 1) {
          const [stop, lowColor] = lowStops[i];
          const spaceColor = tuning.SKY_SPACE_GRADIENT_STOPS[i][1];
          const color = new THREE.Color(lowColor).lerp(new THREE.Color(spaceColor), high);
          gradient.addColorStop(stop, color.getStyle());
        }
        return gradient;
      }

      function draw(high = 0, snowFactor = 0) {
        // ベース層: 赤い月か通常夕焼け。雪は別レイヤとして上から重ねる。
        const baseStops = redMoonBaseSky ? tuning.SKY_RED_MOON_GRADIENT_STOPS
          : tuning.SKY_SUNSET_GRADIENT_STOPS;
        ctx.globalAlpha = 1;
        ctx.fillStyle = buildGradient(baseStops, high);
        ctx.fillRect(0, 0, sky.width, sky.height);
        if (snowFactor > 0) {
          ctx.globalAlpha = snowFactor;
          ctx.fillStyle = buildGradient(SKY_SNOW_GRADIENT_STOPS, high);
          ctx.fillRect(0, 0, sky.width, sky.height);
          ctx.globalAlpha = 1;
        }
        texture.needsUpdate = true;
      }

      texture.userData.drawSky = draw;
      draw(0, 0);
      return texture;
    }

    // 雲: 多オクターブ値ノイズ (fbm) + ドメインワープをピクセル単位で描く。
    // 楕円グラデーションの重ね合わせは輪郭が「CGの玉」になるため、フラクタルな縁と
    // 内部の濃淡を持たせ、密度の縦勾配から雲頂の光/下面の影を擬似計算して立体感を出す。
    // 楕円エンベロープで密度が外周に向かって必ず 0 になるので、端のぶつ切りも起きない。
    function cloudHash(ix, iy, seed) {
      let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1440662683);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function cloudNoise(x, y, seed) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const a = cloudHash(ix, iy, seed);
      const b = cloudHash(ix + 1, iy, seed);
      const c = cloudHash(ix, iy + 1, seed);
      const d = cloudHash(ix + 1, iy + 1, seed);
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }
    function cloudFbm(x, y, seed) {
      let v = 0;
      let amp = 0.52;
      let f = 1;
      for (let o = 0; o < 4; o += 1) {
        v += cloudNoise(x * f, y * f, seed + o * 101) * amp;
        amp *= 0.5;
        f *= 2.13;
      }
      return v;
    }
    // ピクセル走査はそれなりに重いので、起動時に数種類だけ生成して使い回す。
    const cloudTexturePool = [];
    const CLOUD_TEXTURE_VARIANTS = 12;
    function createCloudTexture() {
      if (cloudTexturePool.length >= CLOUD_TEXTURE_VARIANTS) {
        return cloudTexturePool[Math.floor(Math.random() * cloudTexturePool.length)];
      }
      const W = 256;
      const H = 96;
      const seed = Math.floor(Math.random() * 2 ** 31);
      const stretch = 2.8 + Math.random() * 1.6;
      const density = new Float32Array(W * H);
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const nx = x / W;
          const ny = y / H;
          const ex = (nx - 0.5) * 2;
          const ey = (ny - 0.5) * 2;
          const envelope = Math.max(0, 1 - (ex * ex + ey * ey * 1.35));
          if (envelope <= 0) continue;
          const warp = cloudFbm(nx * 2.4 + 19.7, ny * 4.8, seed ^ 0x9e3779) * 0.9;
          const dd = cloudFbm(nx * stretch + warp, ny * 3.4 + warp * 0.55, seed);
          density[y * W + x] = THREE.MathUtils.clamp((dd - 0.34) * 2.4, 0, 1) * envelope;
        }
      }
      const cloud = document.createElement("canvas");
      cloud.width = W;
      cloud.height = H;
      const ctx = cloud.getContext("2d");
      const img = ctx.createImageData(W, H);
      const data = img.data;
      const litColor = [255, 236, 220];
      const shadeColor = [152, 134, 172];
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = y * W + x;
          const dHere = density[i];
          if (dHere <= 0.004) continue;
          const dUp = density[Math.max(0, y - 2) * W + x];
          // 上方が薄い (=雲頂に近い) ピクセルほど月光で明るく、厚みの下ほど影色に。
          const light = THREE.MathUtils.clamp(0.55 + (dHere - dUp) * 2.2 + (0.5 - y / H) * 0.3, 0, 1);
          const o = i * 4;
          data[o] = Math.round(shadeColor[0] + (litColor[0] - shadeColor[0]) * light);
          data[o + 1] = Math.round(shadeColor[1] + (litColor[1] - shadeColor[1]) * light);
          data[o + 2] = Math.round(shadeColor[2] + (litColor[2] - shadeColor[2]) * light);
          data[o + 3] = Math.round(Math.min(1, dHere * 1.3) * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
      const texture = new THREE.CanvasTexture(cloud);
      texture.colorSpace = THREE.SRGBColorSpace;
      cloudTexturePool.push(texture);
      return texture;
    }

    function createMoonTexture(kind = "normal") {
      const size = 256;
      const moon = document.createElement("canvas");
      moon.width = size;
      moon.height = size;
      const ctx = moon.getContext("2d");
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.42;
      const red = kind === "red";
      const glowStops = red
        ? [
          [0, "rgba(255, 184, 168, 0.96)"],
          [0.55, "rgba(230, 72, 82, 0.78)"],
          [0.85, "rgba(180, 32, 58, 0.42)"],
          [1, "rgba(180, 32, 58, 0)"]
        ]
        : [
          [0, "rgba(255, 248, 170, 0.96)"],
          [0.55, "rgba(255, 232, 120, 0.82)"],
          [0.85, "rgba(250, 218, 80, 0.42)"],
          [1, "rgba(250, 218, 80, 0)"]
        ];
      const bodyStops = red
        ? [
          [0, "#ffd6c9"],
          [0.6, "#ff786d"],
          [1, "#c93245"]
        ]
        : [
          [0, "#fffce0"],
          [0.6, "#fff09a"],
          [1, "#ffe35c"]
        ];

      ctx.clearRect(0, 0, size, size);
      const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, size * 0.5);
      for (const [stop, color] of glowStops) glow.addColorStop(stop, color);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      for (const [stop, color] of bodyStops) body.addColorStop(stop, color);
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, size, size);

      // クレーター: 影の窪み + 光源側の縁のハイライトで立体感を出す。
      for (let i = 0; i < 16; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * r * 0.8;
        const px = cx + Math.cos(a) * dist;
        const py = cy + Math.sin(a) * dist;
        const cr = r * (0.045 + Math.random() * 0.11);
        const depth = 0.1 + Math.random() * 0.14;
        const shade = ctx.createRadialGradient(px, py, cr * 0.15, px, py, cr);
        shade.addColorStop(0, `rgba(40, 25, 30, ${depth})`);
        shade.addColorStop(0.72, `rgba(40, 25, 30, ${depth * 0.55})`);
        shade.addColorStop(1, "rgba(40, 25, 30, 0)");
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(px, py, cr, 0, Math.PI * 2);
        ctx.fill();
        const rim = ctx.createRadialGradient(px - cr * 0.3, py - cr * 0.3, cr * 0.55, px - cr * 0.3, py - cr * 0.3, cr * 1.1);
        rim.addColorStop(0, "rgba(255, 252, 235, 0)");
        rim.addColorStop(0.82, `rgba(255, 252, 235, ${depth * 0.5})`);
        rim.addColorStop(1, "rgba(255, 252, 235, 0)");
        ctx.fillStyle = rim;
        ctx.beginPath();
        ctx.arc(px - cr * 0.3, py - cr * 0.3, cr * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // 周縁減光: 球体らしく外周をわずかに落とす。
      const limb = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, r * 0.25, cx, cy, r);
      limb.addColorStop(0, "rgba(0, 0, 0, 0)");
      limb.addColorStop(0.75, "rgba(20, 8, 24, 0.06)");
      limb.addColorStop(1, "rgba(20, 8, 24, 0.3)");
      ctx.fillStyle = limb;
      ctx.fillRect(0, 0, size, size);

      ctx.restore();
      const texture = new THREE.CanvasTexture(moon);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function createMoonGlowTexture(kind = "normal") {
      const size = 256;
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = size;
      glowCanvas.height = size;
      const ctx = glowCanvas.getContext("2d");
      // アンカー点 (位置・明るさ・色) は従来の手打ちストップと完全に同じ。
      // アンカー間の補間だけを直線からエルミート曲線にして、22% / 55% 位置の
      // 折れ目が輪として見えるのを防ぐ。明るさと広がりは変わらない。
      const red = kind === "red";
      const anchors = red
        ? [
          [0, 0.95, [255, 184, 172]],
          [0.22, 0.62, [230, 72, 82]],
          [0.55, 0.26, [230, 72, 82]],
          [1, 0, [230, 72, 82]]
        ]
        : [
          [0, 0.95, [255, 240, 130]],
          [0.22, 0.62, [255, 224, 90]],
          [0.55, 0.26, [255, 210, 60]],
          [1, 0, [255, 210, 60]]
        ];
      // 各アンカーの接線 = 前後区間の傾きの平均 (端は隣接区間の傾き)。データは単調減少。
      const slopes = [];
      for (let i = 0; i < anchors.length - 1; i += 1) {
        slopes.push((anchors[i + 1][1] - anchors[i][1]) / (anchors[i + 1][0] - anchors[i][0]));
      }
      const tangents = anchors.map((a, i) => {
        if (i === 0) return slopes[0];
        if (i === anchors.length - 1) return slopes[slopes.length - 1];
        return (slopes[i - 1] + slopes[i]) / 2;
      });
      const glowAlpha = (t) => {
        let s = anchors.length - 2;
        for (let k = 0; k < anchors.length - 1; k += 1) {
          if (t <= anchors[k + 1][0]) { s = k; break; }
        }
        const [t0, a0] = anchors[s];
        const [t1, a1] = anchors[s + 1];
        const span = t1 - t0;
        const u = (t - t0) / span;
        const u2 = u * u;
        const u3 = u2 * u;
        return Math.max(0, (2 * u3 - 3 * u2 + 1) * a0 + (u3 - 2 * u2 + u) * span * tangents[s]
          + (-2 * u3 + 3 * u2) * a1 + (u3 - u2) * span * tangents[s + 1]);
      };
      const glowColor = (t) => {
        let s = anchors.length - 2;
        for (let k = 0; k < anchors.length - 1; k += 1) {
          if (t <= anchors[k + 1][0]) { s = k; break; }
        }
        const [t0, , c0] = anchors[s];
        const [t1, , c1] = anchors[s + 1];
        const u = (t - t0) / (t1 - t0);
        return c0.map((v, i) => Math.round(v + (c1[i] - v) * u));
      };
      const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size * 0.5);
      const GLOW_STOPS = 30;
      for (let i = 0; i <= GLOW_STOPS; i += 1) {
        const t = i / GLOW_STOPS;
        const [cr, cg, cb] = glowColor(t);
        g.addColorStop(t, `rgba(${cr}, ${cg}, ${cb}, ${glowAlpha(t).toFixed(4)})`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(glowCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const scene = new THREE.Scene();
    const skyTexture = createSkyTexture();
    scene.background = skyTexture;
    scene.fog = new THREE.FogExp2(0x253056, 0.007);

    const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 520);
    camera.position.set(0, 35, 28);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;

    // 空のグラデーションをそのまま環境マップ化し、金属 (リング) や機体・ビルに
    // 夕暮れ〜星空の反射光を与える。空の見た目が大きく変わった時だけ再生成する。
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const skyEnvSource = skyTexture.clone();
    skyEnvSource.mapping = THREE.EquirectangularReflectionMapping;
    let skyEnvTarget = null;
    let lastEnvHigh = -1;
    let lastEnvSnow = -1;
    function refreshEnvironment(high = 0, snowFactor = 0) {
      skyEnvSource.needsUpdate = true;
      const target = pmremGenerator.fromEquirectangular(skyEnvSource);
      if (skyEnvTarget) skyEnvTarget.dispose();
      skyEnvTarget = target;
      scene.environment = target.texture;
      lastEnvHigh = high;
      lastEnvSnow = snowFactor;
    }
    refreshEnvironment();

    const clock = new THREE.Clock();
    const lowFogColor = new THREE.Color(0x253056);
    const lowFogColorSnow = new THREE.Color(0x6a7383);
    const highFogColor = new THREE.Color(0x05091d);
    let lastSkyHigh = -1;
    let lastSnowSkyFactor = -1;
    const keys = new Set();
    const pickups = [];
    const loopingClouds = [];
    const clouds = [];
    const particles = [];
    const loopingGroundObjects = [];
    const obstacles = [];
    const state = {
      running: false,
      paused: false,
      manualPaused: false,
      loopCount: 1,
      score: 0,
      combo: 1,
      speed: 17,
      distance: 0,
      spawnTimer: 0,
      invulnerable: 0,
      boost: 0,
      boosting: false,
      boostFuel: 0,
      fuelDisplay: 0,
      trailSpawnCarry: 0,
      atmosphereSparkCarry: 0,
      rainbowTimer: 0,
      rainbowQueue: 0,
      muted: false,
      debugMode: tuning.DEBUG_MODE,
      debugHitboxes: false,
      debugDamage: false,
      autopilot: false,
      autoBoost: false,
      fullBoost: false,
      trail: true,
      snow: false,
      snowSkyFactor: 0,
      pendingSnow: null,
      lastRingExtreme: false,
      lastSpawnInterval: null,
      redMoon: false,
      rings: 0,
      ended: false,
      crashCameraTime: 0,
      crashCameraDuration: 2.2,
      crashCameraActive: false,
      crashCameraStartPosition: new THREE.Vector3(),
      crashCameraStartTarget: new THREE.Vector3(),
      currentScoreId: null,
      currentScoreCreatedAt: null,
      currentSubmitSeq: 0
    };

    const input = new THREE.Vector2();
    const touchInput = new THREE.Vector2();
    const playerBox = new THREE.Box3();
    const tempBox = new THREE.Box3();

    function altitudeFactor() {
      return THREE.MathUtils.smoothstep(
        ship.position.y,
        tuning.SKY_ALTITUDE_FADE_START_Y,
        tuning.SKY_ALTITUDE_FADE_END_Y
      );
    }

    function atmosphereDangerFactor() {
      return THREE.MathUtils.smoothstep(
        ship.position.y,
        tuning.ATMOSPHERE_SPARK_START_Y,
        tuning.ATMOSPHERE_EXPLODE_Y
      );
    }

    const audio = createAudioSystem({
      camera,
      soundBtn,
      bgmToggle: document.querySelector("#bgmToggle"),
      state
    });

    let loopBuildingMaterial = null;
    const LOOP_BUILDING_NORMAL_COLOR = 0x26304e;
    const LOOP_BUILDING_DEBUG_COLOR = 0xff3333;
    const LOOP_BUILDING_SNOW_COLOR = 0xd8dde8;

    function refreshLoopBuildingColor() {
      if (!loopBuildingMaterial) return;
      const hex = state.snow ? LOOP_BUILDING_SNOW_COLOR
        : state.debugMode ? LOOP_BUILDING_DEBUG_COLOR
        : LOOP_BUILDING_NORMAL_COLOR;
      loopBuildingMaterial.color.setHex(hex);
    }

    // デバッグモード時の当たり判定可視化。通常プレイ負荷を避けるため、表示ON時だけワイヤを生成する。
    // ship 回転に追従させずワールド軸固定 (実判定がそうだから)。
    const DEBUG_HIT_COLOR = 0x9aff00;
    let shipHitWire = null;

    function disposeDebugWire(wire) {
      if (!wire) return;
      if (wire.parent) wire.parent.remove(wire);
      if (wire.geometry) wire.geometry.dispose();
      if (wire.material) wire.material.dispose();
    }

    function ensureShipHitWire() {
      if (shipHitWire) return;
      shipHitWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
        new THREE.LineBasicMaterial({ color: DEBUG_HIT_COLOR, transparent: true, opacity: 0.85, depthTest: false, fog: false })
      );
      shipHitWire.renderOrder = 50;
      scene.add(shipHitWire);
    }

    // 障害物の AABB を可視化するワイヤを生成する。表示ON時だけ obstacle の親配下に置く。
    function createObstacleDebugBox(halfSize) {
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(halfSize.x * 2, halfSize.y * 2, halfSize.z * 2)),
        new THREE.LineBasicMaterial({ color: DEBUG_HIT_COLOR, transparent: true, opacity: 0.55, depthTest: false, fog: false })
      );
      wire.renderOrder = 49;
      return wire;
    }

    // リング側衝突判定の円を可視化する。表示ON時だけ pickup の子として追加する。
    function createRingDebugCircle(radius) {
      const segments = 48;
      const positions = new Float32Array((segments + 1) * 3);
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        positions[i * 3] = Math.cos(a) * radius;
        positions[i * 3 + 1] = Math.sin(a) * radius;
        positions[i * 3 + 2] = 0;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const wire = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: DEBUG_HIT_COLOR, transparent: true, opacity: 0.9, depthTest: false, fog: false })
      );
      wire.renderOrder = 49;
      return wire;
    }

    function ensureObstacleDebugWire(o) {
      if (o.userData.debugWire || !o.userData.halfSize) return;
      const wire = createObstacleDebugBox(o.userData.halfSize);
      wire.position.copy(o.position);
      (o.parent || ground).add(wire);
      o.userData.debugWire = wire;
    }

    function disposeObstacleDebugWire(o) {
      if (!o.userData.debugWire) return;
      disposeDebugWire(o.userData.debugWire);
      o.userData.debugWire = null;
    }

    function ensurePickupDebugWires(p) {
      if (p.userData.debugWires) return;
      const debugWires = [];
      if (p.userData.rainbow) {
        const innerWire = createRingDebugCircle(tuning.RAINBOW_RING_GLOW_RADIUS);
        const outerWire = createRingDebugCircle(tuning.RAINBOW_RING_RADIUS);
        p.add(innerWire, outerWire);
        debugWires.push(innerWire, outerWire);
      } else {
        const wire = createRingDebugCircle(tuning.PICKUP_RING_RADIUS);
        p.add(wire);
        debugWires.push(wire);
      }
      p.userData.debugWires = debugWires;
    }

    function disposePickupDebugWires(p) {
      if (!p.userData.debugWires) return;
      for (const w of p.userData.debugWires) disposeDebugWire(w);
      p.userData.debugWires = null;
    }

    function setDebugHitboxes(enabled) {
      state.debugHitboxes = state.debugMode && enabled;
      if (state.debugHitboxes) {
        ensureShipHitWire();
        for (const o of obstacles) ensureObstacleDebugWire(o);
        for (const p of pickups) ensurePickupDebugWires(p);
      } else {
        disposeDebugWire(shipHitWire);
        shipHitWire = null;
        for (const o of obstacles) disposeObstacleDebugWire(o);
        for (const p of pickups) disposePickupDebugWires(p);
      }
      updateHud();
    }

    function setDebugMode(enabled) {
      const wasEnabled = state.debugMode;
      state.debugMode = enabled;
      if (!enabled) state.debugDamage = false;
      if (!enabled) state.debugHitboxes = false;
      if (enabled && !wasEnabled) state.fullBoost = false;
      document.body.classList.toggle("debug-on", enabled);
      refreshLoopBuildingColor();
      setDebugHitboxes(state.debugHitboxes);
    }
    setDebugMode(state.debugMode);

    const ambient = new THREE.HemisphereLight(0xd7c6c5, 0x171f46, 1.45);
    scene.add(ambient);

    // 太陽は奥 (-z) からの逆光なので、カメラ側の面が真っ黒に潰れないよう
    // 月光相当の青いフィルライトを手前上方から弱く当てる。
    const moonFill = new THREE.DirectionalLight(0x8fa3d6, 0.55);
    moonFill.position.set(6, 18, 30);
    scene.add(moonFill);

    const sun = new THREE.DirectionalLight(0xd88972, 1.2);
    sun.position.set(-10, 9, -18);
    sun.castShadow = true;
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    scene.add(sun);

    const cyanLight = new THREE.PointLight(0xffd285, 16, 34);
    cyanLight.position.set(0, 5, 8);
    scene.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xff5f7e, 10, 28);
    magentaLight.position.set(8, 4, -8);
    scene.add(magentaLight);

    const moonTextures = {
      normalDisk: createMoonTexture(),
      normalGlow: createMoonGlowTexture(),
      redDisk: createMoonTexture("red"),
      redGlow: createMoonGlowTexture("red")
    };
    const moonGroup = new THREE.Group();
    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTextures.normalGlow,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    moonGlow.scale.set(34, 34, 1);
    const moonDisk = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTextures.normalDisk,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
      depthTest: false,
      fog: false
    }));
    moonDisk.scale.set(10.2, 10.2, 1);
    moonGroup.add(moonGlow, moonDisk);
    moonGroup.position.set(-54, 116, -190);
    scene.add(moonGroup);

    // 星: 四角い点ではなく柔らかい光点にし、暗い星の海 + 明るい星の2層で奥行きを出す。
    const starTexture = (() => {
      const size = 64;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      // 鋭い点光 + ごく薄いハロ。コアを太らせると不自然になるので、
      // 見えやすさはスプライトのサイズ・数・不透明度側で調整する。
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.22, "rgba(255,255,255,0.7)");
      g.addColorStop(0.5, "rgba(255,255,255,0.14)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const STAR_TINTS = [0xffffff, 0xcfe2ff, 0xffeccf, 0xf6fbff];
    function createStarField(count, size, opacity) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const tint = new THREE.Color();
      for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 260;
        positions[i * 3 + 1] = 24 + Math.random() * 500;
        positions[i * 3 + 2] = -35 - Math.random() * 240;
        tint.setHex(STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)]);
        colors[i * 3] = tint.r;
        colors[i * 3 + 1] = tint.g;
        colors[i * 3 + 2] = tint.b;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        map: starTexture,
        vertexColors: true,
        size,
        transparent: true,
        opacity,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending
      });
      return new THREE.Points(geo, mat);
    }
    const starsSmall = createStarField(1100, 0.5, 0.72);
    const starsBright = createStarField(180, 1.1, 0.85);
    const starMat = starsSmall.material;
    const starBrightMat = starsBright.material;
    const stars = new THREE.Group();
    stars.add(starsSmall, starsBright);
    scene.add(stars);

    for (let i = 0; i < 8; i += 1) {
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(30 + Math.random() * 22, 9 + Math.random() * 7),
        new THREE.MeshBasicMaterial({
          map: createCloudTexture(),
          transparent: true,
          opacity: 0.34 + Math.random() * 0.22,
          depthWrite: false
        })
      );
      cloud.position.set(-64 + i * 18 + Math.random() * 8, 13 + Math.random() * 16, -62 - Math.random() * 54);
      cloud.userData.speed = 0.18 + Math.random() * 0.22;
      scene.add(cloud);
      clouds.push(cloud);
    }

    const grid = new THREE.Group();
    grid.position.z = -62;

    const ground = new THREE.Group();
    ground.position.set(0, -36, tuning.GROUND_LOOP_START_Z);
    scene.add(ground);
    const islandFootprints = [];

    const islandEdgeAlphaTex = (() => {
      const size = 256;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(tuning.ISLAND_EDGE_FADE_START, "#ffffff");
      grad.addColorStop(tuning.ISLAND_EDGE_FADE_END, "#000000");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.NoColorSpace;
      return tex;
    })();

    // 地表のまだら模様 (草地や土の濃淡)。グレースケールで描き、material.color で着色する。
    // 雪モードの色差し替え (setHex) がそのまま効くようにするため。
    const terrainTexture = (() => {
      const size = 512;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#c8c8c8";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 480; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 6 + Math.random() * 42;
        const bright = Math.random() < 0.5;
        const alpha = 0.04 + Math.random() * 0.08;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, bright ? `rgba(255,255,255,${alpha})` : `rgba(40,40,40,${alpha})`);
        g.addColorStop(1, "rgba(128,128,128,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 細かい粒状ノイズで質感を足す。
      for (let i = 0; i < 5000; i += 1) {
        const v = Math.random() < 0.5 ? 0 : 255;
        ctx.fillStyle = `rgba(${v},${v},${v},${0.025 + Math.random() * 0.04})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

    const land = new THREE.Mesh(
      new THREE.CircleGeometry(80, 96),
      new THREE.MeshStandardMaterial({ color: 0x24493f, map: terrainTexture, roughness: 0.95, metalness: 0, envMapIntensity: 0.3, transparent: true, opacity: 0.96, depthWrite: false, alphaMap: islandEdgeAlphaTex })
    );
    land.rotation.x = -Math.PI / 2;
    land.scale.set(1.6, 0.95, 1);
    land.position.set(-20, 0.05, -4);
    ground.add(land);
    islandFootprints.push({ x: -20, z: -4, rx: 80 * 1.6, rz: 80 * 0.95 });

const forestPalette = [0x173326, 0x1f4434, 0x2a563f, 0x12281d, 0x365e3c];
    const forestSnowPalette = [0xdfe6e2, 0xe6ece8, 0xd4dcd7, 0xeef2f0, 0xc9d2cc];
    const forestMats = forestPalette.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0, envMapIntensity: 0.35, transparent: true, opacity: 0.92, depthWrite: false, vertexColors: true }));
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4c3a2a, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.92, depthWrite: false });
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 1.4, 6);

    // 複数ジオメトリを1つの BufferGeometry に結合する (ドローコール削減のため)。
    // position/normal/uv (+全入力が持つ場合のみ color) を連結し、インデックスをオフセットする。
    function mergeGeometries(geometries) {
      const hasColor = geometries.every((g) => g.attributes.color);
      let vTotal = 0;
      let iTotal = 0;
      for (const g of geometries) {
        vTotal += g.attributes.position.count;
        iTotal += g.index.count;
      }
      const pos = new Float32Array(vTotal * 3);
      const nor = new Float32Array(vTotal * 3);
      const uv = new Float32Array(vTotal * 2);
      const col = hasColor ? new Float32Array(vTotal * 3) : null;
      const idx = new Uint32Array(iTotal);
      let vo = 0;
      let io = 0;
      for (const g of geometries) {
        pos.set(g.attributes.position.array, vo * 3);
        nor.set(g.attributes.normal.array, vo * 3);
        uv.set(g.attributes.uv.array, vo * 2);
        if (col) col.set(g.attributes.color.array, vo * 3);
        const gi = g.index.array;
        for (let i = 0; i < gi.length; i += 1) idx[io + i] = gi[i] + vo;
        io += gi.length;
        vo += g.attributes.position.count;
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      if (col) merged.setAttribute("color", new THREE.BufferAttribute(col, 3));
      merged.setIndex(new THREE.BufferAttribute(idx, 1));
      return merged;
    }
    // 頂点を位置ハッシュで揺らして、幾何学的なコーン/球を有機的な樹形に崩す。
    // 同一位置の重複頂点 (UVシーム) は同じ量だけ動くので、面の割れは起きない。
    function roughenGeometry(geo, amount) {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const h1 = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        const r1 = (h1 - Math.floor(h1)) - 0.5;
        const h2 = Math.sin(x * 26.651 + y * 15.123 + z * 53.71) * 24634.6345;
        const r2 = (h2 - Math.floor(h2)) - 0.5;
        pos.setXYZ(i, x + r1 * amount, y + r2 * amount * 0.6, z + (r1 + r2) * 0.5 * amount);
      }
      geo.computeVertexNormals();
      return geo;
    }
    // 葉群の頂点カラー: 下層ほど暗く (擬似AO)、わずかな明度ジッターで単色のっぺりを消す。
    // 色相はマテリアル側 (forestMats) が持つので、雪モードの色差し替えはそのまま機能する。
    function bakeFoliageColors(geo) {
      geo.computeBoundingBox();
      const minY = geo.boundingBox.min.y;
      const maxY = geo.boundingBox.max.y;
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const t = (y - minY) / Math.max(1e-6, maxY - minY);
        const h1 = Math.sin(x * 91.7 + y * 47.3 + z * 73.1) * 14375.5453;
        const jitter = ((h1 - Math.floor(h1)) - 0.5) * 0.16;
        const b = THREE.MathUtils.clamp(0.5 + t * 0.55 + jitter, 0.35, 1.1);
        colors[i * 3] = b;
        colors[i * 3 + 1] = b;
        colors[i * 3 + 2] = b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      return geo;
    }
    // 多段の円錐を重ねたモミの木型シルエット。単一円錐の「記号」感をなくす。
    function buildFirFoliage(tiers, rough) {
      const parts = tiers.map(([r, h, y]) => {
        const cone = roughenGeometry(new THREE.ConeGeometry(r, h, 9, 3), rough);
        cone.translate(0, y, 0);
        return cone;
      });
      return bakeFoliageColors(mergeGeometries(parts));
    }
    function buildBroadleafFoliage() {
      const parts = [
        [0.95, 0.25, 0.05, 0],
        [0.8, -0.4, -0.3, 0.2],
        [0.75, 0.05, 0.6, -0.15],
        [0.7, -0.1, -0.05, -0.45]
      ].map(([r, x, y, z]) => {
        const blob = roughenGeometry(new THREE.SphereGeometry(r, 9, 7), 0.13);
        blob.translate(x, y, z);
        return blob;
      });
      return bakeFoliageColors(mergeGeometries(parts));
    }
    // 各アーキタイプは従来の単一円錐/球と同じ高さ・幅に収め、当たり判定を変えない。
    const firA = buildFirFoliage([[1.3, 1.9, -0.85], [1.0, 1.7, 0.15], [0.62, 1.5, 1.05]], 0.09);
    const firB = buildFirFoliage([[0.95, 1.7, -1.45], [0.78, 1.6, -0.45], [0.6, 1.5, 0.5], [0.42, 1.5, 1.55]], 0.07);
    const broadleafGeo = buildBroadleafFoliage();
    // 木は色パレットごとに全本まとめて1メッシュに結合する (160本×2メッシュ → 6メッシュ)。
    // 当たり判定は描画されない軽量アンカー (Object3D) が従来と同じ position/halfSize を持つ。
    const forestBuckets = forestMats.map(() => []);
    const trunkBucket = [];
    const treeMatrix = new THREE.Matrix4();
    const treePos = new THREE.Vector3();
    const treeQuat = new THREE.Quaternion();
    const treeEuler = new THREE.Euler();
    const treeScaleV = new THREE.Vector3();
    function placeTree(x, z) {
      const variant = Math.random();
      const paletteIdx = Math.floor(Math.random() * forestMats.length);
      const archetype = variant < 0.55 ? firA : variant < 0.85 ? firB : broadleafGeo;
      const treeScale = 1.0 + Math.random() * 1.6;
      treeEuler.set(0, Math.random() * Math.PI * 2, 0);
      treeQuat.setFromEuler(treeEuler);
      treeScaleV.setScalar(treeScale);
      treeMatrix.compose(treePos.set(x, 1.8, z), treeQuat, treeScaleV);
      forestBuckets[paletteIdx].push(archetype.clone().applyMatrix4(treeMatrix));
      const trunk = trunkGeo.clone();
      trunk.translate(0, -1.25, 0);
      trunk.applyMatrix4(treeMatrix);
      trunkBucket.push(trunk);
      const anchor = new THREE.Object3D();
      anchor.position.set(x, 1.8, z);
      anchor.userData.obstacle = true;
      anchor.userData.crashMessage = "木に衝突しました。";
      anchor.userData.halfSize = { x: 0.55 * treeScale, y: 2.0 * treeScale, z: 0.55 * treeScale };
      obstacles.push(anchor);
    }
    const forestCarpet = new THREE.Mesh(
      new THREE.CircleGeometry(54, 48),
      new THREE.MeshStandardMaterial({ color: 0x142e21, map: terrainTexture, roughness: 0.95, metalness: 0, envMapIntensity: 0.3, transparent: true, opacity: 0.9, depthWrite: false, alphaMap: islandEdgeAlphaTex })
    );
    forestCarpet.rotation.x = -Math.PI / 2;
    forestCarpet.scale.set(1.6, 0.9, 1);
    forestCarpet.position.set(-58, 0.12, -8);
    ground.add(forestCarpet);
    islandFootprints.push({ x: -58, z: -8, rx: 54 * 1.6, rz: 54 * 0.9 });
    for (let i = 0; i < 160; i += 1) {
      placeTree(-104 + Math.random() * 92, -56 + Math.random() * 102);
    }
    forestBuckets.forEach((bucket, i) => {
      if (bucket.length) ground.add(new THREE.Mesh(mergeGeometries(bucket), forestMats[i]));
    });
    ground.add(new THREE.Mesh(mergeGeometries(trunkBucket), trunkMat));

    const cityPalette = [0x26304e, 0x2f3a5c, 0x1d2540, 0x363f63, 0x222b48];
    const citySnowPalette = [0xd8dde8, 0xe2e6ef, 0xccd2de, 0xeaeef5, 0xc6cdda];
    const cityMats = cityPalette.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.3, envMapIntensity: 0.55, transparent: true, opacity: 0.92, depthWrite: false }));
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd98c, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending });
    const windowGeo = new THREE.PlaneGeometry(0.28, 0.34);

    // ビルのファサード (壁 + 窓) をテクスチャに焼く。窓1枚ずつの板ポリ (数百ドローコール) を
    // 置き換えるので描画負荷はむしろ下がる。map はグレースケールで material.color に着色され
    // (雪モード対応)、点灯窓だけ emissiveMap で暖色に光る。消灯窓が混ざるのがビルらしさの鍵。
    // テクスチャの v=0〜0.94 が壁面、v≈0.975 付近は屋根/屋上設備用の無地領域。
    const FACADE_PLAIN_V = 0.975;
    function createFacadeTextures(w, h) {
      const cols = Math.max(2, Math.floor(w / 0.9));
      const rows = Math.max(2, Math.floor(h / 1.1));
      const cw = 64;
      const ch = 160;
      const wallTop = Math.ceil(ch * 0.06); // canvas上端 (v=1側) は無地ストリップ
      const mapCv = document.createElement("canvas");
      mapCv.width = cw;
      mapCv.height = ch;
      const mctx = mapCv.getContext("2d");
      const emiCv = document.createElement("canvas");
      emiCv.width = cw;
      emiCv.height = ch;
      const ectx = emiCv.getContext("2d");
      ectx.fillStyle = "#000000";
      ectx.fillRect(0, 0, cw, ch);
      // 壁: 下層ほど暗い縦グラデ (擬似AO)。無地ストリップも同系の中間グレー。
      const wall = mctx.createLinearGradient(0, wallTop, 0, ch);
      wall.addColorStop(0, "#b4b4b4");
      wall.addColorStop(1, "#5c5c5c");
      mctx.fillStyle = wall;
      mctx.fillRect(0, 0, cw, ch);
      mctx.fillStyle = "#9a9a9a";
      mctx.fillRect(0, 0, cw, wallTop);
      const cellW = cw / cols;
      const cellH = (ch - wallTop) / rows;
      // 窓サイズはループ数字ビルの板ポリ窓 (セル幅の約34% × 高さの約32%) に合わせる。
      const mx = cellW * 0.33;
      const my = cellH * 0.34;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let ry = 0; ry < rows; ry += 1) {
          const px = cx * cellW + mx;
          const py = wallTop + ry * cellH + my;
          const pw = cellW - mx * 2;
          const ph = cellH - my * 2;
          if (Math.random() < 0.45) {
            mctx.fillStyle = "#2e2e2e"; // 消灯窓: 壁より暗いガラス
            mctx.fillRect(px, py, pw, ph);
          } else {
            mctx.fillStyle = "#d8d8d8";
            mctx.fillRect(px, py, pw, ph);
            ectx.fillStyle = `rgba(255,255,255,${0.55 + Math.random() * 0.45})`;
            ectx.fillRect(px, py, pw, ph);
          }
        }
      }
      const map = new THREE.CanvasTexture(mapCv);
      map.colorSpace = THREE.SRGBColorSpace;
      const emissiveMap = new THREE.CanvasTexture(emiCv);
      emissiveMap.colorSpace = THREE.SRGBColorSpace;
      return { map, emissiveMap };
    }
    const cityBuildingMats = []; // 雪モードの色差し替え用 (テクスチャ付きビルは個別マテリアル)
    function createBuildingMaterial(w, h, paletteIdx) {
      const { map, emissiveMap } = createFacadeTextures(w, h);
      const mat = new THREE.MeshStandardMaterial({
        color: cityPalette[paletteIdx],
        map,
        emissiveMap,
        emissive: 0xffd98c,
        emissiveIntensity: 1.0,
        roughness: 0.62,
        metalness: 0.3,
        envMapIntensity: 0.55,
        transparent: true,
        opacity: 0.92,
        depthWrite: false
      });
      cityBuildingMats.push({ mat, paletteIdx });
      return mat;
    }
    // BoxGeometry の側面UVを v0〜v1 に割り当て、上下面は無地領域に逃がす。
    // BoxGeometry(1セグメント) は面ごとに4頂点で +x,-x,+y,-y,+z,-z の順。
    function remapBoxSideUV(geo, v0, v1) {
      const uvAttr = geo.attributes.uv;
      for (let i = 0; i < uvAttr.count; i += 1) {
        const face = Math.floor(i / 4);
        if (face === 2 || face === 3) uvAttr.setXY(i, 0.5, FACADE_PLAIN_V);
        else uvAttr.setXY(i, uvAttr.getX(i), v0 + uvAttr.getY(i) * (v1 - v0));
      }
      return geo;
    }
    function remapBoxPlainUV(geo) {
      const uvAttr = geo.attributes.uv;
      for (let i = 0; i < uvAttr.count; i += 1) uvAttr.setXY(i, 0.5, FACADE_PLAIN_V);
      return geo;
    }
    // 本体 + (確率で)低層部 + 屋上設備を1ジオメトリに結合した「建築」のシルエットを作る。
    // 当たり判定は従来通り本体ボックスのまま (低層部・設備ぶんは当たらない=甘めで安全側)。
    function createTowerGeometry(w, h, d) {
      const parts = [remapBoxSideUV(new THREE.BoxGeometry(w, h, d), 0, 0.94)];
      if (h > 6 && Math.random() < 0.45) {
        const ph = h * 0.18;
        const pod = remapBoxSideUV(new THREE.BoxGeometry(w + 1.1, ph, d + 1.1), 0, 0.94 * 0.18);
        pod.translate(0, -h / 2 + ph / 2, 0);
        parts.push(pod);
      }
      const equipCount = 1 + Math.floor(Math.random() * 2);
      for (let e = 0; e < equipCount; e += 1) {
        const ew = 0.5 + Math.random() * Math.min(1.4, w * 0.4);
        const eh = 0.3 + Math.random() * 0.7;
        const ed = 0.5 + Math.random() * Math.min(1.4, d * 0.4);
        const eq = remapBoxPlainUV(new THREE.BoxGeometry(ew, eh, ed));
        eq.translate(
          (Math.random() - 0.5) * (w - ew) * 0.8,
          h / 2 + eh / 2,
          (Math.random() - 0.5) * (d - ed) * 0.8
        );
        parts.push(eq);
      }
      return mergeGeometries(parts);
    }
    // ビル足元の接地AO (柔らかい暗がり)。全ビル分を1メッシュに結合する。
    const buildingAoTexture = (() => {
      const size = 64;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, "#e6e6e6");
      grad.addColorStop(0.4, "#8a8a8a");
      grad.addColorStop(0.75, "#2c2c2c");
      grad.addColorStop(1, "#000000");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.NoColorSpace;
      return tex;
    })();
    const buildingAoQuads = [];
    const cityPlaza = new THREE.Mesh(
      new THREE.CircleGeometry(34, 36),
      new THREE.MeshStandardMaterial({ color: 0x141a2c, map: terrainTexture, roughness: 0.78, metalness: 0.08, envMapIntensity: 0.4, transparent: true, opacity: 0.94, depthWrite: false, alphaMap: islandEdgeAlphaTex })
    );
    cityPlaza.rotation.x = -Math.PI / 2;
    cityPlaza.scale.set(1.4, 1.0, 1);
    cityPlaza.position.set(28, 0.12, -12);
    ground.add(cityPlaza);
    islandFootprints.push({ x: 28, z: -12, rx: 34 * 1.4, rz: 34 * 1.0 });
    for (let i = 0; i < 56; i += 1) {
      const isSpire = Math.random() < 0.18;
      const w = isSpire ? 1.6 + Math.random() * 1.4 : 2.5 + Math.random() * 4;
      const d = isSpire ? w : 2.5 + Math.random() * 4;
      const h = isSpire ? 10 + Math.random() * 14 : 3 + Math.random() * 10;
      let building;
      if (isSpire) {
        const mat = cityMats[Math.floor(Math.random() * cityMats.length)];
        building = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.6, h, 8), mat);
      } else {
        const paletteIdx = Math.floor(Math.random() * cityPalette.length);
        building = new THREE.Mesh(createTowerGeometry(w, h, d), createBuildingMaterial(w, h, paletteIdx));
      }
      // 内側端を x=14 に寄せ、リング(中心 x≤10・半径7)のど真ん中を通れば必ずセーフにする。
      // それでもビルはリング右側の穴の中に残るので、右に寄って抜けると建物に当たる。
      building.position.set(14 + Math.random() * 42, h / 2, -44 + Math.random() * 56);
      building.userData.obstacle = true;
      building.userData.crashMessage = "建物に衝突しました。";
      building.userData.halfSize = { x: w / 2, y: h / 2, z: d / 2 };
      ground.add(building);
      obstacles.push(building);

      if (isSpire) {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), windowMat);
        beacon.position.set(building.position.x, h + 0.2, building.position.z);
        ground.add(beacon);
      }
      const ao = new THREE.PlaneGeometry(w + 2.6, d + 2.6);
      ao.rotateX(-Math.PI / 2);
      ao.translate(building.position.x, 0.135, building.position.z);
      buildingAoQuads.push(ao);
    }
    const cityAo = new THREE.Mesh(
      mergeGeometries(buildingAoQuads),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, alphaMap: buildingAoTexture })
    );
    ground.add(cityAo);

    const SNOW_LAND_COLOR = 0xeaf0ed;
    const SNOW_FOREST_CARPET_COLOR = 0xdde4e0;
    const SNOW_CITY_PLAZA_COLOR = 0xc8cfdc;
    const normalLandHex = land.material.color.getHex();
    const normalForestCarpetHex = forestCarpet.material.color.getHex();
    const normalCityPlazaHex = cityPlaza.material.color.getHex();
    function applySnowMode(enabled) {
      state.snow = enabled;
      for (let i = 0; i < forestMats.length; i += 1) {
        forestMats[i].color.setHex(enabled ? forestSnowPalette[i] : forestPalette[i]);
      }
      for (let i = 0; i < cityMats.length; i += 1) {
        cityMats[i].color.setHex(enabled ? citySnowPalette[i] : cityPalette[i]);
      }
      for (const entry of cityBuildingMats) {
        entry.mat.color.setHex(enabled ? citySnowPalette[entry.paletteIdx] : cityPalette[entry.paletteIdx]);
      }
      land.material.color.setHex(enabled ? SNOW_LAND_COLOR : normalLandHex);
      forestCarpet.material.color.setHex(enabled ? SNOW_FOREST_CARPET_COLOR : normalForestCarpetHex);
      cityPlaza.material.color.setHex(enabled ? SNOW_CITY_PLAZA_COLOR : normalCityPlazaHex);
      refreshLoopBuildingColor();
    }

    function applyRedMoonMode(enabled) {
      state.redMoon = enabled;
      redMoonBaseSky = enabled;
      lastSkyHigh = -1;
      lastSnowSkyFactor = -1;
      lastEnvHigh = -1; // 空のベース色が変わるので環境マップも作り直させる。
      moonDisk.material.map = enabled ? moonTextures.redDisk : moonTextures.normalDisk;
      moonGlow.material.map = enabled ? moonTextures.redGlow : moonTextures.normalGlow;
      moonDisk.material.needsUpdate = true;
      moonGlow.material.needsUpdate = true;
      audio.setRedMoonMode(enabled);
      if (enabled) {
        // 赤い月ではデバッグFと同じく燃料を満タン固定にし、表示も即時満タンにする。
        state.boostFuel = tuning.FUEL_DISK_MAX_DIAMETER;
        state.fuelDisplay = tuning.FUEL_DISK_MAX_DIAMETER;
      }
    }

    const LOOP_DISPLAY_FONT = {
      "0": ["XXX", "X.X", "X.X", "X.X", "XXX"],
      "1": [".X.", "XX.", ".X.", ".X.", "XXX"],
      "2": ["XXX", "..X", "XXX", "X..", "XXX"],
      "3": ["XXX", "..X", ".XX", "..X", "XXX"],
      "4": ["X.X", "X.X", "XXX", "..X", "..X"],
      "5": ["XXX", "X..", "XXX", "..X", "XXX"],
      "6": ["XXX", "X..", "XXX", "X.X", "XXX"],
      "7": ["XXX", "..X", "..X", "..X", "..X"],
      "8": ["XXX", "X.X", "XXX", "X.X", "XXX"],
      "9": ["XXX", "X.X", "XXX", "..X", "XXX"],
      "!": [".X.", ".X.", ".X.", "...", ".X."],
      "?": ["XX.", "..X", ".X.", "...", ".X."]
    };
    const LOOP_DISPLAY_COLS = 7;
    const LOOP_DISPLAY_ROWS_TOTAL = 11;
    const LOOP_DISPLAY_PAD_BOTTOM = 3;
    const loopBuildingW = 6.6;
    const loopBuildingH = 12.6;
    const loopBuildingD = 3.2;
    loopBuildingMaterial = new THREE.MeshStandardMaterial({
      color: state.debugMode ? LOOP_BUILDING_DEBUG_COLOR : LOOP_BUILDING_NORMAL_COLOR,
      roughness: 0.62,
      metalness: 0.3,
      envMapIntensity: 0.55,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });
    const loopBuilding = new THREE.Mesh(
      new THREE.BoxGeometry(loopBuildingW, loopBuildingH, loopBuildingD),
      loopBuildingMaterial
    );
    loopBuilding.position.set(28, loopBuildingH / 2, 14);
    loopBuilding.userData.obstacle = true;
    loopBuilding.userData.crashMessage = "建物に衝突しました。";
    loopBuilding.userData.halfSize = { x: loopBuildingW / 2, y: loopBuildingH / 2, z: loopBuildingD / 2 };
    ground.add(loopBuilding);
    obstacles.push(loopBuilding);

    const loopDisplayWindows = [];
    const loopStepX = loopBuildingW / (LOOP_DISPLAY_COLS + 1);
    const loopStepY = loopBuildingH / (LOOP_DISPLAY_ROWS_TOTAL + 1);
    for (let cx = 0; cx < LOOP_DISPLAY_COLS; cx += 1) {
      loopDisplayWindows.push([]);
      for (let r = 0; r < 5; r += 1) {
        const ry = LOOP_DISPLAY_PAD_BOTTOM + r;
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.position.set(
          loopBuilding.position.x - loopBuildingW / 2 + loopStepX * (cx + 1),
          loopStepY * (ry + 1),
          loopBuilding.position.z + loopBuildingD / 2 + 0.02
        );
        win.visible = false;
        ground.add(win);
        loopDisplayWindows[cx].push(win);
      }
    }

    function updateLoopDisplay() {
      const loop = state.loopCount;
      const str = loop > 99 ? "!?" : String(loop).padStart(2, "0");
      for (let cx = 0; cx < LOOP_DISPLAY_COLS; cx += 1) {
        for (let r = 0; r < 5; r += 1) {
          loopDisplayWindows[cx][r].visible = false;
        }
      }
      for (let i = 0; i < 2; i += 1) {
        const pattern = LOOP_DISPLAY_FONT[str[i]];
        if (!pattern) continue;
        const colOffset = i * 4;
        for (let r = 0; r < 5; r += 1) {
          for (let c = 0; c < 3; c += 1) {
            if (pattern[r][c] !== "X") continue;
            const localRow = 4 - r;
            const buildingCol = colOffset + c;
            if (loopDisplayWindows[buildingCol]) {
              loopDisplayWindows[buildingCol][localRow].visible = true;
            }
          }
        }
      }
    }
    updateLoopDisplay();

    loopingGroundObjects.push(ground);
    {
      const seen = new Set();
      const fadeMaterials = [];
      ground.traverse((child) => {
        if (child.material && !seen.has(child.material)) {
          seen.add(child.material);
          child.material.transparent = true;
          child.material.userData.baseOpacity = child.material.opacity;
          fadeMaterials.push(child.material);
        }
      });
      ground.userData.fadeMaterials = fadeMaterials;
    }

    // 海面: 島々の下に広がる水。波 (合成サイン波 + ノイズ) の法線でフレネル反射と
    // 月の鏡面反射を描き、遠方は霧と同じ式でフェードして空に溶かす。
    // ジオメトリは1枚板で、波はすべてフラグメントシェーダ側で計算する。
    const waterUniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uDeepColor: { value: new THREE.Color(tuning.WATER_DEEP_COLOR) },
      uShallowColor: { value: new THREE.Color(tuning.WATER_SHALLOW_COLOR) },
      uHorizonColor: { value: new THREE.Color(0xd49b72) },
      uZenithColor: { value: new THREE.Color(0x1a2a60) },
      uMoonPos: { value: moonGroup.position },
      uMoonColor: { value: new THREE.Color(0xffeebb) },
      uFogColor: { value: scene.fog.color.clone() },
      uFogDensity: { value: scene.fog.density },
      uWaveAmp: { value: tuning.WATER_WAVE_AMP },
      uOpacity: { value: 1 }
    };
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorld = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uScroll;
        uniform float uFogDensity;
        uniform float uWaveAmp;
        uniform float uOpacity;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uZenithColor;
        uniform vec3 uMoonPos;
        uniform vec3 uMoonColor;
        uniform vec3 uFogColor;
        varying vec3 vWorld;

        // sin ベースのハッシュは座標が大きいと精度が破綻して格子模様になるため、
        // sin を使わない Hoskins ハッシュ + 座標の事前折り返しで大座標でも均質にする。
        float hash(vec2 p) {
          p = mod(p, 1024.0);
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float waveHeight(vec2 p) {
          float t = uTime;
          float h = 0.0;
          h += sin(p.x * 0.055 + t * 0.85) * 0.45;
          h += sin((p.x * 0.5 + p.y) * 0.042 - t * 0.62) * 0.34;
          h += sin((p.y * 0.9 - p.x * 0.3) * 0.105 + t * 1.25) * 0.18;
          h += vnoise(p * 0.11 + vec2(t * 0.16, -t * 0.12)) * 0.6;
          h += vnoise(p * 0.42 + vec2(-t * 0.28, t * 0.2)) * 0.24;
          h += vnoise(p * 0.95 + vec2(t * 0.5, t * 0.38)) * 0.12; // 細かいさざ波
          h += vnoise(p * 2.1 + vec2(-t * 0.7, t * 0.55)) * 0.05; // さらに細かい波面ファセット
          return h * uWaveAmp;
        }
        void main() {
          vec2 p = vec2(vWorld.x, vWorld.z - uScroll);
          float eps = 0.22; // 最細オクターブ (波長~0.5) を法線が拾えるよう差分幅は波長の半分未満にする
          float h0 = waveHeight(p);
          float hx = waveHeight(p + vec2(eps, 0.0));
          float hz = waveHeight(p + vec2(0.0, eps));
          vec3 normal = normalize(vec3(h0 - hx, eps, h0 - hz));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fresnel = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), 3.0);
          fresnel = clamp(fresnel, 0.05, 1.0);
          vec3 skyReflect = mix(uZenithColor, uHorizonColor, pow(fresnel, 0.7));
          // 深浅の混色は控えめな高めの周波数に留める。低周波で強く混ぜると
          // 月の光道の中に巨大な暗い染みが浮き出てしまう。
          float depthMix = vnoise(p * 0.06) * 0.25;
          vec3 waterBody = mix(uDeepColor, uShallowColor, depthMix);
          vec3 col = mix(waterBody, skyReflect, fresnel * 0.85);
          vec3 reflectDir = reflect(-viewDir, normal);
          vec3 moonDir = normalize(uMoonPos - vWorld);
          float moonAlign = max(dot(reflectDir, moonDir), 0.0);
          // 月の煌めきは貼り付けたノイズではなく波の法線そのものから出す。
          // 波面のファセットがたまたま月を正反射した画素だけが鋭く光るので、
          // 近距離では点の煌めき、遠距離では自然な光の道にまとまる。
          float spec = pow(moonAlign, 600.0) * 2.6;
          float sheen = pow(moonAlign, 28.0) * 0.06; // 光道のごく薄い下地
          col += uMoonColor * (spec + sheen);
          float dist = length(cameraPosition - vWorld);
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
          col = mix(col, uFogColor, fogFactor * 0.65);
          float alpha = uOpacity * (1.0 - fogFactor);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2400), waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, tuning.WATER_LEVEL_Y, -600);
    water.renderOrder = -3; // 透明パスの最初に描き、島や雲が上に重なるようにする。
    scene.add(water);

    const waterColorTmp = new THREE.Color();
    function updateWater(high) {
      const u = waterUniforms;
      const snow = state.snowSkyFactor;
      u.uFogColor.value.copy(scene.fog.color);
      u.uFogDensity.value = scene.fog.density;
      u.uDeepColor.value
        .setHex(state.redMoon ? tuning.WATER_DEEP_COLOR_RED_MOON : tuning.WATER_DEEP_COLOR)
        .lerp(waterColorTmp.setHex(tuning.WATER_DEEP_COLOR_SNOW), snow)
        .multiplyScalar(1 - high * 0.85);
      u.uShallowColor.value
        .setHex(state.redMoon ? tuning.WATER_SHALLOW_COLOR_RED_MOON : tuning.WATER_SHALLOW_COLOR)
        .lerp(waterColorTmp.setHex(tuning.WATER_SHALLOW_COLOR_SNOW), snow)
        .multiplyScalar(1 - high * 0.85);
      u.uHorizonColor.value
        .set(redMoonBaseSky ? "#8d383d" : "#d49b72")
        .lerp(waterColorTmp.set("#c5bcc0"), snow)
        .multiplyScalar(1 - high);
      u.uZenithColor.value
        .set(redMoonBaseSky ? "#151848" : "#1a2a60")
        .lerp(waterColorTmp.set("#324270"), snow)
        .multiplyScalar(1 - high * 0.9);
      u.uMoonColor.value
        .setHex(state.redMoon ? 0xff8678 : 0xffeebb)
        .multiplyScalar(THREE.MathUtils.lerp(0.8, 1.3, high));
      u.uWaveAmp.value = THREE.MathUtils.lerp(tuning.WATER_WAVE_AMP, tuning.WATER_WAVE_AMP_SNOW, snow);
      u.uOpacity.value = THREE.MathUtils.lerp(1, 0.35, high);
    }

    for (let i = 0; i < 36; i += 1) {
      const baseOpacity = 0.36 + Math.random() * 0.34;
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(18 + Math.random() * 30, 6 + Math.random() * 12),
        new THREE.MeshBasicMaterial({
          map: createCloudTexture(),
          transparent: true,
          opacity: baseOpacity,
          depthWrite: false,
          fog: false
        })
      );
      cloud.position.set((Math.random() - 0.5) * 74, 8 + Math.random() * 16, -12 - i * 9 - Math.random() * 18);
      cloud.rotation.z = (Math.random() - 0.5) * 0.12;
      cloud.userData.speed = 0.04 + Math.random() * 0.08;
      cloud.userData.baseOpacity = baseOpacity;
      scene.add(cloud);
      loopingClouds.push(cloud);
      clouds.push(cloud);
    }

    const softGlowTexture = (() => {
      const size = 128;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0.0, "rgba(255,255,255,0.55)");
      grad.addColorStop(0.18, "rgba(255,255,255,0.32)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.12)");
      grad.addColorStop(1.0, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

    const sparkleTexture = (() => {
      const size = 128;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      const cx = size / 2;
      const cy = size / 2;
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = "lighter";
      ctx.filter = "blur(2px)";

      const hGrad = ctx.createLinearGradient(0, cy, size, cy);
      hGrad.addColorStop(0, "rgba(255,255,255,0)");
      hGrad.addColorStop(0.5, "rgba(255,255,255,0.9)");
      hGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, cy - 1.5, size, 3);

      const vGrad = ctx.createLinearGradient(cx, 0, cx, size);
      vGrad.addColorStop(0, "rgba(255,255,255,0)");
      vGrad.addColorStop(0.5, "rgba(255,255,255,0.9)");
      vGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = vGrad;
      ctx.fillRect(cx - 1.5, 0, 3, size);

      const dotGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.14);
      dotGrad.addColorStop(0, "rgba(255,255,255,1)");
      dotGrad.addColorStop(0.45, "rgba(255,255,255,0.55)");
      dotGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = dotGrad;
      ctx.fillRect(0, 0, size, size);

      const haloGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.6);
      haloGrad.addColorStop(0, "rgba(255,255,255,0.42)");
      haloGrad.addColorStop(0.55, "rgba(255,255,255,0.16)");
      haloGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, size, size);

      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

    const atmosphereSparkMaterials = tuning.ATMOSPHERE_SPARK_COLORS.map((color) => new THREE.SpriteMaterial({
      map: softGlowTexture,
      color,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));

    const ship = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x6fb0ff,
      emissive: 0x2a6fe0,
      emissiveIntensity: 2.1,
      metalness: 0.08,
      roughness: 0.18
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4f9bff,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    function createSleeveGeometry(side, length = 3.3, width = 1.0, lift = 0) {
      const segments = 18;
      const positions = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const taper = 1 - t * 0.72;
        const arch = Math.sin(t * Math.PI);
        const ripple = Math.sin(t * Math.PI * 2.2) * 0.08;
        const x = side * (0.22 + t * length);
        const y = lift + arch * 0.24 - t * 0.18;
        const z = 0.02 + t * 1.34 + ripple;
        const half = width * taper * (0.18 + arch * 0.82);

        positions.push(x, y + half * 0.2, z - half * 0.46);
        positions.push(x, y - half * 0.24, z + half * 0.42);
        uvs.push(t, 1, t, 0);

        if (i < segments) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }

    function createSleeve(side) {
      const sleeve = new THREE.Group();
      const colors = [0xb6e2ff, 0x6fb8ff, 0x3d8eff];
      for (let i = 0; i < 3; i += 1) {
        const material = new THREE.MeshBasicMaterial({
          color: colors[i],
          transparent: true,
          opacity: 0.26 - i * 0.045,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const cloth = new THREE.Mesh(
          createSleeveGeometry(side, 2.85 + i * 0.42, 0.95 + i * 0.18, i * 0.035),
          material
        );
        cloth.userData.phase = i * 0.7 + side * 0.35;
        cloth.renderOrder = 3;
        sleeve.add(cloth);
      }
      return sleeve;
    }

    const body = new THREE.Group();
    const prismGeo = new THREE.BufferGeometry();
    prismGeo.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0.34, -0.95,
      -0.52, -0.18, 0.58,
      0.52, -0.18, 0.58,
      0, -0.42, 0.95
    ], 3));
    prismGeo.setIndex([
      0, 1, 2,
      0, 3, 1,
      0, 2, 3,
      1, 3, 2
    ]);
    prismGeo.computeVertexNormals();
    const prism = new THREE.Mesh(prismGeo, bodyMat);
    prism.scale.set(0.85, 0.72, 1.05);
    body.add(prism);

    const coreLight = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softGlowTexture,
      color: 0x9fd4ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    coreLight.scale.set(1.4, 1.4, 1);
    body.add(coreLight);
    ship.add(body);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softGlowTexture,
      color: 0x7fc2ff,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    glow.scale.set(tuning.SHIP_GLOW_WIDTH, tuning.SHIP_GLOW_HEIGHT, 1);
    glow.position.set(0, 0.02, 0.08);
    glow.renderOrder = 2;
    ship.add(glow);

    const FUEL_DISK_NATURAL_DIAMETER = 5.1; // 内側リングの外周直径（2.55 × 2）
    const fuelDiskMat = new THREE.MeshBasicMaterial({
      color: tuning.FUEL_DISK_COLOR,
      transparent: true,
      opacity: tuning.FUEL_DISK_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const fuelDiskEdgeMat = fuelDiskMat.clone();
    fuelDiskEdgeMat.color.setHex(tuning.FUEL_DISK_TANK_COLOR);
    fuelDiskEdgeMat.opacity = tuning.FUEL_DISK_OPACITY * 0.5;
    const fuelDiskInner = new THREE.Mesh(new THREE.RingGeometry(1.15, 2.55, 96), fuelDiskMat);
    const tankOuterR = tuning.FUEL_DISK_MAX_DIAMETER / 2;
    const fuelDiskOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(tankOuterR, tankOuterR, 0.15, 96, 1, true),
      fuelDiskEdgeMat
    );
    const fuelDisk = new THREE.Group();
    fuelDisk.add(fuelDiskInner);
    fuelDisk.rotation.x = Math.PI / 2;
    fuelDisk.position.set(0, tuning.FUEL_DISK_Y_OFFSET, 0.08);
    ship.add(fuelDisk);
    fuelDiskOuter.position.set(0, tuning.FUEL_DISK_Y_OFFSET, 0.08);
    ship.add(fuelDiskOuter);

    const sleeveL = createSleeve(-1);
    const sleeveR = createSleeve(1);
    sleeveL.rotation.z = 0.18;
    sleeveR.rotation.z = -0.18;
    ship.add(sleeveL, sleeveR);

    const engine = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softGlowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    engine.scale.set(0.55, 0.55, 1);
    engine.position.set(0, -0.42, 0.95);
    engine.renderOrder = 5;
    ship.add(engine);

    const engineHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softGlowTexture,
      color: 0x4f9bff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    engineHalo.scale.set(1.4, 1.0, 1);
    engineHalo.position.set(0, -0.42, 0.9);
    engineHalo.renderOrder = 4;
    ship.add(engineHalo);

    const shipLight = new THREE.PointLight(0x4f9bff, 2.6, 12);
    shipLight.position.set(0, 0.2, 0.2);
    ship.add(shipLight);
    ship.position.set(0, 26, 7);
    scene.add(ship);

    const guideTrail = new THREE.Group();
    const GUIDE_PARTICLE_COUNT = 20;
    const guideGeo = new THREE.BoxGeometry(
      tuning.GUIDE_PARTICLE_SIZE,
      tuning.GUIDE_PARTICLE_SIZE,
      tuning.GUIDE_PARTICLE_SIZE
    );
    const createGuideParticle = () => {
      const material = new THREE.MeshBasicMaterial({
        color: tuning.GUIDE_COLOR,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false
      });
      const particle = new THREE.Mesh(guideGeo, material);
      particle.frustumCulled = false;
      particle.renderOrder = 999;
      return particle;
    };

    for (let i = 0; i < GUIDE_PARTICLE_COUNT; i += 1) {
      guideTrail.add(createGuideParticle());
    }
    guideTrail.visible = false;
    guideTrail.renderOrder = 999;
    scene.add(guideTrail);

    const diskRadius = tuning.PICKUP_RING_RADIUS / 3;

    const chainCanvas = document.createElement("canvas");
    chainCanvas.width = chainCanvas.height = 512;
    const chainCtx = chainCanvas.getContext("2d");
    const chainTexture = new THREE.CanvasTexture(chainCanvas);
    chainTexture.anisotropy = 4;
    const chainMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: chainTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide
      })
    );
    const CHAIN_SPRITE_BASE = diskRadius * 3.4;
    const CHAIN_FADE_DURATION = 0.7;
    const CHAIN_FADE_RISE = 1.4;
    chainMesh.scale.set(CHAIN_SPRITE_BASE, CHAIN_SPRITE_BASE, 1);
    chainMesh.renderOrder = 1000;
    chainMesh.visible = false;
    scene.add(chainMesh);
    let chainFadeValue = 0;
    let chainFadeTime = -1;
    let chainFadeRainbow = false;
    const chainFadePos = new THREE.Vector3();
    const chainColorTmp = new THREE.Color();
    const CHAIN_FONT = "'Doto', system-ui, monospace";
    const chainGlowCss = (rainbow) => {
      if (rainbow) {
        chainColorTmp.setHSL((clock.elapsedTime * 0.3) % 1, 1.0, 0.62);
      } else {
        chainColorTmp.setHex(state.redMoon ? RED_MOON_GUIDE_COLOR : tuning.GUIDE_COLOR);
      }
      return chainColorTmp.getStyle();
    };
    const drawChainSprite = (value, glow) => {
      const size = chainCanvas.width;
      chainCtx.clearRect(0, 0, size, size);
      chainCtx.textAlign = "center";
      chainCtx.textBaseline = "middle";
      const text = String(value);
      let fontSize = 300;
      chainCtx.font = `bold ${fontSize}px ${CHAIN_FONT}`;
      const maxWidth = size * 0.74;
      const measured = chainCtx.measureText(text).width;
      if (measured > maxWidth) {
        fontSize = Math.floor(fontSize * (maxWidth / measured));
        chainCtx.font = `bold ${fontSize}px ${CHAIN_FONT}`;
      }
      const cx = size / 2;
      const cy = size / 2;
      // 本体を色で塗り、同色の控えめなグローをまとわせる。フチなし。
      chainCtx.shadowColor = glow;
      chainCtx.shadowBlur = size * 0.06;
      chainCtx.fillStyle = glow;
      chainCtx.fillText(text, cx, cy);
      chainCtx.shadowBlur = 0;
      chainCtx.fillText(text, cx, cy);
      chainTexture.needsUpdate = true;
    };
    // 取得したリングの位置で、そのチェイン数をふわっと浮かべて消す。
    const triggerChainNumber = (value, position, rainbow) => {
      chainFadeValue = value;
      chainFadePos.copy(position);
      chainFadeRainbow = rainbow;
      chainFadeTime = clock.elapsedTime;
      if (!rainbow) drawChainSprite(value, chainGlowCss(false));
    };
    const updateChainNumber = () => {
      const age = clock.elapsedTime - chainFadeTime;
      if (chainFadeTime < 0 || age >= CHAIN_FADE_DURATION) {
        chainMesh.visible = false;
        return;
      }
      const t = age / CHAIN_FADE_DURATION;
      const ease = 1 - Math.pow(1 - t, 3);
      const scale = CHAIN_SPRITE_BASE * (1 + 0.18 * ease);
      chainMesh.scale.set(scale, scale, 1);
      chainMesh.material.opacity = Math.pow(1 - t, 1.6);
      if (chainFadeRainbow) drawChainSprite(chainFadeValue, chainGlowCss(true));
      chainMesh.position.set(chainFadePos.x, chainFadePos.y + ease * CHAIN_FADE_RISE, chainFadePos.z);
      chainMesh.visible = true;
    };
    // Doto は Canvas 描画でしか使わないため、明示的に先読みしないとブラウザがフェッチせず、
    // 最初のチェイン数がフォールバックフォントで焼き込まれてしまう。起動時にロードしておく。
    const preloadChainFont = () => {
      if (!document.fonts || !document.fonts.load) return;
      const tryLoad = () => document.fonts.load("700 300px 'Doto'");
      tryLoad()
        .then((faces) => (faces && faces.length) ? faces : document.fonts.ready.then(tryLoad))
        .then(() => {
          // 先読み完了前にすでに表示中なら、正しいフォントで描き直す（虹は毎フレーム再描画なので除く）。
          if (chainFadeTime >= 0 && !chainFadeRainbow) {
            drawChainSprite(chainFadeValue, chainGlowCss(false));
          }
        })
        .catch(() => {});
    };
    preloadChainFont();

    const shadowTexture = (() => {
      const size = 256;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      ctx.clearRect(0, 0, size, size);
      ctx.filter = "blur(32px)";
      const cx = size / 2;
      const cy = size / 2;
      ctx.fillStyle = "rgba(100, 100, 100, 0.6)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.04, size * 0.075, size * 0.30, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * size * 0.04, cy - size * 0.10);
        ctx.quadraticCurveTo(
          cx + side * size * 0.30, cy - size * 0.02,
          cx + side * size * 0.46, cy + size * 0.32
        );
        ctx.lineTo(cx + side * size * 0.34, cy + size * 0.38);
        ctx.quadraticCurveTo(
          cx + side * size * 0.18, cy + size * 0.16,
          cx + side * size * 0.05, cy + size * 0.06
        );
        ctx.closePath();
        ctx.fill();
      }
      return new THREE.CanvasTexture(cv);
    })();
    const shipShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false
      })
    );
    shipShadow.rotation.x = -Math.PI / 2;
    shipShadow.scale.set(3, 3, 1);
    scene.add(shipShadow);

    const pickupGeo = new THREE.TorusGeometry(
      tuning.PICKUP_RING_RADIUS,
      tuning.PICKUP_RING_TUBE_RADIUS,
      tuning.PICKUP_RING_RADIAL_SEGMENTS,
      tuning.PICKUP_RING_TUBULAR_SEGMENTS
    );
    // 金属ゴールドの実在感: metalness=1 + 環境マップ反射で「磨かれた金の輪」にする。
    // 視認性はエミッシブと各リングの PointLight が引き続き担保する。
    const pickupMat = new THREE.MeshStandardMaterial({
      color: 0xffce7a,
      emissive: 0xffe9b8,
      emissiveIntensity: 0.3,
      metalness: 1.0,
      roughness: 0.24,
      envMapIntensity: 1.5,
      fog: false,
      depthTest: false,
      toneMapped: false
    });
    const sparkleMaterial = new THREE.PointsMaterial({
      map: sparkleTexture,
      color: 0xffd84d,
      size: tuning.SPARKLE_SIZE,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const rainbowSparkleMaterial = new THREE.PointsMaterial({
      map: sparkleTexture,
      color: 0xffffff,
      vertexColors: true,
      size: tuning.RAINBOW_SPARKLE_SIZE,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    function createSparkleRing(count = tuning.SPARKLE_COUNT, material = sparkleMaterial, opts = {}) {
      const positions = new Float32Array(count * 3);
      const phase = new Float32Array(count);
      const baseAngle = new Float32Array(count);
      const baseRadius = new Float32Array(count);
      const angularSpeed = new Float32Array(count);
      const colors = opts.rainbow ? new Float32Array(count * 3) : null;
      const tmpColor = colors ? new THREE.Color() : null;
      const hueOffset = opts.hueOffset ?? 0;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + Math.random() * tuning.SPARKLE_RING_ANGLE_RANDOM;
        const r = tuning.SPARKLE_RING_RADIUS + (Math.random() - 0.5) * tuning.SPARKLE_RING_RADIUS_RANDOM;
        baseAngle[i] = a;
        baseRadius[i] = r;
        phase[i] = Math.random() * Math.PI * 2;
        angularSpeed[i] = (Math.random() - 0.5) * tuning.SPARKLE_RING_ANGULAR_SPEED;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = Math.sin(a) * r;
        positions[i * 3 + 2] = (Math.random() - 0.5) * tuning.SPARKLE_RING_Z_RANDOM;
        if (colors) {
          tmpColor.setHSL((hueOffset + i / count) % 1, 1.0, 0.55);
          colors[i * 3] = tmpColor.r;
          colors[i * 3 + 1] = tmpColor.g;
          colors[i * 3 + 2] = tmpColor.b;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      if (colors) geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const points = new THREE.Points(geo, material);
      points.userData.phase = phase;
      points.userData.baseAngle = baseAngle;
      points.userData.baseRadius = baseRadius;
      points.userData.angularSpeed = angularSpeed;
      points.userData.count = count;
      return points;
    }

    function createRainbowPickupRing(hueBase = 0) {
      const group = new THREE.Group();
      const segments = tuning.RAINBOW_RING_SEGMENTS;
      const arc = (Math.PI * 2) / segments;
      for (let i = 0; i < segments; i += 1) {
        const color = new THREE.Color().setHSL((hueBase + i / segments) % 1, 1.0, 0.58);
        const material = new THREE.MeshBasicMaterial({
          color,
          fog: false,
          depthTest: false,
          transparent: true,
          opacity: 1
        });
        const glowMaterial = new THREE.MeshBasicMaterial({
          color,
          fog: false,
          depthTest: false,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending
        });
        const segment = new THREE.Mesh(new THREE.TorusGeometry(
          tuning.RAINBOW_RING_RADIUS,
          tuning.RAINBOW_RING_TUBE_RADIUS,
          tuning.RAINBOW_RING_RADIAL_SEGMENTS,
          tuning.RAINBOW_RING_TUBULAR_SEGMENTS,
          arc * tuning.RAINBOW_RING_ARC_COVERAGE
        ), material);
        const glow = new THREE.Mesh(new THREE.TorusGeometry(
          tuning.RAINBOW_RING_GLOW_RADIUS,
          tuning.RAINBOW_RING_GLOW_TUBE_RADIUS,
          tuning.RAINBOW_RING_GLOW_RADIAL_SEGMENTS,
          tuning.RAINBOW_RING_TUBULAR_SEGMENTS,
          arc * tuning.RAINBOW_RING_ARC_COVERAGE
        ), glowMaterial);
        segment.rotation.z = i * arc;
        glow.rotation.z = i * arc;
        group.add(glow, segment);
      }
      return group;
    }


    function disposeRenderable(object) {
      object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
          else child.material.dispose();
        }
      });
    }
    const trailGeo = new THREE.SphereGeometry(0.035, 8, 6);
    const trailColors = [0xffe49a];
    const boostTrailColors = [0xffd66b];
    // 赤い月では燃料やブースト由来の光を赤系に寄せる。tuning.RED_MOON_BASE_COLOR を基準に
    // HSL シフトで派生させているので、ベース色を変えればこの下のパレットがまとめて連動する。
    const RED_MOON_BASE_HSL = new THREE.Color(tuning.RED_MOON_BASE_COLOR).getHSL({});
    function redMoonShade(dL = 0, dS = 0, dH = 0) {
      return new THREE.Color().setHSL(
        (RED_MOON_BASE_HSL.h + dH + 1) % 1,
        THREE.MathUtils.clamp(RED_MOON_BASE_HSL.s + dS, 0, 1),
        THREE.MathUtils.clamp(RED_MOON_BASE_HSL.l + dL, 0, 1)
      );
    }
    const RED_MOON_GUIDE_COLOR = tuning.RED_MOON_BASE_COLOR;
    const redMoonTrailColors = [redMoonShade(+0.094, 0, +0.023).getHex()];
    const redMoonBoostTrailColors = [redMoonShade(-0.029).getHex()];
    const redMoonFuelNormal = redMoonShade(+0.034, 0, +0.017);
    const redMoonFuelBoost = redMoonShade(-0.066);

    const colorNormal = {
      body: new THREE.Color(0x6fb0ff),
      bodyEmissive: new THREE.Color(0x2a6fe0),
      glow: new THREE.Color(0x7fc2ff),
      core: new THREE.Color(0x9fd4ff),
      fuelDisk: new THREE.Color(0xffd66b),
      engineHalo: new THREE.Color(0x4f9bff),
      light: new THREE.Color(0x4f9bff),
      sleeve0: new THREE.Color(0xb6e2ff),
      sleeve1: new THREE.Color(0x6fb8ff),
      sleeve2: new THREE.Color(0x3d8eff)
    };
    const colorBoost = {
      body: new THREE.Color(0xffe07a),
      bodyEmissive: new THREE.Color(0xffa830),
      glow: new THREE.Color(0xffd24a),
      core: new THREE.Color(0xfff6c8),
      fuelDisk: new THREE.Color(0xffd24a),
      engineHalo: new THREE.Color(0xffb13a),
      light: new THREE.Color(0xffc24a),
      sleeve0: new THREE.Color(0xfff2b8),
      sleeve1: new THREE.Color(0xffd24a),
      sleeve2: new THREE.Color(0xff9a28)
    };
    const colorBoostRedMoon = {
      body: redMoonShade(+0.028, 0, +0.002),
      bodyEmissive: redMoonShade(-0.098, 0, -0.012),
      glow: redMoonShade(-0.039, 0, -0.016),
      core: redMoonShade(+0.216, 0, +0.024),
      fuelDisk: redMoonFuelBoost,
      engineHalo: redMoonShade(-0.076, 0, -0.017),
      light: redMoonShade(-0.039, 0, -0.016),
      sleeve0: redMoonShade(+0.200, 0, +0.016),
      sleeve1: redMoonShade(0, 0, -0.010),
      sleeve2: redMoonShade(-0.168, -0.303, -0.015)
    };
    function disposePickup(item) {
      const halo = item.children[1];
      const r = item.children[0];
      if (halo && halo.geometry) halo.geometry.dispose();
      if (item.userData.rainbow) {
        if (r) disposeRenderable(r);
      } else if (r && r.material) {
        r.material.dispose();
      }
      if (halo && halo.material) halo.material.dispose();
      disposePickupDebugWires(item);
    }

    function resetObjects() {
      for (const item of pickups) {
        disposePickup(item);
        scene.remove(item);
      }
      for (const item of particles) {
        scene.remove(item);
        if (item.userData.trail) item.material.dispose();
      }
      pickups.length = 0;
      particles.length = 0;
    }

    function spawnPickup(opts = {}) {
      const pickup = new THREE.Group();
      const isRainbow = !!opts.rainbow;
      const hue = opts.hue ?? 0;
      let ringMat;
      let haloMat;
      if (isRainbow) {
        haloMat = rainbowSparkleMaterial.clone();
      } else {
        ringMat = pickupMat.clone();
        ringMat.transparent = true;
        haloMat = sparkleMaterial.clone();
        if (state.redMoon) {
          ringMat.color.setHex(tuning.RED_MOON_BASE_COLOR);
          ringMat.emissive.setHex(tuning.RED_MOON_BASE_COLOR);
          ringMat.emissiveIntensity = 0.5;
          haloMat.color.setHex(tuning.RED_MOON_BASE_COLOR);
        }
      }
      const halo = isRainbow
        ? createSparkleRing(tuning.RAINBOW_SPARKLE_COUNT, haloMat, { rainbow: true, hueOffset: hue })
        : createSparkleRing(tuning.SPARKLE_COUNT, haloMat);
      const ring = isRainbow ? createRainbowPickupRing(hue) : new THREE.Mesh(pickupGeo, ringMat);
      if (!isRainbow) ring.scale.z = tuning.PICKUP_RING_BODY_Z_SCALE;
      const lightColor = isRainbow ? 0xffffff : state.redMoon ? tuning.RED_MOON_BASE_COLOR : 0xffffff;
      const ringLight = new THREE.PointLight(lightColor, isRainbow ? 3.5 : 5.5, 18);
      ring.renderOrder = 6;
      halo.renderOrder = 5;
      pickup.add(ring, halo, ringLight);
      if (!state.lastRing) state.lastRing = { x: 0, y: state.running ? ship.position.y : 28 };
      let nextX, nextY;
      let extremeJump = false;
      if (isRainbow) {
        nextX = state.lastRing.x;
        nextY = state.lastRing.y;
      } else {
        nextX = THREE.MathUtils.clamp(state.lastRing.x + (Math.random() - 0.5) * tuning.PICKUP_X_RANDOM * 2, -10, 10);
        const r = Math.random();
        let candidateY;
        if (r < 0.18) {
          candidateY = -32 + Math.random() * 14;
          extremeJump = true;
        } else if (r < 0.32) {
          candidateY = 55 + Math.random() * 30;
          extremeJump = true;
        } else {
          candidateY = THREE.MathUtils.clamp(state.lastRing.y + (Math.random() - 0.5) * tuning.PICKUP_Y_RANDOM * 2, -32, 88);
        }
        // 前回スポーンからの経過時間で機体がノーブーストで動ける Y 距離にクランプする。
        // これで「速い間隔 × 極端ジャンプ」の取れない並びが原理的に出ない。
        const maxYDelta = opts.maxYDeltaFromLast ?? Infinity;
        const lastY = state.lastRing.y;
        nextY = THREE.MathUtils.clamp(candidateY, lastY - maxYDelta, lastY + maxYDelta);
        nextY = THREE.MathUtils.clamp(nextY, -32, 88);
        // クランプで実質的に極端ジャンプじゃなくなったら、次回間隔強制も解除する。
        if (Math.abs(nextY - candidateY) > 0.01) extremeJump = false;
      }
      state.lastRing.x = nextX;
      state.lastRing.y = nextY;
      pickup.position.set(
        nextX,
        nextY,
        tuning.PICKUP_SPAWN_Z_BASE - Math.random() * tuning.PICKUP_SPAWN_Z_RANDOM
      );
      pickup.rotation.set(0, 0, Math.random() * Math.PI);
      pickup.userData.value = 100;
      pickup.userData.rainbow = isRainbow;
      const fadeMaterials = [];
      pickup.traverse((child) => {
        if (child.material) {
          const m = child.material;
          m.transparent = true;
          m.userData.baseOpacity = m.opacity;
          fadeMaterials.push(m);
        }
      });
      pickup.userData.fadeMaterials = fadeMaterials;
      if (state.debugHitboxes) ensurePickupDebugWires(pickup);
      scene.add(pickup);
      pickups.push(pickup);
      return { extreme: extremeJump };
    }

    const burstGeometry = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const burstRingGeometry = new THREE.BoxGeometry(
      tuning.RING_BURST_PARTICLE_SIZE,
      tuning.RING_BURST_PARTICLE_SIZE,
      tuning.RING_BURST_PARTICLE_SIZE
    );
    const burstMaterialCache = new Map();
    function getBurstMaterial(color) {
      const key = new THREE.Color(color).getHex();
      let mat = burstMaterialCache.get(key);
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({ color: key });
        burstMaterialCache.set(key, mat);
      }
      return mat;
    }

    function burst(position, color, count = 14, velocityBias = null) {
      const mat = getBurstMaterial(color);
      for (let i = 0; i < count; i += 1) {
        const p = new THREE.Mesh(burstGeometry, mat);
        p.position.copy(position);
        p.userData.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 5,
          (Math.random() - 0.5) * 8
        );
        if (velocityBias) p.userData.velocity.add(velocityBias);
        p.userData.life = 0.55 + Math.random() * 0.35;
        scene.add(p);
        particles.push(p);
      }
    }

    function emitExhaustPuff() {
      const puffPos = new THREE.Vector3(ship.position.x, ship.position.y - 0.5, ship.position.z + 1.0);
      const bias = new THREE.Vector3(0, 0.2, 6);
      burst(puffPos, 0xdfe6ee, 16, bias);
    }

    function spawnAtmosphereSpark(intensity = 1) {
      const mat = atmosphereSparkMaterials[Math.floor(Math.random() * atmosphereSparkMaterials.length)];
      const p = new THREE.Sprite(mat);
      p.position.set(
        ship.position.x + (Math.random() - 0.5) * tuning.ATMOSPHERE_SPARK_SPREAD_X,
        ship.position.y + tuning.ATMOSPHERE_SPARK_OFFSET_Y + (Math.random() - 0.5) * tuning.ATMOSPHERE_SPARK_SPREAD_Y,
        ship.position.z + tuning.ATMOSPHERE_SPARK_OFFSET_Z + (Math.random() - 0.5) * tuning.ATMOSPHERE_SPARK_SPREAD_Z
      );
      p.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * tuning.ATMOSPHERE_SPARK_SPEED_X * intensity,
        (Math.random() - 0.5) * tuning.ATMOSPHERE_SPARK_SPEED_Y * intensity,
        (tuning.ATMOSPHERE_SPARK_SPEED_Z + Math.random() * 1.6) * intensity
      );
      p.userData.life = tuning.ATMOSPHERE_SPARK_LIFE_BASE + Math.random() * tuning.ATMOSPHERE_SPARK_LIFE_RANDOM;
      p.userData.maxLife = p.userData.life;
      p.userData.atmosphereSpark = true;
      p.userData.startScale = tuning.ATMOSPHERE_SPARK_SIZE * tuning.ATMOSPHERE_SPARK_SPRITE_START_SCALE;
      p.userData.endScale = tuning.ATMOSPHERE_SPARK_SIZE * tuning.ATMOSPHERE_SPARK_SPRITE_END_SCALE;
      p.renderOrder = 5;
      p.scale.setScalar(p.userData.startScale);
      scene.add(p);
      particles.push(p);
    }

    const rainbowBurstHueSteps = 12;
    const rainbowBurstColor = new THREE.Color();
    function burstRing(item, color, count = 24) {
      const isRainbow = item.userData.rainbow;
      const ringRadius = isRainbow ? tuning.RAINBOW_RING_RADIUS : tuning.PICKUP_RING_RADIUS;
      const sharedMat = isRainbow ? null : getBurstMaterial(color);
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * tuning.RING_BURST_ANGLE_RANDOM;
        const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
        const radius = ringRadius + (Math.random() - 0.5) * tuning.RING_BURST_RADIUS_RANDOM;
        const particleMat = isRainbow
          ? getBurstMaterial(rainbowBurstColor.setHSL(Math.floor((i / count) * rainbowBurstHueSteps) / rainbowBurstHueSteps, 1.0, 0.58).getHex())
          : sharedMat;
        const p = new THREE.Mesh(burstRingGeometry, particleMat);
        p.position.set(
          item.position.x + radial.x * radius,
          item.position.y + radial.y * radius,
          ship.position.z + (Math.random() - 0.5) * tuning.RING_BURST_Z_RANDOM
        );
        const speed = tuning.RING_BURST_RADIAL_SPEED + Math.random() * tuning.RING_BURST_RADIAL_SPEED_RANDOM;
        const dir = tuning.RING_BURST_INWARD ? -1 : 1;
        p.userData.velocity = new THREE.Vector3(
          radial.x * speed * dir,
          radial.y * speed * dir + tuning.RING_BURST_UPWARD_SPEED,
          (Math.random() - 0.5) * tuning.RING_BURST_Z_SPEED_RANDOM
        );
        p.userData.life = tuning.RING_BURST_LIFE_BASE + Math.random() * tuning.RING_BURST_LIFE_RANDOM;
        scene.add(p);
        particles.push(p);
      }
    }

    function spawnOneTrail(boostAmount = state.boost) {
      const rbTrail = THREE.MathUtils.clamp(state.rainbowTimer / 8 * tuning.TRAIL_RAINBOW_TINT_MAX, 0, 1);
      const activeTrailColors = state.redMoon ? redMoonTrailColors : trailColors;
      const activeBoostTrailColors = state.redMoon ? redMoonBoostTrailColors : boostTrailColors;
      const colorIdx = Math.floor(Math.random() * activeTrailColors.length);
      const trailColor = new THREE.Color(activeTrailColors[colorIdx]).lerp(new THREE.Color(activeBoostTrailColors[colorIdx]), boostAmount);
      if (rbTrail > 0) {
        const hue = (clock.elapsedTime * 0.35 + Math.random() * tuning.TRAIL_RAINBOW_HUE_RANDOM) % 1;
        trailColor.lerp(new THREE.Color().setHSL(hue, tuning.TRAIL_RAINBOW_SATURATION, tuning.TRAIL_RAINBOW_LIGHTNESS), rbTrail);
      }
      const spread = 1 + boostAmount * tuning.TRAIL_BOOST_SPREAD;
      const mat = new THREE.SpriteMaterial({
        map: sparkleTexture,
        color: trailColor,
        transparent: true,
        opacity: THREE.MathUtils.lerp(tuning.TRAIL_OPACITY_NORMAL, tuning.TRAIL_OPACITY_BOOST, boostAmount),
        depthTest: false,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending
      });
      const p = new THREE.Sprite(mat);
      p.position.set(
        ship.position.x + (Math.random() - 0.5) * tuning.TRAIL_OFFSET_X * spread,
        ship.position.y + tuning.TRAIL_OFFSET_Y_BASE + (Math.random() - 0.5) * tuning.TRAIL_OFFSET_Y * spread,
        ship.position.z + tuning.TRAIL_OFFSET_Z_BASE + Math.random() * (tuning.TRAIL_OFFSET_Z_RANDOM + boostAmount * tuning.TRAIL_OFFSET_Z_BOOST)
      );
      const angle = (Math.random() - 0.5) * tuning.TRAIL_ANGLE_SPREAD * (1 + boostAmount * tuning.TRAIL_ANGLE_BOOST_SPREAD);
      const angleY = (Math.random() - 0.5) * tuning.TRAIL_ANGLE_Y_SPREAD * (1 + boostAmount * tuning.TRAIL_ANGLE_Y_BOOST_SPREAD);
      const speed = tuning.TRAIL_SPEED_BASE + Math.random() * tuning.TRAIL_SPEED_RANDOM + boostAmount * tuning.TRAIL_SPEED_BOOST;
      p.userData.velocity = new THREE.Vector3(
        Math.sin(angle) * speed - input.x * tuning.TRAIL_INPUT_DRIFT,
        Math.sin(angleY) * speed * tuning.TRAIL_VERTICAL_SPEED_SCALE + tuning.TRAIL_VERTICAL_DRIFT + boostAmount * tuning.TRAIL_VERTICAL_BOOST_LIFT,
        Math.cos(angle) * speed * tuning.TRAIL_BACKWARD_SPEED_MULTIPLIER
      );
      p.userData.life = tuning.TRAIL_LIFE_BASE + Math.random() * tuning.TRAIL_LIFE_RANDOM + boostAmount * tuning.TRAIL_LIFE_BOOST;
      p.userData.maxLife = p.userData.life;
      p.userData.trail = true;
      p.userData.startScale = tuning.TRAIL_START_SCALE_BASE + Math.random() * tuning.TRAIL_START_SCALE_RANDOM + boostAmount * tuning.TRAIL_START_SCALE_BOOST;
      p.userData.endScale = p.userData.startScale + tuning.TRAIL_END_SCALE_GROWTH + Math.random() * tuning.TRAIL_END_SCALE_RANDOM + boostAmount * tuning.TRAIL_END_SCALE_BOOST;
      p.renderOrder = 4;
      p.scale.setScalar(p.userData.startScale);
      scene.add(p);
      particles.push(p);
    }

    const rankingClose = document.querySelector("#rankingClose");
    const rankingTitle = document.querySelector("#rankingTitle");
    const rankingMessage = document.querySelector("#rankingMessage");
    const rankingTableBody = document.querySelector("#rankingTableBody");
    const rankingTable = document.querySelector(".ranking-table");
    const rankingAction = document.querySelector("#rankingAction");
    const rankingSubmitBtn = document.querySelector("#rankingSubmitName");
    const rankingNameErrorEl = document.querySelector("#rankingNameError");
    const resultRankEntry = document.querySelector("#resultRankEntry");
    const resultRankEl = document.querySelector("#resultRank");
    const openRankingTopBtn = document.querySelector("#openRankingTop");
    const reopenRankingBtn = document.querySelector("#reopenRanking");
    const NAME_PATTERN = /^[A-Za-z0-9]{1,16}$/;
    const DEFAULT_RANKING_NAME = "nanashi";
    let rankingSubmitPending = false;
    const CROWN_SVG = `<svg class="rank-crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8zm2 12h14v2H5v-2z"/></svg>`;
    const DEVELOPER_MARK = `<span class="ranking-dev-mark" title="Developer" role="img" aria-label="Developer">✦</span>`;

    function setStartButton(mode) {
      if (mode === "ranking") {
        startBtn.innerHTML = `${CROWN_SVG}RANKING`;
        startBtn.dataset.action = "ranking";
        menu.classList.add("is-ranking-mode");
      } else {
        startBtn.textContent = "RETRY";
        startBtn.dataset.action = "retry";
        menu.classList.remove("is-ranking-mode");
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[c]);
    }

    function renderRankingName(row) {
      const mark = row.is_developer ? DEVELOPER_MARK : "";
      return `<span class="ranking-name-display"><span class="ranking-player-name">${escapeHtml(row.name || DEFAULT_RANKING_NAME)}</span>${mark}</span>`;
    }

    function resetRankingUi() {
      state.currentScoreId = null;
      state.currentScoreCreatedAt = null;
      state.currentSubmitSeq += 1;
      resultRankEntry.hidden = true;
      resultRankEl.hidden = true;
      resultRankEl.textContent = "";
      resultRankEl.classList.remove("is-rainbow-rank");
      menu.classList.remove("is-ranking-pending");
      setStartButton("retry");
      reopenRankingBtn.hidden = true;
    }

    function closeRanking() {
      rankingOverlay.hidden = true;
      // 編集モードで開いていた場合 (未登録キャンセル / OK 成功どちらも)、
      // 主ボタンを RETRY にしつつ RANKING 再オープンボタンを横に表示する
      if (state.currentScoreId) {
        state.currentScoreId = null;
        setStartButton("retry");
        reopenRankingBtn.hidden = false;
      }
      refreshPauseState();
    }

    function renderRankingRow(row, editingId) {
      const isSelf = row.id === editingId;
      const mark = row.is_developer ? DEVELOPER_MARK : "";
      const nameCell = isSelf
        ? `<td class="ranking-name-edit"><span class="ranking-name-display"><input id="rankingNameInput" maxlength="16" pattern="[A-Za-z0-9]+" autocomplete="off" value="${escapeHtml(row.name || DEFAULT_RANKING_NAME)}">${mark}</span></td>`
        : `<td>${renderRankingName(row)}</td>`;
      const cls = isSelf ? ' class="ranking-self"' : '';
      return `<tr${cls}><td>${row.rank}</td><td>${row.score}</td><td>${row.loop_count}</td>${nameCell}</tr>`;
    }

    async function doSubmitRankingName() {
      if (rankingSubmitPending) return;
      const input = document.querySelector("#rankingNameInput");
      if (!input || !state.currentScoreId) return;
      const name = input.value.trim();
      if (!NAME_PATTERN.test(name)) {
        rankingNameErrorEl.textContent = "半角英数字16字以内で入力してください";
        rankingNameErrorEl.hidden = false;
        return;
      }
      rankingNameErrorEl.hidden = true;
      rankingSubmitPending = true;
      rankingSubmitBtn.disabled = true;
      try {
        await setName(state.currentScoreId, name);
        state.currentScoreId = null;
        setStartButton("retry");
        reopenRankingBtn.hidden = false;
        await openRanking({ allowNameEdit: false });
      } catch (e) {
        console.warn("名前登録失敗", e);
        rankingNameErrorEl.textContent = "登録に失敗しました";
        rankingNameErrorEl.hidden = false;
      } finally {
        rankingSubmitPending = false;
        rankingSubmitBtn.disabled = false;
      }
    }

    function attachRankingNameEditHandlers() {
      const input = document.querySelector("#rankingNameInput");
      if (!input) return;
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") event.preventDefault();
      });
    }

    async function openRanking({ allowNameEdit = false } = {}) {
      rankingTableBody.innerHTML = "";
      rankingMessage.textContent = "読み込み中...";
      rankingMessage.hidden = false;
      rankingTitle.hidden = true;
      rankingTable.hidden = true;
      rankingAction.hidden = true;
      rankingNameErrorEl.hidden = true;
      rankingOverlay.hidden = false;
      refreshPauseState();
      try {
        const list = await getTopRanking(10);
        if (!list || list.length === 0) {
          rankingMessage.textContent = "まだランキングがありません";
          return;
        }
        const editingId = (allowNameEdit && state.currentScoreId) ? state.currentScoreId : null;
        const editingRow = editingId ? list.find(row => row.id === editingId) : null;
        const canEdit = !!editingRow && !editingRow.is_developer;
        rankingTableBody.innerHTML = list.map(row => renderRankingRow(row, canEdit ? editingId : null)).join("");
        rankingMessage.hidden = true;
        rankingTitle.hidden = false;
        rankingTable.hidden = false;
        if (canEdit) {
          attachRankingNameEditHandlers();
          rankingAction.hidden = false;
        }
      } catch (e) {
        console.warn("ランキング取得失敗", e);
        rankingMessage.textContent = "ランキングを取得できませんでした";
      }
    }

    rankingClose.addEventListener("click", closeRanking);
    rankingOverlay.addEventListener("click", (event) => {
      if (event.target !== rankingOverlay) return;
      // 名前編集モード中は背景クリック/タップでは閉じない
      if (state.currentScoreId) return;
      closeRanking();
    });
    openRankingTopBtn.addEventListener("click", () => openRanking({ allowNameEdit: false }));
    reopenRankingBtn.addEventListener("click", () => openRanking({ allowNameEdit: false }));
    rankingSubmitBtn.addEventListener("click", doSubmitRankingName);

    function resetGame() {
      resetRankingUi();
      resetObjects();
      chainFadeTime = -1;
      chainMesh.visible = false;
      state.running = true;
      audio.startBgm();
      state.score = 0;
      state.combo = 1;
      state.loopCount = 1;
      updateLoopDisplay();
      applySnowMode(false);
      state.snowSkyFactor = 0;
      lastSnowSkyFactor = -1;
      state.pendingSnow = null;
      ground.position.z = tuning.GROUND_LOOP_START_Z;
      state.speed = 17;
      state.distance = 0;
      state.spawnTimer = 0.1 * tuning.BASE_SPEED;
      state.invulnerable = 1.0;
      state.boost = 0;
      state.boostFuel = 0;
      state.fuelDisplay = 0;
      const redMoonChance = state.debugMode ? tuning.RED_MOON_DEBUG_CHANCE : tuning.RED_MOON_CHANCE;
      applyRedMoonMode(Math.random() < redMoonChance);
      audio.resetEmptyBoostLatch();
      state.trailSpawnCarry = 0;
      state.atmosphereSparkCarry = 0;
      waterUniforms.uScroll.value = 0; // 長時間プレイで座標が育ち精度が落ちるのを防ぐ。
      state.rainbowTimer = 0;
      state.rainbowQueue = 0;
      state.lastRing = { x: 0, y: 26 };
      state.lastRingExtreme = false;
      state.lastSpawnInterval = null;
      state.rings = 0;
      state.ended = false;
      state.crashCameraTime = 0;
      state.crashCameraActive = false;
      camera.up.set(0, 1, 0);
      menu.classList.remove("is-result");
      openRankingTopBtn.hidden = true;
      ship.position.set(0, 26, 7);
      ship.rotation.set(0, 0, 0);
      menu.hidden = true;
      updateHud();
    }

    function buildXShareHref(score, rank = null) {
      const shareUrl = window.location.origin + window.location.pathname;
      const shareText = rank !== null
        ? `OyasumiSanpoで「${rank}位」になりました${rank <= 10 ? "👑" : "。"}\nスコアは「${score}点」でした。\n#OyasumiSanpo`
        : `OyasumiSanpoで遊びました。\nスコアは${score}点でした。\n#OyasumiSanpo`;
      return `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    }

    async function endGame(title, detail) {
      state.running = false;
      audio.stopBgm();
      state.ended = true;
      resetRankingUi();
      menu.hidden = false;
      menu.classList.add("is-ranking-pending");
      menu.classList.add("is-result");
      openRankingTopBtn.hidden = true;
      const h1 = menu.querySelector("h1");
      h1.textContent = title;
      h1.hidden = !title;
      menu.querySelector(".lead").textContent = detail;
      const resultScoreEl = document.querySelector("#resultScore");
      if (resultScoreEl) resultScoreEl.textContent = `SCORE:${state.score}`;
      const xShareEl = document.querySelector("#xShare");
      // ランキング通信が遅い/失敗した場合でも共有できるよう、まずスコアのみで用意する。
      if (xShareEl) xShareEl.href = buildXShareHref(state.score);
      setStartButton("retry");

      const seq = state.currentSubmitSeq;
      const snapScore = state.score;
      const snapLoop = state.loopCount;
      try {
        const result = await submitScore({ score: snapScore, loopCount: snapLoop });
        if (seq !== state.currentSubmitSeq) return;
        if (!result) return;
        const { id, createdAt } = result;
        state.currentScoreId = id;
        state.currentScoreCreatedAt = createdAt;
        const rank = await getMyRank({ id, score: snapScore, loopCount: snapLoop, createdAt });
        if (seq !== state.currentSubmitSeq) return;
        const rankNumber = Number(rank);
        const isTopTen = rankNumber <= 10;
        if (isTopTen) {
          resultRankEl.classList.add("is-rainbow-rank");
          resultRankEl.innerHTML = `<span class="rank-rainbow-text">RANK</span> ${CROWN_SVG}<span class="rank-rainbow-text">${rankNumber}</span>`;
          setStartButton("ranking");
        } else {
          resultRankEl.classList.remove("is-rainbow-rank");
          resultRankEl.textContent = `RANK ${rankNumber}`;
        }
        resultRankEntry.hidden = false;
        resultRankEl.hidden = false;
        const xShareEl = document.querySelector("#xShare");
        if (xShareEl) xShareEl.href = buildXShareHref(snapScore, rankNumber);
      } catch (e) {
        console.warn("通信失敗、ランキングは表示しません", e);
      } finally {
        if (seq === state.currentSubmitSeq) {
          menu.classList.remove("is-ranking-pending");
        }
      }
    }

    function updateHud() {
      scoreEl.textContent = `SCORE:${state.score}`;
      if (state.debugMode) {
        const loopFrac = (ground.position.z - tuning.GROUND_LOOP_START_Z) / tuning.GROUND_WRAP_DISTANCE;
        const loopProgress = Math.max(0, Math.min(100, Math.floor(loopFrac * 100)));
        // 今この瞬間に湧くリングが、島ループ上のどこに到達するかを予測する。
        // リングは z=PICKUP_SPAWN_Z_BASE から z=0 まで forward 距離を進む間に、島は forward*0.4 だけ進む。
        // const ringLagFrac = (-tuning.PICKUP_SPAWN_Z_BASE * 0.4) / tuning.GROUND_WRAP_DISTANCE;
        // const arriveTotal = loopFrac + ringLagFrac;
        // const arrivePct = Math.floor(((arriveTotal % 1) + 1) % 1 * 100);
        // const arriveLoop = state.loopCount + Math.floor(arriveTotal);
        const onOff = (v) => v ? "O" : "X";
        debugInfoEl.textContent = [
          `Y=${Math.round(ship.position.y)}`,
          `Z=${Math.round(ground.position.z)}`,
          `LOOP=${state.loopCount}(${loopProgress}%)`,
          `SPEED=${state.speed.toFixed(1)}`,
          // `RING→L${arriveLoop}(${arrivePct}%)`,
          // `SNOW=${onOff(state.snow)}${state.pendingSnow !== null ? `(→${onOff(state.pendingSnow)})` : ""}`,
          // `RED=${onOff(state.redMoon)}`,
        ].join("  ");
        // const effectiveSnow = state.pendingSnow ?? state.snow;
        // const rainChance = effectiveSnow ? tuning.RAINBOW_RING_SNOW_CHANCE : tuning.RAINBOW_RING_CHANCE;
        // const rainPct = Math.round(rainChance * 100);
        debugStatsEl.textContent = [
          `FUEL/F=${state.fullBoost || state.redMoon ? "MAX" : state.boostFuel.toFixed(2)}`,
          `BOOST/B=${onOff(state.autoBoost)}`,
          `TRAIL/T=${onOff(state.trail)}`,
          // `CHAIN=${state.combo}`,
          // `DISK=${Math.min(state.boostFuel, tuning.FUEL_DISK_MAX_DIAMETER).toFixed(2)}`,
          // `RAIN=${rainPct}%(Q:${state.rainbowQueue})`,
        ].join("  ");
        debugAutoEl.textContent = [
          `PILOT/P=${onOff(state.autopilot)}`,
          `DMG/I=${onOff(state.debugDamage)}`,
          `HIT/C=${onOff(state.debugHitboxes)}`,
        ].join("  ");
        debugInfoEl.hidden = false;
        debugStatsEl.hidden = false;
        debugAutoEl.hidden = false;
        if (state.debugHitboxes && shipHitWire) {
          // 当たり判定 (リング・障害物共通) を機体位置で表示。
          shipHitWire.position.copy(ship.position);
          shipHitWire.scale.set(
            tuning.SHIP_HIT_RADIUS_X * 2,
            tuning.SHIP_HIT_RADIUS_Y * 2,
            tuning.SHIP_HIT_RADIUS_Z * 2
          );
        }
      } else {
        debugInfoEl.hidden = true;
        debugStatsEl.hidden = true;
        debugAutoEl.hidden = true;
      }
    }

    function updateInput() {
      input.set(0, 0);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) input.x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) input.x += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) input.y += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) input.y -= 1;
      input.add(touchInput);
      if (state.debugMode && state.autopilot) {
        let target = null;
        let targetZ = -Infinity;
        for (const item of pickups) {
          if (item.userData.collected) continue;
          if (item.position.z >= ship.position.z) continue;
          if (item.position.z > targetZ) { targetZ = item.position.z; target = item; }
        }
        if (target) {
          input.x = THREE.MathUtils.clamp(target.position.x - ship.position.x, -1, 1);
          input.y = THREE.MathUtils.clamp(target.position.y - ship.position.y, -1, 1);
        }
      }
      if (state.debugMode && state.autoBoost) keys.add("Space");
      if (input.lengthSq() > 1) input.normalize();
    }

    function shipRingHit(ring, forward) {
      const dx = ship.position.x - ring.position.x;
      const dy = ship.position.y - ring.position.y;
      // スイープ判定: リングは前フレームから今フレームで [ring.z - forward, ring.z] を通過したので、
      // 機体 z に最も近い区間上の点との距離で判定する。高速時のトンネリングを防ぐため。
      const ringStartZ = ring.position.z - (forward ?? 0);
      const ringEndZ = ring.position.z;
      const nearestZ = THREE.MathUtils.clamp(ship.position.z, ringStartZ, ringEndZ);
      const dz = Math.abs(ship.position.z - nearestZ);
      const depth = tuning.SHIP_HIT_RADIUS_Z;
      if (dz >= depth) return "miss";
      const d = Math.hypot(dx, dy);
      const ex = tuning.SHIP_HIT_RADIUS_X;
      const ey = tuning.SHIP_HIT_RADIUS_Y;
      const radial = (d < 1e-6)
        ? Math.max(ex, ey)
        : 1 / Math.sqrt((dx / d / ex) * (dx / d / ex) + (dy / d / ey) * (dy / d / ey));
      if (ring.userData.rainbow) {
        // レインボーは見た目のグロー (内側) とリング本体 (外側) の帯が当たり判定。
        // 内側に完全に入れば pass、外側を完全に外れれば miss、その中間 = crash。
        const innerR = tuning.RAINBOW_RING_GLOW_RADIUS;
        const outerR = tuning.RAINBOW_RING_RADIUS;
        if (d + radial < innerR) return "pass";
        if (d - radial > outerR) return "miss";
        return "crash";
      }
      const ringR = tuning.PICKUP_RING_RADIUS;
      if (d + radial < ringR) return "pass";
      if (d - radial > ringR) return "miss";
      return "crash";
    }

    function collect(item) {
      if (item.userData.collected) return;
      item.userData.collected = true;
      state.rings += 1;
      const isRainbow = item.userData.rainbow;
      const ringScore = isRainbow ? tuning.RAINBOW_RING_SCORE : tuning.NORMAL_RING_SCORE;
      const scoreBoostMul = state.boost > 0.5 ? tuning.BOOST_SCORE_MULTIPLIER : 1;
      state.score = Math.min(tuning.SCORE_MAX, state.score + Math.floor(ringScore * scoreBoostMul * state.combo));
      triggerChainNumber(state.combo, item.position, isRainbow);
      state.combo += 1;
      const rewardMultiplier = isRainbow ? tuning.RAINBOW_RING_MULTIPLIER : 1;
      state.boostFuel = Math.min(tuning.FUEL_DISK_MAX_DIAMETER, state.boostFuel + tuning.BOOST_FUEL_PER_RING * rewardMultiplier);
      audio.resetEmptyBoostLatch();
      burstRing(
        item,
        isRainbow ? 0xffffff : state.redMoon ? tuning.RED_MOON_BASE_COLOR : 0xffd66b,
        isRainbow ? tuning.RAINBOW_RING_BURST_COUNT : tuning.RING_BURST_COUNT
      );
      if (isRainbow) {
        audio.rainbowTone();
        state.rainbowTimer = 8;
      } else {
        audio.sparkleTone();
      }
      const halo = item.children[1];
      if (halo) halo.visible = false;
    }

    function crash(message = "障害物に衝突しました。") {
      if (state.invulnerable > 0 || !state.running) return;
      state.crashCameraTime = 0;
      state.crashCameraActive = true;
      state.crashCameraStartPosition.copy(camera.position);
      state.crashCameraStartTarget.set(ship.position.x * 0.25, ship.position.y + 1.4, -24);
      burst(ship.position, 0xff8866, 40);
      audio.tone(80, 0.35, "sawtooth", 0.06);
      flash.classList.add("on");
      window.setTimeout(() => flash.classList.remove("on"), 240);
      if (state.debugMode && !state.debugDamage) {
        state.invulnerable = 0.6;
        return;
      }
      endGame("", message);
    }

    function atmosphereExplosion() {
      if (state.invulnerable > 0 || !state.running) return;
      state.crashCameraTime = 0;
      state.crashCameraActive = true;
      state.crashCameraStartPosition.copy(camera.position);
      state.crashCameraStartTarget.set(ship.position.x * 0.25, ship.position.y + 1.4, -24);
      burst(ship.position, 0xffa04a, tuning.ATMOSPHERE_EXPLOSION_PARTICLES);
      burst(ship.position, 0x8cefff, Math.floor(tuning.ATMOSPHERE_EXPLOSION_PARTICLES * 0.4));
      audio.tone(64, 0.42, "sawtooth", 0.08);
      flash.classList.add("on");
      window.setTimeout(() => flash.classList.remove("on"), 280);
      if (state.debugMode && !state.debugDamage) {
        state.invulnerable = 0.9;
        ship.position.y = tuning.ATMOSPHERE_SPARK_START_Y - 8;
        return;
      }
      endGame("", "天井に衝突しました。");
    }

    function updateAtmosphereDanger(dt) {
      if (!state.running) {
        state.atmosphereSparkCarry = 0;
        return;
      }
      const danger = atmosphereDangerFactor();
      if (danger <= 0) {
        state.atmosphereSparkCarry = 0;
        return;
      }
      const sparkRate = THREE.MathUtils.lerp(
        tuning.ATMOSPHERE_SPARK_RATE_MIN,
        tuning.ATMOSPHERE_SPARK_RATE_MAX,
        danger
      );
      state.atmosphereSparkCarry += sparkRate * dt;
      while (state.atmosphereSparkCarry >= 1) {
        spawnAtmosphereSpark(1);
        state.atmosphereSparkCarry -= 1;
      }
      if (ship.position.y >= tuning.ATMOSPHERE_EXPLODE_Y) {
        atmosphereExplosion();
      }
    }

    function stepWorld(forward) {
      // 波の模様を島と同じ速度で手前に流し、海が世界と一緒に動いて見えるようにする。
      waterUniforms.uScroll.value += forward * 0.4;
      for (const item of loopingClouds) {
        item.position.z += forward;
        if (item.position.z > 18) item.position.z -= tuning.CLOUD_WRAP_DISTANCE;
      }
      for (const item of loopingGroundObjects) {
        item.position.z += forward * 0.4;
        // リング到達ラグぶん手前で次ループの雪状態を先決定し、リング生成側 (stepSpawnTimer) が
        // 自分が届く頃の雪状態を見てレインボー判定できるようにする。視覚切替は wrap で行う。
        if (state.pendingSnow === null) {
          const loopFrac = (item.position.z - tuning.GROUND_LOOP_START_Z) / tuning.GROUND_WRAP_DISTANCE;
          const ringLagFrac = (-tuning.PICKUP_SPAWN_Z_BASE * 0.4) / tuning.GROUND_WRAP_DISTANCE;
          if (loopFrac >= 1 - ringLagFrac) {
            const snowChance = state.debugMode ? tuning.SNOW_LOOP_DEBUG_CHANCE : tuning.SNOW_LOOP_CHANCE;
            state.pendingSnow = Math.random() < snowChance;
          }
        }
        if (item.position.z > tuning.GROUND_WRAP_END_Z) {
          item.position.z -= tuning.GROUND_WRAP_DISTANCE;
          state.loopCount += 1;
          updateLoopDisplay();
          applySnowMode(state.pendingSnow ?? false);
          state.pendingSnow = null;
        }
        const fadeMaterials = item.userData.fadeMaterials;
        if (fadeMaterials) {
          const z = item.position.z;
          let factor;
          if (z >= tuning.GROUND_FADE_NEAR_Z) factor = 1;
          else if (z <= tuning.GROUND_FADE_FAR_Z) factor = tuning.GROUND_FADE_MIN_OPACITY;
          else {
            const t = (z - tuning.GROUND_FADE_FAR_Z) / (tuning.GROUND_FADE_NEAR_Z - tuning.GROUND_FADE_FAR_Z);
            factor = THREE.MathUtils.lerp(tuning.GROUND_FADE_MIN_OPACITY, 1, t);
          }
          for (let m = 0; m < fadeMaterials.length; m += 1) {
            const mat = fadeMaterials[m];
            mat.opacity = mat.userData.baseOpacity * factor;
          }
        }
      }
    }

    function stepSpawnTimer(forward) {
      state.spawnTimer -= forward;
      if (state.spawnTimer <= 0) {
        // 前回スポーンから今までの距離 (= 機体がY移動できた時間相当) を使ってクランプ幅を出す。
        // shipYSpeed はブーストMAX時の速度 (SHIP_Y_SPEED * BOOST_SPEED_MULTIPLIER)。
        // ブーストすれば届く範囲に収める＝極端ジャンプには戦略的なブーストが必要になる。
        const prevInterval = state.lastSpawnInterval ?? 1.6 * tuning.BASE_SPEED;
        const shipYSpeed = tuning.SHIP_Y_SPEED * tuning.BOOST_SPEED_MULTIPLIER;
        const maxYDelta = shipYSpeed * (prevInterval / Math.max(state.speed, 1));

        if (state.rainbowQueue > 0) {
          const total = 7;
          const idx = total - state.rainbowQueue;
          spawnPickup({ rainbow: true, hue: 0.1 + (idx / total) * 0.75, idx });
          state.rainbowQueue -= 1;
          state.spawnTimer = (state.rainbowQueue > 0 ? tuning.RAINBOW_RING_SPAWN_INTERVAL : 2.4 + Math.random() * 2.0) * tuning.BASE_SPEED;
          state.lastSpawnInterval = state.spawnTimer;
        } else {
          const spawnInfo = spawnPickup({ maxYDeltaFromLast: maxYDelta });
          state.lastRingExtreme = spawnInfo?.extreme ?? false;
          // pendingSnow が立っていればそちら (=ループ末尾で先決定された次の雪状態) を見て判定する。
          // 今湧くリングが届く頃の見た目に合わせるため。
          const effectiveSnow = state.pendingSnow ?? state.snow;
          const rainbowChance = effectiveSnow ? tuning.RAINBOW_RING_SNOW_CHANCE : tuning.RAINBOW_RING_CHANCE;
          if (Math.random() < rainbowChance) {
            state.rainbowQueue = 7;
            state.spawnTimer = 1.8 * tuning.BASE_SPEED;
          } else if (!state.lastRingExtreme && Math.random() < 0.4) {
            // 直前が極端ジャンプ (低空/高空) なら速い間隔をスキップして次に余裕を持たせる。
            state.spawnTimer = (0.4 + Math.random() * 0.9) * tuning.BASE_SPEED;
          } else {
            state.spawnTimer = (1.6 + Math.random() * 3.4) * tuning.BASE_SPEED;
          }
          state.lastSpawnInterval = state.spawnTimer;
        }
      }
    }

    function stepPickups(dt, forward) {
      playerBox.setFromObject(ship);
      for (let i = pickups.length - 1; i >= 0; i -= 1) {
        const item = pickups[i];
        item.position.z += forward;
        item.rotation.z += dt * 0.8;
        item.position.y += Math.sin(clock.elapsedTime * 2.2 + item.position.x) * dt * 0.42;
        const fadeMaterials = item.userData.fadeMaterials;
        if (fadeMaterials) {
          const z = item.position.z;
          let factor;
          if (z >= tuning.PICKUP_FADE_NEAR_Z) factor = 1;
          else if (z <= tuning.PICKUP_FADE_FAR_Z) factor = tuning.PICKUP_FADE_MIN_OPACITY;
          else {
            const t = (z - tuning.PICKUP_FADE_FAR_Z) / (tuning.PICKUP_FADE_NEAR_Z - tuning.PICKUP_FADE_FAR_Z);
            factor = THREE.MathUtils.lerp(tuning.PICKUP_FADE_MIN_OPACITY, 1, t);
          }
          for (let m = 0; m < fadeMaterials.length; m += 1) {
            const mat = fadeMaterials[m];
            mat.opacity = mat.userData.baseOpacity * factor;
          }
        }
        const halo = item.children[1];
        if (halo && halo.isPoints) {
          const t = clock.elapsedTime;
          const pos = halo.geometry.attributes.position;
          const arr = pos.array;
          const ud = halo.userData;
          const count = ud.count || tuning.SPARKLE_COUNT;
          for (let s = 0; s < count; s += 1) {
            const angle = ud.baseAngle[s] + ud.angularSpeed[s] * t;
            const radius = ud.baseRadius[s] + Math.sin(t * 2.0 + ud.phase[s]) * 0.22;
            arr[s * 3] = Math.cos(angle) * radius;
            arr[s * 3 + 1] = Math.sin(angle) * radius;
          }
          pos.needsUpdate = true;
        }
        if (!item.userData.collected) {
          const hit = shipRingHit(item, forward);
          if (hit === "pass") collect(item);
          else if (hit === "crash") crash("リングの縁に衝突しました。");
        }
        if (!item.userData.collected && !item.userData.missed && item.position.z >= ship.position.z) {
          item.userData.missed = true;
          state.combo = 1;
        }
        if (item.position.z > 36) {
          disposePickup(item);
          scene.remove(item);
          pickups.splice(i, 1);
        }
      }
    }

    function stepGuide() {
      const guideActive = state.boosting;
      let nearest = null;
      let nearestZ = -Infinity;
      for (const item of pickups) {
        if (item.userData.collected) continue;
        if (item.position.z >= ship.position.z) continue;
        if (item.position.z > nearestZ) {
          nearestZ = item.position.z;
          nearest = item;
        }
      }
      if (nearest && guideActive) {
        const tip = new THREE.Vector3(0, 0.34, -0.95);
        ship.localToWorld(tip);
        const isRainbow = nearest.userData.rainbow;
        const hueShift = clock.elapsedTime * 0.3;
        for (let gi = 0; gi < GUIDE_PARTICLE_COUNT; gi += 1) {
          const t = (gi + 0.5) / GUIDE_PARTICLE_COUNT;
          const child = guideTrail.children[gi];
          child.position.set(
            tip.x + (nearest.position.x - tip.x) * t,
            tip.y + (nearest.position.y - tip.y) * t,
            tip.z + (nearest.position.z - tip.z) * t
          );
          if (isRainbow) {
            child.material.color.setHSL((t + hueShift) % 1, 1.0, 0.6);
          } else {
            child.material.color.setHex(state.redMoon ? RED_MOON_GUIDE_COLOR : tuning.GUIDE_COLOR);
          }
        }
        guideTrail.visible = true;
      } else {
        guideTrail.visible = false;
      }
    }

    function stepParticles(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.userData.life -= dt;
        if (!p.userData.trail && !p.userData.atmosphereSpark) {
          p.userData.velocity.y -= dt * 5.6;
        }
        p.position.addScaledVector(p.userData.velocity, dt);
        if (p.userData.trail) {
          const t = Math.max(0, p.userData.life / p.userData.maxLife);
          const age = 1 - t;
          p.material.opacity = t * t * 0.85;
          p.scale.setScalar(p.userData.startScale + age * (p.userData.endScale - p.userData.startScale));
        } else if (p.userData.atmosphereSpark) {
          const t = Math.max(0, p.userData.life / p.userData.maxLife);
          p.scale.setScalar(THREE.MathUtils.lerp(p.userData.endScale, p.userData.startScale, t));
        } else {
          p.scale.setScalar(Math.max(0.05, p.userData.life));
        }
        if (p.userData.life <= 0) {
          scene.remove(p);
          if (p.userData.trail) p.material.dispose();
          particles.splice(i, 1);
        }
      }
    }

    function stepObstacleCollision() {
      if (state.invulnerable <= 0) {
        const sx = tuning.SHIP_HIT_RADIUS_X;
        const sy = tuning.SHIP_HIT_RADIUS_Y;
        const sz = tuning.SHIP_HIT_RADIUS_Z;
        for (const o of obstacles) {
          const wx = ground.position.x + o.position.x;
          const wy = ground.position.y + o.position.y;
          const wz = ground.position.z + o.position.z;
          const hs = o.userData.halfSize;
          if (Math.abs(wz - ship.position.z) > hs.z + sz) continue;
          if (Math.abs(wx - ship.position.x) > hs.x + sx) continue;
          if (ship.position.y > wy + hs.y + sy) continue;
          if (ship.position.y < wy - hs.y - sy) continue;
          crash(o.userData.crashMessage);
          break;
        }
      }
    }

    function stepObjects(dt) {
      const forward = state.speed * dt;
      state.distance += forward;
      grid.position.z = -62 + (state.distance % 7);
      stepWorld(forward);
      stepSpawnTimer(forward);
      stepPickups(dt, forward);
      stepGuide();
      stepParticles(dt);
      stepObstacleCollision();
    }

    function updateClouds(dt) {
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        cloud.position.y += Math.sin(clock.elapsedTime * 0.18 + cloud.position.z) * dt * 0.08;
        if (cloud.position.x > 78) cloud.position.x = -82;
      }
    }

    function updateCloudFade() {
      for (const cloud of clouds) {
        if (cloud.userData.baseOpacity === undefined) continue;
        const z = cloud.position.z;
        let factor;
        if (z >= tuning.CLOUD_FADE_NEAR_Z) factor = 1;
        else if (z <= tuning.CLOUD_FADE_FAR_Z) factor = tuning.CLOUD_FADE_MIN_OPACITY;
        else {
          const t = (z - tuning.CLOUD_FADE_FAR_Z) / (tuning.CLOUD_FADE_NEAR_Z - tuning.CLOUD_FADE_FAR_Z);
          factor = THREE.MathUtils.lerp(tuning.CLOUD_FADE_MIN_OPACITY, 1, t);
        }
        cloud.material.opacity = cloud.userData.baseOpacity * factor;
      }
    }

    function updateSkyAtmosphere(dt, high) {
      const snowTarget = state.snow ? 1 : 0;
      const fadeStep = dt / tuning.SNOW_SKY_FADE_DURATION;
      if (state.snowSkyFactor < snowTarget) state.snowSkyFactor = Math.min(snowTarget, state.snowSkyFactor + fadeStep);
      else if (state.snowSkyFactor > snowTarget) state.snowSkyFactor = Math.max(snowTarget, state.snowSkyFactor - fadeStep);
      scene.fog.color.copy(lowFogColor).lerp(lowFogColorSnow, state.snowSkyFactor).lerp(highFogColor, high);
      scene.fog.density = THREE.MathUtils.lerp(0.007, 0.0032, high);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.95, 0.74, high);
      ambient.intensity = THREE.MathUtils.lerp(1.45, 0.74, high);
      sun.intensity = THREE.MathUtils.lerp(1.2, 0.28, high);
      moonDisk.material.opacity = THREE.MathUtils.lerp(0.34, 0.92, high);
      moonGlow.material.opacity = THREE.MathUtils.lerp(0.55, 1, high);
      starMat.opacity = THREE.MathUtils.lerp(0.72, 1, high);
      starBrightMat.opacity = THREE.MathUtils.lerp(0.8, 1, high);
      if (Math.abs(high - lastSkyHigh) > 0.01 || Math.abs(state.snowSkyFactor - lastSnowSkyFactor) > 0.005) {
        skyTexture.userData.drawSky(high, state.snowSkyFactor);
        lastSkyHigh = high;
        lastSnowSkyFactor = state.snowSkyFactor;
      }
      // 環境マップは PMREM 生成コストがあるので、空が大きく変わった時だけ作り直す。
      if (Math.abs(high - lastEnvHigh) > 0.12 || Math.abs(state.snowSkyFactor - lastEnvSnow) > 0.3) {
        refreshEnvironment(high, state.snowSkyFactor);
      }
      updateWater(high);
    }

    function updateBoostState(dt) {
      state.invulnerable = Math.max(0, state.invulnerable - dt);
      const wantsBoost = keys.has("Space");
      const unlimitedBoost = (state.debugMode && state.fullBoost) || state.redMoon;
      const unlimitedBoosting = unlimitedBoost && wantsBoost;
      const boosting = wantsBoost && (state.boostFuel > 0 || unlimitedBoosting);
      if (boosting && !unlimitedBoost) {
        state.boostFuel = Math.max(0, state.boostFuel - dt);
        if (state.boostFuel <= 0 && audio.playEmptyBoostOnce()) emitExhaustPuff();
      } else if (wantsBoost && !unlimitedBoost) {
        if (audio.playEmptyBoostOnce()) emitExhaustPuff();
      } else {
        audio.resetEmptyBoostLatch();
      }
      state.boost += ((boosting ? 1 : 0) - state.boost) * Math.min(1, dt * 7);
      state.boosting = boosting;
      state.rainbowTimer = Math.max(0, state.rainbowTimer - dt);
      return { b: state.boost, rb: Math.min(1, state.rainbowTimer / 8), boosting };
    }

    function updateShipColors(b, rb) {
      const tmpRainbow = new THREE.Color();
      const activeBoostColors = state.redMoon ? colorBoostRedMoon : colorBoost;
      const hueBase = (clock.elapsedTime * 0.35) % 1;
      function applyRainbow(target, hueOffset) {
        if (rb <= 0) return;
        tmpRainbow.setHSL((hueBase + hueOffset) % 1, 1.0, 0.56);
        target.lerp(tmpRainbow, rb);
      }
      bodyMat.color.lerpColors(colorNormal.body, activeBoostColors.body, b);
      applyRainbow(bodyMat.color, 0.0);
      bodyMat.emissive.lerpColors(colorNormal.bodyEmissive, activeBoostColors.bodyEmissive, b);
      applyRainbow(bodyMat.emissive, 0.05);
      glow.material.color.lerpColors(colorNormal.glow, activeBoostColors.glow, b);
      applyRainbow(glow.material.color, 0.1);
      coreLight.material.color.lerpColors(colorNormal.core, activeBoostColors.core, b);
      applyRainbow(coreLight.material.color, 0.15);
      fuelDiskMat.color.lerpColors(
        state.redMoon ? redMoonFuelNormal : colorNormal.fuelDisk,
        activeBoostColors.fuelDisk,
        b
      );
      applyRainbow(fuelDiskMat.color, 0.2);
      engineHalo.material.color.lerpColors(colorNormal.engineHalo, activeBoostColors.engineHalo, b);
      applyRainbow(engineHalo.material.color, 0.25);
      shipLight.color.lerpColors(colorNormal.light, activeBoostColors.light, b);
      applyRainbow(shipLight.color, 0.1);
      sleeveL.children[0].material.color.lerpColors(colorNormal.sleeve0, activeBoostColors.sleeve0, b);
      applyRainbow(sleeveL.children[0].material.color, 0.3);
      sleeveL.children[1].material.color.lerpColors(colorNormal.sleeve1, activeBoostColors.sleeve1, b);
      applyRainbow(sleeveL.children[1].material.color, 0.4);
      sleeveL.children[2].material.color.lerpColors(colorNormal.sleeve2, activeBoostColors.sleeve2, b);
      applyRainbow(sleeveL.children[2].material.color, 0.5);
      sleeveR.children[0].material.color.lerpColors(colorNormal.sleeve0, activeBoostColors.sleeve0, b);
      applyRainbow(sleeveR.children[0].material.color, 0.6);
      sleeveR.children[1].material.color.lerpColors(colorNormal.sleeve1, activeBoostColors.sleeve1, b);
      applyRainbow(sleeveR.children[1].material.color, 0.7);
      sleeveR.children[2].material.color.lerpColors(colorNormal.sleeve2, activeBoostColors.sleeve2, b);
      applyRainbow(sleeveR.children[2].material.color, 0.8);
    }

    function updateShipPhysics(dt) {
      const targetSpeed = Math.min(tuning.MAX_SPEED, 17 + (state.loopCount - 1) * 5);
      state.speed += (targetSpeed - state.speed) * dt * 0.06;
      const boostSpeedFactor = 1 + state.boost * (tuning.BOOST_SPEED_MULTIPLIER - 1);
      const floatBob = Math.sin(clock.elapsedTime * 1.6 + ship.position.x * 0.08) * dt * 0.55;
      ship.position.x = THREE.MathUtils.clamp(ship.position.x + input.x * dt * 10.5 * boostSpeedFactor, -10.5, 10.5);
      ship.position.y = THREE.MathUtils.clamp(
        ship.position.y + input.y * dt * tuning.SHIP_Y_SPEED * boostSpeedFactor + floatBob,
        tuning.SHIP_MOVE_MIN_Y,
        tuning.SHIP_MOVE_MAX_Y
      );
    }

    function updateShipVisuals(dt, b, rb) {
      ship.rotation.z += ((-input.x * 0.48) - ship.rotation.z) * dt * 8;
      ship.rotation.x += ((input.y * 0.22) - ship.rotation.x) * dt * 6;
      ship.rotation.y = Math.sin(clock.elapsedTime * 4.8) * 0.035;
      const pulse = 1 + Math.sin(clock.elapsedTime * 9) * 0.08;
      const fuelFactor = Math.min(1, state.boostFuel / 1.5);
      const boostExpand = 1 + b * fuelFactor * (tuning.SHIP_GLOW_BOOST_EXPAND + rb * tuning.SHIP_GLOW_RAINBOW_EXPAND);
      glow.scale.set(tuning.SHIP_GLOW_WIDTH * pulse * boostExpand, tuning.SHIP_GLOW_HEIGHT * pulse * boostExpand, 1);
      glow.material.opacity = Math.min(1, 1.0 + b * 0.2);
      state.fuelDisplay += (state.boostFuel - state.fuelDisplay) * Math.min(1, dt * 2);
      const fuelDiskDiameter = Math.min(state.fuelDisplay, tuning.FUEL_DISK_MAX_DIAMETER);
      fuelDiskInner.scale.setScalar(fuelDiskDiameter / FUEL_DISK_NATURAL_DIAMETER);
      fuelDiskOuter.scale.setScalar(1);
      fuelDisk.rotation.z += dt * (0.22 + b * 0.32);
      const enginePulse = 1 + b * 0.6;
      engine.scale.set(0.55 * enginePulse, 0.55 * enginePulse, 1);
      engineHalo.scale.set(1.4 * enginePulse * (1 + b * 0.5), 1.0 * enginePulse * (1 + b * 0.5), 1);
      const sleeveExpand = 1 + b * (1.0 + rb * 0.4);
      sleeveL.scale.set(sleeveExpand, 1, sleeveExpand);
      sleeveR.scale.set(sleeveExpand, 1, sleeveExpand);
      body.rotation.x = Math.sin(clock.elapsedTime * 1.6) * 0.035 + input.y * 0.025;
      body.rotation.z = -input.x * 0.035;
      sleeveL.rotation.z = 0.18 + Math.sin(clock.elapsedTime * 2.8) * 0.11 + input.x * 0.025;
      sleeveR.rotation.z = -0.18 - Math.sin(clock.elapsedTime * 2.8 + 0.4) * 0.11 + input.x * 0.025;
      sleeveL.rotation.y = -0.12 + Math.sin(clock.elapsedTime * 1.8) * 0.045;
      sleeveR.rotation.y = 0.12 + Math.sin(clock.elapsedTime * 1.8 + 0.5) * 0.045;
      cyanLight.position.x = ship.position.x;
      cyanLight.position.y = ship.position.y + 3;
      cyanLight.intensity = 14 + state.boost * 12;
    }

    function updateShipShadow() {
      const shadowAlt = ship.position.y - ground.position.y;
      const shadowVisibility = 1 - THREE.MathUtils.smoothstep(shadowAlt, 4, 45);
      const shadowZ = ship.position.z - tuning.SHIP_SHADOW_OFFSET_Z;
      const lx = ship.position.x - ground.position.x;
      const lz = shadowZ - ground.position.z;
      let coverage = 0;
      for (const f of islandFootprints) {
        const dx = (lx - f.x) / f.rx;
        const dz = (lz - f.z) / f.rz;
        const r = Math.sqrt(dx * dx + dz * dz);
        const c = 1 - THREE.MathUtils.smoothstep(r, 0.88, 1.0);
        if (c > coverage) coverage = c;
      }
      shipShadow.material.opacity = 0.65 * shadowVisibility * coverage;
      shipShadow.position.set(ship.position.x, ground.position.y + 0.06, shadowZ);
      const shadowSize = THREE.MathUtils.lerp(0.5, 3.6, shadowVisibility);
      shipShadow.scale.set(shadowSize * 1.6 * (1 + state.boost * 0.4), shadowSize, 1);
    }

    function updateTrailParticles(dt, boosting) {
      let aliveTrail = 0;
      for (const p of particles) if (p.userData.trail) aliveTrail += 1;
      if (boosting && state.trail) {
        state.trailSpawnCarry += dt * tuning.TRAIL_SPAWN_RATE * tuning.BOOST_TRAIL_MULTIPLIER;
        const room = Math.max(0, tuning.TRAIL_MAX - aliveTrail);
        const toSpawn = Math.min(room, Math.floor(state.trailSpawnCarry), 6);
        state.trailSpawnCarry -= toSpawn;
        state.trailSpawnCarry = Math.min(state.trailSpawnCarry, 0.95);
        for (let s = 0; s < toSpawn; s += 1) spawnOneTrail(Math.max(0.75, state.boost));
      } else {
        state.trailSpawnCarry = 0;
      }
    }

    function updateRunningCamera(dt) {
      camera.position.x += (ship.position.x * 0.5 - camera.position.x) * dt * 2.4;
      camera.position.y += (ship.position.y + 4.2 - camera.position.y) * dt * 2.2;
      camera.position.z += (28 + state.boost * 3.5 - camera.position.z) * dt * 2.1;
      camera.up.set(0, 1, 0);
      camera.lookAt(ship.position.x * 0.25, ship.position.y + 1.4, -24);
    }

    function updateCrashCamera(dt) {
      state.crashCameraTime += dt;
      const t = Math.min(1, state.crashCameraTime / state.crashCameraDuration);
      const ease = 1 - Math.pow(1 - t, 3);
      const roll = Math.sin(ease * Math.PI) * 0.35 + ease * Math.PI;
      const target = new THREE.Vector3(
        THREE.MathUtils.lerp(state.crashCameraStartTarget.x, ship.position.x * 0.18, ease),
        THREE.MathUtils.lerp(state.crashCameraStartTarget.y, ship.position.y + 54, ease),
        THREE.MathUtils.lerp(state.crashCameraStartTarget.z, -48, ease)
      );
      camera.position.set(
        THREE.MathUtils.lerp(state.crashCameraStartPosition.x, ship.position.x * 0.2, ease),
        THREE.MathUtils.lerp(state.crashCameraStartPosition.y, ship.position.y + 7.5, ease),
        THREE.MathUtils.lerp(state.crashCameraStartPosition.z, 18, ease)
      );
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      camera.lookAt(target);
    }

    function updateIdleMenuScene(dt) {
      ship.rotation.y += dt * 0.5;
      ship.position.y = 26 + Math.sin(clock.elapsedTime * 1.1) * 0.42;
      fuelDiskInner.scale.setScalar(0);
      fuelDiskOuter.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.6) * 0.06);
      fuelDisk.rotation.z += dt * 0.16;
      sleeveL.rotation.z = 0.18 + Math.sin(clock.elapsedTime * 1.8) * 0.08;
      sleeveR.rotation.z = -0.18 - Math.sin(clock.elapsedTime * 1.8 + 0.4) * 0.08;
      camera.up.set(0, 1, 0);
      camera.position.y += (38 - camera.position.y) * dt * 2;
      camera.position.z += (28 - camera.position.z) * dt * 2;
      camera.lookAt(0, 26.5, -12);
    }

    function updateMenuScene(dt) {
      shipShadow.material.opacity = 0;
      if (state.crashCameraActive) {
        updateCrashCamera(dt);
      } else {
        updateIdleMenuScene(dt);
      }
    }

    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.04);
      if (state.paused) {
        renderer.render(scene, camera);
        return;
      }
      updateInput();
      stars.rotation.y = Math.sin(clock.elapsedTime * 0.05) * 0.015;
      waterUniforms.uTime.value = clock.elapsedTime;
      updateClouds(dt);
      const high = altitudeFactor();
      updateSkyAtmosphere(dt, high);
      if (state.running) {
        const { b, rb, boosting } = updateBoostState(dt);
        updateShipColors(b, rb);
        updateShipPhysics(dt);
        updateAtmosphereDanger(dt);
        updateShipVisuals(dt, b, rb);
        updateShipShadow();
        updateTrailParticles(dt, boosting);
        updateRunningCamera(dt);
        stepObjects(dt);
        updateHud();
      } else {
        updateMenuScene(dt);
      }
      updateChainNumber();
      audio.updateBgmAudio();
      updateCloudFade();
      renderer.render(scene, camera);
    }

    function resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        audio.stopBgm();
      } else if (state.running) {
        audio.startBgm();
      }
    });
    window.addEventListener("keydown", (event) => {
      if (isTextEntryTarget(event.target) && event.code !== "Escape") return;
      if (!rankingOverlay.hidden) {
        if (event.repeat) return;
        // 名前編集モード中は Escape 以外のキーでは閉じない
        if (state.currentScoreId && event.code !== "Escape") {
          return;
        }
        closeRanking();
        return;
      }
      if (!helpOverlay.hidden) {
        if (event.repeat) return;
        setHelpOpen(false);
        return;
      }
      if (state.manualPaused) {
        if (event.repeat) return;
        setManualPause(false);
        return;
      }
      if (event.code === "Space") event.preventDefault();
      if (event.repeat) return;
      if (event.code === "KeyH") {
        setHelpOpen(true);
        return;
      }
      if (event.code === "Escape" && state.running) {
        setManualPause(true);
        return;
      }
      keys.add(event.code);
      if (event.code === "KeyR" && state.debugMode) resetGame();
      if (event.code === "KeyP" && state.debugMode) {
        state.autopilot = !state.autopilot;
        if (!state.autopilot) keys.delete("Space");
      }
      if (event.code === "KeyB" && state.debugMode) {
        state.autoBoost = !state.autoBoost;
        if (!state.autoBoost) keys.delete("Space");
      }
      if (event.code === "KeyC" && state.debugMode) {
        setDebugHitboxes(!state.debugHitboxes);
      }
      if (event.code === "KeyF" && state.debugMode) {
        state.fullBoost = !state.fullBoost;
      }
      if (event.code === "KeyI" && state.debugMode) {
        state.debugDamage = !state.debugDamage;
        updateHud();
      }
      if (event.code === "KeyT" && state.debugMode) {
        state.trail = !state.trail;
        if (!state.trail) {
          for (const p of particles) {
            if (p.userData.trail) p.userData.life = 0;
          }
        }
      }
    });
    window.addEventListener("keyup", (event) => {
      keys.delete(event.code);
      if (isTextEntryTarget(event.target) || !rankingOverlay.hidden) {
        return;
      }
      if (event.code === "Space") audio.resetEmptyBoostLatch();
    });

    startBtn.addEventListener("click", () => {
      if (startBtn.dataset.action === "ranking") {
        openRanking({ allowNameEdit: true });
        return;
      }
      resetGame();
      if (!state.muted) audio.resume();
    });

    let touchId = null;
    stick.addEventListener("pointerdown", (event) => {
      preventCancelableDefault(event);
      touchId = event.pointerId;
      stick.setPointerCapture(touchId);
    });
    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== touchId) return;
      preventCancelableDefault(event);
      const rect = stick.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      const max = rect.width * 0.32;
      const v = new THREE.Vector2(x, y);
      if (v.length() > max) v.setLength(max);
      touchInput.set(v.x / max, -v.y / max);
      knob.style.transform = `translate(${v.x}px, ${v.y}px)`;
    });
    function clearStick(event) {
      if (touchId !== null && event.pointerId !== touchId) return;
      preventCancelableDefault(event);
      touchId = null;
      touchInput.set(0, 0);
      knob.style.transform = "translate(0, 0)";
    }
    stick.addEventListener("pointerup", clearStick);
    stick.addEventListener("pointercancel", clearStick);
    let boostTouchId = null;
    touchBoost.addEventListener("pointerdown", (event) => {
      preventCancelableDefault(event);
      boostTouchId = event.pointerId;
      touchBoost.setPointerCapture(boostTouchId);
      keys.add("Space");
    });
    touchBoost.addEventListener("pointermove", (event) => {
      if (event.pointerId !== boostTouchId) return;
      preventCancelableDefault(event);
    });
    function clearTouchBoost(event) {
      if (boostTouchId !== null && event.pointerId !== boostTouchId) return;
      preventCancelableDefault(event);
      boostTouchId = null;
      keys.delete("Space");
      audio.resetEmptyBoostLatch();
    }
    touchBoost.addEventListener("pointerup", clearTouchBoost);
    touchBoost.addEventListener("pointercancel", clearTouchBoost);
    touchBoost.addEventListener("lostpointercapture", clearTouchBoost);

    const urlParams = new URLSearchParams(window.location.search);
    initDevAuth(urlParams);
    if (urlParams.has("rank")) {
      openRanking({ allowNameEdit: false });
    } else {
      if (urlParams.has("play")) {
        resetGame();
      }
      if (urlParams.has("help")) {
        setHelpOpen(true);
      }
    }

    updateHud();
    animate();
