export const VERTEX = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * Domain-warped simplex noise bends the plane, five drifting anchors pull
 * the five colours around it, and the blend happens in OKLab so mixes stay clean.
 * Colours arrive as OKLab triples.
 */
export const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uIntensity;
uniform float uGrain;
uniform vec3 uLab[5];

// 2D simplex noise, Ashima Arts / Ian McEwan (MIT).
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 oklabToSrgb(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  vec3 lin = vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  lin = clamp(lin, 0.0, 1.0);
  return mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (gl_FragCoord.xy / uRes - 0.5) * vec2(aspect, 1.0);
  float t = uTime;

  // Two layers of warp, the second fed by the first, for the liquid look.
  vec2 q = vec2(snoise(p * 1.2 + vec2(0.0, t * 0.15)),
                snoise(p * 1.2 + vec2(5.2, -t * 0.12)));
  vec2 r = vec2(snoise(p * 1.6 + 2.0 * q + vec2(1.7, 9.2) + t * 0.10),
                snoise(p * 1.6 + 2.0 * q + vec2(8.3, 2.8) - t * 0.08));
  vec2 w = p + uIntensity * (0.30 * q + 0.22 * r);

  vec3 acc = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 5; i++) {
    float f = float(i);
    vec2 anchor = vec2(
      aspect * 0.42 * sin(t * 0.13 * (1.0 + f * 0.31) + f * 2.1),
      0.40 * cos(t * 0.17 * (1.0 + f * 0.23) + f * 1.3));
    vec2 d = w - anchor;
    float weight = 1.0 / (dot(d, d) + 0.06);
    weight *= weight * (1.35 - 0.12 * f); // the dominant colour gets a bit more room
    acc += uLab[i] * weight;
    total += weight;
  }

  vec3 lab = acc / total;
  lab.yz *= 1.12; // slightly richer than the source art
  vec3 rgb = oklabToSrgb(lab);

  // Grain doubles as dithering, which hides banding in the slow gradients.
  rgb += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;
