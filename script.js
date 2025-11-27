// ===== App State / Elements =====
let isLoggedIn=false,currentUser=null,pendingLoginUser=null,twoFACode=null,userEmail=null;
const loginBtn=document.getElementById('loginBtn'),registerBtn=document.getElementById('registerBtn'),heroPlayBtn=document.getElementById('hero-play-btn');
const loginModal=document.getElementById('loginModal'),registerModal=document.getElementById('registerModal'),twofaModal=document.getElementById('twofaModal');
const authButtons=document.getElementById('auth-buttons'),userDashboard=document.getElementById('user-dashboard'),userMenuBtn=document.getElementById('user-menu-btn'),userMenu=document.getElementById('user-menu');
const logoutBtn=document.getElementById('logoutBtn'),profileBtn=document.getElementById('profileBtn');
const nameBtn=document.getElementById('nameBtn');
const notification=document.getElementById('notification'),twofaCodeHint=document.getElementById('twofaCodeHint'),userBalanceAmount=document.getElementById('user-balance-amount');

// Validation flags
let isEmailValid=false,isPasswordValid=false,isUsernameValid=false,doPasswordsMatch=false;

// ===== Storage: Users =====
function initializeUsers(){ if(!localStorage.getItem('casinoUsers')) localStorage.setItem('casinoUsers', JSON.stringify([])); }
function getUsers(){ return JSON.parse(localStorage.getItem('casinoUsers')||'[]'); }
function saveUser(user){ const users=getUsers(); users.push(user); localStorage.setItem('casinoUsers', JSON.stringify(users)); }
function findUser(identifier){ return getUsers().find(u=>u.email===identifier||u.username===identifier); }
function usernameExists(username){ return getUsers().some(u=>u.username===username); }
function emailExists(email){ return getUsers().some(u=>u.email===email); }

// persist balance/session for currentUser
function persistCurrentUser(){
  if(!currentUser) return;
  const users=getUsers(); const idx=users.findIndex(u=>u.email===currentUser.email);
  if(idx>-1){ users[idx]={...users[idx], balance: currentUser.balance}; localStorage.setItem('casinoUsers', JSON.stringify(users)); }
  const saved=JSON.parse(localStorage.getItem('currentUser')||'{}'); const sessionExpiry=saved.sessionExpiry || (Date.now()+7*24*60*60*1000);
  localStorage.setItem('currentUser', JSON.stringify({...currentUser, sessionExpiry}));
  userBalanceAmount.textContent=`CHF${(currentUser.balance||0).toFixed(2)}`;
}

// ===== UI helpers =====
function showSection(id){ 
  document.querySelectorAll('.page-section').forEach(s=>s.style.display='none'); 
  document.getElementById(id+'-section').style.display='block'; 
  window.scrollTo(0,0);
  
  // Navigation aktualisieren
  updateNavIndicator(id);
}

function updateNavIndicator(currentSection) {
  const navItems = document.querySelectorAll('nav ul li a');
  navItems.forEach(item => {
    item.classList.remove('active');
  });
  
  // Je nach aktueller Sektion den entsprechenden Nav-Punkt markieren
  if (currentSection === 'games' || currentSection === 'slots' || currentSection === 'blackjack' || currentSection === 'roulette' || currentSection === 'plinko') {
    document.getElementById('nav-games').classList.add('active');
  } else if (currentSection === 'home') {
    document.getElementById('nav-home').classList.add('active');
  }
}

function showNotification(message,isError=false){ const n=notification; n.textContent=message; n.classList.remove('error'); if(isError) n.classList.add('error'); n.classList.add('show'); setTimeout(()=>n.classList.remove('show'),3000); }
function validateEmail(email){ const re=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; return re.test(String(email).toLowerCase()); }
function validatePassword(p){ return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s]).{8,}$/.test(p); }
function calculatePasswordStrength(p){ let s=0; if(p.length>=8)s+=20;if(/[a-z]/.test(p))s+=20;if(/[A-Z]/.test(p))s+=20;if(/[0-9]/.test(p))s+=20;if(/[^a-zA-Z\d\s]/.test(p))s+=20;return s; }
function updatePasswordStrength(p){ const w=calculatePasswordStrength(p); const bar=document.getElementById('passwordStrengthBar'); bar.style.width=`${w}%`; bar.style.background=w<40?'#e74c3c':(w<80?'#f39c12':'#2ecc71'); }
function resetFormValidation(){ isEmailValid=false;isPasswordValid=false;isUsernameValid=false;doPasswordsMatch=false; document.getElementById('registerSubmit').disabled=true; document.querySelectorAll('.error-message').forEach(el=>el.style.display='none'); document.getElementById('passwordStrengthBar').style.width='0%'; }

