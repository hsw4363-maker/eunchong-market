import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, setDoc, addDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const localDate = (stamp) => stamp?.toDate?.().toLocaleDateString("ko-KR") ?? "방금";
const field = (form, name) => form.elements.namedItem(name);
const money = (n) => Number(n || 0).toLocaleString("ko-KR");
const statusName = { approved:"교환 확정 · 수령 대기", collected:"수령 완료" };
const colors = ["#edf5e8","#f8edf1","#f7f0e3","#e8f3f8"];
const imagePath = (url) => typeof url==="string" && (/^(?:\.\/)?images\/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp|gif)$/i.test(url) || /^https:\/\/[^\s"'<>]+$/i.test(url)) ? url : "";
const photoHtml = (p) => imagePath(p.imageUrl)
  ? `<img class="product-photo" loading="lazy" src="${esc(imagePath(p.imageUrl))}" alt="${esc(p.name)}" data-emoji="${esc(p.emoji||"🎁")}">`
  : `<span>${esc(p.emoji||"🎁")}</span>`;
const demo = [
  {id:"demo1",name:"귀여운 연필 세트",category:"문구",price:50,emoji:"✏️",stock:10,active:true},
  {id:"demo2",name:"달콤한 막대 사탕",category:"간식",price:30,emoji:"🍭",stock:10,active:true},
  {id:"demo3",name:"말랑말랑 인형",category:"장난감",price:180,emoji:"🧸",stock:10,active:true},
  {id:"demo4",name:"깜짝 선물 꾸러미",category:"특별 선물",price:350,emoji:"🎁",stock:10,active:true}
];
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE_");
let app, auth, db, currentUser=null, profile=null, products=[], students=[], orders=[], ownOrders=[], ledger=[], chosenProduct=null, category="전체", adminTab="orders";
let stopProducts=null,stopProfile=null;
const EMAIL_DOMAIN = "students.eunchong.example"; // 관리자 계정은 Firebase Console에서 실제 이메일로 만듭니다.
const emailOf = (username) => `${username.toLowerCase()}@${EMAIL_DOMAIN}`;
const isAdmin = () => profile?.role === "admin" && profile?.active !== false;

function toast(text){const el=$("#toast");el.textContent=text;el.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add("hidden"),4500);}
function messageFor(e){console.error(e);return ({
 "auth/invalid-credential":"아이디 또는 비밀번호가 올바르지 않습니다.",
 "auth/email-already-in-use":"이미 사용 중인 아이디입니다.",
 "auth/weak-password":"비밀번호를 더 길게 설정해주세요.",
 "permission-denied":"이 작업을 할 권한이 없습니다. 관리자에게 문의해주세요.",
 "failed-precondition":"잠시 후 다시 시도해주세요."
})[e.code] || e.message || "처리 중 문제가 발생했습니다.";}
function show(view){
 if(view==="admin"&&!isAdmin()){toast("관리자만 접근할 수 있습니다.");return;}
 if(view==="history"&&!profile){$("#login-dialog").showModal();return;}
 $$(".view").forEach(el=>el.classList.toggle("hidden",el.id!==view+"-view"));
 $$("nav [data-view]").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
 window.scrollTo({top:0,behavior:"smooth"});
}
function renderHeader(){
 $("#login-btn").classList.toggle("hidden",!!profile);
 $("#logout-btn").classList.toggle("hidden",!profile);
 $("#point-pill").classList.toggle("hidden",!profile);
 $("#point-pill").innerHTML=profile?`🌿 <b>${money(profile.balance)}</b> P`:"";
 $("#who").textContent=profile?.name?profile.name+"님":"";
 $$(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
}
function renderProducts(){
 const list=products.filter(p=>p.active!==false&&(category==="전체"||p.category===category));
 const cats=["전체",...new Set(products.filter(p=>p.active!==false).map(p=>p.category))];
 $("#categories").innerHTML=cats.map(c=>`<button data-category="${esc(c)}" class="${c===category?"active":""}">${esc(c==="전체"?"전체 선물":c)}</button>`).join("");
 $("#product-grid").innerHTML=list.length?list.map((p,i)=>`<article class="product"><div class="product-visual" style="background:${colors[i%colors.length]}"><span class="product-tag">${p.stock>0?"은총 선물":"품절"}</span>${photoHtml(p)}</div><div class="product-body"><small>${esc(p.category)}</small><h3>${esc(p.name)}</h3><div class="product-bottom"><strong>${money(p.price)} <small>은총표</small></strong><button data-order="${esc(p.id)}" ${p.stock<=0||!configured?"disabled":""}>${p.stock>0?"교환하기":"품절"}</button></div></div></article>`).join(""):`<div class="empty" style="grid-column:1/-1">등록된 선물이 없어요. 관리자에서 상품을 추가해주세요.</div>`;
}
function listRow(title,sub,extra=""){return `<div class="row"><div class="row-main"><b>${esc(title)}</b><small>${esc(sub)}</small></div>${extra}</div>`;}
function renderHistory(){
 $("#my-balance").textContent=money(profile?.balance)+" P";
 $("#my-orders").innerHTML=ownOrders.length?ownOrders.map(o=>listRow(o.productName, `${localDate(o.createdAt)} · ${money(o.price)} P`,`<span class="status ${esc(o.status)}">${esc(statusName[o.status]||o.status)}</span>`)).join(""):'<div class="empty">아직 교환 내역이 없어요.</div>';
 $("#my-ledger").innerHTML=ledger.length?ledger.map(x=>listRow(x.note,localDate(x.createdAt),`<strong class="${x.amount>=0?"positive":"negative"}">${x.amount>0?"+":""}${money(x.amount)} P</strong>`)).join(""):'<div class="empty">아직 적립·사용 기록이 없어요.</div>';
}
function renderAdmin(){
 if(!isAdmin())return;
 $("#student-count").textContent=students.length+"명";
 $("#pending-count").textContent=orders.filter(o=>o.status==="approved").length+"건";
 $("#product-count").textContent=products.length+"개";
 $("#admin-orders").innerHTML=orders.length?orders.map(o=>listRow(o.productName,`${o.studentName||"학생"} · ${money(o.price)} P · ${localDate(o.createdAt)}`,`<div class="row-actions"><span class="status ${esc(o.status)}">${esc(statusName[o.status]||o.status)}</span>${o.status==="approved"?`<button class="approve" data-status="collected" data-id="${esc(o.id)}">수령 완료</button>`:""}</div>`)).join(""):'<div class="empty">교환 내역이 없어요.</div>';
 $("#student-select").innerHTML='<option value="">학생 선택</option>'+students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.username)}) · ${money(s.balance)}P</option>`).join("");
 $("#student-list").innerHTML=students.length?students.map(s=>listRow(s.name,`${s.username} · ${money(s.balance)} P`)).join(""):'<div class="empty">학생을 등록해주세요.</div>';
 $("#admin-product-list").innerHTML=products.length?products.map(p=>listRow(`${p.emoji} ${p.name}`,`${money(p.price)}P · 재고 ${p.stock}개 · ${p.active?"공개":"숨김"}`,`<div class="row-actions"><button class="subtle" data-edit="${esc(p.id)}">수정</button><button class="subtle danger" data-delete="${esc(p.id)}">삭제</button></div>`)).join(""):'<div class="empty">상품을 등록해주세요.</div>';
}
async function loadStore(){
 if(!configured){products=demo;renderProducts();return;}
 const snap=await getDocs(isAdmin()?collection(db,"products"):query(collection(db,"products"),where("active","==",true)));
 products=snap.docs.map(d=>({id:d.id,...d.data()}));renderProducts();
}
function watchLiveData(){
 if(stopProducts)stopProducts();
 if(stopProfile)stopProfile();
 stopProducts=null;stopProfile=null;
 if(!configured)return;
 stopProducts=onSnapshot(isAdmin()?collection(db,"products"):query(collection(db,"products"),where("active","==",true)),snap=>{
   products=snap.docs.map(d=>({id:d.id,...d.data()}));renderProducts();
 },e=>toast(messageFor(e)));
 if(currentUser&&profile){
   stopProfile=onSnapshot(doc(db,"users",currentUser.uid),snap=>{
     if(!snap.exists()||snap.data().active===false){signOut(auth).catch(()=>{});return;}
     profile=snap.data();renderHeader();renderHistory();
   },e=>toast(messageFor(e)));
 }
}
async function refreshMine(){
 if(!profile)return;
 const [o,l]=await Promise.all([getDocs(query(collection(db,"orders"),where("uid","==",currentUser.uid))),getDocs(query(collection(db,"ledger"),where("uid","==",currentUser.uid)))]);
 ownOrders=o.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 ledger=l.docs.map(d=>({id:d.id,...d.data()}));
 // 학생이 직접 교환한 내역은 주문에서 가져와 적립·사용 기록에도 표시합니다.
 const spent=ownOrders.filter(o=>["approved","collected"].includes(o.status)).map(o=>({id:"order_"+o.id,amount:-o.price,note:"선물 교환 · "+o.productName,createdAt:o.createdAt}));
 ledger=[...ledger,...spent].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));renderHistory();
}
async function refreshAdmin(){
 if(!isAdmin())return;
 const [u,o]=await Promise.all([getDocs(collection(db,"users")),getDocs(collection(db,"orders"))]);
 students=u.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.role==="student");
 orders=o.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));renderAdmin();
}
async function refreshAll(){
 await loadStore();if(profile){await refreshMine();if(isAdmin())await refreshAdmin();}
 renderHeader();
}
async function refreshProfile(){
 if(!currentUser){profile=null;renderHeader();return;}
 const snap=await getDoc(doc(db,"users",currentUser.uid));
 profile=snap.exists()?snap.data():null;
 if(!profile||profile.active===false){profile=null;await signOut(auth);toast("등록되지 않았거나 비활성화된 계정입니다.");}
 renderHeader();
}
async function safeTask(callback){try{await callback()}catch(e){toast(messageFor(e));}}
async function orderProduct(){
 if(!profile){$("#product-dialog").close();$("#login-dialog").showModal();return;}
 const p=chosenProduct;if(!p)return;
 if(!confirm(`${p.name} 선물을 ${p.price} 은총표로 교환할까요?`))return;
 const orderRef=doc(collection(db,"orders"));
 await runTransaction(db,async tx=>{
   const productRef=doc(db,"products",p.id),userRef=doc(db,"users",currentUser.uid);
   const [productSnap,userSnap]=await Promise.all([tx.get(productRef),tx.get(userRef)]);
   if(!productSnap.exists()||!productSnap.data().active)throw Error("판매 중인 상품이 아닙니다.");
   if(!userSnap.exists()||userSnap.data().active===false)throw Error("학생 계정을 확인해주세요.");
   const product=productSnap.data(),student=userSnap.data();
   if(product.stock<1)throw Error("방금 품절되었습니다. 다른 선물을 골라주세요.");
   if(student.balance<product.price)throw Error("은총표가 부족합니다.");
   tx.set(orderRef,{uid:currentUser.uid,studentName:student.name,productId:p.id,productName:product.name,price:product.price,status:"approved",createdAt:serverTimestamp()});
   tx.update(productRef,{stock:product.stock-1,lastOrderId:orderRef.id});
   tx.update(userRef,{balance:student.balance-product.price,lastOrderId:orderRef.id});
 });
 $("#product-dialog").close();toast("교환이 확정됐어요! 선물을 수령해주세요.");
 await refreshProfile();await loadStore();await refreshMine();show("history");
}
async function decideOrder(orderId,status){
 if(status!=="collected")throw Error("이미 교환된 상품은 수령 완료만 변경할 수 있습니다.");
 const ref=doc(db,"orders",orderId);
 await runTransaction(db,async(tx)=>{
  const orderSnap=await tx.get(ref);if(!orderSnap.exists())throw Error("신청을 찾을 수 없습니다.");
  const o=orderSnap.data();
  if(o.status!=="approved")throw Error("아직 수령 가능한 상태가 아닙니다.");
  tx.update(ref,{status:"collected",collectedAt:serverTimestamp()});
 });
 toast("처리되었습니다.");await refreshAdmin();await loadStore();await refreshMine();
}
async function addStudent(form){
 const username=field(form,"username").value.trim().toLowerCase(),password=field(form,"password").value,name=field(form,"name").value.trim();
 if(!/^[a-z0-9_]{4,20}$/.test(username))throw Error("아이디는 영문 소문자, 숫자, _ 로 4~20자 입력해주세요.");
 if(students.some(s=>s.username===username))throw Error("이미 등록된 아이디입니다.");
 const secondary=initializeApp(firebaseConfig,"student-creation-"+Date.now());
 const secondAuth=getAuth(secondary);let created=null;
 try{
  const credential=await createUserWithEmailAndPassword(secondAuth,emailOf(username),password);
  created=credential.user;
  await setDoc(doc(db,"users",created.uid),{name,username,role:"student",balance:0,active:true,createdAt:serverTimestamp()});
 }catch(e){if(created){try{await deleteUser(created)}catch{}}throw e;}
 finally{await signOut(secondAuth).catch(()=>{});await deleteApp(secondary);}
 form.reset();toast("학생 계정을 만들었습니다. 아이디와 초기 비밀번호를 전달해주세요.");await refreshAdmin();
}
async function changeBalance(form){
 const uid=field(form,"uid").value,amount=Number(field(form,"amount").value),note=field(form,"note").value.trim();
 if(!uid||!Number.isSafeInteger(amount)||amount===0||Math.abs(amount)>100000||!note)throw Error("학생, 수량, 사유를 확인해주세요.");
 const userRef=doc(db,"users",uid),entryRef=doc(collection(db,"ledger"));
 await runTransaction(db,async(tx)=>{const snap=await tx.get(userRef);if(!snap.exists())throw Error("학생을 찾을 수 없습니다.");const balance=snap.data().balance+amount;if(balance<0)throw Error("보유 은총표보다 많이 차감할 수 없습니다.");tx.update(userRef,{balance});tx.set(entryRef,{uid,amount,note,createdAt:serverTimestamp()});});
 toast("은총표가 변경되었습니다.");await refreshAdmin();
}
async function saveProduct(form){
 const data={name:field(form,"name").value.trim(),category:field(form,"category").value,imageUrl:field(form,"imageUrl").value.trim(),emoji:field(form,"emoji").value||"🎁",price:Number(field(form,"price").value),stock:Number(field(form,"stock").value),active:field(form,"active").checked};
 if(data.imageUrl&&!imagePath(data.imageUrl))throw Error("사진 경로는 images/파일명.jpg 또는 https:// 이미지 주소를 입력해주세요.");
 if(!data.name||!Number.isSafeInteger(data.price)||data.price<1||!Number.isSafeInteger(data.stock)||data.stock<0)throw Error("상품 정보를 확인해주세요.");
 const id=field(form,"id").value;if(id)await updateDoc(doc(db,"products",id),data);else await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});
 form.reset();field(form,"id").value="";toast("상품이 저장되었습니다.");await loadStore();await refreshAdmin();
}
async function removeProduct(productId){
 if(!isAdmin())throw Error("관리자만 상품을 삭제할 수 있습니다.");
 const product=products.find(p=>p.id===productId);
 if(!product)return;
 if(!confirm(`'${product.name}' 상품을 삭제할까요?\n이미 교환된 상품은 기록 보존을 위해 비공개로 전환됩니다.`))return;
 const linked=await getDocs(query(collection(db,"orders"),where("productId","==",productId)));
 if(linked.empty){
   await deleteDoc(doc(db,"products",productId));
   toast("상품이 삭제되었습니다.");
 }else{
   await updateDoc(doc(db,"products",productId),{active:false});
   toast("교환 기록이 있어 상품을 비공개로 전환했습니다.");
 }
 const form=$("#product-form");
 if(field(form,"id").value===productId){form.reset();field(form,"id").value="";}
 await loadStore();await refreshAdmin();
}
function bindEvents(){
 document.addEventListener("error",e=>{if(e.target.matches?.("img.product-photo"))e.target.replaceWith(document.createTextNode(e.target.dataset.emoji||"🎁"));},true);
 $$("[data-view]").forEach(button=>button.addEventListener("click",()=>show(button.dataset.view)));
 $("#login-btn").onclick=()=>$("#login-dialog").showModal();
 $("#logout-btn").onclick=()=>safeTask(async()=>{await signOut(auth);show("shop");toast("로그아웃했습니다.")});
 $$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());
 $("#login-form").onsubmit=(e)=>{e.preventDefault();safeTask(async()=>{if(!configured)throw Error("현재 로그인을 사용할 수 없습니다.");const f=e.currentTarget;const uname=field(f,"username").value.trim().toLowerCase();const email=uname.includes("@")?uname:emailOf(uname);await signInWithEmailAndPassword(auth,email,field(f,"password").value);$("#login-dialog").close();f.reset();toast("로그인했습니다.")})};
 $("#categories").onclick=(e)=>{const btn=e.target.closest("[data-category]");if(btn){category=btn.dataset.category;renderProducts();}};
 $("#product-grid").onclick=(e)=>{const btn=e.target.closest("[data-order]");if(!btn)return;chosenProduct=products.find(p=>p.id===btn.dataset.order);if(!chosenProduct)return;$("#detail-emoji").innerHTML=photoHtml(chosenProduct);$("#detail-name").textContent=chosenProduct.name;$("#detail-meta").textContent=`${money(chosenProduct.price)} 은총표 · 재고 ${chosenProduct.stock}개`;$("#product-dialog").showModal();};
 $("#request-order").onclick=()=>safeTask(orderProduct);
 $$("[data-admin-tab]").forEach(b=>b.onclick=()=>{adminTab=b.dataset.adminTab;$$(".admin-tab").forEach(p=>p.classList.toggle("hidden",p.id!=="admin-"+adminTab));$$("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x===b));});
 $("#create-student").onsubmit=(e)=>{e.preventDefault();safeTask(()=>addStudent(e.currentTarget))};
 $("#change-balance").onsubmit=(e)=>{e.preventDefault();safeTask(()=>changeBalance(e.currentTarget))};
 $("#product-form").onsubmit=(e)=>{e.preventDefault();safeTask(()=>saveProduct(e.currentTarget))};
 $("#admin-product-list").onclick=(e)=>{const del=e.target.closest("[data-delete]");if(del){safeTask(()=>removeProduct(del.dataset.delete));return;}const b=e.target.closest("[data-edit]");if(!b)return;const p=products.find(x=>x.id===b.dataset.edit);if(!p)return;const f=$("#product-form");for(const key of ["id","name","category","emoji","price","stock","imageUrl"])field(f,key).value=p[key]??"";field(f,"active").checked=p.active;window.scrollTo({top:0,behavior:"smooth"});};
 $("#admin-orders").onclick=(e)=>{const b=e.target.closest("[data-status]");if(b)safeTask(()=>decideOrder(b.dataset.id,b.dataset.status));};
}
bindEvents();
renderHeader();
if(!configured){products=demo;renderProducts();}
else{
 app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
 onAuthStateChanged(auth,async(user)=>{currentUser=user;try{await refreshProfile();await refreshAll();watchLiveData();if(!profile)show("shop")}catch(e){toast(messageFor(e));}});
}
