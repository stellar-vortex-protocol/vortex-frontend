/**
 * Dependency-free QR code SVG encoder.
 *
 * Implements QR Code Model 2 (versions 1–10, byte mode, ECC level M).
 * Outputs an inline SVG string suitable for embedding in React components.
 *
 * Choice rationale: a from-scratch encoder keeps the bundle zero-overhead
 * (no npm package), is fully auditable, and the algorithm is well-specified
 * in ISO/IEC 18004. The implementation below is derived from the public QR
 * spec and common open-source reference implementations (Nayuki, zxing).
 *
 * @see https://www.qrcode.com/en/about/version.html
 */

// ---------------------------------------------------------------------------
// GF(256) arithmetic (primitive polynomial x^8+x^4+x^3+x^2+1 = 0x11D)
// ---------------------------------------------------------------------------

const EXP: number[] = new Array(512);
const LOG: number[] = new Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

function gfPoly(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const term = [1, EXP[i]];
    const result: number[] = new Array(g.length + term.length - 1).fill(0);
    for (let a = 0; a < g.length; a++)
      for (let b = 0; b < term.length; b++)
        result[a + b] ^= gfMul(g[a], term[b]);
    g = result;
  }
  return g;
}

function rsEncode(data: number[], ecCount: number): number[] {
  const gen = gfPoly(ecCount);
  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0)
      for (let j = 1; j < gen.length; j++)
        msg[i + j] ^= gfMul(gen[j], coef);
  }
  return msg.slice(data.length);
}

// ---------------------------------------------------------------------------
// Version / capacity tables (ECC level M)
// [version]: [totalCodewords, ecCodewordsPerBlock, block1Count, block1DataCW, block2Count, block2DataCW]
// ---------------------------------------------------------------------------

type VersionInfo = {
  totalCW: number;
  ecCW: number;
  b1Count: number;
  b1Data: number;
  b2Count: number;
  b2Data: number;
};

// ECC level M capacity data (versions 1-10)
const VERSION_INFO: VersionInfo[] = [
  { totalCW: 26,  ecCW: 10, b1Count: 1, b1Data: 16, b2Count: 0, b2Data: 0  }, // v1
  { totalCW: 44,  ecCW: 16, b1Count: 1, b1Data: 28, b2Count: 0, b2Data: 0  }, // v2
  { totalCW: 70,  ecCW: 26, b1Count: 1, b1Data: 44, b2Count: 0, b2Data: 0  }, // v3
  { totalCW: 100, ecCW: 18, b1Count: 2, b1Data: 32, b2Count: 0, b2Data: 0  }, // v4
  { totalCW: 134, ecCW: 24, b1Count: 2, b1Data: 43, b2Count: 0, b2Data: 0  }, // v5
  { totalCW: 172, ecCW: 16, b1Count: 4, b1Data: 27, b2Count: 0, b2Data: 0  }, // v6
  { totalCW: 196, ecCW: 18, b1Count: 4, b1Data: 31, b2Count: 0, b2Data: 0  }, // v7
  { totalCW: 242, ecCW: 22, b1Count: 2, b1Data: 38, b2Count: 2, b2Data: 39 }, // v8
  { totalCW: 292, ecCW: 22, b1Count: 3, b1Data: 36, b2Count: 2, b2Data: 37 }, // v9
  { totalCW: 346, ecCW: 26, b1Count: 4, b1Data: 43, b2Count: 1, b2Data: 44 }, // v10
];

// Byte-mode capacity at ECC-M for each version (bytes of input)
const BYTE_CAPACITY_M = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];

// Alignment pattern center positions (version >= 2)
const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ---------------------------------------------------------------------------
// Bit buffer helper
// ---------------------------------------------------------------------------

class BitBuffer {
  private data: number[] = [];
  private bitLength = 0;

  put(num: number, bits: number) {
    for (let i = bits - 1; i >= 0; i--) {
      this.putBit(((num >>> i) & 1) === 1);
    }
  }

  putBit(bit: boolean) {
    const byteIdx = Math.floor(this.bitLength / 8);
    if (this.data.length <= byteIdx) this.data.push(0);
    if (bit) this.data[byteIdx] |= 0x80 >> this.bitLength % 8;
    this.bitLength++;
  }

  get length() { return this.bitLength; }
  getBytes() { return this.data; }
}

// ---------------------------------------------------------------------------
// Matrix helpers
// ---------------------------------------------------------------------------

