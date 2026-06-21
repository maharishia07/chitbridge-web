import { useState, useEffect, useCallback } from "react";
import { networkApi } from "../api/network";
export function useNetwork(meId) {
  const [tree, setTree]   = useState([]);
  const [conns, setConns] = useState([]);
  const [err, setErr]     = useState(null);
  const reload = useCallback(async () => {
    try { const [t, c] = await Promise.all([networkApi.subtree(meId), networkApi.connections(meId)]);
          setTree(t); setConns(c); setErr(null); }
    catch (e) { setErr(e.message); }
  }, [meId]);
  useEffect(() => { reload(); }, [reload]);
  return {
    tree, conns, err, reload,
    lookup:     networkApi.lookup,
    request:    async (childBridgeId) => { await networkApi.request({ parentId: meId, childBridgeId }); reload(); },
    register:   async (name) => networkApi.register({ name, claimed: false }),   // invite-stub
    approve:    async (edgeId) => { await networkApi.approve(edgeId, meId); reload(); },
    decline:    async (edgeId) => { await networkApi.decline(edgeId, meId); reload(); },
    suspend:    async (edgeId) => { await networkApi.suspend(edgeId); reload(); },
    resume:     async (edgeId) => { await networkApi.resume(edgeId); reload(); },
    disconnect: async (edgeId, settle) => { await networkApi.disconnect(edgeId, settle); reload(); },
  };
}
