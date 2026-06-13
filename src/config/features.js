// ============================================================
// CHIT AND BRIDGE — Feature Flag Configuration
// ============================================================
// APP_MODE controls what is visible:
//   production — only fully done features
//   demo       — all screens with visual_flag true
//   dev        — everything including in-progress badges
//
// To switch mode:
//   Change APP_MODE below
//   OR set VITE_APP_MODE in .env
// ============================================================

export const APP_MODE = import.meta.env.VITE_APP_MODE || 'dev';
// 'production' | 'demo' | 'dev'

// ── Feature Registry ─────────────────────────────────────────
// api_status: 'done' | 'in-progress' | 'pending'
// visual_flag: true (UI built) | false (UI not built yet)
// endpoint: the API endpoint this feature calls
// phase: 'MVP' | 'IT-2' | 'P0.5' | 'P1' | 'P2' | 'P3'

export const FEATURES = {

  // ── AUTHENTICATION ──────────────────────────────────────────
  login: {
    id: 'login',
    name: 'Login and OTP verification',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'POST /api/entities/register + POST /api/entities/verify',
    phase: 'MVP',
    route: '/login',
  },

  // ── INBOX ───────────────────────────────────────────────────
  inbox_all_task: {
    id: 'inbox_all_task',
    name: 'All Task — full entity inbox',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'GET /api/chits/inbox',
    phase: 'MVP',
    route: '/inbox',
  },

  inbox_tabs: {
    id: 'inbox_tabs',
    name: 'Open / Act / Close tabs',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'GET /api/chits/inbox?status=filter',
    phase: 'MVP',
    route: '/inbox',
  },

  inbox_swipe_gestures: {
    id: 'inbox_swipe_gestures',
    name: 'Swipe left to close — swipe right to reopen',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'PUT /api/chits/:id/status',
    phase: 'MVP',
    route: '/inbox',
  },

  inbox_long_press_assign: {
    id: 'inbox_long_press_assign',
    name: 'Long press — assignment bottom sheet',
    api_status: 'in-progress',
    visual_flag: true,
    endpoint: 'PUT /api/chits/:id/assign — pending',
    phase: 'IT-2',
    route: '/inbox',
  },

  // ── CHIT DETAIL ─────────────────────────────────────────────
  chit_detail: {
    id: 'chit_detail',
    name: 'Chit detail — full view',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'GET /api/chits/:chit_id',
    phase: 'MVP',
    route: '/chit/:id',
  },

  chit_detail_tabs: {
    id: 'chit_detail_tabs',
    name: 'Chit detail — Details Status Summary tabs',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'GET /api/chits/:chit_id',
    phase: 'MVP',
    route: '/chit/:id',
  },

  chit_line_items_cards: {
    id: 'chit_line_items_cards',
    name: 'Line items — card per item with GST — Option B',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'GET /api/chits/:chit_id — detail.line_items',
    phase: 'MVP',
    route: '/chit/:id',
  },

  chit_state_log_timeline: {
    id: 'chit_state_log_timeline',
    name: 'Status tab — timeline oldest bottom newest top',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'GET /api/chits/:chit_id — state_log',
    phase: 'MVP',
    route: '/chit/:id',
  },

  chit_summary_tab: {
    id: 'chit_summary_tab',
    name: 'Summary tab — totals GST breakdown',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'GET /api/chits/:chit_id — summary_json',
    phase: 'MVP',
    route: '/chit/:id',
  },

  chit_print: {
    id: 'chit_print',
    name: 'Print chit as receipt — one tap',
    api_status: 'pending',
    visual_flag: false,
    endpoint: 'GET /api/chits/:id/pdf — pending',
    phase: 'P1',
    route: '/chit/:id',
  },

  chit_otp_delivery: {
    id: 'chit_otp_delivery',
    name: 'OTP delivery confirmation',
    api_status: 'pending',
    visual_flag: false,
    endpoint: 'POST /api/chits/:id/confirm-delivery — pending',
    phase: 'P1',
    route: '/chit/:id',
  },

  // ── SEND CHIT ───────────────────────────────────────────────
  send_chit: {
    id: 'send_chit',
    name: 'Send new chit — manual line items',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'POST /api/chits/send',
    phase: 'MVP',
    route: '/send',
  },

  send_from_catalogue: {
    id: 'send_from_catalogue',
    name: 'Send chit from supplier catalogue — cart to chit',
    api_status: 'pending',
    visual_flag: true,
    endpoint: 'GET /api/suppliers/:id/catalogue — pending',
    phase: 'P1',
    route: '/catalogue/:supplier_id',
  },

  // ── CONNECTIONS ─────────────────────────────────────────────
  connections_list: {
    id: 'connections_list',
    name: 'My connections — partner list',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'GET /api/connections/list',
    phase: 'MVP',
    route: '/connections',
  },

  connections_request: {
    id: 'connections_request',
    name: 'Send connection request',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'POST /api/connections/request',
    phase: 'MVP',
    route: '/connections',
  },

  connections_respond: {
    id: 'connections_respond',
    name: 'Accept or reject connection request',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'PUT /api/connections/:id/respond',
    phase: 'MVP',
    route: '/connections',
  },

  // ── CATALOGUE ───────────────────────────────────────────────
  catalogue_browse: {
    id: 'catalogue_browse',
    name: 'Browse supplier catalogue',
    api_status: 'pending',
    visual_flag: true,
    endpoint: 'GET /api/suppliers/:id/catalogue — pending',
    phase: 'P1',
    route: '/catalogue/:supplier_id',
  },

  catalogue_manage: {
    id: 'catalogue_manage',
    name: 'Manage own catalogue — add edit items',
    api_status: 'pending',
    visual_flag: true,
    endpoint: 'POST /api/catalogue — pending',
    phase: 'P1',
    route: '/my-catalogue',
  },

  catalogue_bulk_upload: {
    id: 'catalogue_bulk_upload',
    name: 'Bulk upload catalogue — CSV',
    api_status: 'pending',
    visual_flag: false,
    endpoint: 'POST /api/catalogue/upload — pending',
    phase: 'P1',
    route: '/my-catalogue/upload',
  },

  // ── ACTOR MODEL ─────────────────────────────────────────────
  actor_my_task: {
    id: 'actor_my_task',
    name: 'My Task — actor self-assigned queue',
    api_status: 'in-progress',
    visual_flag: true,
    endpoint: 'GET /api/chits/inbox?assigned_to=me — pending',
    phase: 'IT-2',
    route: '/my-tasks',
  },

  actor_self_assign: {
    id: 'actor_self_assign',
    name: 'Pull to My Task — actor self-assigns',
    api_status: 'in-progress',
    visual_flag: true,
    endpoint: 'PUT /api/chits/:id/assign — pending',
    phase: 'IT-2',
    route: '/inbox',
  },

  actor_push_assign: {
    id: 'actor_push_assign',
    name: 'Push to another actor — long press assignment',
    api_status: 'in-progress',
    visual_flag: true,
    endpoint: 'PUT /api/chits/:id/assign — pending',
    phase: 'IT-2',
    route: '/inbox',
  },

  actor_return_to_entity: {
    id: 'actor_return_to_entity',
    name: 'Return chit to entity queue from My Task',
    api_status: 'in-progress',
    visual_flag: true,
    endpoint: 'PUT /api/chits/:id/unassign — pending',
    phase: 'IT-2',
    route: '/my-tasks',
  },

  // ── EMPLOYEES ───────────────────────────────────────────────
  employee_list: {
    id: 'employee_list',
    name: 'Employee list — all actors under entity',
    api_status: 'in-progress',
    visual_flag: true,
    endpoint: 'GET /api/actors — pending',
    phase: 'IT-2',
    route: '/employees',
  },

  employee_add: {
    id: 'employee_add',
    name: 'Add employee — create actor with OTP',
    api_status: 'in-progress',
    visual_flag: true,
    endpoint: 'POST /api/actors — pending',
    phase: 'IT-2',
    route: '/employees/add',
  },

  // ── MIS DASHBOARD ───────────────────────────────────────────
  mis_dashboard: {
    id: 'mis_dashboard',
    name: 'MIS dashboard — entity chit management',
    api_status: 'in-progress',
    visual_flag: true,
    endpoint: 'GET /api/entities/mis — pending',
    phase: 'P1',
    route: '/mis',
  },

  // ── SETTINGS ────────────────────────────────────────────────
  entity_settings: {
    id: 'entity_settings',
    name: 'Entity settings — toggles and preferences',
    api_status: 'pending',
    visual_flag: true,
    endpoint: 'GET /api/entities/settings — pending',
    phase: 'P1',
    route: '/settings',
  },

  app_mode_switch: {
    id: 'app_mode_switch',
    name: 'App mode switch — production demo dev',
    api_status: 'done',
    visual_flag: true,
    endpoint: 'Local setting — no API call',
    phase: 'MVP',
    route: '/settings',
  },
};

