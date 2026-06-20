// Content = catalogue composition. REFERENCED. Points at content packs; proposes a
// visibility (tighten-only, capped by the layers above).
export const CONTENT_PACKS = {
  own_only:        { id:'own_only', label:'Own catalogue only', references:['own'], visibility_contribution:'private' },
  distributor_feed:{ id:'distributor_feed', label:'Own + distributor feed', references:['own','distributor'], visibility_contribution:'restricted' },
  open_market:     { id:'open_market', label:'Own + open marketplace', references:['own','marketplace'], visibility_contribution:'public' },
};
