// OrbitalShader.js
export const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0); // No projection needed for a screen-filling quad
  }
`;
export const fragmentShader = `
precision highp float;

uniform float time;
uniform float isovalue;
uniform float aspectRatio;
uniform float edgeThreshold;
uniform float edgeWidth;
uniform int renderMode;
uniform vec3 cameraPos;
uniform vec3 cameraDirection;
uniform vec3 cameraUp;
uniform vec3 cameraRight;

// Orbital data arrays - extended to 6 orbitals
uniform int orbital_n[6];
uniform int orbital_l[6];
uniform int orbital_m[6];
uniform float orbital_weight[6];
uniform float orbital_phase[6];
uniform int orbital_count;

varying vec2 vUv;

#define PI 3.14159265359
#define MAX_STEPS 100
#define STEP_SIZE 0.5
#define DENSITY_THRESHOLD 0.00002
#define MAX_DISTANCE 100.0

// Maximum L value we'll support
#define MAX_L 4

// Optimized cartesian calculation of spherical harmonics up to L=4
// Replace the existing SH computation in your shader with this optimized version

// Constants needed for normalization
#define SQRT_PI 1.77245385091
#define SQRT_2 1.41421356237
#define SQRT_3 1.73205080757
#define SQRT_5 2.2360679775
#define SQRT_6 2.44949
#define SQRT_7 2.64575
#define SQRT_10 3.16228
#define SQRT_14 3.74166
#define SQRT_15 3.87298
#define SQRT_35 5.91608

float o_1_0_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return pow(Q, 1.5) * exp(-Q * r) / SQRT_PI;
}


float o_2_0_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 8.0) * SQRT_2 * pow(Q, 1.5) *
      (-Q * r + 2.0) * exp(-0.5 * Q * r) / SQRT_PI;
}

float o_2_1_neg_1_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 8.0) * pow(Q, 2.5) * rxy *
      exp(-0.5 * Q * r) * cos(phi) / SQRT_PI;
}

float o_2_1_neg_1_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return -1.0 / 8.0 * pow(Q, 2.5) * rxy *
      exp(-0.5 * Q * r) * sin(phi) / SQRT_PI;
}

float o_2_1_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 8.0) * SQRT_2 * pow(Q, 2.5) * z *
      exp(-0.5 * Q * r) / SQRT_PI;
}

float o_2_1_1_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return -1.0 / 8.0 * pow(Q, 2.5) * x *
      exp(-0.5 * Q * r) / SQRT_PI;
}

float o_2_1_1_imag(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return -1.0 / 8.0 * pow(Q, 2.5) * y *
      exp(-0.5 * Q * r) / SQRT_PI;
}

float o_3_0_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 243.0) * SQRT_3 * pow(Q, 1.5) *
      (2.0 * Q*Q * r*r - 18.0 * Q * r + 27.0) *
      exp(-1.0 / 3.0 * Q * r) / SQRT_PI;
}

float o_3_1_neg_1_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 81.0) * pow(Q, 2.5) * rxy *
      (-Q * r + 6.0) * exp(-1.0 / 3.0 * Q * r) * cos(phi) / SQRT_PI;
}

float o_3_1_neg_1_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return -1.0 / 81.0 * pow(Q, 2.5) * rxy *
      (-Q * r + 6.0) * exp(-1.0 / 3.0 * Q * r) * sin(phi) / SQRT_PI;
}

float o_3_1_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 81.0) * SQRT_2 * pow(Q, 2.5) * z *
      (-Q * r + 6.0) * exp(-1.0 / 3.0 * Q * r) / SQRT_PI;
}

float o_3_1_1_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 81.0) * pow(Q, 2.5) * x *
      (Q * r - 6.0) * exp(-1.0 / 3.0 * Q * r) / SQRT_PI;
}

float o_3_1_1_imag(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 81.0) * pow(Q, 2.5) * y *
      (Q * r - 6.0) * exp(-1.0 / 3.0 * Q * r) / SQRT_PI;
}

