// ════════════════════════════════════════════
//  js/pdf.js — Módulo de generación de PDF y selección de categorías
//  Depende de globals: state, SECTIONS, pdfSelection, escapeHTML,
//                      countTotal, countDone, showToast, PERSONAL
//  Cargado después del script principal via <script src="js/pdf.js">
// ════════════════════════════════════════════

function initPdfSelection() {
  SECTIONS.forEach(sec => {
    if (!(sec.id in pdfSelection.cats)) pdfSelection.cats[sec.id] = true;
  });
}

function buildCatToggleList() {
  initPdfSelection();
  const wrap = document.getElementById("catToggleList");
  wrap.innerHTML = "";
  SECTIONS.forEach(sec => {
    const sel      = pdfSelection.cats[sec.id] !== false;
    const elimBuild = state.eliminados || [];
    const activosBuild = sec.vehicles.filter(v => !elimBuild.includes(sec.id+"_"+v.ro));
    const done     = activosBuild.filter(v => !!(state.vehicles[sec.id+"_"+v.ro]||{})._done).length;
    const item     = document.createElement("div");
    item.className = "cat-toggle-item" + (sel ? " selected" : "");
    item.id        = "catItem_" + sec.id;
    item.innerHTML = `
      <div>
        <div class="cat-toggle-label">${sec.label}</div>
        <div class="cat-toggle-sub">${activosBuild.length} unidades · ${done} relevadas</div>
      </div>
      <div class="cat-check" id="catCheck_${sec.id}">${sel ? "✓" : ""}</div>`;
    item.addEventListener("click", () => toggleCat(sec.id));
    wrap.appendChild(item);
  });
  // Sincronizar extras
  syncExtrasToggle();
}

function toggleCat(secId) {
  pdfSelection.cats[secId] = !pdfSelection.cats[secId];
  const sel  = pdfSelection.cats[secId];
  const item = document.getElementById("catItem_" + secId);
  const chk  = document.getElementById("catCheck_" + secId);
  if (item) item.classList.toggle("selected", sel);
  if (chk)  chk.textContent = sel ? "✓" : "";
}

function toggleExtra(which) {
  pdfSelection[which] = !pdfSelection[which];
  syncExtrasToggle();
}

function syncExtrasToggle() {
  ["personal","leyenda"].forEach(k => {
    const sel  = pdfSelection[k];
    const item = document.getElementById("toggle" + k.charAt(0).toUpperCase() + k.slice(1));
    const chk  = document.getElementById("check"  + k.charAt(0).toUpperCase() + k.slice(1));
    if (item) item.classList.toggle("selected", sel);
    if (chk)  chk.textContent = sel ? "✓" : "";
  });
}

function seleccionarTodasCats(val) {
  SECTIONS.forEach(sec => {
    pdfSelection.cats[sec.id] = val;
    const item = document.getElementById("catItem_" + sec.id);
    const chk  = document.getElementById("catCheck_" + sec.id);
    if (item) item.classList.toggle("selected", val);
    if (chk)  chk.textContent = val ? "✓" : "";
  });
}

function fillPreview() {
  const t=countTotal(), d=countDone();
  document.getElementById("p-total").textContent = t;
  document.getElementById("p-done").textContent  = d;
  document.getElementById("p-pend").textContent  = t-d;
  const [y,m,dd]=(state.fecha||"--").split("-");
  document.getElementById("previewMeta").innerHTML =
    `<b>Fecha:</b> ${dd}/${m}/${y}<br><b>Oficial:</b> ${escapeHTML(state.oficial)}<br><b>Ayudante:</b> ${escapeHTML(state.ayudante)}`;
  document.getElementById("pendWarn").innerHTML = t-d>0
    ? `<div class="warn-box">⚠️ <b>${t-d}</b> móvil(es) sin completar. El PDF incluirá los datos disponibles.</div>`
    : `<div class="info-box">✅ Todos los móviles completados.</div>`;
  buildCatToggleList();
}


// ════════════════════════════════════════════
//  GENERACIÓN DE PDF
// ════════════════════════════════════════════

