/*
  "Campo eléctrico" — the hero's living energy field (docs/CONCEPTO.md, escena #inicio "Alta Tensión").
  Raw WebGL1, one full-screen triangle, original GLSL.
  Navy base; field lines of a current running along the brand ray (the hero's SVG streak, rising ~17°): long
  streamlines (contours of "distance across the ray + domain-warped fbm"), bunched towards the ray like the field
  around a conductor, orange halos with gold cores where packets of current travel up them; a finer web between them;
  thin jagged arcs that strike now and then and flicker; rare white sparks; a pointer that pushes and swirls the
  field with a decaying velocity; a shockwave pulse (loader hand-off, clicks); u_depth (hero pin) calms and dims it;
  film grain.
  Half resolution, DPR ≤ 1. Loaded with import() only behind env.desktop && !env.lite; the CSS poster is the fallback.
  Auto-degrade: after the first 2.5 s of a run, 10 frames in a row over 45 ms (< 22 fps; a 30 Hz rAF cap from
  Energy Saver / 30 Hz panels runs at 33 ms and is NOT slow) → onDegrade(true): the hero fades the canvas out and
  calls markLite(); the context is released once the fade is over. A lost context → onDegrade(false): GL is
  dropped for this page only, the session is not marked lite.
*/
export const VERT = 'attribute vec2 a;varying vec2 v_uv;void main(){v_uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';