// ===== AVATAR MANAGEMENT =====
function updateUserAvatar() {
  if (!currentUser) return;
  
  const userAvatarBtn = document.getElementById('user-menu-btn');
  const savedAvatar = localStorage.getItem(`userAvatar_${currentUser.email}`);
  
  if (savedAvatar) {
    // Replace icon with actual avatar image
    userAvatarBtn.innerHTML = `<img src="${savedAvatar}" alt="Profilbild" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  } else {
    // Show default icon if no avatar
    userAvatarBtn.innerHTML = '<i class="fas fa-user"></i>';
  }
}

function updateUIForLogin(user){
  isLoggedIn=true; currentUser=user; authButtons.style.display='none'; userDashboard.style.display='flex';
  document.getElementById('hero-play-btn').textContent='Jetzt spielen'; userBalanceAmount.textContent=`CHF${(user.balance||0).toFixed(2)}`;
  
  // Load and set avatar
  updateUserAvatar();
  
  const sessionExpiry=Date.now()+7*24*60*60*1000; localStorage.setItem('currentUser', JSON.stringify({...user, sessionExpiry}));
}

function updateUIForLogout(showMsg=true){
  if(showMsg) showNotification('Du wurdest abgemeldet.');
  isLoggedIn=false; currentUser=null; pendingLoginUser=null; authButtons.style.display='flex'; userDashboard.style.display='none';
  document.getElementById('hero-play-btn').textContent='Jetzt spielen'; userMenu.classList.remove('show'); localStorage.removeItem('currentUser');
  resetBlackjackUI(true);
}

function checkSessionOnLoad(){
  const saved=localStorage.getItem('currentUser'); if(!saved) return;
  const obj=JSON.parse(saved);
  if(!obj.sessionExpiry||Date.now()>obj.sessionExpiry){ updateUIForLogout(false); showNotification('Sitzung abgelaufen. Bitte melde dich erneut an.', true); }
  else{ updateUIForLogin(obj); }
}

// ===== 2FA =====
function generate2FACode(){ return Math.floor(100000+Math.random()*900000).toString(); }
function send2FACode(email){ twoFACode=generate2FACode(); userEmail=email; twofaCodeHint.textContent=`Testcode: ${twoFACode} (In echter App per E-Mail)`; showNotification(`Bestätigungscode wurde an ${email} gesendet`); }
function resend2FACode(){ if(userEmail){ send2FACode(userEmail); showNotification('Neuer Code wurde gesendet'); } }

// ===== App init / events =====
document.addEventListener('DOMContentLoaded',()=>{
  initializeUsers(); checkSessionOnLoad();

  // login inputs
  document.getElementById('loginEmail').addEventListener('blur',function(){ document.getElementById('loginEmailError').style.display=this.value.length===0?'block':'none'; });
  document.getElementById('loginPassword').addEventListener('blur',function(){ document.getElementById('loginPasswordError').style.display=this.value.length===0?'block':'none'; });

  // register inputs
  document.getElementById('registerUsername').addEventListener('input',function(){
    const err=document.getElementById('usernameError'); isUsernameValid=this.value.length>=3;
    if(usernameExists(this.value)){ err.textContent='Dieser Benutzername ist bereits vergeben'; err.style.display='block'; isUsernameValid=false; }
    else{ err.textContent='Benutzername muss mindestens 3 Zeichen lang sein'; err.style.display=(!isUsernameValid&&this.value.length>0)?'block':'none'; }
    validateRegisterForm();
  });
  document.getElementById('registerEmail').addEventListener('input',function(){
    const err=document.getElementById('emailError'); isEmailValid=validateEmail(this.value);
    if(emailExists(this.value)){ err.textContent='Diese E-Mail-Adresse ist bereits registriert'; err.style.display='block'; isEmailValid=false; }
    else{ err.textContent='Bitte gib eine gültige E-Mail-Adresse ein'; err.style.display=(!isEmailValid&&this.value.length>0)?'block':'none'; }
    validateRegisterForm();
  });
  document.getElementById('registerPassword').addEventListener('input',function(){
    const err=document.getElementById('passwordError'); isPasswordValid=validatePassword(this.value); updatePasswordStrength(this.value);
    err.style.display=(!isPasswordValid&&this.value.length>0)?'block':'none';
    const c=document.getElementById('registerConfirmPassword').value; if(c.length>0){ doPasswordsMatch=this.value===c; document.getElementById('confirmPasswordError').style.display=doPasswordsMatch?'none':'block'; }
    validateRegisterForm();
  });
  document.getElementById('registerConfirmPassword').addEventListener('input',function(){
    const p=document.getElementById('registerPassword').value; const err=document.getElementById('confirmPasswordError'); doPasswordsMatch=this.value===p; err.style.display=(!doPasswordsMatch&&this.value.length>0)?'block':'none'; validateRegisterForm();
  });

  document.getElementById('twofaCode').addEventListener('input',function(){ const e=document.getElementById('twofaError'); const ok=/^\d{6}$/.test(this.value); e.style.display=(!ok&&this.value.length>0)?'block':'none'; });

  // contact
  const contactForm=document.getElementById('contactForm'),contactSubmitBtn=document.getElementById('contactSubmitBtn');
  if(contactForm){ contactForm.addEventListener('submit',async function(e){
    e.preventDefault(); const name=document.getElementById('contactName').value.trim(),email=document.getElementById('contactEmail').value.trim(),subject=document.getElementById('contactSubject').value.trim(),message=document.getElementById('contactMessage').value.trim();
    if(!name||!email||!subject||!message){ showNotification('Bitte füllen Sie alle Felder aus',true); return; } if(!validateEmail(email)){ showNotification('Bitte geben Sie eine gültige E-Mail-Adresse ein',true); return; }
    showNotification('Nachricht wird gesendet...'); contactSubmitBtn.disabled=true;
    try{ const fd=new FormData(contactForm); fd.set('_subject',subject?`Kontakt: ${subject}`:'Neue Nachricht über JeeBet'); const resp=await fetch(contactForm.action,{method:'POST',body:fd,headers:{'Accept':'application/json'}}); if(resp.ok){ showNotification('Ihre Nachricht wurde erfolgreich gesendet!'); contactForm.reset(); } else { const data=await resp.json().catch(()=>({})); const msg=data?.errors?.map(e=>e.message).join(', ')||resp.statusText; showNotification('Senden fehlgeschlagen: '+msg,true); } }
    catch{ showNotification('Netzwerkfehler beim Senden',true); }
    finally{ contactSubmitBtn.disabled=false; }
  });}
});

function validateRegisterForm(){ const btn=document.getElementById('registerSubmit'); btn.disabled=!(isEmailValid&&isPasswordValid&&isUsernameValid&&doPasswordsMatch); }

// open/close modals
function switchToRegister(){ loginModal.style.display='none'; registerModal.style.display='flex'; resetFormValidation(); }
function switchToLogin(){ registerModal.style.display='none'; twofaModal.style.display='none'; loginModal.style.display='flex'; resetFormValidation(); }
loginBtn.addEventListener('click',()=>{ loginModal.style.display='flex'; resetFormValidation(); });
registerBtn.addEventListener('click',()=>{ registerModal.style.display='flex'; resetFormValidation(); });
heroPlayBtn.addEventListener('click',()=>{ if(isLoggedIn){ playGame('Willkommensspiel'); } else { registerModal.style.display='flex'; }});
document.querySelectorAll('.close-modal').forEach(btn=>btn.addEventListener('click',()=>{ loginModal.style.display='none'; registerModal.style.display='none'; twofaModal.style.display='none'; document.getElementById('bjContinueModal').style.display='none'; resetFormValidation(); }));
window.addEventListener('click',(e)=>{ if(e.target===loginModal){ loginModal.style.display='none'; resetFormValidation(); } if(e.target===registerModal){ registerModal.style.display='none'; resetFormValidation(); } if(e.target===twofaModal){ twofaModal.style.display='none'; } if(e.target===document.getElementById('bjContinueModal')){ document.getElementById('bjContinueModal').style.display='none'; } if(!userDashboard.contains(e.target)) userMenu.classList.remove('show'); });

// user menu
userMenuBtn.addEventListener('click',()=>{ if(!isLoggedIn){ showNotification('Bitte zuerst anmelden.',true); return; } userMenu.classList.toggle('show'); });
logoutBtn.addEventListener('click',()=>{ updateUIForLogout(true); });
profileBtn.addEventListener('click',()=>{ userMenu.classList.remove('show'); openAccountPanel(); });

// ===== USER HERO SECTION =====
const userHero = document.getElementById('userHero');
const userHeroName = document.getElementById('userHeroName');
const userHeroAvatar = document.getElementById('userHeroAvatar');
const closeHeroBtn = document.getElementById('closeHeroBtn');
const changeAvatarBtn = document.getElementById('changeAvatarBtn');
const avatarUpload = document.getElementById('avatarUpload');

// Replace the nameBtn event listener
nameBtn.addEventListener('click', () => { 
  userMenu.classList.remove('show'); 
  showUserHero();
});

// Show user hero section
function showUserHero() {
  if (!currentUser) return;
  
  // Set username
  userHeroName.textContent = currentUser.username || currentUser.email || 'Spieler';
  
  // Set avatar (load from localStorage or use default)
  const savedAvatar = localStorage.getItem(`userAvatar_${currentUser.email}`);
  if (savedAvatar) {
    userHeroAvatar.src = savedAvatar;
  } else {
    // Create initial avatar with first letter and gradient background
    const initial = currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'S';
    userHeroAvatar.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23ff5533;stop-opacity:1" /><stop offset="100%" style="stop-color:%23ff8c42;stop-opacity:1" /></linearGradient></defs><rect width="100%" height="100%" fill="url(%23grad)"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="48" font-weight="bold" fill="white">${initial}</text></svg>`;
  }
  
  userHero.style.display = 'flex';
}

// Close hero section
closeHeroBtn.addEventListener('click', () => {
  userHero.style.display = 'none';
});

// Change avatar functionality
changeAvatarBtn.addEventListener('click', () => {
  avatarUpload.click();
});

avatarUpload.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      userHeroAvatar.src = e.target.result;
      
      // Save to localStorage
      if (currentUser) {
        localStorage.setItem(`userAvatar_${currentUser.email}`, e.target.result);
        
        // Update avatar in account panel
        const accAvatar = document.getElementById('accAvatar');
        if (accAvatar) {
          accAvatar.innerHTML = `<img src="${e.target.result}" alt="Profilbild" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        }
        
        // Update small avatar in header
        updateUserAvatar();
      }
      
      showNotification('Profilbild erfolgreich aktualisiert!');
    };
    reader.readAsDataURL(file);
  }
});

// Close hero when clicking outside content
userHero.addEventListener('click', (e) => {
  if (e.target === userHero) {
    userHero.style.display = 'none';
  }
});

// Close with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && userHero.style.display === 'flex') {
    userHero.style.display = 'none';
  }
});

// ===== ACCOUNT PANEL =====
const accountRoot   = document.getElementById('accountRoot');
const accountOverlay= document.getElementById('accountOverlay');
const accountClose  = document.getElementById('accountCloseBtn');
const accUserNameEl = document.getElementById('accUserName');
const accAvatarEl   = document.getElementById('accAvatar');
const accBalanceEl  = document.getElementById('accBalance');
const accBalanceBig = document.getElementById('accBalanceBig');

function openAccountPanel(){
  if(!isLoggedIn){ showNotification('Bitte zuerst anmelden.', true); loginModal.style.display='flex'; return; }
  
  const name = currentUser?.username || currentUser?.email || 'Spieler';
  accUserNameEl.textContent = name;
  
  // Load avatar for account panel
  const savedAvatar = localStorage.getItem(`userAvatar_${currentUser.email}`);
  if (savedAvatar) {
    accAvatarEl.innerHTML = `<img src="${savedAvatar}" alt="Profilbild" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  } else {
    accAvatarEl.textContent = name.slice(0,1).toUpperCase();
    accAvatarEl.style.background = 'var(--gradient)';
    accAvatarEl.style.color = '#111';
    accAvatarEl.style.display = 'flex';
    accAvatarEl.style.alignItems = 'center';
    accAvatarEl.style.justifyContent = 'center';
    accAvatarEl.style.fontWeight = 'bold';
  }
  
  const bal = `CHF${(currentUser?.balance||0).toFixed(2)}`;
  accBalanceEl.textContent = bal;
  accBalanceBig.textContent = bal;

  setActiveAccTab('overview');
  accountRoot.hidden = false;
  document.addEventListener('keydown', escCloseAcc, { once: true });
}

