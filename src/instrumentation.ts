export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { printBootChecklist } = await import("@/lib/boot");
  printBootChecklist();
  const { startFicheWatchLoop } = await import("@/lib/fiche/loop");
  startFicheWatchLoop();
  const { startWaInboundLoop } = await import("@/lib/wa-inbound-loop");
  startWaInboundLoop();
  const { startGbpInviteLoop } = await import("@/lib/gbp-loop");
  startGbpInviteLoop();
}
