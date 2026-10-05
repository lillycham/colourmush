import type { Frame, Painter } from "./painter";
import { FRAGMENT, VERTEX } from "./shader";

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`colourmush: shader compile failed: ${log}`);
  }
  return shader;
}

/** Throws if WebGL is unavailable, so the caller can fall back. */
export function createWebGLPainter(canvas: HTMLCanvasElement): Painter {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) throw new Error("colourmush: WebGL is unavailable");

  const program = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`colourmush: program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  // One oversized triangle covers the whole viewport.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "uRes");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uIntensity = gl.getUniformLocation(program, "uIntensity");
  const uGrain = gl.getUniformLocation(program, "uGrain");
  const uLab = gl.getUniformLocation(program, "uLab");

  return {
    draw({ time, lab, width, height, intensity, grain }: Frame) {
      if (gl.isContextLost()) return;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uIntensity, intensity);
      gl.uniform1f(uGrain, grain);
      gl.uniform3fv(uLab, lab);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