function closeAccountPanel(){ accountRoot.hidden = true; }
function escCloseAcc(e){ if(e.key==='Escape') closeAccountPanel(); }

accountOverlay.addEventListener('click', closeAccountPanel);
accountClose  .addEventListener('click', closeAccountPanel);

// Tab-Steuerung
function setActiveAccTab(key){
  document.querySelectorAll('.acc-tabs [role="tab"]').forEach(btn=>{
    const isActive = btn.dataset.accTab===key;
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('.acc-tab').forEach(panel=>{
    panel.hidden = panel.dataset.accPanel !== key;
  });
}

// Klicks auf Tabs
document.querySelectorAll('.acc-tabs [role="tab"]').forEach(btn=>{
  btn.addEventListener('click', ()=> setActiveAccTab(btn.dataset.accTab));
});

// „Alle anzeigen" → Transaktionen
document.querySelectorAll('[data-acc-switch="transactions"]').forEach(el=>{
  el.addEventListener('click', ()=> setActiveAccTab('transactions'));
});

// generic play/claim
function playGame(name){ if(isLoggedIn){ showNotification(`${name} wird gestartet...`); } else { showNotification('Bitte melde dich zuerst an, um zu spielen', true); loginModal.style.display='flex'; } }
function claimBonus(name){ if(isLoggedIn){ showNotification(`${name} wurde deinem Konto gutgeschrieben`); } else { showNotification('Bitte melde dich zuerst an, um Boni zu beanspruchen', true); loginModal.style.display='flex'; } }

// auth flows
document.getElementById('loginForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  const id=document.getElementById('loginEmail').value.trim(), pw=document.getElementById('loginPassword').value;
  if(!id){ showNotification('Bitte gib deinen Benutzernamen oder E-Mail ein',true); return; }
  if(!pw){ showNotification('Bitte gib dein Passwort ein',true); return; }
  const user=findUser(id); if(!user){ showNotification('Benutzer nicht gefunden',true); return; }
  if(user.password!==pw){ showNotification('Ungültiges Passwort',true); return; }
  pendingLoginUser=user; loginModal.style.display='none'; send2FACode(user.email); twofaModal.style.display='flex';
});

document.getElementById('registerForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  if(!isEmailValid||!isPasswordValid||!isUsernameValid||!doPasswordsMatch){ showNotification('Bitte überprüfe deine Eingaben',true); return; }
  const username=document.getElementById('registerUsername').value.trim(), email=document.getElementById('registerEmail').value.trim(), password=document.getElementById('registerPassword').value;
  const newUser={username,email,password,balance:100.00,createdAt:new Date().toISOString()};
  saveUser(newUser); showNotification('Registrierung erfolgreich! Du kannst dich jetzt anmelden.'); registerModal.style.display='none'; document.getElementById('registerForm').reset(); resetFormValidation();
});

document.getElementById('twofaForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  const code=document.getElementById('twofaCode').value;
  if(!/^\d{6}$/.test(code)){ showNotification('Bitte gib einen gültigen 6-stelligen Code ein',true); return; }
  if(code!==twoFACode){ showNotification('Ungültiger Bestätigungscode',true); return; }
  if(pendingLoginUser){ twofaModal.style.display='none'; updateUIForLogin(pendingLoginUser); showNotification('Anmeldung erfolgreich!'); pendingLoginUser=null; }
});

setInterval(()=>{ const saved=localStorage.getItem('currentUser'); if(!saved) return; const obj=JSON.parse(saved); if(!obj.sessionExpiry||Date.now()>obj.sessionExpiry){ updateUIForLogout(false); showNotification('Sitzung abgelaufen. Bitte melde dich erneut an.', true); } }, 15*60*1000);

// ===== BLACKJACK =====
let shoe=[], playerHand=[], dealerHand=[], roundActive=false, hiddenDealerCard=null, currentBet=0;
const bjBet=document.getElementById('bjBet'), bjStart=document.getElementById('bjStart'), bjHit=document.getElementById('bjHit'), bjStand=document.getElementById('bjStand'), bjDouble=document.getElementById('bjDouble');
const dealerCardsEl=document.getElementById('dealerCards'), playerCardsEl=document.getElementById('playerCards'), dealerScoreEl=document.getElementById('dealerScore'), playerScoreEl=document.getElementById('playerScore'), bjResultEl=document.getElementById('bjResult'), bjBalanceInfo=document.getElementById('bjBalanceInfo'), bjShoeInfo=document.getElementById('bjShoeInfo');
const bjContinueModal=document.getElementById('bjContinueModal'), bjYes=document.getElementById('bjYes'), bjNo=document.getElementById('bjNo'), bjRoundSummary=document.getElementById('bjRoundSummary');

function openBlackjack(){
  if (!isLoggedIn) {
    showNotification('Bitte melde dich an, um Black Jack zu spielen.', true);
    loginModal.style.display = 'flex';
    return;
  }
  showSection('blackjack');
  updateBjBalanceInfo();
  if (shoe.length === 0) buildAndShuffleShoe();
  bjShoeInfo.textContent = `Karten im Shoe: ${shoe.length}`;
}

function buildAndShuffleShoe(){
  const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'], suits=['♠','♥','♦','♣'];
  shoe=[];
  for(let d=0; d<6; d++){ for(const r of ranks){ for(const s of suits){ shoe.push({r,s}); } } }
  for(let i=shoe.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shoe[i],shoe[j]]=[shoe[j],shoe[i]]; }
  showNotification('Neuer Shoe gemischt.');
}

function cardValue(card){ if(card.r==='A') return 11; if(['K','Q','J','10'].includes(card.r)) return 10; return parseInt(card.r,10); }
function handValue(hand){ let total=0, aces=0; for(const c of hand){ total+=cardValue(c); if(c.r==='A') aces++; } while(total>21 && aces>0){ total-=10; aces--; } return total; }
function renderCard(card, hidden=false){ const div=document.createElement('div'); div.className='card'+((card.s==='♥'||card.s==='♦')?' red':''); if(hidden) div.classList.add('hidden-card'); div.textContent=hidden?'??':(`${card.r}${card.s}`); return div; }
function renderHands(showDealerHole=false){
  dealerCardsEl.innerHTML=''; playerCardsEl.innerHTML='';
  dealerHand.forEach((c,i)=>dealerCardsEl.appendChild(renderCard(c, i===1 && !showDealerHole && hiddenDealerCard)));
  playerHand.forEach(c=>playerCardsEl.appendChild(renderCard(c,false)));
  playerScoreEl.textContent=`(${handValue(playerHand)})`;
  dealerScoreEl.textContent= showDealerHole ? `(${handValue(dealerHand)})` : '(?)';
}
function dealCard(target){ if(shoe.length===0) buildAndShuffleShoe(); return target.push(shoe.pop()); }
function resetBlackjackUI(clear=false){
  playerHand=[]; dealerHand=[]; hiddenDealerCard=false; bjResultEl.textContent=''; dealerCardsEl.innerHTML=''; playerCardsEl.innerHTML='';
  bjHit.disabled=true; bjStand.disabled=true; bjDouble.disabled=true; roundActive=false;
  if(clear) currentBet=0;
  bjShoeInfo.textContent=`Karten im Shoe: ${shoe.length}`;
}
function updateBjBalanceInfo(){ bjBalanceInfo.textContent = currentUser ? `Kontostand: CHF${(currentUser.balance||0).toFixed(2)}` : ''; }

function startRound(){
  if(!isLoggedIn){ showNotification('Bitte zuerst anmelden',true); return; }
  const bet = parseInt(bjBet.value,10) || 0;
  if(bet<=0){ showNotification('Bitte einen Einsatz > 0 setzen',true); return; }
  if(currentUser.balance < bet){ showNotification('Nicht genügend Guthaben',true); return; }

  if(shoe.length<52){ buildAndShuffleShoe(); }

  resetBlackjackUI();
  currentBet = bet;
  currentUser.balance -= bet; persistCurrentUser(); updateBjBalanceInfo();

  dealCard(playerHand); dealCard(dealerHand);
  dealCard(playerHand); dealCard(dealerHand); hiddenDealerCard=true;
  renderHands(false);

  const p=handValue(playerHand), d=handValue(dealerHand);
  if(p===21 && d!==21){ finishRound('blackjack'); return; }
  roundActive=true; bjHit.disabled=false; bjStand.disabled=false; bjDouble.disabled=(currentUser.balance<bet);
  bjShoeInfo.textContent=`Karten im Shoe: ${shoe.length}`;
}

