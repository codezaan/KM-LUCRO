(function(){
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  
  // --- UTILIDADES ---
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function getLocalYMD(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  function addDays(ymd, n){ const d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + n); return getLocalYMD(d); }
  function startOfWeekSunday(ymd){ const d = new Date(ymd + 'T12:00:00'); const day = d.getDay(); d.setDate(d.getDate() - day); return getLocalYMD(d); }
  function fmtDateBR(ymd){ if(!ymd) return ''; const [y,m,d] = ymd.split('-'); return `${d}/${m}/${y}`; }
  function fmtTimeBR(ts){ if(!ts) return ''; const d = new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

  // --- FORMAT ---
  function digitsToBR(digits){ 
    digits=String(digits||'').replace(/\D/g,''); const val=Number(digits); 
    const str=String(val).padStart(3,'0'); 
    const cents=str.slice(-2); const whole=str.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); 
    return whole+','+cents; 
  }
  function brToNum(str){ return Number(str.replace(/\D/g,''))/100; }
  function numToDigits(num){ return String(Math.round(num*100)); }
  function formatMoney(num){ return 'R$ ' + digitsToBR(numToDigits(num)); }

  function attachBR(el){
    if(!el)return; el.type='tel';
    if(!el.dataset.raw || el.value==='') { el.dataset.raw='0'; el.value='0,00'; }
    el.addEventListener('input', ()=>{
      let d = el.value.replace(/\D/g,''); el.dataset.raw = String(Number(d));
      el.value = digitsToBR(el.dataset.raw);
    });
    el.addEventListener('blur', ()=>{ if(el.value==='') { el.dataset.raw='0'; el.value='0,00'; }});
  }
  function parseBR(el){ return brToNum(el.dataset.raw||'0'); }
  function attachCapitalize(el){
    el.addEventListener('input', (e)=>{
      if(e.target.value.length > 0){ e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1); }
    });
  }

  // --- DADOS ---
  function loadData(key){ try{ return JSON.parse(localStorage.getItem(key)||'[]'); }catch(e){return[];} }
  function saveData(key,val){ localStorage.setItem(key, JSON.stringify(val)); }
  function loadHistAll(){ try{ return JSON.parse(localStorage.getItem('km_hist')||'{}'); }catch(e){return{};} }
  function saveHistAll(h){ localStorage.setItem('km_hist', JSON.stringify(h)); }
  function loadHist(placa){ const db=loadHistAll(); return db[placa]||{}; }
  function saveHist(placa,h){ const db=loadHistAll(); db[placa]=h; saveHistAll(db); }
  
  // --- STATE ---
  let carros = loadData('km_carros');
  let carroAtual = null;
  let turno = null;
  let navStates = {}; 
  let tutTimeout = null; 

  // --- UI ---
  const uiHeader = qs('#appHeader');
  const uiBack = qs('#btnBack');
  const uiTitle = qs('#headerTitle');
  const viewGarage = qs('#viewGarage');
  const viewPanel = qs('#viewPanel');
  const viewResult = qs('#viewResult'); 
  const carListEl = qs('#carList');
  const panelContent = qs('#panelContent');
  const resultContent = qs('#resultContent');

  // --- NAV ---
  function navigate(to, title='KM LUCRO', backFn=null){
    viewGarage.classList.add('hidden'); viewPanel.classList.add('hidden'); viewResult.classList.add('hidden');
    uiHeader.classList.add('hidden');
    if(to==='GARAGE'){ viewGarage.classList.remove('hidden'); }
    else if(to==='RESULT') { viewResult.classList.remove('hidden'); }
    else {
      uiHeader.classList.remove('hidden'); uiTitle.textContent=title;
      if(to==='PANEL') viewPanel.classList.remove('hidden');
    }
    uiBack.onclick = backFn || (() => navigate('GARAGE'));
  }

  // ---------- LOAD HANDLER (updated: show tutorial in front on first run) ----------
  window.addEventListener('load', ()=>{
    const splash = qs('#splash');

    renderGarage();
    
    // Botão AJUDA DA GARAGEM
    const helpBtn = qs('#btnGarageHelp');
    if(helpBtn) helpBtn.onclick=()=>startTutorial(true);

    const addBtn = qs('#btnAddCar');
    if(addBtn) addBtn.onclick=()=>{ 
        if(tutTimeout) clearTimeout(tutTimeout);
        localStorage.setItem('tutorial_seen', 'true'); 
        openModalCar(); 
    };
    
    // Se nunca viu o tutorial: mostra IMEDIATAMENTE em primeiro plano
    const seen = localStorage.getItem('tutorial_seen');
    if(!seen && carros.length === 0) {
      // esconde o splash para o tutorial ficar "clean" na frente
      if(splash) splash.style.display = 'none';

      // mostra tutorial agora; a função grava tutorial_seen ao fechar se for first-run
      startTutorial(false);

      // não precisa do timeout
      tutTimeout = null;
    } else {
      // comportamento normal: fade do splash e remoção
      if(splash){
        setTimeout(()=>{ splash.style.opacity = 0; setTimeout(()=>splash.remove(),500); }, 2000);
      }

      // se já for visto e houver carros, mantém renderGarage tal qual
      if(!seen && carros.length > 0){
        // caso raro: agenda tutorial se quiser (mantido para compatibilidade)
        tutTimeout = setTimeout(() => startTutorial(false), 2500);
      }
    }
  });

  // --- TUTORIAL ---
      
   // Substitua a função existente por esta:
  function startTutorial(isManual){
    // evita duplicar
    if(document.querySelector('.tutorial-overlay')) return;

    const steps = [
      { icon: '👋', title: 'Bem-vindo!', text: 'O <b>KM LUCRO</b> é seu parceiro para gerenciar ganhos e custos de forma inteligente.' },
      { icon: '🚗', title: '1. Cadastre', text: 'Comece adicionando seu veículo. Informe se ele é <b>Combustível Líquido (DEG)</b> ou <b>GNV (Cilindro)</b>.' },
      { icon: '📝', title: '2. Informe', text: 'Ao finalizar o dia, você só precisa digitar o <b>KM Final</b> e o <b>Valor Total Ganho</b>.' },
      { icon: '⛽', title: '3. Abastecimento', text: 'Se abasteceu, lance o valor. O app desconta do ganho e calcula seu <b>Lucro Líquido</b> e a <b>Média</b> na hora!' }
    ];

    let currentStep = 0;
    const ov = document.createElement('div');
    ov.className = 'tutorial-overlay';
    ov.setAttribute('role','dialog');
    ov.setAttribute('aria-modal','true');

    // fecha e restaura scroll
    function closeTut(saveSeen=true){
      document.body.style.overflow = ''; // restaura scroll
      if(saveSeen && !isManual) localStorage.setItem('tutorial_seen','true');
      ov.style.opacity = '0';
      setTimeout(()=>{ if(ov && ov.parentNode) ov.remove(); }, 240);
    }

    function renderStep(){
      const s = steps[currentStep];
      const btnText = currentStep === steps.length - 1 ? 'ENTENDI' : 'PRÓXIMO ➔';
      const skipText = isManual ? 'Fechar' : 'Pular Introdução';

      // monta dots
      let dots = '<div style="display:flex;gap:6px;margin-top:12px">';
      steps.forEach((_,i)=>{ dots += `<span style="width:8px;height:8px;border-radius:8px;display:inline-block;background:${i===currentStep? 'var(--accent)' : '#333'}"></span>`; });
      dots += '</div>';

      ov.innerHTML = `
        <div class="tutorial-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="font-size:34px">${s.icon}</div>
            <div>
              <div style="font-weight:800;font-size:18px;color:var(--accent);text-transform:uppercase">${s.title}</div>
              <div style="font-size:13px;color:var(--muted);margin-top:6px">${s.text}</div>
            </div>
          </div>
          ${dots}
          <div class="btn-row">
            <button id="tutBtn" class="btn-primary">${btnText}</button>
            <button id="tutSkip" class="btn-secondary">${skipText}</button>
          </div>
        </div>
      `;

      // eventos
      ov.querySelector('#tutBtn').onclick = () => {
        if(currentStep < steps.length - 1){
          currentStep++;
          renderStep();
          ov.scrollTop = 0;
        } else {
          closeTut(true);
        }
      };
      ov.querySelector('#tutSkip').onclick = () => closeTut(isManual ? false : true);
    }

    // fecha ao clicar fora do card
    ov.addEventListener('click', (e) => {
      if(e.target === ov){
        closeTut(isManual ? false : true);
      }
    });

    // impede scroll do body enquanto tutorial aberto
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    renderStep();
  }


  // --- GARAGEM ---
  function renderGarage(){
    carros = loadData('km_carros'); carListEl.innerHTML='';
    const headerLogo = qs('.garage-header');
    const fabBtn = qs('#btnAddCar');
    const helpBtn = qs('#btnGarageHelp');

    if(!carros.length){ 
      if(headerLogo) headerLogo.classList.add('hidden');
      if(fabBtn) fabBtn.classList.add('hidden');
      if(helpBtn) helpBtn.classList.add('hidden'); // Esconde ajuda se não tem carro (tela de boas vindas ja explica)
      carListEl.innerHTML = `
        <div class="welcome-box">
          <img src="imagens/logo.png" class="welcome-img" alt="KM Lucro">
          <div class="welcome-title">Garagem Vazia</div>
          <div class="welcome-text">Adicione seu primeiro veículo para começar.</div>
          <button id="btnFirstAdd" class="btn-primary">ADICIONAR VEÍCULO</button>
        </div>`;

      // --- forçar src correto da welcome-img (fix imediato) ---
      setTimeout(() => {
        const splash = document.querySelector('.splash-logo-img');
        const welcomeImg = document.querySelector('.welcome-img');
        if (welcomeImg) {
          // copia o src do splash (que funciona) — fallback para './imagens/logo.png'
          welcomeImg.src = splash ? splash.src : './imagens/logo.png';
          welcomeImg.alt = welcomeImg.alt || 'KM Lucro';
        }
      }, 50);

      const btnFirst = qs('#btnFirstAdd');
      if(btnFirst) btnFirst.onclick = () => { 
          if(tutTimeout) clearTimeout(tutTimeout);
          localStorage.setItem('tutorial_seen', 'true'); 
          openModalCar(); 
      };
      return; 
    }
    
    if(headerLogo) headerLogo.classList.remove('hidden');
    if(fabBtn) fabBtn.classList.remove('hidden');
    if(helpBtn) helpBtn.classList.remove('hidden');

    carros.forEach(c=>{
      const item=document.createElement('div'); item.className='car-item';
      const isGNV = c.sistema === 'gnv';
      item.innerHTML=`<div style="display:flex;align-items:center;flex:1" class="clk"><div class="car-icon-box">${isGNV?'🔥':'⛽'}</div><div class="car-details"><div class="car-placa">${c.placa}</div><div class="car-desc">${c.apelido} • ${isGNV?'Cilindro (GNV)':'DEG'}</div></div></div><button class="btn-trash-icon">🗑️</button>`;
      item.querySelector('.clk').onclick=()=>openPanel(c);
      item.querySelector('.btn-trash-icon').onclick=(e)=>{
        e.stopPropagation(); if(confirm('Excluir veículo e dados?')){
          carros=carros.filter(x=>x.placa!==c.placa); saveData('km_carros',carros);
          const h=loadHistAll(); delete h[c.placa]; saveHistAll(h);
          localStorage.removeItem('turno_'+c.placa); renderGarage();
        }
      };
      carListEl.appendChild(item);
    });
  }

  function openModalCar(){
    const ov=document.createElement('div'); ov.className='modal-overlay';
    ov.innerHTML=`<div class="modal-card"><div class="modal-title" style="display:flex;align-items:center;justify-content:center">Novo Veículo <button id="btnHelpCar" class="btn-help-icon">?</button></div>
      <label class="big-label">Sistema</label><select id="mSys" style="margin-bottom:5px"><option value="liquido">DEG</option><option value="gnv">Cilindro (GNV)</option></select><div id="degHelp" style="font-size:11px;color:#777;margin-bottom:20px;text-align:center">(Diesel, Etanol e Gasolina)</div>
      <label class="big-label">Placa</label><input id="mPlaca" type="text" placeholder="ABC-1234" style="text-transform:uppercase;margin-bottom:15px">
      <label class="big-label">Apelido</label><input id="mApelido" type="text" placeholder="Ex: Uber Black" style="margin-bottom:15px">
      <label class="big-label">KM Atual</label><input id="mKm" type="number" placeholder="0" style="margin-bottom:20px">
      <button id="mSave" class="btn-primary">SALVAR</button><button id="mCancel" class="btn-secondary">CANCELAR</button></div>`;
    document.body.appendChild(ov);
    
    const helpBtn = ov.querySelector('#btnHelpCar');
    if(helpBtn) helpBtn.onclick = () => alert('DICAS:\n\n• DEG: Carros Flex ou Diesel.\n• GNV: Carros com Kit Gás.\n\nO KM ATUAL serve para iniciar o controle dos turnos.');

    const iP=ov.querySelector('#mPlaca'); const mSys=ov.querySelector('#mSys'); const dHelp=ov.querySelector('#degHelp'); const iAp=ov.querySelector('#mApelido');
    attachCapitalize(iAp);
    mSys.addEventListener('change', ()=>{ if(mSys.value==='liquido') dHelp.classList.remove('hidden'); else dHelp.classList.add('hidden'); });
    iP.addEventListener('input',e=>{let v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''); if(v.length>3)v=v.slice(0,3)+'-'+v.slice(3,7); e.target.value=v.slice(0,8);});
    ov.querySelector('#mCancel').onclick=()=>ov.remove();
    ov.querySelector('#mSave').onclick()=>{
      const pl=iP.value.trim(); const km=parseFloat(ov.querySelector('#mKm').value); const sys=mSys.value;
      if(pl.length<7)return alert('Placa inválida'); if(isNaN(km))return alert('Informe KM');
      if(carros.find(x=>x.placa===pl))return alert('Placa já existe');
      let apelido = iAp.value.trim() || 'Carro'; apelido = apelido.charAt(0).toUpperCase() + apelido.slice(1);
      carros.push({placa:pl, apelido:apelido, kmCarro:km, sistema:sys});
      saveData('km_carros',carros); ov.remove(); renderGarage();
    };
  }

  // --- PAINEL ---
  function openPanel(c){ carroAtual=c; renderMenuPanel(); }
  
  function renderMenuPanel(){
    navigate('PANEL', carroAtual.apelido.toUpperCase(), ()=>{ renderGarage(); navigate('GARAGE'); });
    const isGNV = carroAtual.sistema === 'gnv';
    const labelFuel = isGNV ? 'Histórico Cilindro' : 'Histórico Combustível';
    const iconFuel = isGNV ? '🔥' : '⛽';
    
    const svgs = {
      calc: '<svg viewBox="0 0 24 24"><path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M7,7H17V9H7V7M7,11H11V13H7V11M13,11H17V13H13V11M7,15H11V17H7V15M13,15H17V17H13V15Z" /></svg>',
      km:   '<svg viewBox="0 0 24 24"><path d="M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12,11.5c-1.38,0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5,1.12 2.5,2.5-1.12,2.5-2.5,2.5z" /></svg>',
      ganho:'<svg viewBox="0 0 24 24"><path d="M12,1L3,5v6c0,5.55,3.84,10.74,9,12c5.16-1.26,9-6.45,9-12V5L12,1z M12,16c-2.21,0-4-1.79-4-4c0-2.21,1.79-4,4-4s4,1.79,4,4C16,14.21,14.21,16,12,16z M13.5,10h-2v1h-1v3h2.5v1h-3V16h3v1h1v-3h-2.5v-1h3V10z" /></svg>',
      desp: '<svg viewBox="0 0 24 24"><path d="M22.7,19l-9.1-9.1c0.9-2.3,0.4-5-1.5-6.9c-2-2-5-2.4-7.4-1.3L9,6L6,9L1.6,4.7C0.4,7.1,0.9,10.1,2.9,12.1c1.9,1.9,4.6,2.4,6.9,1.5l9.1,9.1L22.7,19z" /></svg>',
      res:  '<svg viewBox="0 0 24 24"><path d="M19,3h-4.18C14.4,1.84,13.3,1,12,1S9.6,1.84,9.18,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3z M12,2.75c0.41,0,0.75,0.34,0.75,0.75S12.41,4.25,12,4.25s-0.75-0.34-0.75-0.75S11.59,2.75,12,2.75z M10.09,16.41L7.5,13.83l1.41-1.41l1.18,1.18l4.24-4.24l1.41,1.41L10.09,16.41z" /></svg>',
      calc_flex: '<svg viewBox="0 0 24 24"><path d="M7,2H17A2,2 0 0,1 19,4V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V4A2,2 0 0,1 7,2M7,4V9H17V4H7M7,11V13H9V11H7M11,11V13H13V11H11M15,11V13H17V11H15M7,15V17H9V15H7M11,15V17H13V15H11M15,15V17H17V15H15M7,19V21H17V19H7Z"/></svg>'
    };
    
    // MENU LIMPO (SEM AJUDA)
    panelContent.innerHTML=`<div class="menu-grid">
      <div class="menu-btn" id="bC"><div class="menu-icon-svg-box">${svgs.calc}</div><div class="menu-lbl">Calcular Dia</div></div>
      <div class="menu-btn" id="bK"><div class="menu-icon-svg-box">${svgs.km}</div><div class="menu-lbl">Histórico KM</div></div>
      <div class="menu-btn" id="bG"><div class="menu-icon-svg-box">${svgs.ganho}</div><div class="menu-lbl">Ganhos</div></div>
      <div class="menu-btn" id="bF"><div class="menu-icon-svg-box">${svgs.desp}</div><div class="menu-lbl">Despesas</div></div>
      <div class="menu-btn" id="bFlex"><div class="menu-icon-svg-box">${svgs.calc_flex}</div><div class="menu-lbl">Calculadora Flex</div></div>
      <div class="menu-btn" id="bR"><div class="menu-icon-svg-box">${svgs.res}</div><div class="menu-lbl">Resultados</div></div>
    </div>`;
    
    qs('#bC').onclick=()=>renderCalculator();
    qs('#bK').onclick=()=>renderHistory('KM');
    qs('#bG').onclick=()=>renderHistory('GANHO');
    qs('#bF').onclick=()=>renderHistory('DESPESA');
    qs('#bR').onclick=()=>renderHistory('RESULTADO');
    qs('#bFlex').onclick=()=>openFuelComparator();
  }

  // --- CALCULADORA FLEX ---
  function openFuelComparator(){
    const ov=document.createElement('div'); ov.className='modal-overlay';
    ov.innerHTML=`<div class="modal-card"><div class="modal-title">Etanol ou Gasolina?</div>
      <label class="big-label">Preço Gasolina (R$)</label><input id="pGas" type="tel" class="big-input" placeholder="0,00">
      <label class="big-label">Preço Etanol (R$)</label><input id="pEta" type="tel" class="big-input" placeholder="0,00">
      <button id="bComp" class="btn-primary">COMPARAR</button>
      <div id="resComp" class="comp-result-box hidden"></div>
      <button id="bClose" class="btn-secondary" style="margin-top:15px">FECHAR</button></div>`;
    document.body.appendChild(ov);
    const iG=ov.querySelector('#pGas'); const iE=ov.querySelector('#pEta'); attachBR(iG); attachBR(iE);
    ov.querySelector('#bClose').onclick=()=>ov.remove();
    ov.querySelector('#bComp').onclick=()=>{
      const g=parseBR(iG); const e=parseBR(iE); if(g<=0||e<=0) return alert('Preencha os valores');
      const ratio=e/g; const box=ov.querySelector('#resComp'); box.classList.remove('hidden');
      let winner=ratio<0.7?'ETANOL':'GASOLINA'; let pct=(ratio*100).toFixed(0);
      box.innerHTML=`<div style="font-size:12px;color:#aaa;margin-bottom:5px">O Etanol está <b>${pct}%</b> da Gasolina</div>
      <div class="comp-winner">ABASTEÇA COM ${winner}</div><div style="font-size:11px;color:#777;margin-top:5px">(Abaixo de 70% Etanol compensa)</div>`;
    };
  }

  // --- CALCULADORA DIA ---
  function renderCalculator(){
    navigate('PANEL','CALCULAR DIA',()=>renderMenuPanel());
    try{turno=JSON.parse(localStorage.getItem('turno_'+carroAtual.placa));}catch(e){turno=null;}
    
    if(!turno){
      panelContent.innerHTML=`<div class="dash-content">
        <div class="big-input-container" style="margin-top:40px"><label class="big-label">KM Inicial</label><input id="kmIniStart" type="number" class="big-input" style="font-size:40px;color:var(--accent)" value="${carroAtual.kmCarro.toFixed(0)}"></div>
        <button id="bIni" class="btn-primary">INICIAR TURNO 🚀</button>
      </div>`;
      qs('#bIni').onclick=()=>{
        const valKm=parseFloat(qs('#kmIniStart').value); if(isNaN(valKm))return alert('KM Inválido');
        if(valKm!==carroAtual.kmCarro){carroAtual.kmCarro=valKm; const idx=carros.findIndex(c=>c.placa===carroAtual.placa); if(idx!==-1){carros[idx].kmCarro=valKm; saveData('km_carros',carros);}}
        turno={kmInicial:valKm, startedAt:Date.now()}; localStorage.setItem('turno_'+carroAtual.placa, JSON.stringify(turno)); renderCalculator();
      };
    } else {
      panelContent.innerHTML=`<div class="dash-content">
        <div class="input-group" style="width:100%;text-align:center;margin-bottom:20px;border-bottom:1px solid #333;padding-bottom:15px"><label class="big-label">KM Inicial (Toque p/ corrigir)</label><input id="iKmIniCor" type="number" value="${turno.kmInicial}" style="background:transparent;border:none;color:#777;font-size:20px;text-align:center;font-weight:bold;width:100px;"></div>
        <div class="big-input-container"><label class="big-label">KM Final</label><input id="iKm" type="number" class="big-input" placeholder="${turno.kmInicial}"></div>
        <div class="big-input-container"><label class="big-label">Faturamento (R$)</label><input id="iGan" type="tel" class="big-input" placeholder="0,00"></div>
        <div style="width:100%;margin-top:10px"><label class="big-label">Meta (Opcional)</label><input id="iMet" type="tel" placeholder="0,00"></div>
        <button id="bFim" class="btn-primary">FINALIZAR TURNO</button><button id="bCan" class="btn-secondary">Cancelar</button></div>`;
      attachBR(qs('#iGan')); attachBR(qs('#iMet')); qs('#iKm').focus();
      qs('#iKmIniCor').addEventListener('change', (e)=>{const n=parseFloat(e.target.value); if(!isNaN(n)&&n>0){turno.kmInicial=n; localStorage.setItem('turno_'+carroAtual.placa,JSON.stringify(turno));}});
      qs('#bCan').onclick=()=>{if(confirm('Cancelar turno?')){localStorage.removeItem('turno_'+carroAtual.placa); turno=null; renderCalculator();}};
      qs('#bFim').onclick=function(){
        const kIni=parseFloat(qs('#iKmIniCor').value); const kf=parseFloat(qs('#iKm').value); const ga=parseBR(qs('#iGan')); const me=parseBR(qs('#iMet'));
        if(isNaN(kf)||kf<kIni)return alert('KM Final menor que Inicial'); if(ga<=0)return alert('Informe faturamento');
        this.disabled=true; this.textContent='PROCESSANDO...';
        const reg={id:uid(), kmInicial:kIni, kmFinal:kf, kmRodado:Number((kf-kIni).toFixed(2)), ganho:ga, meta:me, createdAt:Date.now()};
        askFuel(reg);
      };
    }
  }

  function askFuel(reg){
    const isGNV = carroAtual.sistema === 'gnv';
    const labelQ = isGNV ? 'Abasteceu Cilindro?' : 'Abasteceu Tanque?';
    const ov=document.createElement('div'); ov.className='modal-overlay';
    ov.innerHTML=`<div class="modal-card" style="text-align:center"><div class="modal-title">${labelQ}</div><button id="y" class="btn-primary">SIM ✅</button><button id="n" class="btn-secondary">NÃO</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#n').onclick=()=>{ov.remove(); finishSave(reg,null);};
    ov.querySelector('#y').onclick=()=>{ov.remove(); showFuelForm(reg);};
  }

  function showFuelForm(reg){
    const isGNV = carroAtual.sistema === 'gnv';
    const ov=document.createElement('div'); ov.className='modal-overlay';
    let typeSelect = '';
    const unitLabel = isGNV ? 'm³' : 'L';
    const savedLiqType = localStorage.getItem('last_liq_type') || 'gasolina';
    const savedLiqPrice = localStorage.getItem('last_liq_price') || '0';
    const savedGnvPrice = localStorage.getItem('last_gnv_price') || '0';
    if(isGNV){ typeSelect = `<div style="text-align:center;margin-bottom:20px;font-weight:800;color:var(--accent);font-size:18px">CILINDRO GNV</div><input type="hidden" id="fType" value="gnv">`; }
    else { typeSelect = `<label class="big-label">Tipo (DEG)</label><select id="fType"><option value="gasolina" ${savedLiqType==='gasolina'?'selected':''}>GASOLINA</option><option value="etanol" ${savedLiqType==='etanol'?'selected':''}>ETANOL</option><option value="diesel" ${savedLiqType==='diesel'?'selected':''}>DIESEL</option></select>`; }
    ov.innerHTML=`<div class="modal-card"><div class="modal-title">Abastecimento</div>${typeSelect}
      <label class="big-label">Total Pago (R$)</label><input id="fVal" type="tel" class="big-input" placeholder="0,00"><br>
      <label class="big-label">Preço/${unitLabel} (R$)</label><input id="fPre" type="tel" class="big-input" placeholder="0,00">
      <button id="s" class="btn-primary">SALVAR & FINALIZAR</button></div>`;
    document.body.appendChild(ov);
    const iV=ov.querySelector('#fVal'); const iP=ov.querySelector('#fPre'); attachBR(iV); attachBR(iP);
    if(isGNV && savedGnvPrice!=='0'){ iP.dataset.raw=savedGnvPrice; iP.value=digitsToBR(savedGnvPrice); }
    else if(!isGNV && savedLiqPrice!=='0'){ iP.dataset.raw=savedLiqPrice; iP.value=digitsToBR(savedLiqPrice); }
    ov.querySelector('#s').onclick=function(){
      const v=parseBR(iV); const p=parseBR(iP); if(v<=0||p<=0)return alert('Preencha valores');
      this.disabled=true; this.textContent='SALVANDO...';
      const type = isGNV ? 'gnv' : ov.querySelector('#fType').value;
      if(isGNV){ localStorage.setItem('last_gnv_price', iP.dataset.raw); } 
      else { localStorage.setItem('last_liq_type', type); localStorage.setItem('last_liq_price', iP.dataset.raw); }
      const qtd = Number((v/p).toFixed(2));
      // Criamos o objeto de despesa, mas **não** salvamos diretamente em day.despesas aqui.
      // A despesa ficará anexada ao turno (reg.combustivel) e será exibida via turnos.
      const despesa = { id: uid(), tipo: 'DESPESA', grupo: 'combustivel', subgrupo: type, valor: v, preco: p, qtd: qtd, data: getLocalYMD(), createdAt: Date.now() };
      reg.combustivel = despesa; 
      ov.remove(); finishSave(reg, despesa);
    };
  }

  // --- FINISH SAVE (corrigida para evitar duplicação) ---
  function finishSave(reg, despesaCombustivel){
    try {
      const ymd = getLocalYMD();
      const db = loadHistAll();

      if(!db[carroAtual.placa]) db[carroAtual.placa] = {};
      if(!db[carroAtual.placa][ymd]) db[carroAtual.placa][ymd] = { turnos: [], despesas: [] };

      const day = db[carroAtual.placa][ymd];

      // se já existe um turno com o mesmo id, atualiza ao invés de duplicar
      const existIdx = (day.turnos || []).findIndex(t => t.id === reg.id);
      if(existIdx !== -1){
        day.turnos[existIdx] = reg;
        console.log('Turno atualizado:', reg.id);
      } else {
        day.turnos.push(reg);
        console.log('Turno adicionado:', reg.id);
      }

      // IMPORTANT:
      // Não adicionamos a despesa de combustível em day.despesas quando ela veio via turno.
      // Isso evita duplicação na tela de Despesas (já que renderHistory agrega combustíveis dos turnos).
      // Se quiser manter também em despesas, adicione aqui com uma flag isTurno:true e trate no render.

      saveHistAll(db);

      // atualiza km do carro se necessário
      if(reg.kmFinal > carroAtual.kmCarro){
        carroAtual.kmCarro = reg.kmFinal;
        const idx = carros.findIndex(c => c.placa === carroAtual.placa);
        if(idx !== -1){ carros[idx].kmCarro = reg.kmFinal; saveData('km_carros', carros); }
      }

      // limpa turno ativo
      localStorage.removeItem('turno_' + carroAtual.placa);
      turno = null;

      // render resultado
      renderResultView(reg);
    } catch(err) {
      console.error('Erro em finishSave:', err);
      alert('Erro ao salvar registro (veja console).');
    }
  }

  function renderResultView(reg){
    navigate('RESULT', 'RESULTADO');
    const hasFuel=!!reg.combustivel; const custo=hasFuel?reg.combustivel.valor:0; const lucro=reg.ganho-custo;
    const media = (hasFuel && reg.combustivel.qtd>0) ? (reg.kmRodado/reg.combustivel.qtd) : 0;
    const unit = (reg.combustivel && reg.combustivel.subgrupo==='gnv') ? 'm³' : 'L';
    
    resultContent.innerHTML = `
      <div class="result-card"><span class="res-icon">🎉</span><div class="res-lbl">RESULTADO DO TURNO</div>
      <div class="res-val" style="color:${lucro>=0?'var(--success)':'var(--danger)'}">${formatMoney(lucro)}</div>
      <div style="color:var(--muted);font-size:14px;margin-bottom:20px">LUCRO LÍQUIDO</div>
      ${(reg.meta>0&&reg.ganho>=reg.meta)?'<div class="res-meta">🏆 META BATIDA!</div>':''}
      <div class="res-grid">
        <div class="res-box"><span class="res-k">FATURAMENTO</span><span class="res-v" style="color:#fff">${formatMoney(reg.ganho)}</span></div>
        <div class="res-box"><span class="res-k">KM RODADO</span><span class="res-v">${reg.kmRodado.toFixed(1)} km</span></div>
        ${hasFuel?`<div class="res-box"><span class="res-k">COMBUSTÍVEL</span><span class="res-v" style="color:var(--danger)">- ${formatMoney(custo)}</span></div>
        <div class="res-box"><span class="res-k">MÉDIA</span><span class="res-v">${media.toFixed(1)} km/${unit}</span></div>`:''}
      </div><button id="btnHomeResult" class="btn-primary">VOLTAR AO INÍCIO</button></div>`;
    qs('#btnHomeResult').onclick = () => renderMenuPanel();
  }

  // --- MODAL DESPESAS ---
  function openAddExpenseModal(onSave){
    const ov = document.createElement('div'); ov.className = 'modal-overlay';
    const EXPENSE_GROUPS = {
      'preventiva': { label: 'Manutenção Preventiva', subs: ['Troca de Óleo', 'Filtros', 'Pneus', 'Freios', 'Alinhamento', 'Correia', 'Velas', 'Fluidos'] },
      'corretiva': { label: 'Manutenção Corretiva', subs: ['Suspensão', 'Motor', 'Elétrica', 'Radiador', 'Embreagem', 'Mecânica Geral'] },
      'documentos': { label: 'Documentação', subs: ['IPVA', 'Licenciamento', 'Seguro', 'Multas', 'Financiamento'] },
      'estetica': { label: 'Estética', subs: ['Lavagem', 'Higienização', 'Polimento'] },
      'outros': { label: 'Outros', subs: ['Estacionamento', 'Pedágio', 'Outros'] }
    };
    let groupOpts = ''; for(let g in EXPENSE_GROUPS) groupOpts += `<option value="${g}">${EXPENSE_GROUPS[g].label}</option>`;
    ov.innerHTML = `<div class="modal-card"><div class="modal-title">Nova Despesa</div>
      <label class="big-label">Categoria</label><select id="exGroup">${groupOpts}</select>
      <label class="big-label">Item</label><select id="exSub"></select>
      <label class="big-label">Valor (R$)</label><input id="exVal" type="tel" class="big-input" placeholder="0,00">
      <label class="big-label">Data</label><div id="exDateTrigger" class="custom-date-trigger">${fmtDateBR(getLocalYMD())}</div>
      <button id="saveEx" class="btn-primary">SALVAR</button><button id="cancelEx" class="btn-secondary">CANCELAR</button></div>`;
    document.body.appendChild(ov);
    let selectedDate = getLocalYMD();
    const trigger = ov.querySelector('#exDateTrigger');
    trigger.onclick = () => openMonthPicker(selectedDate, (d)=>{ selectedDate=d; trigger.textContent=fmtDateBR(d); });
    const selG=ov.querySelector('#exGroup'); const selS=ov.querySelector('#exSub'); const iVal=ov.querySelector('#exVal');
    attachBR(iVal);
    function updateSubs(){ const g=selG.value; let sOpts=''; EXPENSE_GROUPS[g].subs.forEach(s=>sOpts+=`<option value="${s}">${s}</option>`); selS.innerHTML=sOpts; }
    selG.addEventListener('change',updateSubs); updateSubs();
    ov.querySelector('#cancelEx').onclick=()=>ov.remove();
    ov.querySelector('#saveEx').onclick=()=>{
      const val=parseBR(iVal); if(val<=0)return alert('Informe o valor');
      const despesa={id:uid(), tipo:'DESPESA', grupo:selG.value, subgrupo:selS.value, valor:val, data:selectedDate, createdAt:Date.now()};
      const db=loadHistAll();
      if(!db[carroAtual.placa]) db[carroAtual.placa]={}; if(!db[carroAtual.placa][selectedDate]) db[carroAtual.placa][selectedDate]={turnos:[], despesas:[]};
      if(!db[carroAtual.placa][selectedDate].despesas) db[carroAtual.placa][selectedDate].despesas=[];
      db[carroAtual.placa][selectedDate].despesas.push(despesa);
      saveHistAll(db); ov.remove(); if(onSave)onSave();
    };
  }

  // --- HISTÓRICOS UNIFICADO ---
  function renderHistory(tipo){
    let t = '';
    if(tipo==='KM') t='Histórico KM';
    else if(tipo==='GANHO') t='Histórico Ganhos';
    else if(tipo==='DESPESA') t='Gestão de Despesas';
    else if(tipo==='RESULTADO') t='Resultados';

    navigate('PANEL', t, ()=>renderMenuPanel());
    const stateKey = `${carroAtual.placa}_${tipo}`;
    if(!navStates[stateKey]) navStates[stateKey] = getLocalYMD();
    let ref = navStates[stateKey];
    const from=startOfWeekSunday(ref); const to=addDays(from,7);
    let extraBtn = '';
    if(tipo==='DESPESA') extraBtn = `<button id="btnAddExp" class="btn-primary" style="margin:10px 16px;width:calc(100% - 32px)">+ NOVA DESPESA</button>`;

    panelContent.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center">
      <div class="nav-calendar"><button class="action-btn" id="p">◀</button><div class="nav-date-title" id="l"></div><button class="action-btn" id="n">▶</button></div>
      <div class="mini-calendar" id="cal"></div>${extraBtn}<div class="history-list" id="lst"></div>
    </div>`;
    
    if(tipo==='DESPESA') qs('#btnAddExp').onclick = () => openAddExpenseModal(()=>renderHistory(tipo));

    qs('#l').textContent=`${fmtDateBR(ref)}`; 
    qs('#l').onclick=()=>{openMonthPicker(ref, d=>{ navStates[stateKey]=d; renderHistory(tipo); });};
    const days=renderMiniCalendar(qs('#cal'),from,to,carroAtual.placa,ref);
    days.forEach(d=>d.onclick=()=>{ navStates[stateKey]=d.dataset.ymd; renderHistory(tipo); });
    qs('#p').onclick = () => { navStates[stateKey] = addDays(ref, -7); renderHistory(tipo); };
    qs('#n').onclick = () => { navStates[stateKey] = addDays(ref, 7); renderHistory(tipo); };

    const db=loadHistAll(); const list=qs('#lst'); list.innerHTML='';
    const dayObj=db[carroAtual.placa]?.[ref] || {turnos:[], despesas:[]};
    const dh=document.createElement('div'); dh.className='turno-date-header'; dh.textContent=fmtDateBR(ref); list.appendChild(dh);

    let hasItems = false; let totalDia = 0;

    if(tipo !== 'DESPESA'){
        (dayObj.turnos||[]).forEach(r => {
            hasItems = true;
            if(tipo==='GANHO') totalDia += r.ganho;
            const row=document.createElement('div'); row.className='history-item';
            const hr=fmtTimeBR(r.createdAt);
            let txt='', act='';
            if(tipo==='KM') txt=`${r.kmInicial} ➝ ${r.kmFinal} <br><span style="color:var(--muted)">${r.kmRodado.toFixed(1)} km</span>`;
            else if(tipo==='GANHO') txt=`<span style="color:#fff;font-weight:700">${formatMoney(r.ganho)}</span>`;
            else if(tipo==='RESULTADO'){
               const cust = (r.combustivel ? r.combustivel.valor : 0);
               const luc = r.ganho - cust;
               txt = `<span style="color:${luc>=0?'var(--success)':'var(--danger)'};font-weight:700">Lucro: ${formatMoney(luc)}</span>`;
            }
            act = (tipo==='RESULTADO') ? `<button class="action-btn btn-view" style="background:rgba(255,255,255,0.1);color:#fff">👁️</button>` : `<button class="action-btn btn-edit">✏️</button>`;
            row.innerHTML=`<div style="display:flex;align-items:center"><div class="hist-time">${hr}</div><div class="hist-data">${txt}</div></div><div style="display:flex">${act}<button class="action-btn btn-del">🗑️</button></div>`;
            row.querySelector('.btn-del').onclick=()=>{if(confirm('Apagar?')){ db[carroAtual.placa][ref].turnos = dayObj.turnos.filter(x=>x.id!==r.id); saveHistAll(db); renderHistory(tipo); }};
            if(tipo==='RESULTADO') row.querySelector('.btn-view').onclick=()=>{renderResultView(r)};
            else row.querySelector('.btn-edit').onclick=()=>{openEditModal(r,tipo,()=>renderHistory(tipo))};
            list.appendChild(row);
        });
    }

    if(tipo === 'DESPESA'){
        // Construir lista de despesas do dia:
        // - as "despesas" regulares (salvas via openAddExpenseModal)
        // - os combustíveis vindo dos turnos (reg.combustivel)
        // Importante: não duplicar combustíveis que foram previamente salvos em despesas.
        const savedDesp = (dayObj.despesas||[]).filter(d => !d.isTurno); // ignorar despesas marcadas como isTurno
        const allDesp = [...savedDesp];
        (dayObj.turnos||[]).forEach(t => { if(t.combustivel) allDesp.push({...t.combustivel, isTurno:true, id:t.id}); }); 
        allDesp.forEach(d => {
            hasItems = true; totalDia += (d.valor || d.custo || 0);
            const row=document.createElement('div'); row.className='history-item';
            const iconMap = { 'combustivel':'⛽', 'preventiva':'🛠️', 'corretiva':'🔧', 'documentos':'📄', 'estetica':'✨', 'outros':'📝' };
            const grp = d.grupo || 'combustivel'; 
            const sub = d.subgrupo || (d.tipo==='gnv'?'GNV':d.tipo);
            const val = d.valor || d.custo || 0;
            row.innerHTML=`<div style="display:flex;align-items:center"><div class="hist-time" style="background:transparent;font-size:20px;padding:0">${iconMap[grp]||'💸'}</div><div class="hist-data" style="margin-left:10px"><b style="text-transform:capitalize">${sub}</b><br><span style="color:var(--danger)">- ${formatMoney(val)}</span></div></div><div style="display:flex"><button class="action-btn btn-del">🗑️</button></div>`;
            row.querySelector('.btn-del').onclick=()=>{
                if(confirm('Apagar despesa?')){
                  if(d.isTurno) return alert('Esta despesa é de um turno. Apague o turno em Resultados.');
                  db[carroAtual.placa][ref].despesas = (dayObj.despesas||[]).filter(x=>x.id!==d.id);
                  saveHistAll(db); renderHistory(tipo);
                }
            };
            list.appendChild(row);
        });
    }

    if(!hasItems) list.innerHTML+='<div style="text-align:center;color:#444;margin-top:20px">Vazio.</div>';
    else if(tipo!=='KM' && tipo!=='RESULTADO'){
        const f=document.createElement('div');f.style.cssText='text-align:right;padding:10px;font-weight:800;color:var(--accent);font-size:18px';
        f.textContent=`Total: ${formatMoney(totalDia)}`;list.appendChild(f);
    }
  }

  function openEditModal(item,tipo,cb){
    const ov=document.createElement('div'); ov.className='modal-overlay';
    let inps='';
    inps=`<label class="big-label">KM Final</label><input type="number" id="eK" class="big-input" value="${item.kmFinal}"><label class="big-label">Ganho</label><input id="eG" class="big-input">`;
    ov.innerHTML=`<div class="modal-card"><div class="modal-title">Editar Turno</div>${inps}<button id="s" class="btn-primary">SALVAR</button><button id="c" class="btn-secondary">CANCELAR</button></div>`;
    document.body.appendChild(ov);
    const iK=ov.querySelector('#eK'); const iG=ov.querySelector('#eG');
    iG.dataset.raw=numToDigits(item.ganho); iG.value=digitsToBR(iG.dataset.raw); attachBR(iG);
    ov.querySelector('#c').onclick=()=>ov.remove();
    ov.querySelector('#s').onclick=()=>{
      const km=parseFloat(iK.value); const g=parseBR(iG); 
      if(km>=item.kmInicial){ item.kmFinal=km; item.kmRodado=Number((km-item.kmInicial).toFixed(2)); item.ganho=g; cb(); ov.remove(); } 
      else alert('KM Inválido');
      const db=loadHistAll(); 
      Object.keys(db[carroAtual.placa]||{}).forEach(d=>{
        if(db[carroAtual.placa][d].turnos){
          const ts=db[carroAtual.placa][d].turnos; const idx=ts.findIndex(t=>t.id===item.id); if(idx!==-1)ts[idx]=item;
        }
      }); 
      saveHistAll(db);
    };
  }

  function deleteTurno(placa,ymd,id){ const db=loadHistAll(); if(db[placa]?.[ymd]){db[placa][ymd].turnos=db[placa][ymd].turnos.filter(t=>t.id!==id); saveHistAll(db);} }
  function renderMiniCalendar(el,from,to,placa,sel){
    el.innerHTML=''; const arr=[];
    for(let d=new Date(from+'T12:00:00'); d<new Date(to+'T12:00:00'); d.setDate(d.getDate()+1)){
      const ymd=getLocalYMD(d); const div=document.createElement('div'); div.className=`day-dot ${ymd===sel?'day-selected':''}`; div.textContent=d.getDate(); div.dataset.ymd=ymd;
      const db=loadHistAll(); 
      const hasT = db[placa]?.[ymd]?.turnos?.length;
      const hasD = db[placa]?.[ymd]?.despesas?.length;
      if(hasT || hasD) div.classList.add('day-has-data');
      el.appendChild(div);
      arr.push(div);
    }
    return arr;
  }
})();

