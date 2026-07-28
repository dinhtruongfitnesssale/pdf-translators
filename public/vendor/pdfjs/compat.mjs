// Polyfill Uint8Array base64/hex cho trinh duyet cu.
// pdf.js 6.x goi toHex()/toBase64()/Uint8Array.fromBase64(), chi co tu
// Chrome 140, Safari 18.2, Firefox 133. Tren ban cu hon se bao loi
// "hashOriginal.toHex is not a function" ngay khi mo tai lieu.

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