function playerHit(){
  if(!roundActive) return;
  bjDouble.disabled = true;
  dealCard(playerHand);
  renderHands(false);
  const v = handValue(playerHand);
  if(v>21){ finishRound('player_bust'); }
}

function playerStand(){
  if(!roundActive) return;
  roundActive=false; bjHit.disabled=true; bjStand.disabled=true; bjDouble.disabled=true;
  hiddenDealerCard=false; renderHands(true);
  while(handValue(dealerHand) < 17){ dealCard(dealerHand); renderHands(true); }
  const pv=handValue(playerHand), dv=handValue(dealerHand);
  if(dv>21) finishRound('dealer_bust');
  else if(pv>dv) finishRound('player_win');
  else if(pv<dv) finishRound('dealer_win');
  else finishRound('push');
}

function playerDouble(){
  if(!roundActive) return;
  if(currentUser.balance < currentBet){ showNotification('Zu wenig Guthaben zum Verdoppeln', true); return; }
  currentUser.balance -= currentBet; persistCurrentUser(); updateBjBalanceInfo();
  currentBet *= 2;
  dealCard(playerHand); renderHands(false);
  if(handValue(playerHand)>21){ finishRound('player_bust'); } else { playerStand(); }
}

function finishRound(outcome){
  roundActive=false; bjHit.disabled=true; bjStand.disabled=true; bjDouble.disabled=true; hiddenDealerCard=false; renderHands(true);
  let text=''; let delta=0;
  switch(outcome){
    case 'blackjack': delta=Math.floor(currentBet*1.5)+currentBet; text=`Blackjack! Du gewinnst CHF${(currentBet*1.5).toFixed(2)} (+Einsatz).`; break;
    case 'player_bust': delta=0; text='Überkauft! Du verlierst deinen Einsatz.'; break;
    case 'dealer_bust': delta=currentBet*2; text='Dealer überkauft! Du gewinnst.'; break;
    case 'player_win':  delta=currentBet*2; text='Du gewinnst!'; break;
    case 'dealer_win':  delta=0; text='Dealer gewinnt.'; break;
    case 'push':        delta=currentBet; text='Unentschieden (Push) – Einsatz zurück.'; break;
  }
  if(delta>0){ currentUser.balance += delta; persistCurrentUser(); updateBjBalanceInfo(); }
  bjResultEl.textContent=text;
  bjShoeInfo.textContent=`Karten im Shoe: ${shoe.length}`;
  bjRoundSummary.textContent = `Ergebnis: ${text}   |   Kontostand: CHF${currentUser.balance.toFixed(2)}`;
  document.getElementById('bjContinueModal').style.display='flex';
}

// Buttons
document.getElementById('bjStart').addEventListener('click', startRound);
document.getElementById('bjHit').addEventListener('click', playerHit);
document.getElementById('bjStand').addEventListener('click', playerStand);
document.getElementById('bjDouble').addEventListener('click', playerDouble);
document.getElementById('bjYes').addEventListener('click',()=>{ document.getElementById('bjContinueModal').style.display='none'; resetBlackjackUI(); });
document.getElementById('bjNo').addEventListener('click',()=>{ document.getElementById('bjContinueModal').style.display='none'; showSection('games'); resetBlackjackUI(true); });

// ===== ROULETTE =====
let rouletteNumbers = [];
let rouletteInitDone = false;
let rouletteHistory = [];

const straightBets = new Map(); // number -> count
const outsideBets  = new Map(); // type   -> count

const rouletteWheel     = document.getElementById('rouletteWheel');
const rouletteBall      = document.getElementById('rouletteBall');
const rouletteSpinBtn   = document.getElementById('rouletteSpin');
const rouletteClearBtn  = document.getElementById('rouletteClear');
const rouletteResult    = document.getElementById('rouletteResult');
const rouletteHistoryEl = document.getElementById('rouletteHistory');
const rouletteBalanceInfo = document.getElementById('rouletteBalanceInfo');
const rouletteBetInput  = document.getElementById('rouletteBet');

function openRoulette(){
  if (!isLoggedIn) { showNotification('Bitte melde dich an, um Roulette zu spielen.', true); loginModal.style.display='flex'; return; }
  showSection('roulette');
  if (!rouletteInitDone) { initRoulette(); rouletteInitDone = true; }
  updateRouletteBalanceInfo();
  updateSpinButton();
}

function initRoulette(){
  // Farbliste exakt nach EU-Rad
  const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  rouletteNumbers = Array.from({length:37}, (_,i)=>({number:i, color: i===0 ? 'green' : (REDS.has(i)?'red':'black')}));
  createWheelNumbers();

  // Grid events (Mehrfach-Chips: LMB+1 / RMB-1)
  document.querySelectorAll('.roulette-table-numbers td[data-number]').forEach(cell=>{
    cell.addEventListener('click',     e=>{ e.preventDefault(); addStraight(cell); });
    cell.addEventListener('contextmenu',e=>{ e.preventDefault(); removeStraight(cell); });
  });

  // Outside bets (inkl. Dutzende)
  document.querySelectorAll('.roulette-bet-option').forEach(opt=>{
    opt.addEventListener('click',      e=>{ e.preventDefault(); addOutside(opt); });
    opt.addEventListener('contextmenu',e=>{ e.preventDefault(); removeOutside(opt); });
  });

  rouletteSpinBtn.addEventListener('click', spinRoulette);
  rouletteClearBtn.addEventListener('click', clearAllBets);
  rouletteBetInput.addEventListener('input', updateSpinButton);
}

function createWheelNumbers(){
  rouletteWheel.querySelectorAll('.roulette-number').forEach(n=>n.remove());
  const sequence = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const RADIUS = 130;
  const orbit  = RADIUS - 18; // Ball-Orbit
  sequence.forEach((num, i)=>{
    const d  = rouletteNumbers[num];
    const a  = (i/sequence.length)*360;
    const el = document.createElement('div');
    el.className = `roulette-number ${d.color}`;
    el.textContent = num;
    el.style.transform = `translate(-50%,-50%) rotate(${a}deg) translate(${RADIUS}px) rotate(-${a}deg)`;
    rouletteWheel.appendChild(el);
  });
  // Ball an Start-Orbit bringen
  rouletteBall.style.transform = `translate(-50%,-50%) rotate(0deg) translate(${orbit}px)`;
}

function addStraight(cell){
  const n = parseInt(cell.dataset.number,10);
  const c = (straightBets.get(n)||0)+1;
  straightBets.set(n,c);
  cell.classList.add('selected-bet');
  incBadge(cell);
  updateSpinButton();
}

function removeStraight(cell){
  const n = parseInt(cell.dataset.number,10);
  if(!straightBets.has(n)) return;
  const left = (straightBets.get(n)||0)-1;
  if(left<=0){ straightBets.delete(n); cell.classList.remove('selected-bet'); }
  decBadge(cell);
  updateSpinButton();
}

function addOutside(opt){
  const k = opt.dataset.bet;
  const c = (outsideBets.get(k)||0)+1;
  outsideBets.set(k,c);
  opt.classList.add('selected-bet');
  incBadge(opt);
  updateSpinButton();
}

function removeOutside(opt){
  const k = opt.dataset.bet;
  if(!outsideBets.has(k)) return;
  const left = (outsideBets.get(k)||0)-1;
  if(left<=0){ outsideBets.delete(k); opt.classList.remove('selected-bet'); }
  decBadge(opt);
  updateSpinButton();
}

function clearAllBets(){
  straightBets.clear(); outsideBets.clear();
  document.querySelectorAll('.chip-badge').forEach(b=>b.remove());
  document.querySelectorAll('.selected-bet').forEach(e=>e.classList.remove('selected-bet'));
  updateSpinButton();
}

function incBadge(el){
  let b = el.querySelector('.chip-badge');
  if(!b){ b=document.createElement('div'); b.className='chip-badge'; b.textContent='0'; el.appendChild(b); }
  b.textContent = String(parseInt(b.textContent,10)+1);
}

function decBadge(el){
  const b = el.querySelector('.chip-badge');
  if(!b) return;
  const next = parseInt(b.textContent,10)-1;
  if(next<=0) b.remove(); else b.textContent=String(next);
}

function updateRouletteBalanceInfo(){
  rouletteBalanceInfo.textContent = currentUser ? `Kontostand: CHF${(currentUser.balance||0).toFixed(2)}` : '';
}