function createMatrix(size: number): (boolean | null)[][] {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function setFinderPattern(m: (boolean | null)[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++)
    for (let c = -1; c <= 7; c++) {
      const pr = row + r, pc = col + c;
      if (pr < 0 || pc < 0 || pr >= m.length || pc >= m.length) continue;
      const onBorder = r === -1 || r === 7 || c === -1 || c === 7;
      const onInner = r >= 1 && r <= 5 && c >= 1 && c <= 5;
      const onCore  = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      m[pr][pc] = onBorder || (onCore && !onInner) || (onCore);
      // Simplified: dark if on outer border OR in inner 3x3
      m[pr][pc] = !(r === 0 || r === 6 || c === 0 || c === 6
        ? false
        : r >= 2 && r <= 4 && c >= 2 && c <= 4
          ? false
          : true);
      // Use proper finder logic:
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      m[pr][pc] = ring === 0 || ring === 2 || ring === 3;
    }
}

function setAlignmentPattern(m: (boolean | null)[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++)
    for (let c = -2; c <= 2; c++) {
      const ring = Math.max(Math.abs(r), Math.abs(c));
      m[row + r][col + c] = ring === 0 || ring === 2;
    }
}

function setTimingPatterns(m: (boolean | null)[][], size: number) {
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (m[6][i] === null) m[6][i] = dark;
    if (m[i][6] === null) m[i][6] = dark;
  }
}

function setFormatInfo(m: (boolean | null)[][], mask: number) {
  // ECC level M = 0b00, mask pattern
  const size = m.length;
  // ECC bits for level M: 01
  const formatData = ((0b01 << 3) | mask);
  // 15-bit BCH error correction of format information
  const formatStr = bchFormat(formatData) ^ 0b101010000010010;

  const positions = [
    [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],
    [8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]
  ];
  const positions2 = [
    [size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],
    [8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]
  ];

  for (let i = 0; i < 15; i++) {
    const bit = ((formatStr >> (14 - i)) & 1) === 1;
    m[positions[i][0]][positions[i][1]] = bit;
    m[positions2[i][0]][positions2[i][1]] = bit;
  }
  // Dark module
  m[size - 8][8] = true;
}

function bchFormat(data: number): number {
  let d = data << 10;
  while (bitLen(d) >= 11) {
    d ^= 0b10100110111 << (bitLen(d) - 11);
  }
  return (data << 10) | d;
}

function bitLen(n: number): number {
  let len = 0;
  while (n > 0) { n >>= 1; len++; }
  return len;
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

const MASK_PATTERNS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r, _) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(m: (boolean | null)[][], mask: number): boolean[][] {
  const fn = MASK_PATTERNS[mask];
  return m.map((row, r) =>
    row.map((cell, c) =>
      cell === null ? false : cell !== fn(r, c) ? cell : !cell
    ) as boolean[]
  ) as boolean[][];
}

function penaltyScore(m: boolean[][]): number {
  const size = m.length;
  let score = 0;

  // Rule 1: 5+ in a row/col
  for (let r = 0; r < size; r++) {
    for (let run = 0, c = 0; c < size; c++) {
      if (c > 0 && m[r][c] === m[r][c - 1]) run++; else run = 1;
      if (run === 5) score += 3; else if (run > 5) score++;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let run = 0, r = 0; r < size; r++) {
      if (r > 0 && m[r][c] === m[r - 1][c]) run++; else run = 1;
      if (run === 5) score += 3; else if (run > 5) score++;
    }
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (m[r][c] === m[r][c+1] && m[r][c] === m[r+1][c] && m[r][c] === m[r+1][c+1])
        score += 3;

  // Rule 4: proportion of dark modules
  const dark = m.flat().filter(Boolean).length;
  const pct = (dark / (size * size)) * 100;
  score += Math.abs(Math.ceil(pct / 5) * 5 - 50) * 2;

  return score;
}

// ---------------------------------------------------------------------------
// Data encoding
// ---------------------------------------------------------------------------

function encodeData(text: string, version: number, info: VersionInfo): number[] {
  const bytes = new TextEncoder().encode(text);
  const buf = new BitBuffer();

  const charCountBits = version < 10 ? 8 : 16;
  buf.put(0b0100, 4);                    // byte mode indicator
  buf.put(bytes.length, charCountBits); // character count
  bytes.forEach(b => buf.put(b, 8));    // data bytes

  const totalDataBits = (info.b1Count * info.b1Data + info.b2Count * info.b2Data) * 8;
  buf.put(0, Math.min(4, totalDataBits - buf.length)); // terminator
  while (buf.length % 8 !== 0) buf.putBit(false);       // pad to byte

  const padBytes = [0xEC, 0x11];
  for (let i = 0; buf.length < totalDataBits; i++)
    buf.put(padBytes[i % 2], 8);

  return buf.getBytes();
}

function interleaveBlocks(dataBytes: number[], info: VersionInfo): number[] {
  const blocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < info.b1Count; i++) {
    blocks.push(dataBytes.slice(offset, offset + info.b1Data));
    offset += info.b1Data;
  }
  for (let i = 0; i < info.b2Count; i++) {
    blocks.push(dataBytes.slice(offset, offset + info.b2Data));
    offset += info.b2Data;
  }

  const ecBlocks = blocks.map(b => rsEncode(b, info.ecCW));
  const interleaved: number[] = [];

  const maxLen = Math.max(...blocks.map(b => b.length));
  for (let i = 0; i < maxLen; i++)
    blocks.forEach(b => { if (i < b.length) interleaved.push(b[i]); });
  const maxEC = ecBlocks[0].length;
  for (let i = 0; i < maxEC; i++)
    ecBlocks.forEach(ec => interleaved.push(ec[i]));

  return interleaved;
}

