export const V0_1 = {
  version: '0.1',
  params: {
    currency_code:          { klass:'advisory',  value:'INR' },
    allowed_languages:      { klass:'bound_set', value:['en'], set:['en'] },
    catalogue_visibility:   { klass:'chosen',    value:'private', cap:'private', scale:['private','restricted','public'] },
    max_schemas_per_entity: { klass:'bound',     value:2 },
  },
  plan_menu: {
    free:       { entities:5,    chitsPerDay:10,   networks:1,    depth:1,    public:false },
    pro:        { entities:50,   chitsPerDay:500,  networks:10,   depth:3,    public:true  },
    enterprise: { entities:null, chitsPerDay:null, networks:null, depth:null, public:true  },
  },
};
export const V0_2 = {
  version: '0.2',
  params: {
    currency_code:          { klass:'advisory',  value:'USD' },
    allowed_languages:      { klass:'bound_set', value:['en'], set:['en','ta','hi'] },
    catalogue_visibility:   { klass:'chosen',    value:'private', cap:'restricted', scale:['private','restricted','public'] },
    max_schemas_per_entity: { klass:'bound',     value:2 },
  },
  plan_menu: V0_1.plan_menu,
};