function updateSpinButton(){
  const a = parseInt(rouletteBetInput.value)||0;
  const chips = [...straightBets.values(), ...outsideBets.values()].reduce((s,v)=>s+v,0);
  rouletteSpinBtn.disabled = !(a>0 && chips>0 && currentUser && currentUser.balance >= a*chips);
}

function spinRoulette(){
  const chipVal = parseInt(rouletteBetInput.value)||0;
  const chips   = [...straightBets.values(), ...outsideBets.values()].reduce((s,v)=>s+v,0);
  if(chipVal<=0 || chips===0){ showNotification('Bitte Einsatz & Wette wählen', true); return; }
  const totalBet = chipVal*chips;
  if(currentUser.balance < totalBet){ showNotification('Nicht genügend Guthaben', true); return; }

  currentUser.balance -= totalBet;
  persistCurrentUser(); updateRouletteBalanceInfo(); updateSpinButton();

  const sequence = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const segments = sequence.length;
  const idx      = Math.floor(Math.random()*segments);
  const winner   = sequence[idx];

  // Segment-Winkel
  const segAngle = 360/segments;
  const targetAngle = idx*segAngle;

  // Orbit für Ball
  const RADIUS = 130, orbit = RADIUS-18;

  // Anzahl Umdrehungen
  const wheelTurns = 6;   // Rad
  const ballTurns  = 14;  // Ball (gegenläufig)

  // Reset
  rouletteWheel.style.transition = 'none';
  rouletteBall .style.transition = 'none';
  rouletteWheel.style.transform  = 'rotate(0deg)';
  rouletteBall .style.transform  = `translate(-50%,-50%) rotate(0deg) translate(${orbit}px)`;

  // Nächstes Frame
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    // Übergangsdauer
    rouletteWheel.style.transition = 'transform 4s cubic-bezier(0.2,0.8,0.2,1)';
    rouletteBall .style.transition = 'transform 4s cubic-bezier(0.2,0.8,0.2,1)';

    // Rad dreht vorwärts
    const wheelEnd = 360*wheelTurns;
    rouletteWheel.style.transform = `rotate(${wheelEnd}deg)`;

    // Ball dreht schneller rückwärts + stoppt am Gewinner
    const ballEnd = -(360*ballTurns) - targetAngle;
    rouletteBall.style.transform = `translate(-50%,-50%) rotate(${ballEnd}deg) translate(${orbit}px)`;
  }));

  // Abrechnung nach der Animation
  setTimeout(()=>{ settleRoulette(winner, totalBet, chipVal); }, 4200);
}

function settleRoulette(winner, totalBet, chipVal){
  addToHistoryView(winner);

  let winnings = 0;

  // Straight 35:1 (36x inkl. Einsatz)
  straightBets.forEach((cnt, n)=>{ if(n===winner) winnings += cnt * chipVal * 36; });

  // Outside: 1:1 bzw. Dutzende 2:1
  outsideBets.forEach((cnt, type)=>{
    if(outsideWins(type, winner)){
      winnings += cnt * chipVal * (type.endsWith('12') ? 3 : 2);
    }
  });

  if(winnings>0){ currentUser.balance += winnings; persistCurrentUser(); updateRouletteBalanceInfo(); }

  const net = winnings - totalBet;
  let txt = `Zahl: ${winner} – `;
  if(net>0) txt += `Gewinn: CHF${net.toFixed(2)}`;
  else if(net<0) txt += `Verlust: CHF${Math.abs(net).toFixed(2)}`;
  else txt += 'Break-even';
  rouletteResult.textContent = txt;
  showNotification(txt);

  // Transitions zurücksetzen
  setTimeout(()=>{ rouletteWheel.style.transition='none'; rouletteBall.style.transition='none'; }, 250);

  // Einsätze bleiben liegen (wie am Tisch). Löschen: Button.
  updateSpinButton();
}

function outsideWins(type, n){
  if(n===0) return false;
  switch(type){
    case 'red':   return rouletteNumbers[n].color==='red';
    case 'black': return rouletteNumbers[n].color==='black';
    case 'even':  return n%2===0;
    case 'odd':   return n%2===1;
    case '1st12': return n>=1 && n<=12;
    case '2nd12': return n>=13 && n<=24;
    case '3rd12': return n>=25 && n<=36;
    default: return false;
  }
}

function addToHistoryView(n){
  rouletteHistory.unshift({number:n, color: rouletteNumbers[n].color});
  if(rouletteHistory.length>10) rouletteHistory.pop();
  rouletteHistoryEl.innerHTML='';
  rouletteHistory.forEach(item=>{
    const el=document.createElement('div');
    el.className=`roulette-history-item ${item.color}`;
    el.textContent=item.number;
    rouletteHistoryEl.appendChild(el);
  });
}

// ===== SLOTS =====
let slotsSpinning = false;
let slotsBalance = 1000;
let slotsWin = 0;
let slotsSymbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
let slotsPaytable = {
  '🍒🍒🍒': 10,
  '🍋🍋🍋': 20,
  '🍊🍊🍊': 30,
  '🍇🍇🍇': 40,
  '🔔🔔🔔': 50,
  '💎💎💎': 75,
  '7️⃣7️⃣7️⃣': 100
};

// Slots Game Funktionen
function openSlots() {
  if (!isLoggedIn) {
    showNotification('Bitte melde dich an, um die Slots zu spielen.', true);
    loginModal.style.display = 'flex';
    return;
  }
  // Alle Sektionen verstecken
  document.querySelectorAll('.page-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Slots-Sektion anzeigen
  document.getElementById('slots-section').style.display = 'block';
  
  // Navigation aktualisieren
  updateNavIndicator('Slots');
  
  // Benachrichtigung anzeigen
  showNotification('Diamond Casino Slots geladen');
  
  // Balance-Info aktualisieren
  updateSlotsBalanceInfo();
}

function updateSlotsBalanceInfo() {
  if (currentUser) {
    slotsBalance = currentUser.balance;
    document.getElementById('slotsBalanceInfo').textContent = `Kontostand: CHF${slotsBalance.toFixed(2)}`;
    document.getElementById('slotsCredits').textContent = Math.floor(slotsBalance);
  }
}

function spinSlots() {
  if (slotsSpinning) return;
  
  const bet = parseInt(document.getElementById('slotsBet').value) || 5;
  if (bet <= 0) {
    showNotification('Bitte einen Einsatz > 0 setzen', true);
    return;
  }
  
  if (slotsBalance < bet) {
    showNotification('Nicht genügend Guthaben', true);
    return;
  }
  
  // Einsatz abziehen
  slotsBalance -= bet;
  if (currentUser) {
    currentUser.balance = slotsBalance;
    persistCurrentUser();
  }
  updateSlotsBalanceInfo();
  
  // Spin-Animation starten
  slotsSpinning = true;
  document.getElementById('slotsSpin').disabled = true;
  
  const reels = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
  ];
  
  // Alle Walzen zum Spinnen bringen
  reels.forEach(reel => {
    reel.classList.add('spinning');
    reel.querySelectorAll('.symbol').forEach(sym => {
      sym.textContent = slotsSymbols[Math.floor(Math.random() * slotsSymbols.length)];
    });
  });
  
  // Nach unterschiedlicher Zeit anhalten (wie echte Slotmaschine)
  setTimeout(() => stopReel(reels[0], checkResult), 1000 + Math.random() * 500);
  setTimeout(() => stopReel(reels[1], checkResult), 1500 + Math.random() * 500);
  setTimeout(() => stopReel(reels[2], checkResult), 2000 + Math.random() * 500);
}

function stopReel(reel, callback) {
  reel.classList.remove('spinning');
  
  // Zufällige Symbole für die Anzeige setzen
  const symbols = reel.querySelectorAll('.symbol');
  symbols.forEach(sym => {
    sym.textContent = slotsSymbols[Math.floor(Math.random() * slotsSymbols.length)];
  });
  
  if (callback) callback();
}

