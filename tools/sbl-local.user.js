// ==UserScript==
// @name         SBL concierge — current local worktree
// @namespace    sbl-experience-local
// @version      2026.10.15.1
// @description  Loads this worktree's current bundle on each page load. Local demo only.
// @match        https://sbl.so/*
// @match        https://app.secondbrainlabs.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(() => {
  const script = document.createElement('script');
  script.src = 'http://127.0.0.1:8787/agent.js';
  script.onerror = () => console.error('SBL: the local bundle could not load. Check the local server and browser permissions.');
  document.documentElement.appendChild(script);
})();
