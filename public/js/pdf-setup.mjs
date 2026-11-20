// Nạp pdf.js (chỉ có bản ES module) rồi đưa ra phạm vi toàn cục cho các script khác.
import '/vendor/pdfjs/compat.mjs';
import * as pdfjsLib from '/vendor/pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.entry.mjs';
window.pdfjsLib = pdfjsLib;
