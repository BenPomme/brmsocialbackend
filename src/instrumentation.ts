export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { printBootChecklist } = await import("@/lib/boot");
  printBootChecklist();
  const { startFicheWatchLoop } = await import("@/lib/fiche/loop");
  startFicheWatchLoop();
  const { pumpWaInboundJobs } = await import("@/lib/jobs");
  const tick = () => {
    pumpWaInboundJobs().catch((e) => console.warn("wa_inbound pump", e));
  };
  tick();
  setInterval(tick, 3000);
}
