// The Makhana tilt-shift 3D renderer (WebGL1), ported from the MAKHANA prototype. World pixels on the
// ground (x, y) become 3D (X = x, Y = height, Z = y); the camera looks north at a tilt; upright
// billboards are stretched by 1/cos(pitch) (K) so pixel art keeps its proportions; cliffs, walls and
// buildings are extruded blocks; fog by depth; then a post pass with depth of field (or a tilt-shift
// strip), saturation, contrast and brightness. One context is shared by whoever is drawing.
import { mk, clamp } from './tex.js';

let R = null;   // the renderer, made on first use
export function renderer() {
  if (R) return R.ok ? R : null;
  R = { ok: false };
  const c = mk(256, 160); let gl = null;
  try { gl = c.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, depth: true }); } catch { /* none */ }
  if (!gl) return null;
  R.c = c; R.gl = gl;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  try {
    R.P = prog(`attribute vec3 aPos;attribute vec2 aUV;attribute vec4 aRect;attribute vec2 aSA;uniform mat4 uMVP;varying vec2 vUV;varying vec4 vRect;varying vec2 vSA;varying float vD;
      void main(){vec4 p=uMVP*vec4(aPos,1.);gl_Position=p;vUV=aUV;vRect=aRect;vSA=aSA;vD=p.w;}`,
    `precision mediump float;uniform sampler2D uTex;uniform vec3 uFog;uniform vec2 uFogR;uniform float uFogA;uniform float uShadow;uniform float uPix;uniform float uDith;uniform vec2 uDR;uniform vec3 uTint;varying vec2 vUV;varying vec4 vRect;varying vec2 vSA;varying float vD;
      float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}
      float b4(vec2 a){return b2(.5*a)*.25+b2(a);}
      void main(){vec2 uv=vRect.z<0.?vRect.xy+vUV*abs(vRect.zw):vRect.xy+fract(vUV)*vRect.zw;vec4 c=texture2D(uTex,uv);
        if(uShadow>.5){if(c.a<.05)discard;gl_FragColor=vec4(0.,0.,0.,c.a*.75*vSA.y);return;}
        if(c.a<.5)discard;if(vSA.y<.999){if(uDith>.5){if(vSA.y<b4(floor(gl_FragCoord.xy/uPix))+.03)discard;}else if(vSA.y<.5)discard;}
        vec3 col=c.rgb*vSA.x*uTint;float f=smoothstep(uFogR.x,uFogR.y,vD)*uFogA;gl_FragColor=vec4(mix(col,uFog,f),clamp((vD-uDR.x)/uDR.y,0.,1.));}`);
    R.Q = prog(`attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}`,
    `precision mediump float;uniform sampler2D uS;uniform vec2 uRes;uniform float uFocus,uBand,uMax,uSat,uBri,uCon,uMode,uFocal,uRange,uSoft;uniform vec2 uDR;
      float coc(float a){return uMax*smoothstep(uRange,uRange+uSoft,abs(uDR.x+a*uDR.y-uFocal));}
      void main(){vec2 uv=gl_FragCoord.xy/uRes;vec4 c0=texture2D(uS,uv);vec3 c;
        if(uMode<.5){float d=abs(uv.y-uFocus);float r=uMax*smoothstep(uBand,uBand+.28,d);vec4 acc=c0;float n=1.;
          if(r>.05){for(int i=0;i<24;i++){float a=float(i)*2.39996;float rr=sqrt((float(i)+.5)/24.)*r;acc+=texture2D(uS,uv+vec2(cos(a),sin(a))*rr/uRes);n+=1.;}}c=acc.rgb/n;}
        else{float cc=coc(c0.a);vec3 acc=c0.rgb;float ws=1.;
          if(uMax>.05){for(int i=0;i<34;i++){float a=float(i)*2.39996;float rr=sqrt((float(i)+.5)/34.)*uMax;vec4 s=texture2D(uS,uv+vec2(cos(a),sin(a))*rr/uRes);
            float sc=coc(s.a);float use=s.a>c0.a+.004?min(sc,cc):sc;float w=clamp(use-rr+1.,0.,1.);acc+=s.rgb*w;ws+=w;}}c=acc/ws;}
        float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);c=(c-.5)*uCon+.5;c*=uBri;gl_FragColor=vec4(c,1.);}`);
  } catch (err) { console.warn('garden 3D disabled:', err); return null; }
  const P = R.P, Q = R.Q, u = (p, n) => gl.getUniformLocation(p, n);
  R.loc = { aPos: gl.getAttribLocation(P, 'aPos'), aUV: gl.getAttribLocation(P, 'aUV'), aRect: gl.getAttribLocation(P, 'aRect'), aSA: gl.getAttribLocation(P, 'aSA') };
  for (const n of ['uMVP', 'uTex', 'uFog', 'uFogR', 'uFogA', 'uShadow', 'uDR', 'uPix', 'uDith', 'uTint']) R.loc[n] = u(P, n);
  R.qloc = { aP: gl.getAttribLocation(Q, 'aP') };
  for (const n of ['uS', 'uRes', 'uFocus', 'uBand', 'uMax', 'uSat', 'uBri', 'uCon', 'uMode', 'uFocal', 'uRange', 'uSoft', 'uDR']) R.qloc[n] = u(Q, n);
  R.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, R.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  R.dyn = gl.createBuffer(); R.dynS = gl.createBuffer();
  R.AS = 2048; R.atlas = texNew(R.AS, R.AS, null); R.pack = { x: 0, y: 0, rh: 0, gen: 1 };
  R.pitch = 20 * Math.PI / 180; R.fov = 60 * Math.PI / 180; R.K = 1 / Math.cos(R.pitch);
  c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.ok = false; R.lost = true; });
  R.ok = true;
  return R;
}
export const glLost = () => !!R?.lost;