// ---------------------------------------------------------------------------
// Matrix population
// ---------------------------------------------------------------------------

function buildMatrix(version: number, codewords: number[]): boolean[][] {
  const size = version * 4 + 17;
  const m = createMatrix(size);

  // Finder patterns + separators
  setFinderPattern(m, 0, 0);
  setFinderPattern(m, 0, size - 7);
  setFinderPattern(m, size - 7, 0);

  // Timing
  setTimingPatterns(m, size);

  // Alignment patterns
  const alignPos = ALIGNMENT_POSITIONS[version] ?? [];
  if (alignPos.length >= 2) {
    for (let r of alignPos)
      for (let c of alignPos) {
        if (m[r][c] !== null) continue; // overlaps finder
        setAlignmentPattern(m, r, c);
      }
  }

  // Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    if (m[i][8] === null) m[i][8] = false;
    if (m[8][i] === null) m[8][i] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (m[i][8] === null) m[i][8] = false;
    if (m[8][i] === null) m[8][i] = false;
  }
  m[size - 8][8] = true; // dark module

  // Place data bits
  let bitIdx = 0;
  const allBits: boolean[] = [];
  codewords.forEach(byte => {
    for (let i = 7; i >= 0; i--) allBits.push(((byte >> i) & 1) === 1);
  });

  let up = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let d = 0; d < 2; d++) {
        const col = right - d;
        if (m[row][col] === null) {
          m[row][col] = bitIdx < allBits.length ? allBits[bitIdx++] : false;
        }
      }
    }
    up = !up;
  }

  // Choose best mask
  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(m, mask);
    setFormatInfo(m, mask); // write format to the un-masked matrix for scoring
    const score = penaltyScore(candidate);
    if (score < bestScore) { bestScore = score; bestMask = mask; }
  }

  const final = applyMask(m, bestMask);
  // Re-apply format info to the final masked matrix
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (m[r][c] !== null) final[r][c] = m[r][c] as boolean; // preserve function modules
  setFormatInfo(m, bestMask);
  // Copy format info from m back to final
  const formatPositions = [
    ...Array.from({length: 9}, (_, i) => [i, 8] as [number,number]),
    ...Array.from({length: 8}, (_, i) => [8, 7 - i] as [number,number]),
    ...Array.from({length: 7}, (_, i) => [size - 1 - i, 8] as [number,number]),
    ...Array.from({length: 8}, (_, i) => [8, size - 8 + i] as [number,number]),
  ];
  formatPositions.forEach(([r,c]) => { if (m[r][c] !== null) final[r][c] = m[r][c] as boolean; });

  return final;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type QrCodeOptions = {
  /** Side length of the SVG in pixels. Minimum 80. Default 200. */
  size?: number;
  /** Quiet zone modules (default 4, minimum per spec). */
  quietZone?: number;
  /** Dark module fill colour. Default '#000000'. */
  darkColor?: string;
  /** Light module fill colour. Default '#ffffff'. */
  lightColor?: string;
};

/**
 * Encode `text` as a QR code and return an inline SVG string.
 *
 * Throws if `text` exceeds the capacity of version 10 ECC-M (~216 bytes).
 * Stellar public keys (56 chars) fit comfortably in version 3 (44 bytes) —
 * wait, G-prefixed keys are 56 chars which is > 44. They fit in version 4 (64
 * bytes). Contract IDs (C-prefixed, 56 chars) also fit in version 4.
 */
export function encodeQrSvg(text: string, options: QrCodeOptions = {}): string {
  const {
    size = 200,
    quietZone = 4,
    darkColor = '#000000',
    lightColor = '#ffffff',
  } = options;

  const bytes = new TextEncoder().encode(text);

  // Find minimum version
  const versionIndex = BYTE_CAPACITY_M.findIndex(cap => cap >= bytes.length);
  if (versionIndex === -1) {
    throw new Error(
      `QR input too long: ${bytes.length} bytes (max ${BYTE_CAPACITY_M[BYTE_CAPACITY_M.length - 1]} for version 10 ECC-M)`
    );
  }
  const version = versionIndex + 1;
  const info = VERSION_INFO[versionIndex];

  const dataBytes = encodeData(text, version, info);
  const codewords = interleaveBlocks(dataBytes, info);
  const matrix = buildMatrix(version, codewords);

  const moduleCount = matrix.length;
  const totalModules = moduleCount + quietZone * 2;
  const moduleSize = size / totalModules;

  const rects: string[] = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        const x = ((c + quietZone) * moduleSize).toFixed(2);
        const y = ((r + quietZone) * moduleSize).toFixed(2);
        const s = (moduleSize + 0.1).toFixed(2); // slight overlap avoids hairlines
        rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${darkColor}"/>`);
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">`,
    `<rect width="${size}" height="${size}" fill="${lightColor}"/>`,
    ...rects,
    `</svg>`,
  ].join('');
}