function checkResult() {
  // Prüfen ob alle Walzen angehalten haben
  const spinningReels = document.querySelectorAll('.reel.spinning');
  if (spinningReels.length > 0) return;
  
  slotsSpinning = false;
  document.getElementById('slotsSpin').disabled = false;
  
  // Ergebnis auslesen
  const reels = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
  ];
  
  const middleRow = [];
  reels.forEach(reel => {
    const symbols = reel.querySelectorAll('.symbol');
    middleRow.push(symbols[1].textContent);
  });
  
  const result = middleRow.join('');
  
  // Gewinn berechnen
  let winMultiplier = 0;
  for (const [pattern, multiplier] of Object.entries(slotsPaytable)) {
    if (result === pattern) {
      winMultiplier = multiplier;
      break;
    }
  }
  
  const bet = parseInt(document.getElementById('slotsBet').value) || 5;
  const winAmount = winMultiplier * bet;
  
  if (winMultiplier > 0) {
    // Gewinnanimation
    highlightWin();
    
    // Gewinn auszahlen
    slotsBalance += winAmount;
    slotsWin = winAmount;
    
    if (currentUser) {
      currentUser.balance = slotsBalance;
      persistCurrentUser();
    }
    
    showNotification(`Gewonnen! ${result} = ${winMultiplier}x Einsatz!`);
  } else {
    slotsWin = 0;
    showNotification('Kein Gewinn. Versuchen Sie es erneut!');
  }
  
  updateSlotsBalanceInfo();
  document.getElementById('slotsWin').textContent = slotsWin;
}

function highlightWin() {
  const payline = document.createElement('div');
  payline.className = 'payline middle';
  document.querySelector('.slots-paylines').appendChild(payline);
  
  setTimeout(() => {
    payline.style.opacity = '1';
  }, 100);
  
  setTimeout(() => {
    payline.style.opacity = '0';
    setTimeout(() => {
      payline.remove();
  }, 1000);
  }, 2000);
}

function setMaxBet() {
  document.getElementById('slotsBet').value = Math.min(100, Math.floor(slotsBalance));
}

// Event-Listener für Slots
document.addEventListener('DOMContentLoaded', function() {
  const slotsSpinBtn = document.getElementById('slotsSpin');
  const slotsMaxBetBtn = document.getElementById('slotsMaxBet');
  
  if (slotsSpinBtn) {
    slotsSpinBtn.addEventListener('click', spinSlots);
  }
  
  if (slotsMaxBetBtn) {
    slotsMaxBetBtn.addEventListener('click', setMaxBet);
  }
});

// Globale Funktion für den Aufruf aus HTML
window.openSlots = openSlots;

// ===== PLINKO =====
let plinkoConfig = { rows: 12, difficulty: 'medium' }; // easy=8, medium=12, hard=16
let plinkoPegMap = [];         // Peg-Koordinaten pro Reihe
let plinkoSlotPayouts = [];    // Multiplikatoren je Slot (Array-Länge rows+1)
const plinkoBoardEl = document.getElementById('plinkoBoard');
const plinkoSlotsEl = document.getElementById('plinkoSlots');
const plinkoDropBtn = document.getElementById('plinkoDrop');
const plinkoBetInput = document.getElementById('plinkoBet');
const plinkoDifficultySel = document.getElementById('plinkoDifficulty');
const plinkoResultEl = document.getElementById('plinkoResult');
const plinkoHistoryEl = document.getElementById('plinkoHistory');
const plinkoBalanceInfo = document.getElementById('plinkoBalanceInfo');

function openPlinko(){
  if(!isLoggedIn){
    showNotification('Bitte melde dich an, um Plinko zu spielen.', true);
    loginModal.style.display='flex';
    return;
  }
  showSection('plinko');
  updatePlinkoBalanceInfo();
  // Defaults laden
  const diff = plinkoDifficultySel.value || 'medium';
  applyPlinkoDifficulty(diff);
  buildPlinkoBoard();
}

function updatePlinkoBalanceInfo(){
  plinkoBalanceInfo.textContent = currentUser ? `Kontostand: CHF${(currentUser.balance||0).toFixed(2)}` : '';
}

plinkoDifficultySel.addEventListener('change', (e)=>{
  applyPlinkoDifficulty(e.target.value);
  buildPlinkoBoard();
});

function applyPlinkoDifficulty(diff){
  plinkoConfig.difficulty = diff;
  plinkoConfig.rows = (diff==='easy') ? 8 : (diff==='hard' ? 16 : 12);
  plinkoSlotPayouts = getPayoutsFor(plinkoConfig.rows, diff); // Array Länge rows+1
}

function getPayoutsFor(rows, diff){
  // Symmetrische Multiplikatoren (ähnlich gängigen Plinko-Spielen).
  // Kanten = höchste Gewinne, Mitte = kleine Gewinne; je schwieriger, desto steiler.
  const slots = rows + 1;
  let base;
  if(diff==='easy'){
    // z.B. 8 Reihen -> 9 Slots (kleinere Varianz)
    base = [3.3, 2, 1.2, 0.8, 0.6]; // gespiegelt zu voller Länge
  } else if(diff==='hard'){
    base = [40, 15, 3.8, 1.8, 1.2, 1, 0.6]; // steiler
  } else {
    base = [11, 4, 2, 1.4, 1.1, 0.6]; // medium
  }
  // Skaliere/strecke das Muster auf gewünschte Slot-Anzahl und spiegle
  // Wir erzeugen eine glatte Kurve (links->Mitte) und spiegeln nach rechts.
  const leftLen = Math.ceil(slots/2);
  const curve = [];
  for(let i=0;i<leftLen;i++){
    const t = i/(leftLen-1); // 0..1 zur Interpolation
    // Interpolieren zwischen Hoch->Mitte anhand base
    const idx = Math.floor(t*(base.length-1));
    const frac = (t*(base.length-1)) - idx;
    const v = base[idx]*(1-frac) + base[Math.min(idx+1,base.length-1)]*frac;
    curve.push(+v.toFixed(2));
  }
  // Spiegeln ohne die Mitte doppelt zu nehmen
  const right = curve.slice(0, slots-leftLen).reverse();
  const payouts = curve.concat(right);

  // Leicht: Gewinne flacher (cap nach oben)
  if(diff==='easy'){
    return payouts.map(v => Math.min(v, 4.0));
  }
  // Schwer: etwas mehr Edge-Power
  if(diff==='hard'){
    return payouts.map((v,i,arr)=>{
      if(i===0 || i===arr.length-1) return Math.max(v, 33);
      if(i===1 || i===arr.length-2) return Math.max(v, 11);
      return v;
    });
  }
  return payouts;
}

function buildPlinkoBoard(){
  // Board leeren
  plinkoBoardEl.innerHTML='';
  plinkoSlotsEl.innerHTML='';
  plinkoResultEl.textContent='';
  plinkoHistoryEl.innerHTML='';

  const rows = plinkoConfig.rows;
  plinkoBoardEl.style.setProperty('--rows', rows);
  plinkoSlotsEl.style.setProperty('--plinko-slots', rows+1);

  // Geometrie
  const W = plinkoBoardEl.clientWidth || 640;
  const H = plinkoBoardEl.clientHeight || 560;
  const topPad = 30;
  const bottomPad = 60;
  const usableH = H - topPad - bottomPad;
  const rowGap = usableH / (rows+1); // Abstände vertikal
  const colGap = (W - 60) / rows;    // horizontale Schrittweite
  const leftPad = 30;

  plinkoPegMap = [];

  // Pegs erzeugen (Dreiecks-Gitter)
  for(let r=0;r<rows;r++){
    const y = topPad + (r+1)*rowGap;
    const cols = r+1;
    plinkoPegMap[r] = [];
    for(let c=0;c<cols;c++){
      const x = leftPad + (W-2*leftPad)/2 - (r*colGap)/2 + c*colGap;
      plinkoPegMap[r][c] = {x,y};
      const peg = document.createElement('div');
      peg.className='plinko-peg';
      peg.style.left = `${x}px`;
      peg.style.top  = `${y}px`;
      plinkoBoardEl.appendChild(peg);
    }
  }

  // Slots mit Payout-Badges
  const payouts = plinkoSlotPayouts;
  for(let s=0;s<rows+1;s++){
    const badge = document.createElement('div');
    badge.className='plinko-slot ' + slotClassFor(payouts[s], s, rows);
    badge.textContent = `${payouts[s].toFixed(1)}×`;
    plinkoSlotsEl.appendChild(badge);
  }
}

function slotClassFor(mult, idx, rows){
  if(idx===0||idx===rows) return 'edge';
  if(mult>=4) return 'high';
  if(mult>=1.2) return 'mid';
  return 'low';
}

plinkoDropBtn.addEventListener('click', dropPlinkoBall);