export function texNew(w, h, src, linear, flip) {
  const gl = R.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!flip);
  if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); return t;
}
export function texSet(t, src, flip) { const gl = R.gl; gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!flip); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); }
export function texFree(t) { if (t && R?.gl) R.gl.deleteTexture(t); }
export function texSub(t, x, y, src) { const gl = R.gl; gl.bindTexture(gl.TEXTURE_2D, t); gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, src); }
// pack a canvas into the sprite atlas once; returns normalised [u, v, w, h]. When the atlas is full it
// starts again (gen goes up) and everything built from it must be rebuilt.
export function atl(cv) {
  const K = R.pack; if (cv._ag === K.gen) return cv._ar;
  const gl = R.gl, S = R.AS, w = cv.width + 2, h = cv.height + 2;
  if (K.x + w > S) { K.x = 0; K.y += K.rh; K.rh = 0; }
  if (K.y + h > S) { K.gen++; K.x = K.y = K.rh = 0; gl.bindTexture(gl.TEXTURE_2D, R.atlas); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); }
  gl.bindTexture(gl.TEXTURE_2D, R.atlas); gl.texSubImage2D(gl.TEXTURE_2D, 0, K.x + 1, K.y + 1, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  cv._ar = [(K.x + 1) / S, (K.y + 1) / S, cv.width / S, cv.height / S]; cv._ag = K.gen; K.x += w; K.rh = Math.max(K.rh, h); return cv._ar;
}
export const atlasGen = () => R.pack.gen;

