/** @format */

import express, { type Express } from "express";
import * as httpProxy from "http-proxy";
import * as url from "node:url";

const app: Express = express();
const proxy = httpProxy.createProxyServer();

const PORT: string = process.env.PREVERSE_PROXY ?? "8000";
const BASE_PATH = `https://hostify-output-projects.s3.amazonaws.com/__outputs`;

app.use((req, res) => {
  const hostname: string = req.hostname;
  const subdomain: string = hostname.split(".")[0];

  const resolvesTo: string = `${BASE_PATH}/${subdomain}/`;

  if (req.url === "/") {
    req.url = "/index.html";
  }
  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  res.setHeader("X-Powered-By", "Bun");
});

app.listen(PORT, () => console.log(`Rever Proxy Running on ${PORT} 🎉`));