function dropPlinkoBall(){
  const bet = parseInt(plinkoBetInput.value,10) || 0;
  if(bet<=0){ showNotification('Bitte einen Einsatz > 0 setzen', true); return; }
  if(!currentUser || currentUser.balance < bet){ showNotification('Nicht genügend Guthaben', true); return; }

  // Einsatz abziehen
  currentUser.balance -= bet; persistCurrentUser(); updatePlinkoBalanceInfo();

  // Ball erzeugen (Start oben Mitte)
  const ball = document.createElement('div');
  ball.className='plinko-ball';
  plinkoBoardEl.appendChild(ball);

  const rows = plinkoConfig.rows;
  const W = plinkoBoardEl.clientWidth || 640;
  const topStart = 18;
  let x = W/2;
  let y = topStart;

  ball.style.left = `${x}px`;
  ball.style.top  = `${y}px`;

  // Pfad simulieren: an jeder Reihe links/rechts (50/50)
  // Schwierigkeit beeinflusst NUR Payouts/Board-Größe (wie gewünscht).
  let position = 0; // Linksverschiebungen minus Rechtsverschiebungen (zur Slot-Bestimmung)
  let colIdx = 0;   // "c" an der Reihe (für horizontale Schrittweite)
  const horizStep = (plinkoPegMap[plinkoPegMap.length-1][1]?.x || (W/2+40)) - (plinkoPegMap[plinkoPegMap.length-1][0]?.x || (W/2-40));

  let r = -1;
  const timer = setInterval(()=>{
    r++;
    if(r >= rows){
      clearInterval(timer);
      // Slot index aus Position ermitteln: Mitte + position
      const slotIndex = Math.min(Math.max(Math.floor((rows+1)/2 + position), 0), rows);
      const mult = plinkoSlotPayouts[slotIndex] || 0;
      const winnings = +(bet * mult).toFixed(2);
      if(winnings>0){ currentUser.balance += winnings; persistCurrentUser(); updatePlinkoBalanceInfo(); }
      const net = winnings - bet;
      const text = `Slot: ${slotIndex} – Multiplikator ${mult.toFixed(1)}× – ` + (net>=0 ? `Gewinn: CHF${net.toFixed(2)}` : `Verlust: CHF${Math.abs(net).toFixed(2)}`);
      plinkoResultEl.textContent = text;
      showNotification(text);
      addPlinkoHistory(slotIndex, mult, net);
      // sanft unten "liegenlassen"
      setTimeout(()=>{ ball.remove(); }, 900);
      return;
    }

    // Ziel-Peg (Mitte der Reihe): entscheiden L/R und animieren dahin
    const drift = (Math.random()<0.5) ? -1 : 1;
    position += (drift>0 ? 0 : -0) + (drift===-1 ? -0.5 : 0.5); // feinere Mitte
    colIdx = Math.max(0, Math.min(r, Math.round((r/2) + position)));
    const peg = plinkoPegMap[r][Math.max(0, Math.min(colIdx, r))];
    // Bewegung Richtung Peg
    animateTo(ball, peg.x, peg.y, 140, ()=>{
      // Nach „Abprall" horizontal leicht versetzen
      const nx = peg.x + drift * (horizStep/2 - 2);
      const ny = peg.y + ((plinkoPegMap[1]?.[0]?.y ? (plinkoPegMap[1][0].y - (plinkoPegMap[0]?.[0]?.y||peg.y)) : 28) * 0.8);
      animateTo(ball, nx, ny, 120);
    });
  }, 160);
}

function animateTo(el, targetX, targetY, duration=120, cb){
  const startX = parseFloat(el.style.left);
  const startY = parseFloat(el.style.top);
  const dx = targetX - startX;
  const dy = targetY - startY;
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now-start)/duration);
    const ease = t<.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut
    el.style.left = (startX + dx*ease) + 'px';
    el.style.top  = (startY + dy*ease) + 'px';
    if(t<1) requestAnimationFrame(step); else if(cb) cb();
  }
  requestAnimationFrame(step);
}

function addPlinkoHistory(slot, mult, net){
  const chip = document.createElement('div');
  chip.className='plinko-history-item';
  chip.textContent = `Slot ${slot} • ${mult.toFixed(1)}× • ${net>=0?'+':''}${net.toFixed(2)}CHF`;
  plinkoHistoryEl.prepend(chip);
  // max 10
  if(plinkoHistoryEl.childElementCount>10){
    plinkoHistoryEl.removeChild(plinkoHistoryEl.lastChild);
  }
}

// Expose
window.openPlinko = openPlinko;