export const FRAG = `
precision highp float;
uniform vec2 u_res;      // canvas box, CSS px
uniform float u_time;    // seconds (slowed by depth on the JS side): slow drift only
uniform float u_tick;    // u_time mod 186 s (60 arc epochs): arcs, sparks, grain keep float32 precision forever
uniform vec2 u_ptr;      // pointer, CSS px, y down
uniform float u_vel;     // 0..1 pointer speed, decays
uniform float u_depth;   // 0..1 hero pin progress
uniform vec3 u_pulse;    // shockwave origin (CSS px, y down) + age in s
varying vec2 v_uv;

float hash(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p){ float v = .52 * noise(p); p = M * p + 3.1; v += .31 * noise(p); p = M * p + 1.7; v += .17 * noise(p); return v; }

// brand ramp: orange #f26a1b -> #ff9c5c -> gold #ffd79a
vec3 ramp(float t){
  vec3 c = mix(vec3(.949, .416, .106), vec3(1., .612, .361), smoothstep(0., .55, t));
  return mix(c, vec3(1., .843, .604), smoothstep(.55, 1., t));
}

void main(){
  vec2 px = vec2(v_uv.x, 1. - v_uv.y) * u_res;
  vec2 d = px - u_ptr;
  float g = exp(-dot(d, d) / 57800.) * u_vel;                 // sigma = 170 px
  vec2 pw = px - (d * .4 + vec2(-d.y, d.x) * .85) * g;        // push + swirl the domain around the pointer
  vec2 p = vec2(pw.x, u_res.y - pw.y) / u_res.y;               // y up, aspect-true
  float t = u_time;
  float calm = 1. - .55 * u_depth;

  // frame of the brand ray (the hero's SVG streak: through the centre, rising ~17deg): f.x along it, f.y across
  const vec2 DIR = vec2(.955, .297);
  vec2 c0 = vec2(.5 * u_res.x / u_res.y, .51);
  vec2 f = vec2(dot(p - c0, DIR), dot(p - c0, vec2(-DIR.y, DIR.x)));

  // slow domain warp, stretched along the ray and drifting with the current
  vec2 s = vec2(f.x * .7 - t * .05, f.y * 2.2);
  vec2 w = vec2(fbm(s * 1.2 + vec2(0., t * .05)), fbm(s * 1.05 + vec2(4.7, 1.9) - vec2(t * .07, 0.)));

  // energy: a soft band around the diagonal (the brand ray), breathing
  float across = f.y - .05 * sin(f.x * 2.3 + t * .25);
  float band = exp(-across * across * 11.);
  float e = (.1 + .9 * band) * (.55 + .8 * smoothstep(.3, .75, noise(s * .8 + vec2(-t * .1, 5.))));
  e = e * calm + g * 1.2;

  // streamlines of the current: contours of (across + displacement) -> long lines along the ray that never close
  float disp = fbm(vec2(f.x * .95 - t * .13, f.y * 1.3) + w * .9) - .5;
  // lines bunch up towards the ray (the conductor) and spread out away from it
  float fy = f.y + disp * .3;
  float v = sign(fy) * pow(abs(fy) * 2.2, .8) * 7.;
  float id = floor(v);
  float dl = abs(fract(v) - .5) * 2.;                          // 1 on a line, 0 midway
  float lh = hash(vec2(id, 7.1));
  // packets of current travelling up the ray, each line at its own pace
  float pk = pow(.5 + .5 * sin(f.x * 4.2 - t * (1.1 + lh * 1.8) + lh * 40.), 5.);
  float li = mix(.14, 1., step(.4, lh)) * (.22 + .78 * pk);
  float core = pow(dl, 34.), glow = pow(dl, 6.);
  // a finer, fainter web of field lines between them
  float v2 = (f.y + disp * .34 + w.y * .03) * 31.;
  float web = pow(abs(fract(v2) - .5) * 2., 40.) * .16;
  float tone = clamp(.3 + pk * .45 + (lh - .5) * .5 + band * .2, 0., 1.);
  vec3 tint = ramp(tone);

  // base: navy #0b1a3a -> abyss #060d1f, warm bloom upper right, cold one lower left
  vec3 navy = vec3(.043, .102, .227), abyss = vec3(.024, .051, .122);
  vec3 col = mix(abyss, navy, smoothstep(-.2, 1.1, v_uv.y * .7 + v_uv.x * .5));
  vec2 ua = v_uv - vec2(.95, .98), ub = v_uv - vec2(.04, .02);
  col += vec3(.95, .4, .1) * .16 * exp(-dot(ua, ua) * 5.) * calm;
  col += vec3(.145, .282, .541) * .35 * exp(-dot(ub, ub) * 4.);
  col += ramp(.35) * band * .06 * calm;                         // the current's own glow

  // shockwave pulse
  float age = u_pulse.z;
  float rr = length(px - u_pulse.xy);
  float q = (rr - age * 1050.) / (26. + age * 70.);            // q*q, never pow(): pow(x<0) is undefined in GLSL ES
  float ring = exp(-q * q) * exp(-age * 1.5);
  float surge = exp(-age * 1.1);
  e += ring * 2.4 + surge * .4;

  vec3 orange = vec3(.95, .38, .08), gold = vec3(1., .84, .6);
  col += orange * glow * .42 * li * e;                          // saturated halo
  col += mix(tint, gold, pk) * core * 1.6 * li * e;             // gold cores where a packet passes
  col += ramp(.45) * web * e;
  col += vec3(1., .96, .9) * pow(dl, 60.) * pk * step(.75, lh) * band * .8 * calm;   // white-hot cores on the strongest lines

  // arcs: every ~3 s an epoch may strike a jagged arc near the current, flickering at 16 Hz for ~0.6 s
  float tk = u_tick;
  float ep = floor(tk / 3.1), lt = fract(tk / 3.1);
  float seg = floor(tk * 16.);
  float live = step(.3, hash(vec2(ep, 1.3))) * step(lt, .2) * step(.28, hash(vec2(seg, 3.7))) * calm;
  float ax = f.x - (hash(vec2(ep, 5.1)) - .5) * 1.2;
  float ay = across - (hash(vec2(ep, 9.2)) - .5) * .32;
  vec2 ja = vec2(ax * 11., seg), jb = vec2(ax * 43., seg * 1.37);
  float jag = (mix(hash(floor(ja)), hash(floor(ja) + vec2(1., 0.)), fract(ja.x)) - .5) * .075
            + (mix(hash(floor(jb)), hash(floor(jb) + vec2(1., 0.)), fract(jb.x)) - .5) * .028;   // piecewise-linear: kinks like a real arc
  float span = smoothstep(.42, .1, abs(ax));
  float dist = abs(ay - jag);
  col += (vec3(1., .95, .86) * exp(-dist * 380.) * 1.3 + orange * exp(-dist * 40.) * .55) * span * live;

  // rare white sparks riding the current
  vec2 sp = vec2(f.x * 16. - tk * 1.9, f.y * 16.);
  vec2 cell = floor(sp), fr = fract(sp) - .5;
  float h = hash(cell);
  vec2 at = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - .5) * .6;
  float tw = pow(max(0., sin(tk * 1.7 + h * 60.)), 40.);
  col += vec3(1., .97, .92) * step(.982, h) * tw * smoothstep(.12, 0., length(fr - at)) * band * 1.6 * calm;

  col += ramp(.75) * g * .1;                                    // faint light where the pointer stirs
  col += ramp(.6) * ring * .1;
  col *= 1. - .3 * u_depth;
  col *= mix(.72, 1., smoothstep(1.25, .35, length((v_uv - .5) * vec2(1.2, 1.))));   // vignette
  col += (hash(px * .73 + fract(tk * 7.3) * 91.) - .5) * .028;   // grain, kills banding
  gl_FragColor = vec4(col, 1.);
}`;