// MONTH PICKER
function openMonthPicker(init, cb){
  const ov=document.createElement('div'); ov.className='modal-overlay';
  let [y,m]=init.split('-').map(Number); m--;
  function draw(){
    const d=new Date(y,m,1);
    ov.innerHTML=`<div class="modal-card"><div style="display:flex;justify-content:space-between;margin-bottom:20px;align-items:center">
      <button id="p" class="action-btn">◀</button><div class="modal-title" style="margin:0;text-transform:uppercase">${d.toLocaleString('pt-BR',{month:'long'})} ${y}</div><button id="n" class="action-btn">▶</button></div>
      <div class="mini-calendar" id="gr" style="padding:0"></div><button id="x" class="btn-secondary" style="margin-top:20px">FECHAR</button></div>`;
    const g=ov.querySelector('#gr');
    for(let i=0;i<d.getDay();i++)g.appendChild(document.createElement('div'));
    const dim=new Date(y,m+1,0).getDate();
    for(let i=1;i<=dim;i++){
      const c=document.createElement('div'); c.className='day-dot'; c.textContent=i;
      const ymd=`${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      if(ymd===init)c.classList.add('day-selected');
      c.onclick=()=>{cb(ymd); ov.remove();}; g.appendChild(c);
    }
    ov.querySelector('#p').onclick=()=>{m--;if(m<0){m=11;y--;}draw();};
    ov.querySelector('#n').onclick=()=>{m++;if(m>11){m=0;y++;}draw();};
    ov.querySelector('#x').onclick=()=>ov.remove();
  }
  draw(); document.body.appendChild(ov);
}

// --- Ajuda rápida: abrir tutorial/modal quando clicar no botão "?" da garagem
(function(){
  const btnHelp = document.getElementById('btnGarageHelp');
  if(!btnHelp) return;

  btnHelp.addEventListener('click', ()=> {
    // se já existir, evita duplicar
    if(document.querySelector('.tutorial-overlay')) return;

    const ov = document.createElement('div');
    ov.className = 'tutorial-overlay';
    ov.innerHTML = `
      <div class="tutorial-card" role="dialog" aria-modal="true">
        <div style="text-align:center">
          <div class="tut-icon">❓</div>
          <div class="tut-title">Ajuda rápida — Garagem</div>
        </div>
        <div class="tut-text">
          <strong>O que faz cada parte:</strong>
          <ul style="text-align:left;margin:10px 0 12px 18px;color:var(--muted);line-height:1.4">
            <li><strong>+</strong> — Adiciona veículo (plaque, apelido, km atual).</li>
            <li><strong>🗑️</strong> — Excluir veículo (apaga histórico local).</li>
            <li>Clique no card do veículo para abrir o painel com: Calcular dia, Histórico KM, Ganhos e Combustível.</li>
            <li>Use o calendário no histórico para ver VALORES por dia (diário).</li>
          </ul>
          <div style="margin-top:6px;color:var(--muted)">Dica: o botão <strong>?</strong> abre esta tela. Feche tocando em "Entendi" ou fora da caixa.</div>
        </div>
        <div style="display:flex;gap:12px;margin-top:18px">
          <button id="helpClose" class="btn-primary" style="flex:1">Entendi</button>
          <button id="helpMore" class="btn-secondary" style="flex:1">Mais tarde</button>
        </div>
      </div>
    `;

    // fechar ao clicar fora
    ov.addEventListener('click', (e)=>{
      if(e.target === ov) ov.remove();
    });

    document.body.appendChild(ov);
    ov.querySelector('#helpClose').addEventListener('click', ()=> ov.remove());
    ov.querySelector('#helpMore').addEventListener('click', ()=> ov.remove());
  });
})();

