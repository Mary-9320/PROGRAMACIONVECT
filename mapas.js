(function(){
"use strict";
var po=window.__po;if(!po)return;
var S=po.S,$=po.$,esc=po.esc,pad=po.pad,toast=po.toast;
S.mp={data:null,loading:false,err:"",mun:"",sec:"",loc:"",manz:"",modo:"seccion",pv:0,busy:false};
/* ---------- mapas (croquis por sector y manzana) ---------- */
var MP_COL={ctx:[246,246,244],ctxL:[205,210,210],sec:[222,236,236],secL:[84,110,110],sel:[11,110,110],selL:[6,70,70],txt:[40,52,54]};
function rgb(a){return "rgb("+a[0]+","+a[1]+","+a[2]+")"}
function mpDecode(j){
  var by={};
  j.manzanas.forEach(function(r){
    var rings=r[6].map(function(q){
      var x=q[1],y=q[2],p=[[x/10,y/10]];
      for(var i=3;i<q.length;i+=2){x+=q[i];y+=q[i+1];p.push([x/10,y/10])}
      return {h:q[0],p:p};
    });
    var x0=1e12,y0=1e12,x1=-1e12,y1=-1e12,best=null,bestA=-1;
    rings.forEach(function(g){
      if(g.h)return;
      var a=0,cx=0,cy=0,p=g.p;
      for(var i=0;i<p.length;i++){
        var q=p[(i+1)%p.length],f=p[i][0]*q[1]-q[0]*p[i][1];
        a+=f;cx+=(p[i][0]+q[0])*f;cy+=(p[i][1]+q[1])*f;
        if(p[i][0]<x0)x0=p[i][0];if(p[i][0]>x1)x1=p[i][0];if(p[i][1]<y0)y0=p[i][1];if(p[i][1]>y1)y1=p[i][1];
      }
      if(Math.abs(a)>bestA){bestA=Math.abs(a);best=a?[cx/(3*a),cy/(3*a)]:[p[0][0],p[0][1]]}
    });
    var m={mun:r[0],sec:r[1],man:r[2],loc:r[3],clave:r[4],area:r[5],rings:rings,bb:[x0,y0,x1,y1],w:x1-x0,h:y1-y0,c:best||[(x0+x1)/2,(y0+y1)/2]};
    (by[m.mun]=by[m.mun]||[]).push(m);
  });
  return {muns:j.municipios,by:by};
}
function mpPool(){var d=S.mp.data;return d&&S.mp.mun?(d.by[S.mp.mun]||[]):[]}
function mpUniq(list,k){var s={};list.forEach(function(m){s[m[k]]=1});return Object.keys(s).map(Number).sort(function(a,b){return a-b})}
function mpSecs(){return mpUniq(mpPool(),"sec")}
function mpLocs(){var sec=+S.mp.sec;return mpUniq(mpPool().filter(function(m){return m.sec===sec}),"loc")}
function mpParse(t){
  var set={},bad=[];
  String(t||"").replace(/\s*-\s*/g,"-").split(/[,;\s]+/).forEach(function(x){
    if(!x)return;
    var m=/^(\d+)-(\d+)$/.exec(x);
    if(m){var a=+m[1],b=+m[2];if(b<a||b-a>500){bad.push(x);return}for(var i=a;i<=b;i++)set[i]=1}
    else if(/^\d+$/.test(x))set[+x]=1;else bad.push(x);
  });
  return {set:set,bad:bad};
}
function mpSel(){
  var r=S.mp,p=mpParse(r.manz),sec=+r.sec,loc=r.loc===""?null:+r.loc;
  var base=r.sec===""?[]:mpPool().filter(function(m){return m.sec===sec&&(loc===null||m.loc===loc)});
  var sel=base.filter(function(m){return p.set[m.man]});
  var found={};sel.forEach(function(m){found[m.man]=1});
  var miss=Object.keys(p.set).filter(function(k){return !found[k]});
  var todo=r.sec!==""&&!Object.keys(p.set).length&&!p.bad.length;
  return {base:base,sel:sel,miss:miss,bad:p.bad,mans:Object.keys(p.set).length,todo:todo,print:todo?base:sel};
}
function mpBBox(l){
  var x0=1e12,y0=1e12,x1=-1e12,y1=-1e12;
  l.forEach(function(m){if(m.bb[0]<x0)x0=m.bb[0];if(m.bb[1]<y0)y0=m.bb[1];if(m.bb[2]>x1)x1=m.bb[2];if(m.bb[3]>y1)y1=m.bb[3]});
  return {x0:x0,y0:y0,x1:x1,y1:y1};
}
function mpViewSec(base){
  var b=mpBBox(base),w=b.x1-b.x0,h=b.y1-b.y0,pad=Math.max(25,Math.max(w,h)*0.05);
  return {x0:b.x0-pad,y0:b.y0-pad,x1:b.x1+pad,y1:b.y1+pad};
}
function mpViewMan(foc){
  var b=mpBBox(foc),w=b.x1-b.x0,h=b.y1-b.y0,pad=Math.max(70,Math.max(w,h)*0.9);
  return {x0:b.x0-pad,y0:b.y0-pad,x1:b.x1+pad,y1:b.y1+pad};
}
function mpInView(v){
  return mpPool().filter(function(m){return !(m.bb[2]<v.x0||m.bb[0]>v.x1||m.bb[3]<v.y0||m.bb[1]>v.y1)});
}
function mpNice(max){var n=[10,20,50,100,200,500,1000,2000,5000],o=n[0];for(var i=0;i<n.length;i++)if(n[i]<=max)o=n[i];return o}
/* nivel de cada manzana: 0 contexto, 1 misma sección, 2 seleccionada */
function mpNivel(m,selSet,sec,loc){return selSet.has(m)?2:(m.sec===sec&&(loc===null||m.loc===loc)?1:0)}
function mpLabelFs(m,base,nivel){
  var mn=Math.min(m.w,m.h);
  if(nivel===2)return Math.max(base*1.2,Math.min(mn*0.5,base*2.2));
  if(nivel===0)return 0;
  if(mn<base*1.1)return 0;
  return Math.min(base,mn*0.45);
}
function mpPathD(m,v){
  return m.rings.map(function(g){
    return "M"+g.p.map(function(p){return (p[0]-v.x0).toFixed(1)+","+(v.y1-p[1]).toFixed(1)}).join("L")+"Z";
  }).join("");
}
function mpSvg(v,sel){
  var W=v.x1-v.x0,H=v.y1-v.y0,selSet=new Set(sel),sec=+S.mp.sec,loc=S.mp.loc===""?null:+S.mp.loc;
  var base=Math.max(W,H)/60,items=mpInView(v).map(function(m){return {m:m,n:mpNivel(m,selSet,sec,loc)}});
  items.sort(function(a,b){return a.n-b.n});
  var o='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W.toFixed(1)+' '+H.toFixed(1)+'" role="img" aria-label="Croquis de manzanas" style="display:block;width:100%;height:auto;max-height:75vh;background:#fff">';
  var sw=Math.max(W,H)/900;
  items.forEach(function(it){
    var f=it.n===2?MP_COL.sel:it.n===1?MP_COL.sec:MP_COL.ctx,l=it.n===2?MP_COL.selL:it.n===1?MP_COL.secL:MP_COL.ctxL;
    o+='<path d="'+mpPathD(it.m,v)+'" fill="'+rgb(f)+'" stroke="'+rgb(l)+'" stroke-width="'+(it.n===2?sw*2:sw)+'" fill-rule="evenodd"/>';
  });
  items.forEach(function(it){
    var fs=mpLabelFs(it.m,base,it.n);if(!fs)return;
    o+='<text x="'+(it.m.c[0]-v.x0).toFixed(1)+'" y="'+(v.y1-it.m.c[1]).toFixed(1)+'" font-size="'+fs.toFixed(1)+'" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-weight="'+(it.n===2?700:400)+'" fill="'+(it.n===2?"#fff":rgb(MP_COL.txt))+'">'+it.m.man+'</text>';
  });
  var L=mpNice(W/4),bx=W*0.03,by=H*0.965,bh=Math.max(W,H)/180;
  o+='<g><rect x="'+bx+'" y="'+(by-bh)+'" width="'+L/2+'" height="'+bh+'" fill="#222"/><rect x="'+(bx+L/2)+'" y="'+(by-bh)+'" width="'+L/2+'" height="'+bh+'" fill="#fff" stroke="#222" stroke-width="'+sw+'"/>'+
     '<text x="'+bx+'" y="'+(by-bh*1.8)+'" font-size="'+base*0.9+'" font-family="Arial,sans-serif" fill="#222">0</text>'+
     '<text x="'+(bx+L)+'" y="'+(by-bh*1.8)+'" font-size="'+base*0.9+'" text-anchor="middle" font-family="Arial,sans-serif" fill="#222">'+L+' m</text></g>';
  var ax=W*0.96,ay=H*0.04+base*2.4,ar=base*1.8;
  o+='<g fill="#222"><polygon points="'+ax+','+(ay-ar*1.4)+' '+(ax-ar*0.55)+','+ay+' '+ax+','+(ay-ar*0.35)+' '+(ax+ar*0.55)+','+ay+'"/><text x="'+ax+'" y="'+(ay-ar*1.6)+'" font-size="'+base*1.2+'" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700">N</text></g>';
  return o+'</svg>';
}
function mpPaginas(s){
  if(!s.print.length)return [];
  if(S.mp.modo==="seccion")return [{v:mpViewSec(s.base),foc:s.print,hl:s.sel,tit:"Sección completa"}];
  var g={},orden=[];
  s.print.forEach(function(m){var k=m.man+"|"+m.loc;if(!g[k]){g[k]=[];orden.push(k)}g[k].push(m)});
  orden.sort(function(a,b){var x=a.split("|"),y=b.split("|");return (+x[0]-+y[0])||(+x[1]-+y[1])});
  return orden.map(function(k){var m=g[k][0];return {v:mpViewMan(g[k]),foc:g[k],hl:s.todo?g[k]:s.sel,tit:"Manzana "+m.man+(S.mp.loc===""?" - Loc. "+String(m.loc).padStart(4,"0"):""),mans:String(m.man),loc:m.loc}});
}
function mpLocTxt(){return S.mp.loc===""?"todas":("Loc. "+String(S.mp.loc).padStart(4,"0"))}
function mpMunNom(){return S.mp.data?S.mp.data.muns[S.mp.mun]:""}

/* ---------- mapas: pdf ---------- */
function mpPoly(doc,m,X,Y,s,fill,line,lw){
  doc.setLineWidth(lw);doc.setDrawColor(line[0],line[1],line[2]);
  m.rings.forEach(function(g){
    var p=g.p;if(p.length<3)return;
    var vec=[];for(var i=1;i<p.length;i++)vec.push([(p[i][0]-p[i-1][0])*s,-(p[i][1]-p[i-1][1])*s]);
    if(g.h)doc.setFillColor(255,255,255);else doc.setFillColor(fill[0],fill[1],fill[2]);
    doc.lines(vec,X(p[0][0]),Y(p[0][1]),[1,1],"FD",true);
  });
}
function mpDrawPage(doc,pg,s){
  var pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),v=pg.v,W=v.x1-v.x0,H=v.y1-v.y0;
  var r=S.mp,selSet=new Set(pg.hl),sec=+r.sec,loc=r.loc===""?null:+r.loc;
  var mans=pg.mans||(s.todo?"Todas ("+s.base.length+")":mpManzTxt(s));
  doc.setTextColor(20,40,43);doc.setFont("helvetica","bold");doc.setFontSize(16);doc.text("Croquis de manzanas",10,13);
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(83,104,107);
  doc.text("Jurisdicción Sanitaria 6 - Nuevo León",10,18.5);
  doc.text("Fecha de impresión: "+(function(){var d=new Date();return pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear()})(),pw-10,13,{align:"right"});
  doc.setTextColor(20,40,43);doc.setFontSize(11);
  doc.setFont("helvetica","bold");doc.text("Municipio:",10,25.5);doc.setFont("helvetica","normal");doc.text(mpMunNom(),31,25.5);
  doc.setFont("helvetica","bold");doc.text("Sector (sección):",pw*0.52,25.5);doc.setFont("helvetica","normal");doc.text(String(sec),pw*0.52+34,25.5);
  doc.setFont("helvetica","bold");doc.text("Localidad:",10,31);doc.setFont("helvetica","normal");doc.text(pg.loc!=null?"Loc. "+String(pg.loc).padStart(4,"0"):mpLocTxt(),31,31);
  doc.setFont("helvetica","bold");doc.text("Manzana(s):",pw*0.52,31);doc.setFont("helvetica","normal");
  var mt=doc.splitTextToSize(mans,pw-10-(pw*0.52+25));doc.text(mt.slice(0,2),pw*0.52+25,31);
  var bx=10,by=36,bw=pw-20,bh=ph-36-20;
  var sc=Math.min((bw-4)/W,(bh-4)/H),ox=bx+(bw-W*sc)/2,oy=by+(bh-H*sc)/2;
  function X(x){return ox+(x-v.x0)*sc}
  function Y(y){return oy+(v.y1-y)*sc}
  doc.setDrawColor(150,160,160);doc.setLineWidth(0.3);doc.rect(bx,by,bw,bh);
  doc.saveGraphicsState();doc.rect(bx,by,bw,bh,null);doc.clip();doc.discardPath();
  var items=mpInView(v).map(function(m){return {m:m,n:mpNivel(m,selSet,sec,loc)}});
  items.sort(function(a,b){return a.n-b.n});
  items.forEach(function(it){
    var f=it.n===2?MP_COL.sel:it.n===1?MP_COL.sec:MP_COL.ctx,l=it.n===2?MP_COL.selL:it.n===1?MP_COL.secL:MP_COL.ctxL;
    mpPoly(doc,it.m,X,Y,sc,f,l,it.n===2?0.35:0.15);
  });
  var base=Math.max(W,H)/60;
  items.forEach(function(it){
    var fs=mpLabelFs(it.m,base,it.n);if(!fs)return;
    var pt=Math.max(4.5,Math.min(16,fs*sc*2.835));
    doc.setFont("helvetica",it.n===2?"bold":"normal");doc.setFontSize(pt);
    if(it.n===2)doc.setTextColor(255,255,255);else doc.setTextColor(MP_COL.txt[0],MP_COL.txt[1],MP_COL.txt[2]);
    doc.text(String(it.m.man),X(it.m.c[0]),Y(it.m.c[1]),{align:"center",baseline:"middle"});
  });
  doc.restoreGraphicsState();
  /* norte */
  var ax=bx+bw-9,ay=by+14;
  doc.setFillColor(34,34,34);doc.setDrawColor(34,34,34);
  doc.triangle(ax,ay-9,ax-3,ay,ax+3,ay,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(34,34,34);doc.text("N",ax,ay-10.5,{align:"center"});
  /* escala */
  var L=mpNice(60/sc),Lmm=L*sc,sy=ph-12,sx=10;
  doc.setLineWidth(0.25);doc.setDrawColor(34,34,34);
  doc.setFillColor(34,34,34);doc.rect(sx,sy,Lmm/2,2,"FD");doc.setFillColor(255,255,255);doc.rect(sx+Lmm/2,sy,Lmm/2,2,"FD");
  doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(34,34,34);
  doc.text("0",sx,sy-1.2,{align:"center"});doc.text(L+" m",sx+Lmm,sy-1.2,{align:"center"});
  var N=Math.max(50,Math.round(1000/sc/50)*50);
  doc.setTextColor(83,104,107);doc.text("Escala aproximada 1:"+N+" (hoja carta)",pw/2,ph-9.5,{align:"center"});
  /* leyenda */
  var lx=pw-10-62;
  if(pg.hl.length){doc.setFillColor(MP_COL.sel[0],MP_COL.sel[1],MP_COL.sel[2]);doc.rect(lx,ph-13,4,3,"F");doc.text("Manzana marcada",lx+6,ph-10.7)}
  doc.setFillColor(MP_COL.sec[0],MP_COL.sec[1],MP_COL.sec[2]);doc.setDrawColor(MP_COL.secL[0],MP_COL.secL[1],MP_COL.secL[2]);doc.rect(lx+31,ph-13,4,3,"FD");doc.text("Mismo sector",lx+37,ph-10.7);
  doc.setTextColor(83,104,107);doc.setFontSize(7.5);
  doc.text("Cartografía de manzanas JS 6 (UTM 14N). Croquis de apoyo, no sustituye el levantamiento en campo.",10,ph-4);
  if(pg.tit&&pg.tit!=="Sección completa")doc.text(pg.tit,pw-10,ph-4,{align:"right"});
}
function mpManzTxt(s){
  var m=s.sel.map(function(x){return x.man}),u=[];m.sort(function(a,b){return a-b}).forEach(function(x){if(u.indexOf(x)<0)u.push(x)});
  if(!u.length)return "-";
  var out=[],i=0;
  while(i<u.length){var j=i;while(j+1<u.length&&u[j+1]===u[j]+1)j++;out.push(j-i>=2?u[i]+"-"+u[j]:u.slice(i,j+1).join(", "));i=j+1}
  return out.join(", ");
}
function mpNombreArchivo(s){
  function lim(t){return String(t).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"")}
  var m=s.todo?"completo":"manz"+lim(mpManzTxt(s).replace(/, /g,"_")).slice(0,40);
  return "Croquis_"+lim(mpMunNom())+"_sector"+S.mp.sec+(S.mp.modo==="manzana"?"_hojas":"")+"_"+m+".pdf";
}
function mpCargarPdf(){
  if(window.jspdf)return Promise.resolve(window.jspdf);
  return new Promise(function(res,rej){
    var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=function(){window.jspdf?res(window.jspdf):rej(new Error("jspdf"))};s.onerror=function(){rej(new Error("jspdf"))};
    document.head.appendChild(s);
  });
}
function mpArmarPdf(jp,pages,s){
  var doc=null;
  pages.forEach(function(pg,i){
    var land=(pg.v.x1-pg.v.x0)>=(pg.v.y1-pg.v.y0)*1.05,fmt=land?"l":"p";
    if(i===0)doc=new jp.jsPDF({orientation:fmt,unit:"mm",format:"letter"});else doc.addPage("letter",fmt);
    mpDrawPage(doc,pg,s);
  });
  return doc;
}
async function mpDescargar(){
  var msg=$("mp-msg"),s=mpSel(),pages=mpPaginas(s);
  if(!pages.length){msg.textContent="Elige municipio y sector, y escribe manzanas que existan (o deja el campo vacío para imprimir todo el sector).";return}
  if(S.mp.busy)return;
  S.mp.busy=true;var btn=$("mp-pdf");if(btn){btn.disabled=true;btn.textContent="Preparando PDF…"}
  msg.textContent="";
  try{
    var dl=(typeof claude!=="undefined"&&claude.use)?await claude.use("downloads"):null;
    var jp=await mpCargarPdf(),doc=mpArmarPdf(jp,pages,s);
    if(dl)await dl.save({filename:mpNombreArchivo(s),data:doc.output("arraybuffer")});
    else doc.save(mpNombreArchivo(s));
    toast("PDF listo: ábrelo e imprímelo en tamaño real (100%)");
  }catch(e){
    if(!(e&&e.code==="declined"))msg.textContent=(e&&e.message==="jspdf")?"No se pudo cargar el generador de PDF. Revisa tu conexión e intenta de nuevo.":"No se pudo generar el PDF"+(e&&e.code?" ("+e.code+")":"")+".";
  }finally{S.mp.busy=false;var b=$("mp-pdf");if(b){b.disabled=false;mpBoton(mpSel())}}
}

/* ---------- mapas: interfaz ---------- */
function mapasShell(){
  return '<div id="mp-root" class="panel stack"><div><h2 style="font-size:19px">Croquis de manzanas para imprimir</h2>'+
   '<p class="muted" style="margin:4px 0 0">Elige el municipio, el sector (sección) y las manzanas. Se genera un PDF en tamaño carta con el croquis, la escala y el norte.</p></div>'+
   '<div id="mp-status"></div>'+
   '<div class="mp-grid">'+
   '<div class="field"><label for="mp-mun">Municipio</label><select id="mp-mun"></select></div>'+
   '<div class="field"><label for="mp-sec">Sector (sección)</label><select id="mp-sec"></select></div>'+
   '<div class="field"><label for="mp-loc">Localidad</label><select id="mp-loc"></select></div>'+
   '<div class="field"><label for="mp-manz">Manzana(s)</label><input id="mp-manz" type="text" inputmode="numeric" autocomplete="off" placeholder="Vacío = todo el sector. Ej. 4, 7, 10-15" maxlength="120"></div></div>'+
   '<div class="row"><div class="seg" role="group" aria-label="Formato de hojas"><button type="button" data-act="mp-modo" data-m="seccion" id="mp-m1">Una hoja del sector</button><button type="button" data-act="mp-modo" data-m="manzana" id="mp-m2">Una hoja por manzana</button></div>'+
   '<button class="btn" type="button" id="mp-todo" data-act="mp-todo">Todo el sector</button><button class="btn primary" type="button" id="mp-pdf" data-act="mp-pdf">Descargar PDF para imprimir</button></div>'+
   '<div class="err" id="mp-msg"></div><div id="mp-info" class="muted" style="font-size:14px"></div><div id="mp-prev"></div></div>';
}
function mpOpts(arr,sel,vacio,fmt){
  return '<option value="">'+esc(vacio)+'</option>'+arr.map(function(x){return '<option value="'+x[0]+'"'+(String(x[0])===String(sel)?" selected":"")+'>'+esc(fmt?fmt(x[1]):x[1])+'</option>'}).join("");
}
function mpFill(){
  if(!$("mp-root"))return;
  var r=S.mp,st=$("mp-status");
  if(r.err){st.innerHTML='<div class="banner">'+esc(r.err)+'</div>'}
  else if(!r.data){st.innerHTML='<p class="muted">Cargando manzanas…</p>'}
  else st.innerHTML="";
  var muns=r.data?Object.keys(r.data.muns).map(Number).sort(function(a,b){return a-b}).map(function(k){return [k,r.data.muns[k]]}).sort(function(a,b){return a[1]<b[1]?-1:1}):[];
  $("mp-mun").innerHTML=mpOpts(muns,r.mun,"— Elige municipio —");
  $("mp-sec").innerHTML=mpOpts(mpSecs().map(function(x){return [x,x]}),r.sec,"— Elige sector —");
  $("mp-sec").disabled=!r.mun;
  var locs=r.sec===""?[]:mpLocs();
  $("mp-loc").innerHTML=mpOpts(locs.map(function(x){return [x,x]}),r.loc,"Todas las localidades del sector",function(x){return "Localidad "+String(x).padStart(4,"0")});
  $("mp-loc").disabled=r.sec==="";
  $("mp-manz").value=r.manz;$("mp-manz").disabled=r.sec==="";
  $("mp-m1").setAttribute("aria-pressed",r.modo==="seccion");$("mp-m2").setAttribute("aria-pressed",r.modo==="manzana");
  mpPreview();
}
function mpBoton(s){
  var b=$("mp-pdf");if(!b)return;
  b.textContent=s.todo?(S.mp.modo==="manzana"?"Descargar PDF de todo el sector (una hoja por manzana)":"Descargar PDF del sector completo"):(S.mp.modo==="manzana"?"Descargar PDF (una hoja por manzana)":"Descargar PDF para imprimir");
}
function mpPreview(){
  var z=$("mp-prev"),inf=$("mp-info");if(!z)return;
  var r=S.mp;
  if(!r.data||r.sec===""){z.innerHTML=r.data?'<p class="empty">Elige municipio y sector para ver el croquis.</p>':"";inf.textContent="";$("mp-pdf").disabled=true;return}
  var s=mpSel(),pages=mpPaginas(s),avisos=[];
  if(s.bad.length)avisos.push("No entendí: "+s.bad.join(", ")+".");
  if(s.miss.length)avisos.push("No existe en este sector: "+s.miss.slice(0,15).join(", ")+(s.miss.length>15?"…":"")+".");
  var dup={};s.sel.forEach(function(m){dup[m.man]=(dup[m.man]||0)+1});
  var repetidas=Object.keys(dup).filter(function(k){return dup[k]>1});
  if(repetidas.length&&r.loc===""&&r.modo==="seccion")avisos.push("La manzana "+repetidas.join(", ")+" existe en más de una localidad del sector; se marcan todas. Elige la localidad para marcar solo una.");
  if(r.modo==="seccion"&&s.base.length){var bb=mpBBox(s.base);if(Math.max(bb.x1-bb.x0,bb.y1-bb.y0)>6000)avisos.push("El sector abarca localidades muy separadas; elige una localidad para un croquis legible.")}
  if(s.todo&&r.modo==="manzana"&&pages.length>40)avisos.push("Se generarán "+pages.length+" hojas.");
  inf.textContent=(s.base.length+" manzanas en el sector"+(s.todo?" · se imprime el sector completo":(s.sel.length?" · "+s.sel.length+" marcada"+(s.sel.length===1?"":"s"):"")))+(avisos.length?" — "+avisos.join(" "):"");
  mpBoton(s);
  $("mp-pdf").disabled=!pages.length;
  if(r.pv>=pages.length)r.pv=0;
  var pg=pages.length?pages[r.pv]:{v:mpViewSec(s.base),foc:[]};
  var nav="";
  if(pages.length>1)nav='<div class="row" style="justify-content:center;margin-top:8px"><button class="btn small" type="button" data-act="mp-pv" data-d="-1">←</button><span class="muted">Hoja '+(r.pv+1)+' de '+pages.length+' · '+esc(pg.tit)+'</span><button class="btn small" type="button" data-act="mp-pv" data-d="1">→</button></div>';
  z.innerHTML='<div class="mp-map">'+mpSvg(pg.v,pg.hl||s.sel)+'</div>'+nav;
}
function mpCargar(){
  var r=S.mp;
  if(r.data||r.loading)return;
  r.loading=true;r.err="";
  fetch("manzanas.json").then(function(x){if(!x.ok)throw new Error("http "+x.status);return x.json()}).then(function(j){
    r.data=mpDecode(j);r.loading=false;mpFill();
  }).catch(function(){r.loading=false;r.err="No se pudo cargar la cartografía de manzanas. Recarga la página.";mpFill()});
}
document.addEventListener("change",function(ev){
  var t=ev.target,r=S.mp;if(!t||!t.id||t.id.indexOf("mp-")!==0)return;
  if(t.id==="mp-mun"){r.mun=t.value;r.sec="";r.loc="";r.pv=0;mpFill()}
  else if(t.id==="mp-sec"){r.sec=t.value;r.loc="";r.pv=0;mpFill()}
  else if(t.id==="mp-loc"){r.loc=t.value;r.pv=0;mpPreview()}
});
document.addEventListener("input",function(ev){
  var t=ev.target;if(!t||t.id!=="mp-manz")return;
  S.mp.manz=t.value;S.mp.pv=0;mpPreview();
});
document.addEventListener("click",function(ev){
  var b=ev.target.closest("[data-act]");if(!b)return;
  var a=b.getAttribute("data-act");if(a.indexOf("mp-")!==0)return;
  if(a==="mp-modo"){S.mp.modo=b.getAttribute("data-m");S.mp.pv=0;mpFill();return}
  if(a==="mp-pv"){var n=mpPaginas(mpSel()).length;if(n){S.mp.pv=(S.mp.pv+(+b.getAttribute("data-d"))+n)%n;mpPreview()}return}
  if(a==="mp-todo"){S.mp.manz="";S.mp.pv=0;var i=$("mp-manz");if(i)i.value="";mpPreview();return}
  if(a==="mp-pdf")mpDescargar();
});

window.PO_MAPAS={shell:mapasShell,fill:mpFill,cargar:mpCargar};
})();
