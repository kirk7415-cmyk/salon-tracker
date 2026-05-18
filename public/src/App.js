import { useState, useMemo, useEffect } from "react";

// ── 設定 ──────────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxW5oXFZlJLqmuiLlCUAFPZdmVrITmV6q7eozMgCe3MiEnDkk65cRmkErACXTXncM1e/exec";

async function pushToSheets(payload) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
  } catch(e) { console.warn("Sheets sync failed:", e); }
}

// ── 密碼 ─────────────────────────────────────────────────────────────────────
const PASSWORDS = { collector: "1234", boss: "8888" };

// ── 常數 ─────────────────────────────────────────────────────────────────────
const TEACHERS   = ["小雲","小安","阿寶","Abi","薇薇","Mika","Irene","芷妤"];
const COLLECTORS = ["小安","薇薇"];
const ROLES = [
  { id:"teacher",   label:"老師",   icon:"💅", desc:"填寫當天服務紀錄",   needPw:false },
  { id:"collector", label:"收銀箱", icon:"💰", desc:"核對現金收款",       needPw:true  },
  { id:"boss",      label:"管理人", icon:"📊", desc:"查看所有帳目與統計", needPw:true  },
];
const SERVICE_GROUPS = [
  { group:"美甲", items:[
    {code:"H",label:"H 手部光療"},{code:"F",label:"F 足部光療"},
    {code:"h",label:"h 手部基礎保養"},{code:"f",label:"f 足部基礎保養"},
    {code:"C",label:"C 足部深層保養"},{code:"Rh",label:"Rh 手部卸甲"},
    {code:"Rf",label:"Rf 足部卸甲"},{code:"E",label:"E 延甲"},
    {code:"補甲",label:"補甲"},
  ]},
  { group:"美睫／紋繡", items:[
    {code:"美睫",label:"美睫"},{code:"補睫",label:"補睫"},
    {code:"補色",label:"補色"},{code:"霧眉",label:"霧眉"},
    {code:"紋繡",label:"紋繡"},{code:"紋唇",label:"紋唇"},
  ]},
  { group:"其他", items:[{code:"其他",label:"其他"}] },
];
const ALL_SERVICES      = SERVICE_GROUPS.flatMap(g => g.items);
const NON_CASH_CHANNELS = ["Line Pay","街口支付","信用卡","轉帳","悠遊付","其他"];

const today   = () => new Date().toISOString().slice(0,10);
const fmtDate = d  => d ? d.replace(/-/g,"/") : "";
const nowTs   = () => new Date().toISOString();
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

const recCash    = r => r.serviceAmounts.reduce((s,sa)=>s+(sa.cashAmt   ||0),0);
const recNonCash = r => r.serviceAmounts.reduce((s,sa)=>s+(sa.nonCashAmt||0),0);
const recTotal   = r => recCash(r)+recNonCash(r);

function emptyForm(teacher="") {
  return { date:today(), teacher, customerNo:"", customerOrder:"", selectedServices:[], serviceAmounts:{}, note:"" };
}
function emptyAmt() { return { cashAmt:"", nonCashAmt:"", nonCashChannel:"" }; }

// ── Storage (localStorage for deployed app) ───────────────────────────────────
const REC_KEY = "salon_records_v3";
const COL_KEY = "salon_collections_v3";

function loadLocal(key) {
  try { const v=localStorage.getItem(key); return v?JSON.parse(v):[]; } catch { return []; }
}
function saveLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,  setScreen]  = useState("login");
  const [myName,  setMyName]  = useState("");
  const [myRole,  setMyRole]  = useState(null);
  const [records,     setRecords]     = useState([]);
  const [collections, setCollections] = useState([]);

  useEffect(()=>{
    setRecords(loadLocal(REC_KEY));
    setCollections(loadLocal(COL_KEY));
  },[]);

  async function addRecord(rec) {
    const next=[...records,rec]; setRecords(next); saveLocal(REC_KEY,next);
    await pushToSheets({...rec, type:"record"});
  }
  async function addCollection(col) {
    const next=[...collections,col]; setCollections(next); saveLocal(COL_KEY,next);
    await pushToSheets({...col, type:"collection"});
  }
  async function deleteRecord(id) {
    const next=records.filter(r=>r.id!==id); setRecords(next); saveLocal(REC_KEY,next);
  }

  function login(role, name) { setMyRole(role); setMyName(name||""); setScreen(role.id); }
  function logout() { setMyRole(null); setMyName(""); setScreen("login"); }

  if(screen==="login")     return <LoginScreen onLogin={login}/>;
  if(screen==="teacher")   return <TeacherScreen   myName={myName} records={records} onAddRecord={addRecord} onBack={logout}/>;
  if(screen==="collector") return <CollectorScreen records={records} collections={collections} onAddCollection={addCollection} onBack={logout} myName={myName}/>;
  if(screen==="boss")      return <BossScreen      records={records} collections={collections} onBack={logout} onDeleteRecord={deleteRecord}/>;
  return null;
}