function generatePDF(){
  // ── Warning si quedan vehículos sin revisar ───────────────────────────────
  const total = countTotal(), done = countDone(), pend = total - done;
  if (pend > 0) {
    const continuar = confirm(
      `⚠️ Hay ${pend} vehículo${pend > 1 ? "s" : ""} sin revisar.\n\n` +
      `El PDF se generará con esas filas incompletas.\n\n` +
      `¿Querés continuar de todos modos?`
    );
    if (!continuar) return;
  }
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const PW=210,ML=13,CR=PW-ML*2;
  const [fy,fm,fd]=(state.fecha||"0000-00-00").split("-");
  const fechaStr=`${fd}/${fm}/${fy}`;
  const nroInforme=`INF-${(state.fecha||"").replace(/-/g,"")}`;
  const C={
    navy:[0,53,128], navy2:[0,80,179],
    blue3:[0,174,195],    // turquesa Manual de Marca Buenos Aires #00aec3
    blue4:[208,240,245],  // turquesa muy claro
    white:[255,255,255], off:[244,246,250], text:[13,27,42], muted:[90,106,126],
    head:[0,53,128], htext:[255,255,255], alt:[244,246,250],
    ok:[13,110,47], no:[185,28,28], roto:[146,64,14], na:[100,116,139],
    border:[208,217,232],
  };
  let pageNum=0;

  const LOGO_B64 = "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";
  const LOGO_DER_B64 = "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";

  function addPageHeader(incrementar){
    if(incrementar !== false) pageNum++;
    doc.setFillColor(...C.navy); doc.rect(0,0,PW,14,"F");
    // Logo izquierdo: Escudo Di.Pro.Tran.
    try { doc.addImage(LOGO_B64,"JPEG",ML,1.2,14,12); }
    catch(e) { doc.setFontSize(5); doc.setTextColor(...C.blue4); doc.text("DiProTrans",ML+7,7,{align:"center"}); }
    // Logo derecho: Policía Buenos Aires
    try { doc.addImage(LOGO_DER_B64,"JPEG",PW-ML-20,2,20,10); }
    catch(e) { doc.setFontSize(5); doc.setTextColor(...C.blue4); doc.text("POLICÍA",PW-ML-10,7,{align:"center"}); }
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...C.white);
    doc.text("INFORME DIARIO DE GUARDIA — DIPROTRAN",PW/2,6.5,{align:"center"});
    doc.setFontSize(6.5); doc.setFont("helvetica","normal"); doc.setTextColor(...C.blue4);
    doc.text("Dirección Provincial de Transporte — 2ª Sección",PW/2,11,{align:"center"});
    doc.setFillColor(...C.blue3); doc.rect(0,14,PW,6,"F");  // turquesa BA
    doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...C.white);
    doc.text(`Fecha: ${fechaStr}`,ML,18.2);
    doc.text(`Nro.: ${nroInforme}`,PW/2,18.2,{align:"center"});
    doc.text(`Pág. ${pageNum}`,PW-ML,18.2,{align:"right"});
    doc.setDrawColor(...C.blue4); doc.setLineWidth(0.3);
    doc.line(0,20,PW,20);
  }

  // Hook reutilizable para todas las tablas: dibuja encabezado en página nueva
  function didDrawPageHook(data){
    if(data.pageNumber > 1){
      pageNum++;
      addPageHeader(false); // ya incrementamos arriba
    }
  }

  // Altura estimada de una tabla: cabecera + filas
  // rowH: altura por fila (mm), headH: altura del encabezado
  function estimarAlturaTabla(nFilas, nCols, rowH, headH){
    return headH + nFilas * rowH + 2; // +2 de margen inferior
  }

  const PAGE_BOTTOM = 282; // límite inferior usable de A4 (297 - 15mm margen)
  const HEAD_H = 9;        // altura del bloque de título de sección (mm)

  function addSection(secId, yStart){
    const sec    = SECTIONS.find(s=>s.id===secId);
    const fields = FIELDS[sec.type]||[];
    // Filtrar vehículos dados de baja del PDF
    const elim     = state.eliminados || [];
    const vehiculos = sec.vehicles.filter(v => !elim.includes(secId+"_"+v.ro));
    if (!vehiculos.length) return yStart; // sección vacía tras filtrar bajas
    const nFilas = vehiculos.length;

    // ── Estimación de altura total de esta sección ──
    const rowH  = sec.type==="no_ident" ? 7  : 7;   // altura por fila (mm)
    const headH = 8;                                  // altura de encabezado de tabla
    const alturaEstimada = HEAD_H + estimarAlturaTabla(nFilas, fields.length+2, rowH, headH);

    // ── Salto preventivo si no entra completa ──
    let y = yStart;
    if (y + alturaEstimada > PAGE_BOTTOM) {
      doc.addPage();
      addPageHeader();
      y = 26;
    }

    // ── Título de sección ──
    doc.setFillColor(...C.navy); doc.roundedRect(ML,y,CR,7,1.5,1.5,"F");
    doc.setFillColor(...C.blue3); doc.rect(ML,y,4,7,"F");  // acento turquesa BA
    doc.setFontSize(8.5); doc.setFont("helvetica","bold"); doc.setTextColor(...C.white);
    doc.text(sec.label,ML+6,y+4.9);
    doc.setTextColor(...C.blue4); doc.setFontSize(7);
    doc.text(`${vehiculos.length} unidades`,PW-ML,y+4.9,{align:"right"});
    y+=9;

    if(sec.type==="no_ident"){
      const rows=vehiculos.map((v,idx)=>{
        const d=state.vehicles[sec.id+"_"+v.ro]||{};
        return [String(idx+1),v.marca||"",v.modelo||"",v.ro,d.obs||""];
      });
      doc.autoTable({
        startY:y,
        head:[["#","Marca","Modelo","Dominio/RO","Observaciones"]],
        body:rows,
        margin:{left:ML,right:ML,top:26},
        rowPageBreak:"avoid",
        styles:{fontSize:7.5,cellPadding:2,lineColor:C.border,lineWidth:0.15,textColor:C.text,overflow:"linebreak"},
        headStyles:{fillColor:C.head,textColor:C.htext,fontStyle:"bold",fontSize:7.5,cellPadding:2.5,halign:"center"},
        alternateRowStyles:{fillColor:C.alt},
        columnStyles:{0:{cellWidth:7,halign:"center"},1:{cellWidth:22,fontStyle:"bold"},2:{cellWidth:25},3:{cellWidth:22,fontStyle:"bold"},4:{cellWidth:CR-76}},
        didDrawPage: didDrawPageHook
      });
      return doc.lastAutoTable.finalY+5;
    }

    const headers=["#","RO",...fields.map(f=>f.label),"Observaciones"];
    const fixedW=7+18,obsW=33;
    const fW=fields.length>0?Math.max(10,Math.floor((CR-fixedW-obsW)/fields.length)):0;
    const colStyles={0:{cellWidth:7,halign:"center"},1:{cellWidth:18,fontStyle:"bold"}};
    fields.forEach((f,i)=>{colStyles[i+2]={cellWidth:fW,halign:"center"};});
    colStyles[fields.length+2]={cellWidth:obsW};

    const rows=vehiculos.map((v,idx)=>{
      const key=sec.id+"_"+v.ro;
      const d=state.vehicles[key]||{};
      const extra=[v.modelo||v.marca||""].filter(Boolean).join(" ");
      return [String(idx+1),extra?`${v.ro}\n${extra}`:v.ro,...fields.map(f=>d[f.id]||"—"),d.obs||""];
    });

    doc.autoTable({
      startY:y,
      head:[headers],
      body:rows,
      margin:{left:ML,right:ML,top:26},
      rowPageBreak:"avoid",
      styles:{fontSize:7.5,cellPadding:2,lineColor:C.border,lineWidth:0.15,textColor:C.text,overflow:"linebreak"},
      headStyles:{fillColor:C.head,textColor:C.htext,fontStyle:"bold",fontSize:7.5,cellPadding:2.5,halign:"center"},
      alternateRowStyles:{fillColor:C.alt},
      columnStyles:colStyles,
      didParseCell:(data)=>{
        if(data.section==="body"){
          const v=data.cell.raw;
          if(v==="OK"){data.cell.styles.textColor=C.ok;data.cell.styles.fontStyle="bold";}
          if(v==="NO"){data.cell.styles.textColor=C.no;data.cell.styles.fontStyle="bold";}
          if(v==="Roto"){data.cell.styles.textColor=C.roto;data.cell.styles.fontStyle="bold";}
          if(v==="N/A"){data.cell.styles.textColor=C.na;}
        }
      },
      didDrawPage: didDrawPageHook
    });
    return doc.lastAutoTable.finalY+5;
  }

  function addPersonalPage(){
    doc.addPage(); addPageHeader();
    let y=26;
    doc.setFillColor(...C.navy); doc.roundedRect(ML,y,CR,8,1.5,1.5,"F");
    doc.setFillColor(...C.blue3); doc.rect(ML,y,3,8,"F");
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...C.white);
    doc.text("PERSONAL DE GUARDIA",ML+6,y+5.5);
    y+=14;
    const personal_ordenado = ordenarPersonal([...PERSONAL_BASE]);
    const rows=personal_ordenado.map((ef,idx)=>{
      const d=state.personal[ef.id]||{};
      const func=d.funcion||ef.funcion_base||"chofer";
      const funcLabel=FUNCIONES.find(f=>f.id===func)?.label||func;
      const jerFull=JERARQUIAS[ef.jerarquia]||ef.jerarquia;
      const nombreCompleto=`${ef.jerarquia} ${ef.nombre}
${jerFull} · ${ef.escalafon||""}`;
      return [String(idx+1), nombreCompleto, funcLabel, d.obs||""];
    });
    doc.autoTable({startY:y,head:[["#","Efectivo — Jerarquía · Subescalafón","Función del día","Observaciones"]],body:rows,
      margin:{left:ML,right:ML,top:26},
      rowPageBreak:"avoid",
      styles:{fontSize:7.5,cellPadding:2.5,lineColor:C.border,lineWidth:0.15,textColor:C.text,overflow:"linebreak"},
      headStyles:{fillColor:C.head,textColor:C.htext,fontStyle:"bold",halign:"center",fontSize:7.5},
      alternateRowStyles:{fillColor:C.alt},
      columnStyles:{0:{cellWidth:8,halign:"center"},1:{cellWidth:65,fontStyle:"bold"},2:{cellWidth:35},3:{cellWidth:CR-108}},
      didDrawPage: didDrawPageHook
    });
  }

  function addLegendPage(){
    doc.addPage(); addPageHeader();
    let y=26;
    doc.setFillColor(...C.navy); doc.roundedRect(ML,y,CR,8,1.5,1.5,"F");
    doc.setFillColor(...C.blue3); doc.rect(ML,y,3,8,"F");
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...C.white);
    doc.text("REFERENCIAS Y CONVENCIONES",ML+6,y+5.5);
    y+=14;
    const legendItems=[
      {code:"OK",color:C.ok,desc:"Funciona correctamente / Presente y en buen estado"},
      {code:"NO",color:C.no,desc:"No funciona / Falta / Fuera de servicio"},
      {code:"Roto",color:C.roto,desc:"Presente pero deteriorado o con daño visible"},
      {code:"N/A",color:C.na,desc:"No Aplica — el ítem no corresponde a este vehículo"},
    ];
    legendItems.forEach((item,i)=>{
      const bx=ML,by=y+i*18;
      doc.setFillColor(...item.color); doc.roundedRect(bx,by,18,12,2,2,"F");
      doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(...C.white);
      doc.text(item.code,bx+9,by+7.5,{align:"center"});
      doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...C.navy);
      doc.text(item.code,ML+22,by+5);
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...C.text);
      doc.text(item.desc,ML+22,by+10.5);
      doc.setDrawColor(...C.border); doc.setLineWidth(0.2);
      doc.line(ML,by+14,PW-ML,by+14);
    });
    y+=legendItems.length*18+10;
    const catRows=Object.entries(FIELDS)
      .filter(([,f])=>f.length>0)
      .map(([type,f])=>[SECTIONS.find(s=>s.type===type)?.label||type,f.map(x=>x.label).join(" · ")]);
    doc.autoTable({startY:y,head:[["Categoría","Campos evaluados"]],body:catRows,
      margin:{left:ML,right:ML,top:26},
      rowPageBreak:"avoid",
      styles:{fontSize:7.5,cellPadding:2.5,textColor:C.text,lineColor:C.border,lineWidth:0.15},
      headStyles:{fillColor:C.head,textColor:C.htext,fontStyle:"bold"},
      alternateRowStyles:{fillColor:C.alt},
      columnStyles:{0:{cellWidth:32,fontStyle:"bold"}},
      didDrawPage: didDrawPageHook
    });
    const fy2=doc.lastAutoTable.finalY+14;
    doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
    doc.line(ML,fy2-4,PW-ML,fy2-4);
    doc.setFillColor(...C.off); doc.setDrawColor(...C.border);
    doc.roundedRect(ML,fy2,22,10,1,1,"FD");
    doc.roundedRect(PW-ML-22,fy2,22,10,1,1,"FD");
    doc.setFontSize(5.5); doc.setFont("helvetica","italic"); doc.setTextColor(...C.muted);
    doc.text("LOGO",ML+11,fy2+6,{align:"center"});
    doc.text("LOGO",PW-ML-11,fy2+6,{align:"center"});
    doc.setFontSize(7); doc.setTextColor(...C.muted);
    doc.text(`Generado: ${new Date().toLocaleString("es-AR")} — Sistema de Guardia DIPROTRAN`,PW/2,fy2+6,{align:"center"});
  }

  // ── Pie de página (se aplica a todas las hojas al final) ─────────────────
  function addPageFooter(pNum, total) {
    const fyBot = 291;
    doc.setDrawColor(...C.blue3); doc.setLineWidth(0.4);
    doc.line(ML, fyBot-5, PW-ML, fyBot-5);
    doc.setFontSize(5.5); doc.setFont("helvetica","italic"); doc.setTextColor(...C.muted);
    doc.text("Policía de la Prov. de Buenos Aires — Dirección Provincial de Transporte",ML,fyBot-1.5);
    doc.text(`${nroInforme} · Pág. ${pNum}/${total} · Generado: ${new Date().toLocaleString("es-AR")}`,PW-ML,fyBot-1.5,{align:"right"});
  }

  // ── Página de firmas ─────────────────────────────────────────────────────
  function addFirmaPage(){
    doc.addPage(); addPageHeader();
    let y=28;
    doc.setFillColor(...C.navy); doc.roundedRect(ML,y,CR,8,1.5,1.5,"F");
    doc.setFillColor(...C.blue3); doc.rect(ML,y,3,8,"F");
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...C.white);
    doc.text("VALIDACIÓN Y FIRMA",ML+6,y+5.5);
    y+=14;

    // Resumen ejecutivo
    const totalV  = Object.keys(state.vehicles||{}).length;
    const doneV   = Object.values(state.vehicles||{}).filter(v=>v._done).length;
    const novCount= Object.values(state.vehicles||{}).filter(v=>v.obs?.trim()||v.fotoUrl).length;
    const vacCount= Object.keys(state.vacaciones||{}).filter(k=>(state.vacaciones||{})[k]).length;
    const resumen = [
      ["Número de informe",nroInforme],
      ["Fecha del turno",fechaStr],
      ["Oficial de servicio",state.oficial||"—"],
      ["Ayudante de guardia",state.ayudante||"—"],
      ["Vehículos relevados",`${doneV} de ${totalV}`],
      ["Novedades registradas",String(novCount)],
      ["Efectivos en licencia/vacaciones",String(vacCount)],
    ];
    doc.autoTable({
      startY:y, body:resumen,
      margin:{left:ML,right:ML,top:26},
      styles:{fontSize:9,cellPadding:3.5,lineColor:C.border,lineWidth:0.2,textColor:C.text},
      alternateRowStyles:{fillColor:C.off},
      columnStyles:{0:{cellWidth:70,fontStyle:"bold",textColor:C.navy},1:{cellWidth:CR-70}},
      theme:"grid",
      didDrawPage:didDrawPageHook
    });
    y=doc.lastAutoTable.finalY+18;

    // Cajas de firma
    const boxW=(CR-12)/3, boxH=36;
    const firmas=[
      {label:"Oficial de Servicio",nombre:state.oficial||"",cargo:"Firma y sello"},
      {label:"Revisado por Jefe",nombre:"",cargo:"Firma y sello"},
      {label:"Registro / Control",nombre:"",cargo:"Firma y sello"},
    ];
    firmas.forEach((f,i)=>{
      const bx=ML+i*(boxW+6);
      doc.setFillColor(248,251,255); doc.setDrawColor(...C.border); doc.setLineWidth(0.5);
      doc.roundedRect(bx,y,boxW,boxH,2,2,"FD");
      // Título de la caja
      doc.setFillColor(...C.navy); doc.roundedRect(bx,y,boxW,9,2,2,"F");
      doc.rect(bx,y+5,boxW,4,"F"); // cuadrar abajo del rounded
      doc.setFontSize(7.5); doc.setFont("helvetica","bold"); doc.setTextColor(...C.white);
      doc.text(f.label,bx+boxW/2,y+6,{align:"center"});
      // Nombre pre-impreso
      if(f.nombre){
        doc.setFontSize(7.5); doc.setFont("helvetica","italic"); doc.setTextColor(...C.text);
        doc.text(f.nombre,bx+boxW/2,y+boxH-18,{align:"center"});
      }
      // Línea de firma
      doc.setDrawColor(...C.navy2); doc.setLineWidth(0.5);
      doc.line(bx+6,y+boxH-11,bx+boxW-6,y+boxH-11);
      // Texto "Firma y sello"
      doc.setFontSize(6.5); doc.setFont("helvetica","normal"); doc.setTextColor(...C.muted);
      doc.text(f.cargo,bx+boxW/2,y+boxH-5,{align:"center"});
    });
    y+=boxH+14;

    // Nota de confidencialidad
    doc.setFontSize(6.5); doc.setFont("helvetica","italic"); doc.setTextColor(...C.muted);
    doc.text("Documento de uso interno — Dirección Provincial de Transporte — Policía de la Provincia de Buenos Aires.",PW/2,y,{align:"center"});
    doc.text("Generado automáticamente por el Sistema de Guardia DI.PRO.TRAN.",PW/2,y+5,{align:"center"});
  }

  // ── RENDER ──
  // Categorías seleccionadas (respetar pdfSelection)
  const secsToRender = SECTIONS.filter(sec => pdfSelection.cats[sec.id] !== false);

  addPageHeader();
  let curY=24;
  const infoLines=[["Fecha:",fechaStr],["Oficial de Servicio:",state.oficial],["Ayudante de Guardia:",state.ayudante]];
  doc.autoTable({
    startY:curY,
    body:infoLines,
    margin:{left:ML,right:ML,top:26},
    rowPageBreak:"avoid",
    styles:{fontSize:9,cellPadding:3.5,lineColor:C.border,lineWidth:0.2,textColor:C.text},
    alternateRowStyles:{fillColor:C.off},
    columnStyles:{0:{cellWidth:52,fontStyle:"bold",textColor:C.navy},1:{cellWidth:CR-52}},
    theme:"grid",
    didDrawPage:didDrawPageHook
  });
  curY=doc.lastAutoTable.finalY+8;

  // ── Secciones ──
  secsToRender.forEach(sec=>{
    const ny=addSection(sec.id,curY);
    if(ny) curY=ny+4;
  });

  // ── Personal ──
  if(pdfSelection.personal) addPersonalPage();

  // ── Leyenda ──
  if(pdfSelection.leyenda) addLegendPage();

  // ── Página de firmas ──
  addFirmaPage();

  // ── Pie de página en todas las hojas ──
  const totalPages=doc.getNumberOfPages();
  for(let p=1;p<=totalPages;p++){ doc.setPage(p); addPageFooter(p,totalPages); }

  doc.save(`Guardia_${fechaStr}_DIPROTRAN.pdf`);
}

// ════════════════════════════════════════════
//  COMPARADOR DE INFORMES
// ════════════════════════════════════════════
let _compInformes = [];

