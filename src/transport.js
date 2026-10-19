"use strict";
const https = require("node:https");

// Desktop-only transport: HTTPS with normal certificate validation, no implicit redirects.
function requestHTTPS(options) {
  return new Promise((resolve, reject) => {
    const request = https.request(options.url, { method: options.method, headers: options.headers }, response => {
      const chunks = [];
      let size = 0;
      response.on("data", chunk => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) { response.destroy(); request.destroy(new Error("Calendar response too large")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString("utf8") }));
    });
    request.setTimeout(20000, () => request.destroy(new Error("Calendar request timed out")));
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

module.exports = { requestHTTPS };