// vertex batches: pos3 uv2 rect4 shade alpha = 11 floats
export class Batch {
  constructor(n) { this.a = new Float32Array((n || 4096) * 11); this.n = 0; }
  reset() { this.n = 0; }
  v(x, y, z, u, v, r0, r1, r2, r3, s, al) { if ((this.n + 1) * 11 > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; } const a = this.a, o = this.n * 11; a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = u; a[o + 4] = v; a[o + 5] = r0; a[o + 6] = r1; a[o + 7] = r2; a[o + 8] = r3; a[o + 9] = s; a[o + 10] = al; this.n++; }
  // upright billboard: source rect (sx, sy, sw, sh) of canvas cv, foot at (x, z), base height h, k = stretch
  bb(cv, sx, sy, sw, sh, x, z, h, k, shade, al, ax, zb, scale = 1) {
    const r = atl(cv), S = R.AS, u0 = r[0] + sx / S, v0 = r[1] + sy / S, du = sw / S, dv = sh / S;
    const X0 = x - (ax === undefined ? sw / 2 : ax) * scale, X1 = X0 + sw * scale, Y0 = h, Y1 = h + sh * k * scale, Z = z + (zb || 0), s = shade === undefined ? 1 : shade, a = al === undefined ? 1 : al;
    this.v(X0, Y1, Z, 0, 0, u0, v0, -du, dv, s, a); this.v(X1, Y1, Z, 1, 0, u0, v0, -du, dv, s, a); this.v(X1, Y0, Z, 1, 1, u0, v0, -du, dv, s, a);
    this.v(X0, Y1, Z, 0, 0, u0, v0, -du, dv, s, a); this.v(X1, Y0, Z, 1, 1, u0, v0, -du, dv, s, a); this.v(X0, Y0, Z, 0, 1, u0, v0, -du, dv, s, a);
  }
  // the same, from a rect already in some texture (normalised [u, v, w, h])
  bbr(r, sw, sh, x, z, h, k, shade, al, scale = 1, flip = false) {
    const X0 = x - (sw / 2) * scale, X1 = X0 + sw * scale, Y0 = h, Y1 = h + sh * k * scale, s = shade ?? 1, a = al ?? 1, uL = flip ? 1 : 0, uR = 1 - uL, R0 = r[0], R1 = r[1], R2 = -r[2], R3 = r[3];
    this.v(X0, Y1, z, uL, 0, R0, R1, R2, R3, s, a); this.v(X1, Y1, z, uR, 0, R0, R1, R2, R3, s, a); this.v(X1, Y0, z, uR, 1, R0, R1, R2, R3, s, a);
    this.v(X0, Y1, z, uL, 0, R0, R1, R2, R3, s, a); this.v(X1, Y0, z, uR, 1, R0, R1, R2, R3, s, a); this.v(X0, Y0, z, uL, 1, R0, R1, R2, R3, s, a);
  }
  // flat ground decal
  gd(cv, x, z, w, d, y, al) {
    const r = atl(cv), X0 = x - w / 2, X1 = x + w / 2, Z0 = z - d / 2, Z1 = z + d / 2, Y = y || 0.3, a = al === undefined ? 1 : al;
    this.v(X0, Y, Z0, 0, 0, r[0], r[1], -r[2], r[3], 1, a); this.v(X1, Y, Z0, 1, 0, r[0], r[1], -r[2], r[3], 1, a); this.v(X1, Y, Z1, 1, 1, r[0], r[1], -r[2], r[3], 1, a);
    this.v(X0, Y, Z0, 0, 0, r[0], r[1], -r[2], r[3], 1, a); this.v(X1, Y, Z1, 1, 1, r[0], r[1], -r[2], r[3], 1, a); this.v(X0, Y, Z1, 0, 1, r[0], r[1], -r[2], r[3], 1, a);
  }
  quad(p0, p1, p2, p3, uv0, uv1, uv2, uv3, rect, s, al = 1) { const q = (p, uv) => this.v(p[0], p[1], p[2], uv[0], uv[1], rect[0], rect[1], rect[2], rect[3], s, al); q(p0, uv0); q(p1, uv1); q(p2, uv2); q(p0, uv0); q(p2, uv2); q(p3, uv3); }
  upload(buf, usage) { const gl = R.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, this.a.subarray(0, this.n * 11), usage || gl.DYNAMIC_DRAW); return this.n; }
}
export const newBuffer = () => R.gl.createBuffer();
export function freeBuffer(b) { if (b && R?.gl) R.gl.deleteBuffer(b); }