// ── Helper — should this feature be shown? ───────────────────
export const isFeatureVisible = (featureId) => {
  const feature = FEATURES[featureId];
  if (!feature) return false;

  switch (APP_MODE) {
    case 'production':
      return feature.api_status === 'done' && feature.visual_flag === true;
    case 'demo':
      return feature.visual_flag === true;
    case 'dev':
    default:
      return true;
  }
};

// ── Helper — get status badge for dev mode ───────────────────
export const getStatusBadge = (featureId) => {
  if (APP_MODE !== 'dev') return null;
  const feature = FEATURES[featureId];
  if (!feature) return null;
  return {
    api_status: feature.api_status,
    visual_flag: feature.visual_flag,
    endpoint: feature.endpoint,
    phase: feature.phase,
  };
};

// ── Helper — count by status ─────────────────────────────────
export const getFeatureSummary = () => {
  const all = Object.values(FEATURES);
  return {
    total: all.length,
    done: all.filter(f => f.api_status === 'done' && f.visual_flag).length,
    in_progress: all.filter(f => f.api_status === 'in-progress').length,
    pending: all.filter(f => f.api_status === 'pending').length,
    visual_yes: all.filter(f => f.visual_flag).length,
    visual_no: all.filter(f => !f.visual_flag).length,
  };
};
