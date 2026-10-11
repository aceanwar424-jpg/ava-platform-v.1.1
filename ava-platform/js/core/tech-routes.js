/* OWNED_BY: generic. URL state contains route/record identifiers, never form values. */
(function(){
  const enabled=()=>!!window.TechNavigation?.enabled();
  const forms={
    'master-edit':['master-records','openMasterRecordForm'], 'master-detail':['master-records','showMasterDetail'], 'master-audit':['master-records','showMasterAudit'], 'master-archive':['master-records','archiveMasterRecord'],
    'tenant-edit':['tenants','tntForm'], 'tenant-detail':['tenants','tntDetail'],
    'lead-edit':['leads','openLeadForm'], 'lead-detail':['leads','openLeadDetail'], 'lead-activity':['leads','openAddActivity'],
    'mou-edit':['mou','openMOUForm'], 'invoice-edit':['finance','openInvoiceForm'], 'corporate-invoice':['finance','openCorpMcuInvoicing'],
    'employee-edit':['hrd','openEmpForm'], 'leave-add':['hrd','openLeaveForm'], 'payroll':['hrd','openPayrollModal'],
    'package-add':['tech-harga','tpTambah'], 'license-activate':['tech-aktivasi','tlAktivasi'], 'license-revoke':['tech-aktivasi','tlCabut'],
    'deployment-edit':['tech-control-plane','tcpEditDeployment'], 'deployment-detail':['tech-control-plane','tcpDetailDeployment'], 'ticket-add':['tech-control-plane','tcpOpenTicket'],
    'query':['db-studio','dbOpenSQLEditorModal'],
    'operation-edit':[['tech-isu','tech-roadmap','tech-modul'],'techOpsRestore'],
    'sprint-edit':['tech-sprint','teamSprintRestore'],
    'quotation-add':['penawaran','pnwBaru'], 'quotation-detail':['penawaran','pnwBuka'], 'quotation-item':['penawaran','pnwRestoreItem'],
    'analyzer-simulator':['tech-analyzer','openAstmSimulatorModal'],
    'agent-slot':['agentic','agOpenSlotForm'], 'agent-sign':['agentic','agOpenSignModal'], 'agent-review':['agentic','agOpenFinalReview'],
    'agent-complaint':['agentic','agComplaintEdit'], 'agent-credential':['agentic','agCredEdit'], 'agent-template':['agentic','agTemplateEdit'],
    'agent-charter':['agentic','agOrgEditAgent'], 'agent-right':['agentic','agOrgEditRight']
  };
  let active=null,intent=null,replaying=false,restoringRecord=null,index=Number(history.state?.techIndex)||0,ignorePop=false;
  const allowed=new Set(['section','tab','domain','focus','record','args','team','kind','action','id','query','offset']);
  function clean(params={}){
    const out={};if(!params||typeof params!=='object'||Array.isArray(params))return out;
    for(const [key,value]of Object.entries(params)){
      if(!allowed.has(key))continue;
      if(key==='args'){if(Array.isArray(value)&&value.length<=2&&value.every(v=>v===null||typeof v==='number'||typeof v==='string'&&/^[a-zA-Z0-9_.:-]{0,100}$/.test(v)))out[key]=value;}
      else if(typeof value==='number'&&Number.isFinite(value))out[key]=value;
      else if(typeof value==='string'&&value.length<=180)out[key]=value;
    }return out;
  }
  function read(){
    if(!enabled())return null;
    const url=new URL(location.href),page=url.searchParams.get('techPage');
    if(!page||!/^[a-z0-9-]{1,70}$/.test(page))return null;
    try{return {page,params:clean(JSON.parse(url.searchParams.get('techParams')||'{}'))};}catch{return {page,params:{}};}
  }
  function urlFor(route){const url=new URL(location.href);url.searchParams.set('techPage',route.page);url.searchParams.set('techParams',JSON.stringify(clean(route.params)));url.hash='';return url.href;}
  function commit(page,params={},replace=false){
    if(!enabled())return;intent=null;active={page,params:clean(params)};
    const url=urlFor(active),same=url===location.href;
    if(replaying||replace||same)history.replaceState({...history.state,techIndex:index},'',url);
    else history.pushState({techIndex:++index},'',url);
  }
  function paramsFor(page,params){
    if(!enabled())return params;
    const supplied=Object.keys(params||{}).length;
    const saved=read();let out=clean(!active&&!supplied&&saved?.page===page?saved.params:params);
    const pending=window.workspacePanelTarget;
    if(pending?.page===page){out.section=pending.panel;window.workspacePanelTarget=null;}
    if(out.record?.startsWith('deployment-'))out.section='deployment';
    if(out.record==='ticket-add')out.section='tiket';
    if(out.record==='query')out.section='tables';
    if(out.team!==undefined&&page==='tech-sprint')window.techSprintRouteTeam=out.team;
    if(out.section)window.workspacePanelTarget={page,panel:out.section};
    return out;
  }
  function setIntent(key,args=[]){if(!enabled())return;intent={key,args:clean({args}).args||[]};}
  function openRecord(){
    if(!enabled()||!intent)return;
    const desired=intent;intent=null;
    const base=active||read();if(!base)return;
    const parent=forms[desired.key]?.[0];if(Array.isArray(parent)?!parent.includes(base.page):parent!==base.page)return;
    commit(base.page,{...base.params,record:desired.key,args:desired.args});
  }
  function list(){const base=active||read();if(!base)return;const params={...base.params};delete params.record;delete params.args;delete params.action;delete params.id;commit(base.page,params,true);}
  async function restore(page,params){
    if(!enabled()||!params.record)return;
    const target=forms[params.record];
    if(!target||(Array.isArray(target[0])?!target[0].includes(page):target[0]!==page))throw Error('Tujuan formulir tidak valid untuk halaman ini.');
    const fn=window[target[1]];if(typeof fn!=='function')throw Error('Formulir belum tersedia.');
    const prior=replaying;replaying=true;
    restoringRecord=params.record;
    try{await fn(...(params.args||[]));}finally{replaying=prior;restoringRecord=null;}
  }
  async function replay(route){
    if(!route)return;replaying=true;
    try{await window.navigate(route.page,route.params);}finally{replaying=false;}
  }
  window.addEventListener('popstate',async event=>{
    if(!enabled())return;
    if(ignorePop){ignorePop=false;return;}
    const nextIndex=Number(event.state?.techIndex)||0;
    if(!window.TechNavigation.canLeave()){
      const delta=index-nextIndex;
      if(delta){ignorePop=true;history.go(delta);}else if(active)history.replaceState({techIndex:index},'',urlFor(active));
      return;
    }
    index=nextIndex;await replay(read()||{page:'saas-console',params:{}});
  });
  function frameRoute(){if(!active)return null;const params={...active.params};if(params.record===restoringRecord){delete params.record;delete params.args;}return {page:active.page,params};}
  window.TechRoutes={read,commit,paramsFor,intent:setIntent,openRecord,list,restore,forms,frameRoute,active:()=>active};
})();