// ── LoginScreen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [step,setStep]=useState(null);
  const [name,setName]=useState("");
  const [pw,setPw]=useState("");
  const [pwErr,setPwErr]=useState(false);
  const [showPw,setShowPw]=useState(false);

  function reset(){ setStep(null);setName("");setPw("");setPwErr(false);setShowPw(false); }
  function handleEnter(){
    if(!step) return;
    if(step.needPw && pw!==PASSWORDS[step.id]){ setPwErr(true);setPw("");return; }
    if(step.id==="teacher"&&!name) return;
    if(step.id==="collector"&&!name) return;
    onLogin(step,name);
  }
  const canEnter=step&&(step.needPw?(pw.length>0&&!!name):(!!name));

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#fdf6f0,#fce8d8)",fontFamily:"'Noto Sans TC','Hiragino Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <div style={{background:"linear-gradient(90deg,#c97b63,#e8a98a)",padding:"40px 24px 30px",textAlign:"center"}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:8}}>NAIL STUDIO</div>
        <div style={{fontSize:30,fontWeight:800,color:"#fff"}}>帳目管理系統</div>
      </div>
      <div style={{padding:"32px 20px",maxWidth:420,margin:"0 auto",width:"100%"}}>
        {!step?(
          <>
            <div style={{fontSize:14,color:"#888",textAlign:"center",marginBottom:24}}>請選擇您的身份</div>
            {ROLES.map(r=>(
              <button key={r.id} onClick={()=>{reset();setStep(r);}} style={{width:"100%",padding:"18px 20px",marginBottom:12,borderRadius:16,border:"2px solid #f0ddd5",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:16,textAlign:"left",boxShadow:"0 2px 12px rgba(180,100,70,0.07)"}}>
                <span style={{fontSize:28}}>{r.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:"#333"}}>{r.label}</div>
                  <div style={{fontSize:12,color:"#aaa",marginTop:2}}>{r.desc}</div>
                </div>
                {r.needPw&&<span style={{fontSize:12,color:"#bbb",background:"#f5f0e8",borderRadius:8,padding:"3px 9px"}}>🔒</span>}
              </button>
            ))}
          </>
        ):(
          <div style={card}>
            <button onClick={reset} style={{background:"none",border:"none",color:"#aaa",fontSize:13,cursor:"pointer",marginBottom:14,padding:0}}>← 返回</button>
            <div style={{fontSize:20,fontWeight:800,color:"#333",marginBottom:2}}>{step.icon} {step.label}</div>
            <div style={{fontSize:12,color:"#aaa",marginBottom:20}}>{step.desc}</div>
            {step.id==="teacher"&&(
              <><Lbl required>請選擇您的名字</Lbl>
              <select value={name} onChange={e=>setName(e.target.value)} style={inp(false)}>
                <option value="">-- 選擇 --</option>
                {TEACHERS.map(t=><option key={t} value={t}>{t}</option>)}
              </select></>
            )}
            {step.id==="collector"&&(
              <><Lbl required>請選擇您的名字</Lbl>
              <select value={name} onChange={e=>setName(e.target.value)} style={inp(false)}>
                <option value="">-- 選擇 --</option>
                {COLLECTORS.map(t=><option key={t} value={t}>{t}</option>)}
              </select></>
            )}
            {step.needPw&&(
              <><Lbl required>密碼</Lbl>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} placeholder="請輸入密碼" value={pw} onChange={e=>{setPw(e.target.value);setPwErr(false);}} onKeyDown={e=>e.key==="Enter"&&handleEnter()} style={{...inp(pwErr),paddingRight:44}} autoComplete="off"/>
                <button onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-55%)",background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:17}}>{showPw?"🙈":"👁"}</button>
              </div>
              {pwErr&&<div style={{fontSize:12,color:"#ef4444",marginBottom:10,marginTop:-8}}>密碼錯誤，請再試一次</div>}
              </>
            )}
            <button onClick={handleEnter} disabled={!canEnter} style={{width:"100%",padding:14,marginTop:4,background:!canEnter?"#ddd":"linear-gradient(90deg,#c97b63,#e8a98a)",color:!canEnter?"#aaa":"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:!canEnter?"not-allowed":"pointer"}}>進入</button>
            {step.needPw&&<p style={{fontSize:11,color:"#ccc",textAlign:"center",marginTop:12}}>🔒 此身份需要密碼</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── TeacherScreen ─────────────────────────────────────────────────────────────
function TeacherScreen({ myName, records, onAddRecord, onBack }) {
  const [tab,setTab]=useState(0);
  const [form,setForm]=useState(emptyForm(myName));
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [errors,setErrors]=useState({});

  const myRecords=useMemo(()=>records.filter(r=>r.teacher===myName).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||"").localeCompare(a.createdAt||"")),[records,myName]);

  function setField(k,v){ setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:undefined})); }
  function toggleService(code){
    setForm(f=>{
      const has=f.selectedServices.includes(code);
      const selectedServices=has?f.selectedServices.filter(s=>s!==code):[...f.selectedServices,code];
      const serviceAmounts={...f.serviceAmounts};
      if(!has) serviceAmounts[code]=serviceAmounts[code]||emptyAmt(); else delete serviceAmounts[code];
      return{...f,selectedServices,serviceAmounts};
    });
    setErrors(e=>({...e,services:undefined}));
  }
  function setAmt(code,field,value){ setForm(f=>({...f,serviceAmounts:{...f.serviceAmounts,[code]:{...f.serviceAmounts[code],[field]:value}}})); }

  function validate(){
    const e={};
    if(!form.date) e.date="必填";
    if(!form.customerOrder) e.customerOrder="必填";
    if(form.selectedServices.length===0) e.services="請至少選擇一個項目";
    form.selectedServices.forEach(code=>{
      const sa=form.serviceAmounts[code]||{};
      if((Number(sa.cashAmt)||0)===0&&(Number(sa.nonCashAmt)||0)===0) e[`amt_${code}`]="請填金額";
      if((Number(sa.nonCashAmt)||0)>0&&!sa.nonCashChannel) e[`ch_${code}`]="請選管道";
    });
    return e;
  }

  async function handleSubmit(){
    const e=validate(); if(Object.keys(e).length>0){setErrors(e);return;}
    setSaving(true);
    const serviceAmounts=form.selectedServices.map(code=>{
      const sa=form.serviceAmounts[code]||{};
      return{code,cashAmt:Number(sa.cashAmt)||0,nonCashAmt:Number(sa.nonCashAmt)||0,nonCashChannel:sa.nonCashChannel||""};
    });
    await onAddRecord({id:genId(),date:form.date,teacher:myName,customerNo:form.customerNo,customerOrder:Number(form.customerOrder),serviceAmounts,note:form.note,createdAt:nowTs()});
    setForm(emptyForm(myName)); setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false),2500);
  }

  const formTotal=form.selectedServices.reduce((s,code)=>{const sa=form.serviceAmounts[code]||{};return s+(Number(sa.cashAmt)||0)+(Number(sa.nonCashAmt)||0);},0);
  const byDate=useMemo(()=>{const map={};myRecords.forEach(r=>{if(!map[r.date])map[r.date]=[];map[r.date].push(r);});return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));},[myRecords]);

  return (
    <Shell title={myName} subtitle="老師" accent="#c97b63" onBack={onBack}>
      <TabBar tabs={["新增紀錄","我的留存"]} active={tab} onChange={setTab} color="#c97b63"/>
      {tab===0&&(
        <div style={card}>
          <div style={sec}>新增消費紀錄</div>
          <Lbl required>日期</Lbl>
          <input type="date" value={form.date} onChange={e=>setField("date",e.target.value)} style={inp(errors.date)}/>
          {errors.date&&<Err>{errors.date}</Err>}
          <Lbl required>當天第幾位客人</Lbl>
          <div style={{display:"flex",gap:6,marginBottom:errors.customerOrder?4:12,flexWrap:"wrap"}}>
            {[1,2,3,4,5,6,7,8].map(n=>(
              <button key={n} onClick={()=>setField("customerOrder",String(n))} style={{width:40,height:40,borderRadius:10,border:"none",background:form.customerOrder===String(n)?"#c97b63":"#f5ede8",color:form.customerOrder===String(n)?"#fff":"#c97b63",fontWeight:700,fontSize:15,cursor:"pointer",transition:"all 0.15s"}}>{n}</button>
            ))}
            <input type="number" placeholder="9+" value={Number(form.customerOrder)>8?form.customerOrder:""} onChange={e=>setField("customerOrder",e.target.value)} style={{width:56,padding:"0 8px",border:`1.5px solid ${errors.customerOrder?"#ef4444":"#e8d5cb"}`,borderRadius:10,fontSize:14,background:"#fdfaf8",color:"#333",outline:"none"}}/>
          </div>
          {errors.customerOrder&&<Err>{errors.customerOrder}</Err>}
          <Lbl>客人編號（留空 = NEW）</Lbl>
          <div style={{position:"relative"}}>
            <input type="text" placeholder="留空 = 新客 NEW" value={form.customerNo} onChange={e=>setField("customerNo",e.target.value)} style={{...inp(),paddingRight:form.customerNo?12:68}}/>
            {!form.customerNo&&<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-60%)",background:"#7cb87c",color:"#fff",borderRadius:6,fontSize:11,fontWeight:700,padding:"2px 8px",pointerEvents:"none"}}>NEW</span>}
          </div>
          <Lbl required>施作項目（可複選）</Lbl>
          <div style={{border:`1.5px solid ${errors.services?"#ef4444":"#e8d5cb"}`,borderRadius:12,padding:12,marginBottom:errors.services?4:16,background:"#fdfaf8"}}>
            {SERVICE_GROUPS.map(g=>(
              <div key={g.group} style={{marginBottom:10}}>
                <div style={{fontSize:10,color:"#bbb",fontWeight:700,letterSpacing:1,marginBottom:6}}>{g.group}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {g.items.map(s=>{const sel=form.selectedServices.includes(s.code);return <button key={s.code} onClick={()=>toggleService(s.code)} style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${sel?"#c97b63":"#e8d5cb"}`,background:sel?"#c97b63":"#fff",color:sel?"#fff":"#666",fontSize:12,fontWeight:sel?700:400,cursor:"pointer",transition:"all 0.15s"}}>{s.label}</button>;})}
                </div>
              </div>
            ))}
          </div>
          {errors.services&&<Err>{errors.services}</Err>}
          {form.selectedServices.length>0&&(
            <div style={{marginBottom:12}}>
              {form.selectedServices.map(code=>{
                const label=ALL_SERVICES.find(s=>s.code===code)?.label||code;
                const sa=form.serviceAmounts[code]||emptyAmt();
                return(
                  <div key={code} style={{background:"#fdf8f5",border:`1.5px solid ${errors[`amt_${code}`]||errors[`ch_${code}`]?"#ef4444":"#f0ddd5"}`,borderRadius:12,padding:14,marginBottom:10}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#c97b63",marginBottom:10}}>💅 {label}</div>
                    <div style={{display:"flex",gap:10}}>
                      <div style={{flex:1}}><Lbl>現金（元）</Lbl><input type="number" placeholder="0" value={sa.cashAmt} onChange={e=>setAmt(code,"cashAmt",e.target.value)} style={inp(errors[`amt_${code}`])}/></div>
                      <div style={{flex:1}}><Lbl>非現金（元）</Lbl><input type="number" placeholder="0" value={sa.nonCashAmt} onChange={e=>setAmt(code,"nonCashAmt",e.target.value)} style={inp()}/></div>
                    </div>
                    {errors[`amt_${code}`]&&<Err>{errors[`amt_${code}`]}</Err>}
                    {Number(sa.nonCashAmt)>0&&(
                      <><Lbl required>非現金管道</Lbl>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:errors[`ch_${code}`]?4:0}}>
                        {NON_CASH_CHANNELS.map(ch=><button key={ch} onClick={()=>setAmt(code,"nonCashChannel",ch)} style={{padding:"5px 11px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:sa.nonCashChannel===ch?"#5b8fd4":"#eef3fb",color:sa.nonCashChannel===ch?"#fff":"#5b8fd4",transition:"all 0.15s"}}>{ch}</button>)}
                      </div>
                      {errors[`ch_${code}`]&&<Err>{errors[`ch_${code}`]}</Err>}
                      </>
                    )}
                    {((Number(sa.cashAmt)||0)+(Number(sa.nonCashAmt)||0))>0&&(
                      <div style={{fontSize:11,color:"#aaa",textAlign:"right",marginTop:6}}>小計：<strong style={{color:"#c97b63"}}>${((Number(sa.cashAmt)||0)+(Number(sa.nonCashAmt)||0)).toLocaleString()}</strong></div>
                    )}
                  </div>
                );
              })}
              {formTotal>0&&<div style={{background:"#c97b63",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:"#fff",fontWeight:600}}>本次合計</span><span style={{color:"#fff",fontWeight:800,fontSize:20}}>${formTotal.toLocaleString()}</span></div>}
            </div>
          )}
          <Lbl>備註</Lbl>
          <input type="text" placeholder="Line money、轉帳、預付訂金" value={form.note} onChange={e=>setField("note",e.target.value)} style={inp()}/>
          <button onClick={handleSubmit} disabled={saving} style={{width:"100%",padding:14,background:saving?"#aaa":saved?"#7cb87c":"linear-gradient(90deg,#c97b63,#e8a98a)",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:saving?"not-allowed":"pointer",transition:"background 0.3s"}}>
            {saving?"送出中…":saved?"✓ 已送出！":"送出紀錄"}
          </button>
          <p style={{fontSize:11,color:"#bbb",textAlign:"center",marginTop:8}}>送出後即存入系統，無法修改</p>
        </div>
      )}
      {tab===1&&(
        <div style={card}>
          <div style={sec}>我的紀錄留存（{myRecords.length}筆）</div>
          {byDate.length===0&&<p style={{color:"#ccc",textAlign:"center",padding:20}}>尚無紀錄</p>}
          {byDate.map(([date,recs])=>{
            const dayTotal=recs.reduce((s,r)=>s+recTotal(r),0);
            const dayCash=recs.reduce((s,r)=>s+recCash(r),0);
            return(
              <div key={date} style={{marginBottom:18}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#555"}}>{fmtDate(date)}</span>
                  <div style={{textAlign:"right"}}><span style={{fontSize:14,fontWeight:800,color:"#c97b63"}}>${dayTotal.toLocaleString()}</span><span style={{fontSize:10,color:"#bbb",marginLeft:6}}>現金 ${dayCash}</span></div>
                </div>
                {recs.sort((a,b)=>a.customerOrder-b.customerOrder).map(r=>(
                  <div key={r.id} style={{background:"#fdfaf8",borderRadius:10,padding:"10px 12px",marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#444"}}>第{r.customerOrder}位</span>
                        {r.customerNo?<span style={tg("#f0e8ff","#9b6dbd")}>#{r.customerNo}</span>:<span style={tg("#e8f5e9","#7cb87c")}>NEW</span>}
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:"#c97b63"}}>${recTotal(r).toLocaleString()}</span>
                    </div>
                    <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>
                      {r.serviceAmounts.map(sa=>(
                        <span key={sa.code} style={{fontSize:11,color:"#666",background:"#f0ebe8",borderRadius:6,padding:"2px 8px"}}>
                          {sa.code} ${(sa.cashAmt+sa.nonCashAmt).toLocaleString()}
                          {sa.nonCashAmt>0&&<span style={{color:"#5b8fd4"}}> ({sa.nonCashChannel})</span>}
                        </span>
                      ))}
                    </div>
                    {r.note&&<div style={{fontSize:11,color:"#bbb",marginTop:4}}>備註：{r.note}</div>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

// ── CollectorScreen ───────────────────────────────────────────────────────────
function CollectorScreen({ records, collections, onAddCollection, onBack, myName }) {
  const [selTeacher,setSelTeacher]=useState("全部");
  const [fromDate,setFromDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()-7);return d.toISOString().slice(0,10);});
  const [toDate,setToDate]=useState(today());
  const [cashInputs,setCashInputs]=useState({});
  const [colNote,setColNote]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [checkResult,setCheckResult]=useState(null);
  const [saving,setSaving]=useState(false);

  const inRange=useMemo(()=>records.filter(r=>r.date>=fromDate&&r.date<=toDate&&(selTeacher==="全部"||r.teacher===selTeacher)),[records,fromDate,toDate,selTeacher]);
  const summary=useMemo(()=>{const map={};inRange.forEach(r=>{if(!map[r.teacher])map[r.teacher]={cash:0,nonCash:0,count:0};map[r.teacher].cash+=recCash(r);map[r.teacher].nonCash+=recNonCash(r);map[r.teacher].count++;});return map;},[inRange]);

  function doCheck(){ setCheckResult(Object.entries(summary).map(([t,s])=>{const actual=Number(cashInputs[t]||0);return{teacher:t,expected:s.cash,actual,diff:actual-s.cash,nonCash:s.nonCash};})); }
  async function doConfirm(){
    setSaving(true);
    await onAddCollection({id:genId(),date:today(),fromDate,toDate,collectedBy:myName||"收銀箱",summary:Object.entries(summary).map(([t,s])=>({teacher:t,expectedCash:s.cash,actualCash:Number(cashInputs[t]||0),nonCash:s.nonCash})),note:colNote,createdAt:nowTs()});
    setSaving(false); setConfirmed(true);
  }
  const allMatch=checkResult&&checkResult.every(r=>r.diff===0);

  return (
    <Shell title="收銀箱" subtitle={myName} accent="#5b8fd4" onBack={onBack}>
      <div style={card}>
        <div style={sec}>篩選區間</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <div style={{flex:1}}><Lbl>從</Lbl><input type="date" value={fromDate} onChange={e=>{setFromDate(e.target.value);setCheckResult(null);setConfirmed(false);}} style={{...inp(),marginBottom:0}}/></div>
          <div style={{flex:1}}><Lbl>到</Lbl><input type="date" value={toDate} onChange={e=>{setToDate(e.target.value);setCheckResult(null);setConfirmed(false);}} style={{...inp(),marginBottom:0}}/></div>
        </div>
        <Lbl>老師</Lbl>
        <select value={selTeacher} onChange={e=>setSelTeacher(e.target.value)} style={inp()}>
          <option>全部</option>{TEACHERS.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      {Object.keys(summary).length>0?(
        <div style={{...card,marginTop:16}}>
          <div style={sec}>帳目應收 / 實收輸入</div>
          {Object.entries(summary).map(([t,s])=>(
            <div key={t} style={{padding:"12px 0",borderBottom:"1px solid #f5ede8"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div><span style={{fontSize:14,fontWeight:700,color:"#333"}}>{t}</span><span style={{fontSize:11,color:"#bbb",marginLeft:8}}>{s.count}筆</span></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:"#c97b63"}}>${(s.cash+s.nonCash).toLocaleString()}</div><div style={{fontSize:10,color:"#bbb"}}>現金 ${s.cash} ／ 非現金 ${s.nonCash}</div></div>
              </div>
              <Lbl>實收現金</Lbl>
              <input type="number" placeholder={`應收 $${s.cash}`} value={cashInputs[t]||""} onChange={e=>{setCashInputs(c=>({...c,[t]:e.target.value}));setCheckResult(null);setConfirmed(false);}} style={inp()}/>
            </div>
          ))}
          <Lbl>備註</Lbl>
          <input type="text" placeholder="例：5/9–5/13 收款" value={colNote} onChange={e=>setColNote(e.target.value)} style={inp()}/>
          <button onClick={doCheck} style={{width:"100%",padding:13,background:"linear-gradient(90deg,#5b8fd4,#7bb3f0)",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:10}}>核對金額</button>
          {checkResult&&(
            <div>
              {checkResult.map(r=>(
                <div key={r.teacher} style={{background:r.diff===0?"#f0fff4":"#fff0f0",borderRadius:10,padding:"10px 14px",marginBottom:8,border:`1px solid ${r.diff===0?"#b2f0c8":"#ffc0c0"}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontWeight:700}}>{r.teacher}</div><div style={{fontSize:11,color:"#888"}}>應收 ${r.expected}　實收 ${r.actual}</div>{r.nonCash>0&&<div style={{fontSize:11,color:"#5b8fd4"}}>非現金 ${r.nonCash}（另計）</div>}</div>
                  {r.diff===0?<span style={{color:"#4caf50",fontWeight:800}}>✓ 一致</span>:<span style={{color:"#ef4444",fontWeight:800}}>{r.diff>0?`多 $${r.diff}`:`少 $${Math.abs(r.diff)}`}</span>}
                </div>
              ))}
              {!confirmed&&<button onClick={doConfirm} disabled={!allMatch||saving} style={{width:"100%",padding:13,background:allMatch&&!saving?"linear-gradient(90deg,#4caf50,#66bb6a)":"#ccc",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:allMatch&&!saving?"pointer":"not-allowed"}}>{saving?"送出中…":allMatch?"✓ 確認收款完成":"金額有差異，請確認"}</button>}
              {confirmed&&<div style={{background:"#f0fff4",border:"1px solid #b2f0c8",borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#4caf50"}}>✓ 收款紀錄已送出</div></div>}
            </div>
          )}
        </div>
      ):(
        <div style={{...card,marginTop:16,textAlign:"center",color:"#ccc",padding:"32px 16px"}}>此區間沒有紀錄</div>
      )}
    </Shell>
  );
}

// ── BossScreen ────────────────────────────────────────────────────────────────
function BossScreen({ records, collections, onBack, onDeleteRecord }) {
  const [tab,setTab]=useState(0);
  const [filterMonth,setFilterMonth]=useState(today().slice(0,7));
  const [filterTeacher,setFilterTeacher]=useState("全部");
  const [copied,setCopied]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(null);

  const filtered=useMemo(()=>records.filter(r=>r.date.startsWith(filterMonth)&&(filterTeacher==="全部"||r.teacher===filterTeacher)).sort((a,b)=>a.date.localeCompare(b.date)||a.teacher.localeCompare(b.teacher)||a.customerOrder-b.customerOrder),[records,filterMonth,filterTeacher]);
  const summary=useMemo(()=>{const map={};filtered.forEach(r=>{if(!map[r.teacher])map[r.teacher]={cash:0,nonCash:0,count:0};map[r.teacher].cash+=recCash(r);map[r.teacher].nonCash+=recNonCash(r);map[r.teacher].count++;});return map;},[filtered]);
  const totalCash=filtered.reduce((s,r)=>s+recCash(r),0);
  const totalNonCash=filtered.reduce((s,r)=>s+recNonCash(r),0);
  const monthCols=useMemo(()=>collections.filter(c=>c.date.startsWith(filterMonth)).sort((a,b)=>b.date.localeCompare(a.date)),[collections,filterMonth]);
  const totalCollected=useMemo(()=>monthCols.reduce((s,c)=>s+c.summary.reduce((ss,t)=>ss+t.actualCash,0),0),[monthCols]);
  const teachers=[...new Set(records.map(r=>r.teacher))];
  const tableRows=useMemo(()=>filtered.flatMap(r=>r.serviceAmounts.map(sa=>({id:r.id,date:r.date,teacher:r.teacher,order:r.customerOrder,customerNo:r.customerNo||"NEW",service:sa.code,cash:sa.cashAmt,nonCash:sa.nonCashAmt,channel:sa.nonCashChannel||"",total:sa.cashAmt+sa.nonCashAmt,note:r.note||""}))),[ filtered]);

  function handleCopy(){
    const header=["日期","老師","客人順序","客人編號","項目","現金","非現金","非現金管道","小計","備註"];
    const rows=tableRows.map(r=>[r.date,r.teacher,r.order,r.customerNo,r.service,r.cash,r.nonCash,r.channel,r.total,r.note]);
    navigator.clipboard.writeText([header,...rows].map(r=>r.join("\t")).join("\n")).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  return (
    <Shell title="管理人統計" subtitle="管理人" accent="#7b63c9" onBack={onBack}>
      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
          <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:320,width:"100%"}}>
            <div style={{fontSize:16,fontWeight:800,color:"#333",marginBottom:8}}>確認刪除？</div>
            <div style={{fontSize:13,color:"#888",marginBottom:20}}>刪除後無法復原，Google 試算表的資料不會自動刪除，需手動處理。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:12,background:"#f5f5f5",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"}}>取消</button>
              <button onClick={()=>{onDeleteRecord(confirmDelete);setConfirmDelete(null);}} style={{flex:1,padding:12,background:"#ef4444",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>確認刪除</button>
            </div>
          </div>
        </div>
      )}

      <TabBar tabs={["業績總覽","月報表","收款紀錄"]} active={tab} onChange={setTab} color="#7b63c9"/>
      <div style={{...card,marginBottom:16}}>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1}}><Lbl>月份</Lbl><input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{...inp(),marginBottom:0}}/></div>
          <div style={{flex:1}}><Lbl>老師</Lbl><select value={filterTeacher} onChange={e=>setFilterTeacher(e.target.value)} style={{...inp(),marginBottom:0}}><option>全部</option>{teachers.map(t=><option key={t}>{t}</option>)}</select></div>
        </div>
      </div>

      {tab===0&&(
        <div>
          <div style={card}>
            <div style={sec}>各老師業績</div>
            {Object.keys(summary).length===0&&<p style={{color:"#ccc",textAlign:"center",padding:"16px 0"}}>本月無資料</p>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {Object.entries(summary).map(([t,s])=>(
                <div key={t} style={{background:"linear-gradient(135deg,#f5f0ff,#ede8ff)",borderRadius:12,padding:"12px 14px",border:"1px solid #d8c8f0"}}>
                  <div style={{fontSize:12,color:"#999"}}>{t} <span style={{color:"#bbb"}}>({s.count}筆)</span></div>
                  <div style={{fontSize:19,fontWeight:800,color:"#7b63c9"}}>${(s.cash+s.nonCash).toLocaleString()}</div>
                  <div style={{fontSize:10,color:"#bbb",marginTop:2}}>現金 ${s.cash} ／ 非現金 ${s.nonCash}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{flex:1,background:"#c97b63",borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:11,color:"rgba(255,255,255,0.75)"}}>現金合計</div><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>${totalCash.toLocaleString()}</div></div>
              <div style={{flex:1,background:"#5b8fd4",borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:11,color:"rgba(255,255,255,0.75)"}}>非現金合計</div><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>${totalNonCash.toLocaleString()}</div></div>
            </div>
            <div style={{background:"#333",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#aaa",fontSize:13}}>總業績</span>
              <span style={{color:"#fff",fontSize:22,fontWeight:800}}>${(totalCash+totalNonCash).toLocaleString()}</span>
            </div>
          </div>
          {(totalCash-totalCollected)>0&&(
            <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:12,padding:"12px 14px",marginTop:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>⚠️ 員工身上尚未收回現金</div>
              <div style={{fontSize:22,fontWeight:800,color:"#f59e0b"}}>${(totalCash-totalCollected).toLocaleString()}</div>
              <div style={{fontSize:11,color:"#aaa",marginTop:2}}>帳目現金 ${totalCash}　已收 ${totalCollected}</div>
            </div>
          )}
        </div>
      )}

      {tab===1&&(
        <div style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={sec}>月報表（{tableRows.length}筆）</div>
            <button onClick={handleCopy} style={{padding:"6px 14px",background:copied?"#7cb87c":"#7b63c9",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",transition:"background 0.3s",flexShrink:0}}>{copied?"✓ 已複製":"複製到試算表"}</button>
          </div>
          {tableRows.length===0&&<p style={{color:"#ccc",textAlign:"center",padding:"16px 0"}}>本月無資料</p>}
          {tableRows.length>0&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:"#f5f0ff"}}>{["日期","老師","順序","客人","項目","現金","非現金","管道","小計","備註",""].map((h,i)=><th key={i} style={{padding:"8px 6px",textAlign:"left",color:"#7b63c9",fontWeight:700,whiteSpace:"nowrap",borderBottom:"2px solid #d8c8f0"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {tableRows.map((r,i)=>(
                    <tr key={i} style={{background:i%2===0?"#fff":"#faf8ff"}}>
                      <td style={td}>{fmtDate(r.date)}</td><td style={td}>{r.teacher}</td>
                      <td style={{...td,textAlign:"center"}}>{r.order}</td><td style={td}>{r.customerNo}</td>
                      <td style={td}><span style={tg("#fce8d8","#c97b63")}>{r.service}</span></td>
                      <td style={{...td,textAlign:"right"}}>{r.cash>0?`$${r.cash.toLocaleString()}`:"-"}</td>
                      <td style={{...td,textAlign:"right"}}>{r.nonCash>0?`$${r.nonCash.toLocaleString()}`:"-"}</td>
                      <td style={td}>{r.channel||"-"}</td>
                      <td style={{...td,textAlign:"right",fontWeight:700,color:"#7b63c9"}}>${r.total.toLocaleString()}</td>
                      <td style={{...td,color:"#aaa"}}>{r.note||"-"}</td>
                      <td style={td}><button onClick={()=>setConfirmDelete(r.id)} style={{padding:"3px 8px",background:"#fff0f0",color:"#ef4444",border:"1px solid #ffc0c0",borderRadius:6,fontSize:11,cursor:"pointer"}}>刪除</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{background:"#ede8ff",fontWeight:700}}><td colSpan={5} style={{...td,color:"#7b63c9"}}>合計</td><td style={{...td,textAlign:"right",color:"#c97b63"}}>${tableRows.reduce((s,r)=>s+r.cash,0).toLocaleString()}</td><td style={{...td,textAlign:"right",color:"#5b8fd4"}}>${tableRows.reduce((s,r)=>s+r.nonCash,0).toLocaleString()}</td><td style={td}></td><td style={{...td,textAlign:"right",color:"#7b63c9"}}>${tableRows.reduce((s,r)=>s+r.total,0).toLocaleString()}</td><td colSpan={2} style={td}></td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {tab===2&&(
        <div style={card}>
          <div style={sec}>收款紀錄（本月）</div>
          {monthCols.length===0&&<p style={{color:"#ccc",textAlign:"center",padding:"16px 0"}}>本月尚無收款紀錄</p>}
          {monthCols.map(col=>(
            <div key={col.id} style={{background:"#fafafa",borderRadius:12,padding:14,marginBottom:12,border:"1px solid #eee"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div><span style={{fontSize:13,fontWeight:700,color:"#333"}}>{fmtDate(col.fromDate)} ～ {fmtDate(col.toDate)}</span><div style={{fontSize:11,color:"#aaa"}}>收款人：{col.collectedBy}　{fmtDate(col.date)}</div></div>
                <span style={{fontSize:14,fontWeight:800,color:"#4caf50"}}>${col.summary.reduce((s,t)=>s+t.actualCash,0).toLocaleString()}</span>
              </div>
              {col.summary.map(t=>(<div key={t.teacher} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#666",padding:"3px 0"}}><span>{t.teacher}</span><span>現金 ${t.actualCash}　非現金 ${t.nonCash}</span></div>))}
              {col.note&&<div style={{fontSize:11,color:"#bbb",marginTop:6}}>備註：{col.note}</div>}
            </div>
          ))}
          {monthCols.length>0&&<div style={{background:"#4caf50",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between"}}><span style={{color:"#fff",fontWeight:600}}>本月已收現金合計</span><span style={{color:"#fff",fontWeight:800,fontSize:18}}>${totalCollected.toLocaleString()}</span></div>}
          {(totalCash-totalCollected)>0&&<div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:12,padding:"12px 14px",marginTop:10}}><div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>⚠️ 員工身上尚未收回現金</div><div style={{fontSize:22,fontWeight:800,color:"#f59e0b"}}>${(totalCash-totalCollected).toLocaleString()}</div></div>}
        </div>
      )}
    </Shell>
  );
}

// ── Shell / TabBar ────────────────────────────────────────────────────────────
function Shell({ title, subtitle, accent, onBack, children }) {
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#fdf6f0,#fce8d8)",fontFamily:"'Noto Sans TC','Hiragino Sans',sans-serif",paddingBottom:60}}>
      <div style={{background:`linear-gradient(90deg,${accent},${accent}bb)`,padding:"22px 20px 18px",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.22)",border:"none",color:"#fff",borderRadius:8,padding:"4px 12px",fontSize:12,cursor:"pointer",marginBottom:10}}>← 切換身份</button>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",letterSpacing:2,marginBottom:2}}>{subtitle}</div>
        <div style={{fontSize:22,fontWeight:800,color:"#fff"}}>{title}</div>
      </div>
      <div style={{padding:"20px 16px",maxWidth:520,margin:"0 auto"}}>{children}</div>
    </div>
  );
}
function TabBar({ tabs, active, onChange, color="#c97b63" }) {
  return (
    <div style={{display:"flex",background:"#fff",borderRadius:12,marginBottom:16,overflow:"hidden",boxShadow:"0 1px 6px rgba(180,100,70,0.08)"}}>
      {tabs.map((t,i)=><button key={t} onClick={()=>onChange(i)} style={{flex:1,padding:"12px 0",border:"none",background:"transparent",fontSize:12,fontWeight:active===i?700:400,color:active===i?color:"#aaa",borderBottom:active===i?`3px solid ${color}`:"3px solid transparent",cursor:"pointer"}}>{t}</button>)}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const card={background:"#fff",borderRadius:16,padding:"20px 16px",boxShadow:"0 2px 16px rgba(180,100,70,0.08)"};
const sec={fontSize:12,fontWeight:700,color:"#c97b63",letterSpacing:1.5,marginBottom:14,textTransform:"uppercase"};
const td={padding:"7px 6px",borderBottom:"1px solid #f0ecff",verticalAlign:"middle",whiteSpace:"nowrap"};
function inp(err){ return{width:"100%",padding:"11px 12px",border:`1.5px solid ${err?"#ef4444":"#e8d5cb"}`,borderRadius:10,fontSize:14,marginBottom:err?4:12,boxSizing:"border-box",background:"#fdfaf8",outline:"none",color:"#333"}; }
function Lbl({children,required}){ return <div style={{fontSize:12,color:"#888",marginBottom:4,fontWeight:600}}>{children}{required&&<span style={{color:"#ef4444",marginLeft:2}}>*</span>}</div>; }
function Err({children}){ return <div style={{fontSize:11,color:"#ef4444",marginBottom:8}}>{children}</div>; }
function tg(bg,color){ return{fontSize:11,background:bg,color,borderRadius:6,padding:"1px 7px",fontWeight:600}; }