/**
 * createCampo(canvas, { onDegrade }) → api | null
 * api: start(), stop(), setDepth(0..1), pointer(x, y), pulse(x, y) (both canvas CSS px), destroy()
 onDegrade(slow): slow = true after sustained slow frames, false when the context was lost
 */
export function createCampo(canvas, { onDegrade } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[campo]', gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['u_res', 'u_time', 'u_tick', 'u_ptr', 'u_vel', 'u_depth', 'u_pulse'].map((n) => [n, gl.getUniformLocation(prog, n)]));

  let w = 0, h = 0, raf = 0, last = 0, since = 0, slow = 0, dead = false;
  let time = 30 + Math.random() * 40, depth = 0, vel = 0, velT = 0;
  const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999, lx: 0, ly: 0, lt: 0 };
  const pul = { x: -9999, y: -9999, age: 99 };

  const resize = () => {
    w = canvas.clientWidth; h = canvas.clientHeight;
    const s = 0.5 * Math.min(window.devicePixelRatio || 1, 1);      // half resolution, CSS scales it up
    canvas.width = Math.max(1, Math.round(w * s)); canvas.height = Math.max(1, Math.round(h * s));
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (!raf && !dead && w) draw();                                 // never leave a cleared canvas on screen
  };

  const draw = () => {
    gl.uniform2f(U.u_res, w, h);
    gl.uniform1f(U.u_time, time);
    gl.uniform1f(U.u_tick, time % 186);
    gl.uniform2f(U.u_ptr, ptr.x, ptr.y);
    gl.uniform1f(U.u_vel, vel);
    gl.uniform1f(U.u_depth, depth);
    gl.uniform3f(U.u_pulse, pul.x, pul.y, pul.age);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
    // ignore the first 2.5 s of every (re)start (compile, boot, image decode) and tab-resume gaps
    if (last && now - since > 2500) {
      slow = now - last > 45 && now - last < 1000 ? slow + 1 : 0;
      if (slow >= 10) { degrade(true); return; }
    }
    last = now;
    time += dt * (1 - 0.6 * depth);                                  // the pin calms the current
    pul.age += dt;
    const k = (r) => 1 - Math.pow(1 - r, dt * 60);                   // frame-rate independent lerp
    ptr.x += (ptr.tx - ptr.x) * k(0.1); ptr.y += (ptr.ty - ptr.y) * k(0.1);
    velT *= Math.exp(-dt / 0.35);
    vel += (velT - vel) * k(0.12);
    draw();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const start = () => { if (!raf && !dead) { last = 0; slow = 0; since = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const onLost = () => degrade(false);
  canvas.addEventListener('webglcontextlost', onLost);
  const halt = () => { dead = true; stop(); ro.disconnect(); canvas.removeEventListener('webglcontextlost', onLost); };
  const lose = () => gl.getExtension('WEBGL_lose_context')?.loseContext();
  // the last frame stays on the canvas while the hero fades it out; the context goes once the fade is over
  function degrade(slow) { if (dead) return; halt(); onDegrade?.(slow); setTimeout(lose, 1300); }

  return {
    start, stop,
    setDepth(v) { depth = v; },
    pointer(x, y) {
      const t = performance.now();
      if (ptr.x < -999) { ptr.x = x; ptr.y = y; ptr.lx = x; ptr.ly = y; }
      const dtm = Math.max(8, t - ptr.lt);
      velT = Math.min(1, Math.max(velT, Math.hypot(x - ptr.lx, y - ptr.ly) / dtm / 1.4));
      ptr.tx = x; ptr.ty = y; ptr.lx = x; ptr.ly = y; ptr.lt = t;
    },
    pulse(x, y) { pul.x = x; pul.y = y; pul.age = 0; ptr.x = ptr.tx = x; ptr.y = ptr.ty = y; velT = Math.max(velT, 0.6); },
    destroy() { halt(); lose(); },
  };
}