/* ===== JeeLotto – Logik ===== */
(function(){
  const MODAL = document.getElementById('jeelottoModal');
  const board = document.getElementById('jl-board');
  const statusEl = document.getElementById('jl-status');
  const nextDrawEl = document.getElementById('jl-next-draw');
  const ticketsEl = document.getElementById('jl-tickets');
  const hintEl = document.getElementById('jl-hint');

  const BTN_CLEAR = document.getElementById('jl-clear');
  const BTN_RANDOM = document.getElementById('jl-random');
  const BTN_SUBMIT = document.getElementById('jl-submit');
  const BTN_REFRESH = document.getElementById('jl-refresh');

  const PRICE = 2; 
  const PRIZES = { 2:2, 3:10, 4:100, 5:10000 }; 

  /* ---- Hilfen: Zeit & Seed ---- */

  // ISO-Wochenstart (Montag) der Woche von 'date'
  function startOfISOWeek(date=new Date()){
    const d = new Date(date.getTime());
    const day = (d.getDay() + 6) % 7; // Mo=0 ... So=6
    d.setDate(d.getDate() - day);
    d.setHours(0,0,0,0);
    return d;
  }

  // Dienstag derselben ISO-Woche (0 Uhr); wenn 'date' noch vor Di liegt -> Dienstag der Vorwoche
  function thisWeekTuesday(date=new Date()){
    const mon = startOfISOWeek(date);
    const tue = new Date(mon);
    tue.setDate(mon.getDate() + 1);
    if (date < tue) { tue.setDate(tue.getDate() - 7); }
    tue.setHours(0,0,0,0);
    return tue;
  }

  // Nächster Dienstag (0 Uhr) nach 'date'
  function nextTuesdayBase(date=new Date()){
    const mon = startOfISOWeek(date);
    const tue = new Date(mon);
    tue.setDate(mon.getDate() + 1);
    if (date >= tue) { tue.setDate(tue.getDate() + 7); }
    tue.setHours(0,0,0,0);
    return tue;
  }

  // ISO-Kalenderwoche (1–53)
  function getWeekNumberISO(date){
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // YYYY-Www Schlüssel für die Woche des übergebenen Dienstags
  function weekKeyFromTuesday(tuesday){
    const y = tuesday.getFullYear();
    const w = getWeekNumberISO(tuesday);
    return `${y}-W${String(w).padStart(2,'0')}`;
  }

  // Montag 0 Uhr aus (Jahr, ISO-Woche)
  function isoWeekToMonday(year, week){
    const simple = new Date(Date.UTC(year, 0, 4)); // 4. Jan liegt immer in ISO-Woche 1
    const day = (simple.getUTCDay() + 6) % 7;      // Mo=0
    const monday = new Date(simple);
    monday.setUTCDate(simple.getUTCDate() - day + (week - 1) * 7);
    monday.setUTCHours(0,0,0,0);
    return new Date(monday.getTime());
  }

  // Ziehungszeit: Mittwoch 19:00 der angegebenen Woche (Jahr/Woche)
  function drawTimeForWeekFromYW(year, week){
    const mon = isoWeekToMonday(year, week);
    const tue = new Date(mon); tue.setDate(mon.getDate() + 1); // Dienstag
    const wed = new Date(tue); wed.setDate(tue.getDate() + 1); // Mittwoch
    wed.setHours(19,0,0,0);
    return wed;
  }

  // Deterministisches RNG (Seed = WeekKey)
  function xmur3(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=h<<13|h>>>19; } return function(){ h=Math.imul(h^ (h>>>16),2246822507); h=Math.imul(h^ (h>>>13),3266489909); return (h^ (h>>>16))>>>0; } }
  function mulberry32(a){ return function(){ let t = a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; } }
  function rngFromKey(key){ const seed = xmur3('JEELOTTO-'+key)(); return mulberry32(seed); }

  function lottoKey(){
  const id = (window.currentUser?.email || window.currentUser?.username || 'guest');
  return 'jeelottoTickets:' + id;
}

// einmalige Migration vom alten globalen Key
(function migrateGlobalLotto(){
  const old = localStorage.getItem('jeelottoTickets');
  const k = lottoKey();
  if (old && !localStorage.getItem(k)) {
    localStorage.setItem(k, old);
  }
})();

function readTickets(){
  try{ return JSON.parse(localStorage.getItem(lottoKey())||'[]'); }catch{ return []; }
}
function writeTickets(t){
  localStorage.setItem(lottoKey(), JSON.stringify(t));
}

  /* ---- Zahlen-Board ---- */
  const selected = new Set();
  function renderBoard(){
    board.innerHTML = '';
    for(let i=1;i<=50;i++){
      const b=document.createElement('button');
      b.type='button'; b.textContent=i; b.className='jl-num'+(selected.has(i)?' selected':'');
      b.addEventListener('click',()=>{
        if(selected.has(i)){ selected.delete(i); b.classList.remove('selected'); }
        else{
          if(selected.size>=5) return;
          selected.add(i); b.classList.add('selected');
        }
        updateHint();
      });
      board.appendChild(b);
    }
  }
  function updateHint(){
    const allowed = canPlayToday();
    hintEl.textContent = allowed ? `Du hast ${selected.size}/5 Zahlen gewählt.` : 'Tipps sind nur dienstags möglich.';
    BTN_SUBMIT.disabled = !(allowed && selected.size===5);
  }

  /* ---- Zeit-Status ---- */
  function canPlayToday(now=new Date()){
    return now.getDay()===2; // Dienstag
  }
  function currentWeekKey(){
    const now = new Date();
    const tue = thisWeekTuesday(now); // letzter Dienstag
    return weekKeyFromTuesday(tue);
  }

  // Nächste Ziehung (Key + Zeitpunkt)
  function nextDrawInfo(){
    const now = new Date();
    const tueThis = thisWeekTuesday(now); // letzter Dienstag
    const y = tueThis.getFullYear();
    const w = getWeekNumberISO(tueThis);
    let when = drawTimeForWeekFromYW(y, w);
    let key  = `${y}-W${String(w).padStart(2,'0')}`;

    // Wenn die Ziehung dieser Woche schon vorbei ist -> nächste Woche
    if (now > when) {
      const nextTue = nextTuesdayBase(now);
      const ny = nextTue.getFullYear();
      const nw = getWeekNumberISO(nextTue);
      when = drawTimeForWeekFromYW(ny, nw);
      key  = `${ny}-W${String(nw).padStart(2,'0')}`;
    }
    return { key, when };
  }

  /* ---- Ziehung (deterministisch) ---- */
  function winningNumbersForWeek(key){
    const rnd = rngFromKey(key);
    const pool = Array.from({length:50},(_,i)=>i+1);
    const win=[];
    for(let j=0;j<5;j++){
      const idx = Math.floor(rnd()*pool.length);
      win.push(pool.splice(idx,1)[0]);
    }
    win.sort((a,b)=>a-b);
    return win;
  }

  // Verpasste Ziehungen nachholen/abrechnen
  function settleIfDue(){
    const tix = readTickets();
    if(!tix.length) return;
    const now = new Date();
    const grouped = {};
    for(const t of tix){
      grouped[t.week] ??= [];
      grouped[t.week].push(t);
    }
    let changed=false;

    for (const week of Object.keys(grouped)) {
      const [yy, ww] = week.split('-W');
      const y = parseInt(yy, 10);
      const w = parseInt(ww, 10);

      const draw = drawTimeForWeekFromYW(y, w);  // MI 19:00

      if (now >= draw) {
        const winNums = winningNumbersForWeek(week);
        for (const t of grouped[week]) {
          if (t.settled) continue;
          const matches = t.numbers.filter(n => winNums.includes(n)).length;
          const prize = PRIZES[matches] || 0;
          t.settled = true;
          t.result = { matches, prize, winNums, drawnAt: draw.toISOString() };
          if (prize > 0) credit(prize, `JeeLotto Gewinn (${matches} Treffer)`);
          changed = true;
        }
      }
    }

    if (changed) writeTickets(tix);
  }

  /* ---- Geldfunktionen – nutzen dein bestehendes User-Handling ---- */
  function credit(amount, note){
    if(window.currentUser){
      currentUser.balance = (currentUser.balance||0) + amount;
      if(typeof persistCurrentUser==='function') persistCurrentUser();
      if(typeof showNotification==='function') showNotification(`+CHF${amount.toFixed(2)} ${note||''}`);
    }
  }
  function debit(amount){
    if(window.currentUser){
      if((currentUser.balance||0) < amount){
        if(typeof showNotification==='function') showNotification('Nicht genug Guthaben.', true);
        return false;
      }
      currentUser.balance -= amount;
      if(typeof persistCurrentUser==='function') persistCurrentUser();
      return true;
    }
    return true; // falls kein Usersystem aktiv
  }

  /* ---- UI -> Tickets rendern ---- */
  function renderTickets(){
    const tix = readTickets().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!tix.length){ ticketsEl.innerHTML = '<p class="jl-dim">Noch keine Tickets.</p>'; return; }
    ticketsEl.innerHTML='';
    for(const t of tix){
      const div=document.createElement('div'); div.className='jl-ticket';
      const nums = t.numbers.slice().sort((a,b)=>a-b).join(' • ');
      const week = t.week;
      const created = new Date(t.createdAt);
      let badge='<span class="jl-badge wait">Offen</span>';
      let extra='';
      if(t.settled){
        const win = t.result.winNums.join(' • ');
        if(t.result.prize>0) badge=`<span class="jl-badge win">Gewinn CHF${t.result.prize.toFixed(2)}</span>`;
        else badge=`<span class="jl-badge lose">Kein Gewinn</span>`;
        extra = `<div class="jl-dim jl-xs">Gewinnzahlen: <b>${win}</b> · Ziehung: ${new Date(t.result.drawnAt).toLocaleString()}</div>`;
      }
      div.innerHTML = `
        <div class="meta"><span>Woche: <b>${week}</b></span><span>Kauf: ${created.toLocaleString()}</span> ${badge}</div>
        <div class="nums">Tipp: ${nums}</div>
        ${extra}
      `;
      ticketsEl.appendChild(div);
    }
  }

  /* ---- Public API: Spiel öffnen ---- */
  window.openJeeLotto = function(){
    if(typeof isLoggedIn!=='undefined' && !isLoggedIn){
      if(typeof showNotification==='function') showNotification('Bitte zuerst anmelden.', true);
      if(typeof loginModal!=='undefined') loginModal.style.display='flex';
      return;
    }
    settleIfDue();              // verpasste Ziehungen nachholen
    renderBoard(); selected.clear(); updateHint();
    const nd = nextDrawInfo();
    nextDrawEl.textContent = `${nd.when.toLocaleString()} (Woche ${nd.key})`;
    statusEl.textContent = canPlayToday()? 'Heute kannst du mitspielen.' : 'Heute kein Spieltag. Tipps nur dienstags.';
    MODAL.hidden=false;

    // ESC schließen
    const esc = (e)=>{ if(e.key==='Escape'){ close(); document.removeEventListener('keydown',esc); } };
    document.addEventListener('keydown',esc);

    // Ticketsliste aktualisieren
    renderTickets();
  };

  function close(){ MODAL.hidden=true; }
  document.querySelectorAll('[data-jl-close]').forEach(el=>el.addEventListener('click', close));

  BTN_CLEAR.addEventListener('click', ()=>{ selected.clear(); renderBoard(); updateHint(); });
  BTN_RANDOM.addEventListener('click', ()=>{
    selected.clear();
    const pool = Array.from({length:50},(_,i)=>i+1);
    for(let i=0;i<5;i++){ const r=Math.floor(Math.random()*pool.length); selected.add(pool.splice(r,1)[0]); }
    renderBoard(); updateHint();
  });

  BTN_SUBMIT.addEventListener('click', ()=>{
    if(selected.size!==5) return;
    if(!canPlayToday()){ if(typeof showNotification==='function') showNotification('Tipps nur dienstags.', true); return; }
    if(!debit(PRICE)) return;

    const week = currentWeekKey();
    const tix = readTickets();
    tix.push({
      numbers: Array.from(selected),
      week,
      createdAt: new Date().toISOString(),
      settled: false,
      result: null
    });
    writeTickets(tix);
    if(typeof showNotification==='function') showNotification('Ticket gekauft. Viel Glück!');
    selected.clear(); renderBoard(); updateHint(); renderTickets();
  });

  BTN_REFRESH.addEventListener('click', ()=>{ settleIfDue(); renderTickets(); updateNextDrawUI(); });

  function updateNextDrawUI(){
    const nd = nextDrawInfo();
    nextDrawEl.textContent = `${nd.when.toLocaleString()} (Woche ${nd.key})`;
    statusEl.textContent = canPlayToday()? 'Heute kannst du mitspielen.' : 'Heute kein Spieltag. Tipps nur dienstags.';
  }

  // Beim Laden direkt verpasste Ziehungen auswerten
  try{ settleIfDue(); }catch{}
})();