float o_3_2_neg_2_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return (1.0 / 162.0) * pow(Q, 3.5) * rxy_sq *
      exp(-1.0 / 3.0 * Q * r) * cos(2.0 * phi) / SQRT_PI;
}

float o_3_2_neg_2_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return -1.0 / 162.0 * pow(Q, 3.5) * rxy_sq *
      exp(-1.0 / 3.0 * Q * r) * sin(2.0 * phi) / SQRT_PI;
}

float o_3_2_neg_1_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 81.0) * pow(Q, 3.5) * z * rxy *
      exp(-1.0 / 3.0 * Q * r) * cos(phi) / SQRT_PI;
}

float o_3_2_neg_1_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return -1.0 / 81.0 * pow(Q, 3.5) * z * rxy *
      exp(-1.0 / 3.0 * Q * r) * sin(phi) / SQRT_PI;
}

float o_3_2_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 486.0) * SQRT_6 * pow(Q, 3.5) *
      (-x*x - y*y + 2.0 * z*z) * exp(-1.0 / 3.0 * Q * r) / SQRT_PI;
}

float o_3_2_1_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return -1.0 / 81.0 * pow(Q, 3.5) * x * z *
      exp(-1.0 / 3.0 * Q * r) / SQRT_PI;
}

float o_3_2_1_imag(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return -1.0 / 81.0 * pow(Q, 3.5) * y * z *
      exp(-1.0 / 3.0 * Q * r) / SQRT_PI;
}

float o_3_2_2_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return (1.0 / 162.0) * pow(Q, 3.5) * rxy_sq *
      exp(-1.0 / 3.0 * Q * r) * cos(2.0 * phi) / SQRT_PI;
}

float o_3_2_2_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return (1.0 / 162.0) * pow(Q, 3.5) * rxy_sq *
      exp(-1.0 / 3.0 * Q * r) * sin(2.0 * phi) / SQRT_PI;
}

float o_4_0_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 1536.0) * pow(Q, 1.5) *
      (-pow(Q, 3.0) * r*r*r + 24.0 * Q*Q * r*r - 144.0 * Q * r + 192.0) *
      exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_1_neg_1_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 5120.0) * SQRT_10 * pow(Q, 2.5) * rxy *
      (Q*Q * r*r - 20.0 * Q * r + 80.0) *
      exp(-0.25 * Q * r) * cos(phi) / SQRT_PI;
}

float o_4_1_neg_1_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return -1.0 / 5120.0 * SQRT_10 * pow(Q, 2.5) * rxy *
      (Q*Q * r*r - 20.0 * Q * r + 80.0) *
      exp(-0.25 * Q * r) * sin(phi) / SQRT_PI;
}

float o_4_1_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 2560.0) * SQRT_5 * pow(Q, 2.5) * z *
      (Q*Q * r*r - 20.0 * Q * r + 80.0) *
      exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_1_1_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return -1.0 / 5120.0 * SQRT_10 * pow(Q, 2.5) * x *
      (Q*Q * r*r - 20.0 * Q * r + 80.0) *
      exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_1_1_imag(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return -1.0 / 5120.0 * SQRT_10 * pow(Q, 2.5) * y *
      (Q*Q * r*r - 20.0 * Q * r + 80.0) *
      exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_2_neg_2_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return -1.0 / 6144.0 * SQRT_6 * pow(Q, 3.5) * rxy_sq *
      (Q * r - 12.0) * exp(-0.25 * Q * r) *
      cos(2.0 * phi) / SQRT_PI;
}

float o_4_2_neg_2_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return (1.0 / 6144.0) * SQRT_6 * pow(Q, 3.5) * rxy_sq *
      (Q * r - 12.0) * exp(-0.25 * Q * r) *
      sin(2.0 * phi) / SQRT_PI;
}

float o_4_2_neg_1_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 3072.0) * pow(Q, 3.5) * z * SQRT_6 * rxy *
      (-Q * r + 12.0) * exp(-0.25 * Q * r) * cos(phi) / SQRT_PI;
}

float o_4_2_neg_1_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return -1.0 / 3072.0 * pow(Q, 3.5) * z * SQRT_6 * rxy *
      (-Q * r + 12.0) * exp(-0.25 * Q * r) * sin(phi) / SQRT_PI;
}

