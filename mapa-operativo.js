(function(){
"use strict";
/* Mapa del sector para los operativos de control larvario.
   Usa manzanas.json (UTM 14N, decímetros). Colorea cada manzana según su estado. */
var D=null,loading=false,fallo=false,cbs=[];
var COL={ctx:"#f3f4f2",ctxL:"#d3d8d7",base:"#d9dedd",baseL:"#98a5a5",rep:"#2f6fb5",repL:"#1d4a7e",pen:"#e08a00",penL:"#8a5400",ok:"#2e9b5f",okL:"#1c6a3f",txt:"#28383a"};

function decode(j){
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
    var m={mun:r[0],sec:r[1],man:r[2],loc:r[3],rings:rings,bb:[x0,y0,x1,y1],w:x1-x0,h:y1-y0,c:best||[(x0+x1)/2,(y0+y1)/2]};
    (by[m.mun]=by[m.mun]||[]).push(m);
  });
  return {muns:j.municipios,by:by};
}
function listo(){return !!D}
function huboFallo(){return fallo}
function cargar(cb){
  if(D){if(cb)cb();return}
  if(fallo)return;
  if(cb)cbs.push(cb);
  if(loading)return;
  loading=true;
  fetch("manzanas.json").then(function(x){if(!x.ok)throw new Error("http "+x.status);return x.json()}).then(function(j){
    D=decode(j);loading=false;var l=cbs;cbs=[];l.forEach(function(f){f()});
  }).catch(function(){
    loading=false;fallo=true;var l=cbs;cbs=[];l.forEach(function(f){f()});
  });
}
function municipios(){
  if(!D)return [];
  return Object.keys(D.muns).map(function(k){return [k,D.muns[k]]}).sort(function(a,b){return a[1].localeCompare(b[1],"es")});
}
function uniq(list,k){var s={};list.forEach(function(m){s[m[k]]=1});return Object.keys(s).map(Number).sort(function(a,b){return a-b})}
function sectores(mun){return D&&D.by[mun]?uniq(D.by[mun],"sec"):[]}
function localidades(mun,sec){return D&&D.by[mun]?uniq(D.by[mun].filter(function(m){return m.sec===+sec}),"loc"):[]}
function baseSector(mun,sec,loc){
  var pool=(D&&D.by[mun])||[],s=+sec,l=(loc===""||loc==null)?null:+loc;
  return pool.filter(function(m){return m.sec===s&&(l===null||m.loc===l)});
}
function faltan(mun,sec,loc,claves){
  var found={};baseSector(mun,sec,loc).forEach(function(m){found[m.man]=1});
  return claves.filter(function(k){return /^\d+$/.test(k)&&!found[+k]});
}
function bbox(l){
  var x0=1e12,y0=1e12,x1=-1e12,y1=-1e12;
  l.forEach(function(m){if(m.bb[0]<x0)x0=m.bb[0];if(m.bb[1]<y0)y0=m.bb[1];if(m.bb[2]>x1)x1=m.bb[2];if(m.bb[3]>y1)y1=m.bb[3]});
  return {x0:x0,y0:y0,x1:x1,y1:y1};
}
function nice(max){var n=[10,20,50,100,200,500,1000,2000,5000],o=n[0];for(var i=0;i<n.length;i++)if(n[i]<=max)o=n[i];return o}
function pathD(m,v){
  return m.rings.map(function(g){
    return "M"+g.p.map(function(p){return (p[0]-v.x0).toFixed(1)+","+(v.y1-p[1]).toFixed(1)}).join("L")+"Z";
  }).join("");
}
/* o = {mun, sec, loc, estados:{numeroManzana:"repartida"|"pendiente"|"realizada"}} */
function svg(o){
  if(!D)return "";
  var est=o.estados||{},base=baseSector(o.mun,o.sec,o.loc);
  if(!base.length)return "";
  var foc=base.filter(function(m){return est[m.man]});
  var b=bbox(foc.length?foc:base),w=b.x1-b.x0,h=b.y1-b.y0;
  var pad=foc.length?Math.max(80,Math.max(w,h)*0.6):Math.max(25,Math.max(w,h)*0.05);
  var v={x0:b.x0-pad,y0:b.y0-pad,x1:b.x1+pad,y1:b.y1+pad};
  var W=v.x1-v.x0,H=v.y1-v.y0,fs0=Math.max(W,H)/60,sw=Math.max(W,H)/900;
  var baseSet=new Set(base);
  var items=((D.by[o.mun])||[]).filter(function(m){return !(m.bb[2]<v.x0||m.bb[0]>v.x1||m.bb[3]<v.y0||m.bb[1]>v.y1)}).map(function(m){
    var inSec=baseSet.has(m);
    return {m:m,n:inSec&&est[m.man]?3:(inSec?2:1),st:inSec?est[m.man]:null};
  });
  items.sort(function(a,b){return a.n-b.n});
  var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W.toFixed(1)+' '+H.toFixed(1)+'" role="img" aria-label="Mapa del sector con manzanas por estado" style="display:block;width:100%;height:auto;max-height:70vh;background:#fff">';
  items.forEach(function(it){
    var f=COL.ctx,l=COL.ctxL,lw=sw;
    if(it.n===2){f=COL.base;l=COL.baseL}
    if(it.n===3){
      lw=sw*2.2;
      if(it.st==="realizada"){f=COL.ok;l=COL.okL}
      else if(it.st==="pendiente"){f=COL.pen;l=COL.penL}
      else{f=COL.rep;l=COL.repL}
    }
    s+='<path d="'+pathD(it.m,v)+'" fill="'+f+'" stroke="'+l+'" stroke-width="'+lw.toFixed(2)+'" fill-rule="evenodd"/>';
  });
  items.forEach(function(it){
    if(it.n===1)return;
    var mn=Math.min(it.m.w,it.m.h),fs;
    if(it.n===3)fs=Math.max(fs0*1.1,Math.min(mn*0.5,fs0*2.2));
    else{if(mn<fs0*1.1)return;fs=Math.min(fs0,mn*0.45)}
    var t=String(it.m.man)+(it.st==="realizada"?" ✓":(it.st==="pendiente"?" !":""));
    s+='<text x="'+(it.m.c[0]-v.x0).toFixed(1)+'" y="'+(v.y1-it.m.c[1]).toFixed(1)+'" font-size="'+fs.toFixed(1)+'" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-weight="'+(it.n===3?700:400)+'" fill="'+(it.n===3?"#fff":COL.txt)+'">'+t+'</text>';
  });
  var L=nice(W/4),bx=W*0.03,by=H*0.965,bh=Math.max(W,H)/180;
  s+='<g><rect x="'+bx+'" y="'+(by-bh)+'" width="'+L/2+'" height="'+bh+'" fill="#222"/><rect x="'+(bx+L/2)+'" y="'+(by-bh)+'" width="'+L/2+'" height="'+bh+'" fill="#fff" stroke="#222" stroke-width="'+sw+'"/>'+
     '<text x="'+bx+'" y="'+(by-bh*1.8)+'" font-size="'+fs0*0.9+'" font-family="Arial,sans-serif" fill="#222">0</text>'+
     '<text x="'+(bx+L)+'" y="'+(by-bh*1.8)+'" font-size="'+fs0*0.9+'" text-anchor="middle" font-family="Arial,sans-serif" fill="#222">'+L+' m</text></g>';
  var ax=W*0.96,ay=H*0.04+fs0*2.4,ar=fs0*1.8;
  s+='<g fill="#222"><polygon points="'+ax+','+(ay-ar*1.4)+' '+(ax-ar*0.55)+','+ay+' '+ax+','+(ay-ar*0.35)+' '+(ax+ar*0.55)+','+ay+'"/><text x="'+ax+'" y="'+(ay-ar*1.6)+'" font-size="'+fs0*1.2+'" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700">N</text></g>';
  return s+'</svg>';
}
window.PO_MAPAOP={listo:listo,fallo:huboFallo,cargar:cargar,municipios:municipios,sectores:sectores,localidades:localidades,faltan:faltan,svg:svg};
})();
