/**
 * Tool execution seam. Client mode is the current default; a future API can
 * replace only this adapter without changing page markup or tool UI state.
 */
export async function executeTool({ mode = "client", client, server, payload }) {
  if (mode === "server") {
    if (typeof server !== "function") throw new Error("Server execution is not configured for this tool.");
    return server(payload);
  }
  if (typeof client !== "function") throw new Error("Client execution is not configured for this tool.");
  return client(payload);
}
