// Polyfill cac API JS rat moi ma pdf.js 6.x dung, cho trinh duyet cu hon.
// Khong co chung thi:
//   - Uint8Array.toHex  -> "hashOriginal.toHex is not a function" khi mo tai lieu
//   - Map.getOrInsertComputed -> page.render() nem loi ngay dong dau
//     (pdf.mjs:15598) nen trang goc trang tinh, du getTextContent van chay
//     binh thuong nen chuc nang dich khong he hong.
// Moi polyfill chi gan khi trinh duyet chua co san.

const HEX = [];
for (let i = 0; i < 256; i++) {
  HEX.push(i.toString(16).padStart(2, '0'));
}

const define = (target, name, value) => {
  if (typeof target[name] !== 'function') {
    Object.defineProperty(target, name, {
      value,
      configurable: true,
      writable: true,
      enumerable: false,
    });
  }
};

const proto = Uint8Array.prototype;

define(proto, 'toHex', function toHex() {
  let out = '';
  for (let i = 0; i < this.length; i++) {
    out += HEX[this[i]];
  }
  return out;
});

define(proto, 'toBase64', function toBase64(options) {
  let bin = '';
  const CHUNK = 0x8000; // tranh tran stack khi mang lon
  for (let i = 0; i < this.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, this.subarray(i, i + CHUNK));
  }
  let out = btoa(bin);
  if (options?.alphabet === 'base64url') {
    out = out.replace(/\+/g, '-').replace(/\//g, '_');
  }
  if (options?.omitPadding) {
    out = out.replace(/=+$/, '');
  }
  return out;
});

define(Uint8Array, 'fromBase64', function fromBase64(input, options) {
  let str = String(input).replace(/[\t\n\f\r ]/g, '');
  if (options?.alphabet === 'base64url') {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
  }
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
});

define(Uint8Array, 'fromHex', function fromHex(input) {
  const str = String(input);
  if (str.length % 2 !== 0 || /[^0-9a-fA-F]/.test(str)) {
    throw new SyntaxError('Chuoi hex khong hop le');
  }
  const out = new Uint8Array(str.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(str.substr(i * 2, 2), 16);
  }
  return out;
});

// --- Map/WeakMap upsert (Chrome 146, Firefox 141, Safari 26) ---
// pdf.js goi getOrInsertComputed o khap noi, ke ca ngay dau page.render().
function getOrInsert(key, value) {
  if (this.has(key)) {
    return this.get(key);
  }
  this.set(key, value);
  return value;
}

function getOrInsertComputed(key, callback) {
  if (this.has(key)) {
    return this.get(key);
  }
  const value = callback(key);
  this.set(key, value);
  return value;
}

for (const Ctor of [Map, WeakMap]) {
  define(Ctor.prototype, 'getOrInsert', getOrInsert);
  define(Ctor.prototype, 'getOrInsertComputed', getOrInsertComputed);
}

// --- Promise.try (Chrome 134, Firefox 134, Safari 18.2) ---
define(Promise, 'try', function attempt(fn, ...args) {
  return new Promise((resolve) => resolve(fn(...args)));
});

// --- Set.prototype.intersection (Chrome 122, Firefox 127, Safari 17) ---
define(Set.prototype, 'intersection', function intersection(other) {
  const out = new Set();
  for (const value of this) {
    if (other.has(value)) {
      out.add(value);
    }
  }
  return out;
});
