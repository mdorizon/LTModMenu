// Side-effect module: replaces window.WebSocket to intercept all connections

console.log("[LTModMenu] Setting up WebSocket hook...");
const OrigWS = window.WebSocket;
console.log("[LTModMenu] Original WebSocket:", typeof OrigWS);

(window as any).WebSocket = function (...args: any[]) {
  const url = args[0] || "";
  console.log("[LTModMenu] new WebSocket() called, url:", url);

  const ws = new (Function.prototype.bind.apply(OrigWS, [null, ...args]) as any)() as WebSocket;
  console.log("[LTModMenu] WebSocket created, readyState:", ws.readyState);

  if (typeof url === "string") {
    window.__gameWS = ws;
    console.log("[LTModMenu] Stored as __gameWS");

    // Hook send
    const _origSend = ws.send.bind(ws);
    ws.send = function (data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      if (typeof data === "string") {
        if (!data.includes("clientUpdatePosition")) {
          console.log("[LTModMenu] WS SEND:", data.substring(0, 120));
        }

        // Track position
        if (data.includes("clientUpdatePosition")) {
          try {
            const jsonStr = data.substring(data.indexOf("["));
            const parsed = JSON.parse(jsonStr);
            if (parsed[0] === "clientUpdatePosition" && parsed[1]) {
              window.__playerPos = parsed[1];
            }
          } catch (_e) {
            // ignore parse errors
          }
        }

        // Block fail messages
        if (
          window.__blockFishingFail &&
          data.includes("getFishingResult") &&
          data.includes('"fail"')
        ) {
          console.log("[LTModMenu] BLOCKED fail message!");
          return;
        }
      }
      return _origSend(data);
    };
    console.log("[LTModMenu] WS send() hooked");
  }

  ws.addEventListener("open", () => {
    console.log("[LTModMenu] WS OPEN, url:", url);
  });

  ws.addEventListener("close", (e) => {
    console.log("[LTModMenu] WS CLOSE, code:", e.code, "reason:", e.reason);
  });

  ws.addEventListener("error", (e) => {
    console.log("[LTModMenu] WS ERROR:", e);
  });

  ws.addEventListener("message", (e) => {
    try {
      const data = typeof e.data === "string" ? e.data : "";

      if (
        data.length > 0 &&
        !data.includes("playerMoved") &&
        !data.includes("updatePosition") &&
        data.length < 500
      ) {
        console.log("[LTModMenu] WS RECV:", data.substring(0, 200));
      }

      if (data.includes("fishCaught")) {
        console.log("[LTModMenu] >>> FISH CAUGHT EVENT <<<");
        const jsonStr = data.substring(data.indexOf("["));
        const parsed = JSON.parse(jsonStr);
        if (parsed[0] === "fishCaught" && parsed[1]) {
          window.__fishBite = parsed[1];
          console.log(
            "[LTModMenu] Fish bite data:",
            JSON.stringify(parsed[1]).substring(0, 200),
          );
        }
      }

      if (data.includes("fishing-result")) {
        console.log("[LTModMenu] >>> FISHING RESULT EVENT <<<");
        const jsonStr2 = data.substring(data.indexOf("["));
        const parsed2 = JSON.parse(jsonStr2);
        if (parsed2[0] === "fishing-result" && parsed2[1]) {
          window.__lastFish = parsed2[1];
          console.log(
            "[LTModMenu] Fish result:",
            JSON.stringify(parsed2[1]).substring(0, 200),
          );
        }
      }
    } catch (err) {
      console.log("[LTModMenu] WS message parse error:", (err as Error).message);
    }
  });

  return ws;
};

(window as any).WebSocket.prototype = OrigWS.prototype;
Object.defineProperty(window.WebSocket, "CONNECTING", { value: 0 });
Object.defineProperty(window.WebSocket, "OPEN", { value: 1 });
Object.defineProperty(window.WebSocket, "CLOSING", { value: 2 });
Object.defineProperty(window.WebSocket, "CLOSED", { value: 3 });
console.log("[LTModMenu] WebSocket constructor hooked");

export {};