float o_4_2_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 3072.0) * pow(Q, 3.5) *
      (Q * r - 12.0) * (x*x + y*y - 2.0 * z*z) *
      exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_2_1_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 3072.0) * SQRT_6 * pow(Q, 3.5) * x * z *
      (Q * r - 12.0) * exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_2_1_imag(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 3072.0) * SQRT_6 * pow(Q, 3.5) * y * z *
      (Q * r - 12.0) * exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_2_2_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return -1.0 / 6144.0 * SQRT_6 * pow(Q, 3.5) * rxy_sq *
      (Q * r - 12.0) * exp(-0.25 * Q * r) *
      cos(2.0 * phi) / SQRT_PI;
}

float o_4_2_2_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return -1.0 / 6144.0 * SQRT_6 * pow(Q, 3.5) * rxy_sq *
      (Q * r - 12.0) * exp(-0.25 * Q * r) *
      sin(2.0 * phi) / SQRT_PI;
}

float o_4_3_neg_3_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 6144.0) * pow(Q, 4.5) * pow(rxy, 3.0) *
      exp(-0.25 * Q * r) * cos(3.0 * phi) / SQRT_PI;
}

float o_4_3_neg_3_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 6144.0) * pow(Q, 4.5) * pow(rxy, 3.0) *
      exp(-0.25 * Q * r) * sin(-3.0 * phi) / SQRT_PI;
}

float o_4_3_neg_2_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return (1.0 / 6144.0) * SQRT_6 * pow(Q, 4.5) * z * rxy_sq *
      exp(-0.25 * Q * r) * cos(2.0 * phi) / SQRT_PI;
}

float o_4_3_neg_2_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return -1.0 / 6144.0 * SQRT_6 * pow(Q, 4.5) * z * rxy_sq *
      exp(-0.25 * Q * r) * sin(2.0 * phi) / SQRT_PI;
}

float o_4_3_neg_1_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 30720.0) * SQRT_15 * pow(Q, 4.5) *
      (5.0 * z*z * rxy - rxy * r*r) *
      exp(-0.25 * Q * r) * cos(phi) / (r * SQRT_PI);
}

float o_4_3_neg_1_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return (1.0 / 30720.0) * SQRT_15 * pow(Q, 4.5) *
      (5.0 * z*z * rxy - rxy * r*r) *
      exp(-0.25 * Q * r) * sin(-phi) / (r * SQRT_PI);
}

float o_4_3_0_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 15360.0) * SQRT_5 * pow(Q, 4.5) * z *
      (-3.0 * x*x - 3.0 * y*y + 2.0 * z*z) *
      exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_3_1_real(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 30720.0) * SQRT_15 * pow(Q, 4.5) * x *
      (x*x + y*y - 4.0 * z*z) *
      exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_3_1_imag(float Q, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  return (1.0 / 30720.0) * SQRT_15 * pow(Q, 4.5) * y *
      (x*x + y*y - 4.0 * z*z) *
      exp(-0.25 * Q * r) / SQRT_PI;
}

float o_4_3_2_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return (1.0 / 6144.0) * SQRT_6 * pow(Q, 4.5) * z * rxy_sq *
      exp(-0.25 * Q * r) * cos(2.0 * phi) / SQRT_PI;
}

float o_4_3_2_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy_sq = x*x + y*y;
  return (1.0 / 6144.0) * SQRT_6 * pow(Q, 4.5) * z * rxy_sq *
      exp(-0.25 * Q * r) * sin(2.0 * phi) / SQRT_PI;
}

float o_4_3_3_real(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return -1.0 / 6144.0 * pow(Q, 4.5) * pow(rxy, 3.0) *
      exp(-0.25 * Q * r) * cos(3.0 * phi) / SQRT_PI;
}

float o_4_3_3_imag(float Q, float phi, float x, float y, float z) {
  float r = sqrt(x*x + y*y + z*z);
  float rxy = sqrt(x*x + y*y);
  return -1.0 / 6144.0 * pow(Q, 4.5) * pow(rxy, 3.0) *
      exp(-0.25 * Q * r) * sin(3.0 * phi) / SQRT_PI;
}