// ------------------------------------------------ matrices and the camera
function m4mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function m4persp(fy, asp, n, f, shiftY) { const t = 1 / Math.tan(fy / 2), nf = 1 / (n - f); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, -shiftY, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]); }
function m4look(e, c, u) {
  let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map((v) => v / l);
  let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x = x.map((v) => v / l);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]], d = (a) => -(a[0] * e[0] + a[1] * e[1] + a[2] * e[2]);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, d(x), d(y), d(z), 1]);
}
export function setLens(pitchDeg, fovDeg) { R.pitch = clamp(pitchDeg, 8, 85) * Math.PI / 180; R.fov = clamp(fovDeg, 4, 110) * Math.PI / 180; R.K = 1 / Math.cos(R.pitch); return R.K; }
// look at (tx, ty, tz) from the camera distance that shows VH world pixels at the target; focusY is
// where on screen the target sits; far = how many distances away to draw. Returns the projector
// PJ(x, y, h) → [screen x, screen y] (h a billboard height, stretched by K).
export function camSetup(VW, VH, tx, ty, tz, focusY, far = 4) {
  const D = VH / (2 * Math.tan(R.fov / 2)), p = R.pitch, e = [tx, ty + D * Math.sin(p), tz + D * Math.cos(p)];
  const shift = 1 - 2 * focusY / VH, M = m4mul(m4persp(R.fov, VW / VH, D * 0.25, D * far, shift), m4look(e, [tx, ty, tz], [0, 1, 0]));
  R.mvp = M; R.D = D; R.focusY = focusY; R.VW = VW; R.VH = VH; R.eye = e;
  return (x, y, h, base = 0) => { const X = x, Y = base + (h || 0) * R.K, Z = y, cw = M[3] * X + M[7] * Y + M[11] * Z + M[15], cx = (M[0] * X + M[4] * Y + M[8] * Z + M[12]) / cw, cy = (M[1] * X + M[5] * Y + M[9] * Z + M[13]) / cw; return [(cx * 0.5 + 0.5) * VW, (1 - (cy * 0.5 + 0.5)) * VH, cw]; };
}
export const camD = () => R.D;
// a screen point (in view units) back onto the horizontal plane at height planeY: [x, z] or null
function m4inv(m) {
  const a = m, o = new Float32Array(16);
  o[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  o[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  o[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  o[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  o[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  o[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  o[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  o[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  o[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  o[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  o[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  o[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  o[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  o[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  o[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  o[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  const det = a[0] * o[0] + a[1] * o[4] + a[2] * o[8] + a[3] * o[12]; if (!det) return null; for (let i = 0; i < 16; i++) o[i] /= det; return o;
}
export function unproject(sx, sy, planeY) {
  const I = m4inv(R.mvp); if (!I) return null; const nx = (sx / R.VW) * 2 - 1, ny = 1 - (sy / R.VH) * 2;
  const P = (z) => { const x = I[0] * nx + I[4] * ny + I[8] * z + I[12], y = I[1] * nx + I[5] * ny + I[9] * z + I[13], zz = I[2] * nx + I[6] * ny + I[10] * z + I[14], w = I[3] * nx + I[7] * ny + I[11] * z + I[15]; return [x / w, y / w, zz / w]; };
  const a = P(-1), b = P(1), dy = b[1] - a[1]; if (Math.abs(dy) < 1e-6) return null; const t = (planeY - a[1]) / dy; if (t < 0) return null;
  return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t];
}

// ------------------------------------------------ frame plumbing
export function glBegin(VW, VH, scale, clear) {
  const gl = R.gl, c = R.c, RW = Math.max(16, Math.round(VW * scale)), RH = Math.max(16, Math.round(VH * scale)); R.RW = RW; R.RH = RH; R.scale = scale;
  if (c.width !== RW || c.height !== RH) { c.width = RW; c.height = RH; }
  if (!R.fbo || R.fw !== RW || R.fh !== RH) {
    if (R.fbo) { gl.deleteFramebuffer(R.fbo); gl.deleteTexture(R.ftex); gl.deleteRenderbuffer(R.rb); }
    R.fbo = gl.createFramebuffer(); R.ftex = texNew(RW, RH, null, true); R.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, R.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, RW, RH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, R.ftex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, R.rb); R.fw = RW; R.fh = RH;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.fbo); gl.viewport(0, 0, RW, RH); gl.clearColor(clear[0] / 255, clear[1] / 255, clear[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
// a full-screen texture (the sky behind everything, or the post pass when blur is given)
export function glScreen(tex, blur, G) {
  const gl = R.gl, L = R.qloc; gl.useProgram(R.Q); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.bindBuffer(gl.ARRAY_BUFFER, R.quad);
  for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i); gl.enableVertexAttribArray(L.aP); gl.vertexAttribPointer(L.aP, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(L.uS, 0); gl.uniform2f(L.uRes, R.RW, R.RH);
  gl.uniform1f(L.uFocus, blur ? 1 - R.focusY / R.VH + (blur.focus || 0) : 0.5); gl.uniform1f(L.uBand, blur ? blur.band : 9); gl.uniform1f(L.uMax, blur ? blur.max * R.scale : 0);
  gl.uniform1f(L.uSat, blur ? blur.sat : 1); gl.uniform1f(L.uBri, blur ? G.bright : 1); gl.uniform1f(L.uCon, blur ? G.contrast : 1);
  const D = R.D || 300, dof = !!blur && G.dof === 'DEPTH'; gl.uniform1f(L.uMode, dof ? 1 : 0); gl.uniform2f(L.uDR, D * 0.3, D * (blur?.depthSpan || 3));
  gl.uniform1f(L.uFocal, D * (1 + ((blur && blur.focus) || 0) * 1.6)); gl.uniform1f(L.uRange, (blur ? blur.band : 0) * D * 1.2); gl.uniform1f(L.uSoft, D * 0.35); gl.drawArrays(gl.TRIANGLES, 0, 6);
}
// the main program: fog colour and strength; fogR = [near, far] in camera distances; tint multiplies
export function glMain(fog, fogA, G, fogR = [0.95, 1.9], tint = [1, 1, 1], depthSpan = 3) {
  const gl = R.gl, L = R.loc; gl.useProgram(R.P); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.uniformMatrix4fv(L.uMVP, false, R.mvp); gl.uniform1i(L.uTex, 0);
  gl.uniform3f(L.uFog, fog[0] / 255, fog[1] / 255, fog[2] / 255); const fk = Math.max(0, G.fog - 1);
  gl.uniform2f(L.uFogR, R.D * Math.max(fogR[0] * 0.47, fogR[0] - fk * 0.13), R.D * Math.max(fogR[1] * 0.58, fogR[1] - fk * 0.2)); gl.uniform1f(L.uFogA, clamp(fogA * G.fog, 0, 0.97));
  gl.uniform1f(L.uShadow, 0); gl.uniform1f(L.uPix, R.scale); gl.uniform2f(L.uDR, R.D * 0.3, R.D * depthSpan); gl.uniform1f(L.uDith, G.dither ? 1 : 0); gl.uniform3f(L.uTint, tint[0], tint[1], tint[2]); gl.activeTexture(gl.TEXTURE0);
}
export function glTint(t) { R.gl.uniform3f(R.loc.uTint, t[0], t[1], t[2]); }
export function glDraw(buf, n, tex, shadow) {
  if (!n) return; const gl = R.gl, L = R.loc; gl.bindTexture(gl.TEXTURE_2D, tex); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
  for (const [l, s, o] of [[L.aPos, 3, 0], [L.aUV, 2, 12], [L.aRect, 4, 20], [L.aSA, 2, 36]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, 44, o); }
  if (shadow) { gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false); gl.uniform1f(L.uShadow, 1); }
  gl.drawArrays(gl.TRIANGLES, 0, n);
  if (shadow) { gl.disable(gl.BLEND); gl.depthMask(true); gl.uniform1f(L.uShadow, 0); }
}
// finish: the post pass into the canvas, which the caller draws where it likes
export function glEnd(blur, G) { const gl = R.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, R.RW, R.RH); glScreen(R.ftex, blur, G); return R.c; }
export const atlasTex = () => R.atlas;
export const glK = () => R.K;
