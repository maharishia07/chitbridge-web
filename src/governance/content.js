export const CONTENT_PACKS = {
  own_only:        { id:'own_only', label:'Own catalogue only', references:['own'], requires_fields:['sku','price'], visibility_contribution:'private' },
  distributor_feed:{ id:'distributor_feed', label:'Own + distributor feed', references:['own','distributor'], requires_fields:['sku','price','supplier_ref'], visibility_contribution:'restricted' },
  open_market:     { id:'open_market', label:'Own + open marketplace', references:['own','marketplace'], requires_fields:['listing_id','seller_ref','rating'], visibility_contribution:'public' },
};