vec2 orbital(int n, int l, int m, float Q, float x, float y, float z, float phase) {
    float phi = phase;
    
    // Dispatch to the correct orbital function
    if (n == 1 && l == 0 && m == 0) {
        return vec2(o_1_0_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 2 && l == 0 && m == 0) {
        return vec2(o_2_0_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 2 && l == 1 && m == -1) {
        return vec2(o_2_1_neg_1_real(Q, phi, x, y, z), o_2_1_neg_1_imag(Q, phi, x, y, z));
    }
    else if (n == 2 && l == 1 && m == 0) {
        return vec2(o_2_1_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 2 && l == 1 && m == 1) {
        return vec2(o_2_1_1_real(Q, x, y, z), o_2_1_1_imag(Q, x, y, z));
    }
    else if (n == 3 && l == 0 && m == 0) {
        return vec2(o_3_0_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 3 && l == 1 && m == -1) {
        return vec2(o_3_1_neg_1_real(Q, phi, x, y, z), o_3_1_neg_1_imag(Q, phi, x, y, z));
    }
    else if (n == 3 && l == 1 && m == 0) {
        return vec2(o_3_1_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 3 && l == 1 && m == 1) {
        return vec2(o_3_1_1_real(Q, x, y, z), o_3_1_1_imag(Q, x, y, z));
    }
    else if (n == 3 && l == 2 && m == -2) {
        return vec2(o_3_2_neg_2_real(Q, phi, x, y, z), o_3_2_neg_2_imag(Q, phi, x, y, z));
    }
    else if (n == 3 && l == 2 && m == -1) {
        return vec2(o_3_2_neg_1_real(Q, phi, x, y, z), o_3_2_neg_1_imag(Q, phi, x, y, z));
    }
    else if (n == 3 && l == 2 && m == 0) {
        return vec2(o_3_2_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 3 && l == 2 && m == 1) {
        return vec2(o_3_2_1_real(Q, x, y, z), o_3_2_1_imag(Q, x, y, z));
    }
    else if (n == 3 && l == 2 && m == 2) {
        return vec2(o_3_2_2_real(Q, phi, x, y, z), o_3_2_2_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 0 && m == 0) {
        return vec2(o_4_0_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 4 && l == 1 && m == -1) {
        return vec2(o_4_1_neg_1_real(Q, phi, x, y, z), o_4_1_neg_1_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 1 && m == 0) {
        return vec2(o_4_1_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 4 && l == 1 && m == 1) {
        return vec2(o_4_1_1_real(Q, x, y, z), o_4_1_1_imag(Q, x, y, z));
    }
    else if (n == 4 && l == 2 && m == -2) {
        return vec2(o_4_2_neg_2_real(Q, phi, x, y, z), o_4_2_neg_2_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 2 && m == -1) {
        return vec2(o_4_2_neg_1_real(Q, phi, x, y, z), o_4_2_neg_1_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 2 && m == 0) {
        return vec2(o_4_2_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 4 && l == 2 && m == 1) {
        return vec2(o_4_2_1_real(Q, x, y, z), o_4_2_1_imag(Q, x, y, z));
    }
    else if (n == 4 && l == 2 && m == 2) {
        return vec2(o_4_2_2_real(Q, phi, x, y, z), o_4_2_2_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 3 && m == -3) {
        return vec2(o_4_3_neg_3_real(Q, phi, x, y, z), o_4_3_neg_3_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 3 && m == -2) {
        return vec2(o_4_3_neg_2_real(Q, phi, x, y, z), o_4_3_neg_2_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 3 && m == -1) {
        return vec2(o_4_3_neg_1_real(Q, phi, x, y, z), o_4_3_neg_1_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 3 && m == 0) {
        return vec2(o_4_3_0_real(Q, x, y, z), 0.0);
    }
    else if (n == 4 && l == 3 && m == 1) {
        return vec2(o_4_3_1_real(Q, x, y, z), o_4_3_1_imag(Q, x, y, z));
    }
    else if (n == 4 && l == 3 && m == 2) {
        return vec2(o_4_3_2_real(Q, phi, x, y, z), o_4_3_2_imag(Q, phi, x, y, z));
    }
    else if (n == 4 && l == 3 && m == 3) {
        return vec2(o_4_3_3_real(Q, phi, x, y, z), o_4_3_3_imag(Q, phi, x, y, z));
    }
    // Default: return zeros if orbital not found
    return vec2(0.0, 0.0);
}

vec2 hydrogenOrbitalOptimized(vec3 pos, int n, int l, int m, float phase) {
  return orbital(n, l, m, 1.0, pos.x, pos.y, pos.z, phase);
}

// Get combined wavefunction at a position (replacing the original function)
vec2 getCombinedWavefunction(vec3 p) {
    vec2 psi = vec2(0.0);
    
    // Compute the wavefunction for each orbital
    for (int i = 0; i < 6; i++) { // Support for 6 orbitals
        if (i >= orbital_count) break;
        
        float weight = orbital_weight[i];
        if (weight > 0.001) {
            vec2 orbitalPsi = hydrogenOrbitalOptimized(p, 
                                                      orbital_n[i], 
                                                      orbital_l[i], 
                                                      orbital_m[i], 
                                                      orbital_phase[i]);
            psi += weight * orbitalPsi;
        }
    }
    
    return psi;
}

// Fast orbital color lookup
vec3 getOrbitalColor(int l) {
    // Colors for different angular momentum values
    if (l == 0) return vec3(0.2, 0.5, 0.9);      // s: blue
    if (l == 1) return vec3(1.0, 0.0, 0.0);      // p: red
    if (l == 2) return vec3(0.0, 1.0, 0.0);      // d: green
    if (l == 3) return vec3(1.0, 0.0, 1.0);      // f: purple
    if (l == 4) return vec3(1.0, 1.0, 0.0);      // g: yellow
    return vec3(0.5, 0.7, 0.7);                  // h+: teal
}

// Get mixed orbital color based on weights
vec3 getMixedOrbitalColor() {
    vec3 mixedColor = vec3(0.0);
    float totalWeight = 0.0;
    
    // Sum all active orbital colors weighted by contribution
    for (int i = 0; i < 6; i++) { // Support for 6 orbitals
        if (i >= orbital_count) break;
        
        float weight = orbital_weight[i];
        if (weight > 0.001) {
            mixedColor += weight * getOrbitalColor(orbital_l[i]);
            totalWeight += weight;
        }
    }
    
    return totalWeight > 0.0 ? mixedColor / totalWeight : vec3(0.5);
}

// Fast HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(vec3(1.0), clamp(p - K.xxx, 0.0, 1.0), c.y);
}

int getMaxN() {
  int result = 0;
  for(int i = 0; i < 6; i++) {
    result = max(result, orbital_n[i]);
  }
  return result;
}

// Color palette function for visually appealing gradients
vec3 orangeWhiteRed(float t) {
    // Orange to white to red gradient
    vec3 orange = vec3(1.0, 0.5, 0.0);
    vec3 white = vec3(1.0, 1.0, 1.0);
    vec3 red = vec3(0.9, 0.1, 0.1);
    
    if (t < 0.5) {
        // Blend from orange to white
        return mix(orange, white, t * 2.0);
    } else {
        // Blend from white to red
        return mix(white, red, (t - 0.5) * 2.0);
    }
}

// Updated raymarch function with better volume visualization
vec4 raymarch(vec3 ro, vec3 rd) {
    // Calculate orbital-specific maximum radius
    float orbitalN = float(getMaxN());
    float org = orbitalN == 1.0 ? 1.5 * orbitalN * orbitalN + 1.0 : 1.5 * orbitalN * orbitalN + 10.0;
    float selectedQ = 1.0;
    float maxDistance = min(MAX_DISTANCE, org / selectedQ);
    
    // Ray-box intersection test (adapted from volume shader)
    vec3 box_min = vec3(-maxDistance);
    vec3 box_max = vec3(maxDistance);
    vec3 inv_dir = 1.0 / rd;
    vec3 tmin_tmp = (box_min - ro) * inv_dir;
    vec3 tmax_tmp = (box_max - ro) * inv_dir;
    vec3 tmin = min(tmin_tmp, tmax_tmp);
    vec3 tmax = max(tmin_tmp, tmax_tmp);
    float t0 = max(tmin.x, max(tmin.y, tmin.z));
    float t1 = min(tmax.x, min(tmax.y, tmax.z));
    
    // Check if ray misses the volume
    if (t0 > t1) {
        return vec4(0.0);
    }
    
    // We don't want to sample points behind the eye
    t0 = max(t0, 0.0);
    
    // Step size calculation (adaptive based on orbital size)
    float dt = maxDistance * 2.0 / float(MAX_STEPS);
    
    // Add small offset to prevent artifacts
    float offset = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
    
    // Initialize accumulation color
    vec4 color = vec4(0.0);
    vec3 p = ro + t0 * rd + rd * dt * offset;
    
    // Adjustable parameters for volume rendering
    float alphaScale = 5e-4; // Increased to show more volume
    float volumeFactor = 1.5; // Boost volume visibility
    
    // Store isosurface position and value for later processing
    vec3 isoPos = vec3(0.0);
    float isoVal = 0.0;
    bool foundIso = false;
    
    // Main ray marching loop
    for (float t = t0; t < t1; t += dt) {
        // Skip if we're outside the volume bounds
        if (length(p) > maxDistance) {
            p += rd * dt;
            continue;
        }
        
        // Calculate wavefunction and density
        vec2 psi = getCombinedWavefunction(p);
        float density = dot(psi, psi);
        
        if (density > DENSITY_THRESHOLD * 0.1) { // Lower threshold to capture more volume
            // Determine color based on render mode
            vec3 sampleColor;
            float sampleAlpha;
            float value = density;
            
            // Apply different visualization modes with improved coloring
            if (renderMode == 0) {
                // Probability density with orange-white-red color scheme
                float normalizedDensity = smoothstep(DENSITY_THRESHOLD * 0.1, isovalue * 2.0, density);
                sampleColor = orangeWhiteRed(normalizedDensity);
                sampleAlpha = smoothstep(0.0, 0.25, density * alphaScale) * volumeFactor;
            }
            else if (renderMode == 1) {
                // Real component 
                float realPart = psi.x;
                float normalizedReal = (realPart + abs(realPart)) / (2.0 * max(abs(realPart), 1e-5));
                sampleColor = orangeWhiteRed(normalizedReal);
                sampleAlpha = smoothstep(0.0, 0.25, abs(realPart) * alphaScale * 1.5) * volumeFactor;
                value = realPart;
            }
            else if (renderMode == 2) {
                // Imaginary component
                float imagPart = psi.y;
                float normalizedImag = (imagPart + abs(imagPart)) / (2.0 * max(abs(imagPart), 1e-5));
                sampleColor = orangeWhiteRed(normalizedImag);
                sampleAlpha = smoothstep(0.0, 0.25, abs(imagPart) * alphaScale * 1.5) * volumeFactor;
                value = imagPart;
            }
            else {
                // Phase visualization with improved coloring
                float phase = atan(psi.y, psi.x);
                float hue = (phase + PI) / (2.0 * PI);
                sampleColor = orangeWhiteRed(hue); // Using our color palette
                sampleAlpha = smoothstep(0.0, 0.25, density * alphaScale) * volumeFactor;
                value = sqrt(density);
            }
            
            // Check for isosurface hit - store but don't break yet to continue capturing volume
            if (!foundIso && density > isovalue) {
                // Store isosurface position and value for later processing
                isoPos = p;
                isoVal = value;
                foundIso = true;
                
                // Continue marching to collect volume information around isosurface
                // (don't break immediately)
            }
            
            // Front-to-back compositing for regular volume rendering
            color.rgb += (1.0 - color.a) * sampleAlpha * sampleColor;
            color.a += (1.0 - color.a) * sampleAlpha;
            
            // Early ray termination if fully opaque
            if (color.a >= 0.98) break;
        }
        
        // Move along the ray
        p += rd * dt;
    }
    
    // Process isosurface if found (after collecting volume information)
    if (foundIso) {
        // Calculate gradient for normal (central differences)
        float step_size = dt * 0.5;
        vec2 psi_x1 = getCombinedWavefunction(isoPos + vec3(step_size, 0.0, 0.0));
        vec2 psi_x2 = getCombinedWavefunction(isoPos - vec3(step_size, 0.0, 0.0));
        float grad_x = dot(psi_x1, psi_x1) - dot(psi_x2, psi_x2);
        
        vec2 psi_y1 = getCombinedWavefunction(isoPos + vec3(0.0, step_size, 0.0));
        vec2 psi_y2 = getCombinedWavefunction(isoPos - vec3(0.0, step_size, 0.0));
        float grad_y = dot(psi_y1, psi_y1) - dot(psi_y2, psi_y2);
        
        vec2 psi_z1 = getCombinedWavefunction(isoPos + vec3(0.0, 0.0, step_size));
        vec2 psi_z2 = getCombinedWavefunction(isoPos - vec3(0.0, 0.0, step_size));
        float grad_z = dot(psi_z1, psi_z1) - dot(psi_z2, psi_z2);
        
        vec3 normal = normalize(vec3(grad_x, grad_y, grad_z));
        
        // Enhanced lighting
        vec3 lightPos1 = vec3(5.0, 5.0, 5.0);
        vec3 lightPos2 = vec3(-5.0, 2.0, 3.0); // Second light for better shading
        
        vec3 lightDir1 = normalize(lightPos1 - isoPos);
        vec3 lightDir2 = normalize(lightPos2 - isoPos);
        
        float diffuse1 = max(dot(normal, lightDir1), 0.0);
        float diffuse2 = max(dot(normal, lightDir2), 0.0) * 0.5; // Second light is dimmer
        
        // Specular highlighting
        vec3 viewDir = normalize(ro - isoPos);
        vec3 reflectDir1 = reflect(-lightDir1, normal);
        vec3 reflectDir2 = reflect(-lightDir2, normal);
        
        float specular1 = pow(max(dot(viewDir, reflectDir1), 0.0), 32.0);
        float specular2 = pow(max(dot(viewDir, reflectDir2), 0.0), 32.0) * 0.3;
        
        // Generate color for isosurface based on value
        float normalizedValue = (isoVal + abs(isoVal)) / (2.0 * max(abs(isoVal), 1e-5));
        vec3 baseColor = orangeWhiteRed(normalizedValue);
        
        // Apply lighting to isosurface
        vec3 litColor = baseColor * ((diffuse1 + diffuse2) * 0.7 + 0.3) + 
                        vec3(1.0) * (specular1 + specular2);
        
        // Blend isosurface with accumulated volume
        float isoAlpha = 0.7; // Semi-transparent isosurface to show volume behind
        vec4 isoColor = vec4(litColor, isoAlpha);
        
        // Blend isosurface with accumulated volume
        color.rgb = mix(color.rgb, isoColor.rgb, isoAlpha * (1.0 - color.a));
        color.a = color.a + isoAlpha * (1.0 - color.a);
    }
    
    // Tone mapping (improved to preserve more color detail)
    color.rgb = color.rgb / (1.0 + color.rgb);
    
    // Add subtle ambient occlusion effect
    float ao = 1.0 - color.a * 0.2;
    color.rgb *= ao;
    
    return color;
}

void main() {
    // Generate ray
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= aspectRatio;
    
    vec3 rayDirection = normalize(cameraDirection + uv.x * cameraRight + uv.y * cameraUp);
    
    // Perform ray marching
    vec4 result = raymarch(cameraPos, rayDirection);
    
    // Background blend
    vec3 backgroundColor = vec3(1.0);
    vec3 finalColor = mix(backgroundColor, result.rgb, result.a);
    
    // Output
    gl_FragColor = vec4(finalColor, 1.0);
}`
