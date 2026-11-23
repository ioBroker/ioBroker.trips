import{createRoot as e,Fragment as t,jsx as n,jsxs as r}from"../../../lib/esm/react-19.js";var i=`iob-dialog-close`;function a(e){return!!e.form}var o=[`header`,`staticText`,`divider`];function s(e,t){return e==null?``:typeof e==`object`?e[t]||e.en||Object.values(e).find(e=>!!e)||``:String(e)}function c(e){let t={};for(let[n,r]of Object.entries(e.items||{}))r&&!o.includes(r.type)&&(t[n]=r.type);return t}function l(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?e.toString():JSON.stringify(e)}function u(e,t){if(t!=null)switch(e){case`number`:case`slider`:{if(typeof t==`number`)return Number.isFinite(t)?t:void 0;let e=l(t).trim().replace(`,`,`.`);if(!e)return;let n=Number(e);return Number.isFinite(n)?n:void 0}case`checkbox`:return t===!0||t===`true`||t===1||t===`1`;default:return l(t)}}function d(e,t){let n={};for(let[r,i]of Object.entries(e)){let e=u(i,t[r]);e!==void 0&&(n[r]=e)}return n}var f=`"Roboto", "Helvetica", "Arial", sans-serif`,p=Object.freeze({type:`light`,primary:`#3399CC`,primaryContrast:`#FFFFFF`,secondary:`#164477`,secondaryContrast:`#FFFFFF`,background:`#FFFFFF`,paper:`#FFFFFF`,text:`rgba(0, 0, 0, 0.87)`,textSecondary:`rgba(0, 0, 0, 0.6)`,divider:`rgba(0, 0, 0, 0.12)`,error:`#D32F2F`,warning:`#ED6C02`,info:`#0288D1`,success:`#2E7D32`,fontFamily:f,fontSize:14,borderRadius:4}),m=Object.freeze({type:`dark`,primary:`#4DABF5`,primaryContrast:`rgba(0, 0, 0, 0.87)`,secondary:`#436A93`,secondaryContrast:`#FFFFFF`,background:`#121212`,paper:`#121212`,text:`#FFFFFF`,textSecondary:`rgba(255, 255, 255, 0.7)`,divider:`rgba(255, 255, 255, 0.12)`,error:`#F44336`,warning:`#FFA726`,info:`#29B6F6`,success:`#66BB6A`,fontFamily:f,fontSize:14,borderRadius:4}),h=[`primary`,`primaryContrast`,`secondary`,`secondaryContrast`,`background`,`paper`,`text`,`textSecondary`,`divider`,`error`,`warning`,`info`,`success`,`fontFamily`],g=[`fontSize`,`borderRadius`];function _(e){return{...e===`dark`?m:p}}function v(e){if(!e||typeof e!=`object`)return _(typeof e==`string`?e:`light`);let t=e,n=_(typeof t.type==`string`?t.type:`light`);for(let e of h){let r=t[e];typeof r==`string`&&r.trim()&&(n[e]=r.trim())}for(let e of g){let r=t[e],i=typeof r==`string`?parseFloat(r):r;typeof i==`number`&&Number.isFinite(i)&&i>=0&&(n[e]=i)}return n}function y(e,t){return e.type===t.type&&h.every(n=>e[n]===t[n])&&g.every(n=>e[n]===t[n])}function b(e){return`--iob-${e.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`)}`}function x(e){let t={};for(let n of h)t[b(n)]=e[n];for(let n of g)t[b(n)]=`${e[n]}px`;return t[`color-scheme`]=e.type,t}var S={ok:{en:`OK`,"zh-cn":`确定`},cancel:{en:`Cancel`,de:`Abbrechen`,ru:`Отмена`,pt:`Cancelar`,nl:`Annuleren`,fr:`Annuler`,it:`Annulla`,es:`Cancelar`,pl:`Anuluj`,uk:`Скасувати`,"zh-cn":`取消`},close:{en:`Close`,de:`Schließen`,ru:`Закрыть`,pt:`Fechar`,nl:`Sluiten`,fr:`Fermer`,it:`Chiudi`,es:`Cerrar`,pl:`Zamknij`,uk:`Закрити`,"zh-cn":`关闭`}},ee=`
dialog {
    box-sizing: border-box;
    width: 480px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
    padding: 0;
    border: 0;
    border-radius: calc(var(--iob-border-radius) * 2);
    background: var(--iob-paper);
    color: var(--iob-text);
    font-family: var(--iob-font-family);
    font-size: var(--iob-font-size);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
/* as the dialogs of MUI: a dark paper gets lighter the higher it lies */
dialog.dark { background-image: linear-gradient(rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.16)); }
dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
dialog:focus { outline: none; }
form { display: flex; flex-direction: column; height: 100%; max-height: inherit; margin: 0; }
header { display: flex; align-items: center; gap: 8px; padding: 12px 8px 12px 16px; font-size: 1.15em; font-weight: 500; }
header span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.body { flex: 1; min-height: 0; padding: 0 16px 16px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 16px 16px; }
button { font: inherit; padding: 6px 16px; border-radius: var(--iob-border-radius); border: 1px solid var(--iob-primary); background: transparent; color: var(--iob-primary); cursor: pointer; }
button.primary { background: var(--iob-primary); color: var(--iob-primary-contrast); }
button.close { border: 0; padding: 2px 8px; font-size: 1.4em; line-height: 1; color: var(--iob-text-secondary); }
label { display: flex; flex-direction: column; gap: 4px; }
label.check { flex-direction: row; align-items: center; gap: 8px; }
input, select, textarea { font: inherit; accent-color: var(--iob-primary); }
.help { color: var(--iob-text-secondary); font-size: 0.85em; }
h3 { margin: 4px 0 0; font-size: 1em; }
p { margin: 0; }
hr { width: 100%; border: 0; border-top: 1px solid var(--iob-divider); margin: 0; }
[hidden] { display: none !important; }
`;function C(e){if(!e)return null;try{let t=Function(`data`,`return (${e});`);return e=>{try{return!!t(e)}catch{return!1}}}catch{return null}}function w(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?String(e):``}function te(e){let{input:t,setting:n}=e;if(t)return t instanceof HTMLInputElement&&t.type===`checkbox`?t.checked:t instanceof HTMLSelectElement?n.options?.[t.selectedIndex]?.value:t.value}function ne(e,t,n,r,i){let a={name:t,setting:n,box:e.createElement(`div`),hidden:C(n.hidden),disabled:C(n.disabled)},o=s(n.label,i);switch(n.type){case`header`:return a.box=e.createElement(`h3`),a.box.textContent=s(n.text,i)||o,a;case`staticText`:return a.box=e.createElement(`p`),a.box.textContent=s(n.text,i)||o,a;case`divider`:return a.box=e.createElement(`hr`),a}let c=e.createElement(`label`);a.box=c;let l=e.createElement(`span`);if(l.textContent=o||t,n.type===`checkbox`){let t=e.createElement(`input`);t.type=`checkbox`,t.checked=r===!0||r===`true`,c.className=`check`,c.append(t,l),a.input=t}else if(n.type===`select`){let t=e.createElement(`select`);for(let r of n.options||[]){let n=e.createElement(`option`);n.textContent=s(r.label,i),t.append(n)}let o=(n.options||[]).findIndex(e=>String(e.value)===w(r));t.selectedIndex=o===-1?0:o,c.append(l,t),a.input=t}else if(n.type===`text`&&(n.minRows||1)>1){let t=e.createElement(`textarea`);t.rows=n.minRows||2,t.value=w(r),c.append(l,t),a.input=t}else{let t=e.createElement(`input`),i=w(r);switch(n.type){case`number`:case`slider`:t.type=n.type===`slider`?`range`:`number`,n.min!==void 0&&(t.min=String(n.min)),n.max!==void 0&&(t.max=String(n.max)),t.step=n.step===void 0?`any`:String(n.step);break;case`password`:t.type=`password`;break;case`color`:t.type=!i||/^#[0-9a-f]{6}$/i.test(i)?`color`:`text`;break;default:t.type=`text`}if(t.value=i,t.type===`range`){let n=e.createElement(`output`);n.textContent=t.value,t.addEventListener(`input`,()=>n.textContent=t.value),l.append(`: `,n)}c.append(l,t),a.input=t}if(n.help){let t=e.createElement(`span`);t.className=`help`,t.textContent=s(n.help,i),c.append(t)}return a}function re(e,t={}){let n=t.lang||`en`,r=document,o=e=>S[e][n]||S[e].en||e,l=r.createElement(`div`);l.setAttribute(`data-iob-dialog`,``);let u=l.attachShadow({mode:`open`}),f=r.createElement(`style`);f.textContent=ee;let p=r.createElement(`dialog`),m=v(t.theme);p.className=m.type===`dark`?`dark`:``;for(let[e,t]of Object.entries(x(m)))p.style.setProperty(e,t);e.width&&(p.style.width=`${e.width}px`),e.height&&(p.style.height=`${e.height}px`);let h=r.createElement(`form`),g=r.createElement(`header`),_=r.createElement(`span`);_.textContent=s(e.title,n);let y=r.createElement(`button`);y.type=`button`,y.className=`close`,y.title=o(`close`),y.setAttribute(`aria-label`,o(`close`)),y.textContent=`×`,g.append(_,y);let b=r.createElement(`div`);return b.className=`body`,h.append(g,b),p.append(h),u.append(f,p),new Promise(t=>{let f=!1,m=e=>{f||(f=!0,p.open&&p.close(),l.remove(),t(e))};if(y.addEventListener(`click`,()=>m(null)),p.addEventListener(`close`,()=>m(null)),h.addEventListener(`submit`,e=>e.preventDefault()),a(e)){let t={},i=[];for(let[t,a]of Object.entries(e.form.items||{})){let o=e.data?.[t]??a.default,s=ne(r,t,a,o,n);i.push(s),b.append(s.box)}let a=()=>{for(let e of i)e.input&&(t[e.name]=te(e));return t},l=()=>{let e=a();for(let t of i)t.box.hidden=t.hidden?t.hidden(e):!1,t.input&&(t.input.disabled=t.disabled?t.disabled(e):!1)};h.addEventListener(`input`,l),h.addEventListener(`change`,l),l();let u=i.find(e=>e.input&&!e.box.hidden&&!e.input.disabled);u?.input&&(u.input.autofocus=!0);let f=r.createElement(`footer`),p=r.createElement(`button`);p.type=`button`,p.textContent=s(e.cancel,n)||o(`cancel`),p.addEventListener(`click`,()=>m(null));let g=r.createElement(`button`);g.type=`submit`,g.className=`primary`,g.textContent=s(e.ok,n)||o(`ok`),f.append(p,g),h.append(f),h.addEventListener(`submit`,()=>m(d(c(e.form),a())))}else b.append(e.element),p.addEventListener(i,e=>m(e.detail??null));r.body.append(l),p.showModal(),u.activeElement&&u.activeElement!==y||(p.tabIndex=-1,p.focus())})}function T(e){return[...new Set(e.filter(e=>typeof e==`string`&&!!e))]}var ie=[`socket`,`dialogs`,`theme`,`editMode`,`settings`,`value`],ae=class extends HTMLElement{states={};objects={};#e=null;#t={};#n=v(`light`);#r=!1;#i=null;#a=void 0;#o=null;#s=!1;#c=(e,t)=>{this.#o?.states.includes(e)&&(this.states[e]=t||null,this.#_())};#l=(e,t)=>{this.#o?.objects.includes(e)&&(this.objects[e]=t||null,this.#d())};get socket(){return this.#e}set socket(e){this.#e=e||null,this.#d()}get settings(){return this.#t}set settings(e){this.#t=e||{},this.#d()}get theme(){return this.#n}set theme(e){let t=v(e);y(t,this.#n)||(this.#n=t,this.#u(),this.#_())}get editMode(){return this.#r}set editMode(e){let t=!!e;t!==this.#r&&(this.#r=t,this.#_())}get dialogs(){return this.#i}set dialogs(e){this.#i=e||null}get value(){return this.#a}set value(e){e!==this.#a&&(this.#a=e,this.#_())}connectedCallback(){for(let e of ie)if(Object.prototype.hasOwnProperty.call(this,e)){let t=this[e];delete this[e],this[e]=t}this.#u(),this.#d()}disconnectedCallback(){this.#g()}getStateIds(e){return[]}getObjectIds(e){return[]}get systemLang(){return this.#e?.systemLang||`en`}text(e){return s(e,this.systemLang)}setState(e,t){return this.#e&&!this.#r?this.#e.setState(e,t):Promise.resolve()}changeValue(e){return this.#r||this.emit(`iob-change`,e)?!1:(this.value=e,!0)}emit(e,t){return this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0,cancelable:!0}))}async openDialog(e){if(this.#r)return null;let t=this.#i?await this.#i.open(e):await re(e,{lang:this.systemLang,theme:this.#n});return a(e)?t&&typeof t==`object`?d(c(e.form),t):null:t??null}#u(){for(let[e,t]of Object.entries(x(this.#n)))this.style.setProperty(e,t)}#d(){if(!this.isConnected)return;let e=this.#e,t=e?T(this.getStateIds(this.#t)):[],n=e?T(this.getObjectIds(this.#t)):[];this.#o&&this.#o.socket!==e&&this.#g();let r=this.#o?.states||[],i=this.#o?.objects||[],a=r.filter(e=>!t.includes(e)),o=i.filter(e=>!n.includes(e)),s=t.filter(e=>!r.includes(e)),c=n.filter(e=>!i.includes(e));e&&a.length&&e.unsubscribeState(a,this.#c),e&&o.length&&this.#h(e,o);for(let e of a)delete this.states[e];for(let e of[...a,...o])!t.includes(e)&&!n.includes(e)&&delete this.objects[e];this.#o=e&&(t.length||n.length)?{socket:e,states:t,objects:n}:null,e&&s.length&&this.#p(e,s),e&&c.length&&this.#m(e,c),this.#_()}#f(e,t,n){return this.#o?.socket===e&&this.#o[t].includes(n)}#p(e,t){e.subscribeState(t,this.#c).catch(e=>console.warn(`<${this.localName}>: cannot subscribe ${t.join(`, `)}: ${e}`));for(let n of t)e.getState(n).then(t=>{this.#f(e,`states`,n)&&this.states[n]===void 0&&(this.states[n]=t||null,this.#_())}).catch(()=>{}),e.getObject(n).then(t=>{this.#f(e,`states`,n)&&!this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#_())}).catch(()=>{})}#m(e,t){e.subscribeObject(t,this.#l).catch(e=>console.warn(`<${this.localName}>: cannot subscribe the objects ${t.join(`, `)}: ${e}`));for(let n of t)e.getObject(n).then(t=>{this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#d())}).catch(()=>{})}#h(e,t){e.unsubscribeObject(t,this.#l).catch(()=>{})}#g(){if(this.#o){let{socket:e,states:t,objects:n}=this.#o;t.length&&e.unsubscribeState(t,this.#c),n.length&&this.#h(e,n),this.#o=null}this.states={},this.objects={}}#_(){this.#s||(this.#s=!0,queueMicrotask(()=>{this.#s=!1,this.isConnected&&this.render()}))}};function oe(e,t){let n=typeof e==`string`?e:e.tag;customElements.get(n)||customElements.define(n,t)}var se=`iob-trips-diagnostics`,ce=3e3;function le(e){let t=String(e??``).trim().match(/^(?:system\.adapter\.)?(?:trips\.)?(\d+)$/);return t?`trips.${t[1]}`:null}function E(e){let t=String(e.object??``).trim(),n=t.match(/^trips\.(\d+)\.([^.]+)/);return n?{instance:`trips.${n[1]}`,object:n[2]}:{instance:le(e.instance),object:t}}var D=`.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;top:0;left:0}.leaflet-container{overflow:hidden}.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow{-webkit-user-select:none;user-select:none;-webkit-user-drag:none}.leaflet-tile::selection{background:0 0}.leaflet-safari .leaflet-tile{image-rendering:-webkit-optimize-contrast}.leaflet-safari .leaflet-tile-container{-webkit-transform-origin:0 0;width:1600px;height:1600px}.leaflet-marker-icon,.leaflet-marker-shadow{display:block}.leaflet-container .leaflet-overlay-pane svg{max-width:none!important;max-height:none!important}.leaflet-container .leaflet-marker-pane img,.leaflet-container .leaflet-shadow-pane img,.leaflet-container .leaflet-tile-pane img,.leaflet-container img.leaflet-image-layer,.leaflet-container .leaflet-tile{width:auto;padding:0;max-width:none!important;max-height:none!important}.leaflet-container img.leaflet-tile{mix-blend-mode:plus-lighter}.leaflet-container.leaflet-touch-zoom{-ms-touch-action:pan-x pan-y;touch-action:pan-x pan-y}.leaflet-container.leaflet-touch-drag{-ms-touch-action:pinch-zoom;touch-action:none;touch-action:pinch-zoom}.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom{-ms-touch-action:none;touch-action:none}.leaflet-container{-webkit-tap-highlight-color:transparent}.leaflet-container a{-webkit-tap-highlight-color:#33b5e566}.leaflet-tile{filter:inherit;visibility:hidden}.leaflet-tile-loaded{visibility:inherit}.leaflet-zoom-box{box-sizing:border-box;z-index:800;width:0;height:0}.leaflet-overlay-pane svg{-moz-user-select:none}.leaflet-pane{z-index:400}.leaflet-tile-pane{z-index:200}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-tooltip-pane{z-index:650}.leaflet-popup-pane{z-index:700}.leaflet-map-pane canvas{z-index:100}.leaflet-map-pane svg{z-index:200}.leaflet-vml-shape{width:1px;height:1px}.lvml{display:inline-block;position:absolute}.leaflet-control{z-index:800;pointer-events:visiblePainted;pointer-events:auto;position:relative}.leaflet-top,.leaflet-bottom{z-index:1000;pointer-events:none;position:absolute}.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-control{float:left;clear:both}.leaflet-right .leaflet-control{float:right}.leaflet-top .leaflet-control{margin-top:10px}.leaflet-bottom .leaflet-control{margin-bottom:10px}.leaflet-left .leaflet-control{margin-left:10px}.leaflet-right .leaflet-control{margin-right:10px}.leaflet-fade-anim .leaflet-popup{opacity:0;transition:opacity .2s linear}.leaflet-fade-anim .leaflet-map-pane .leaflet-popup{opacity:1}.leaflet-zoom-animated{transform-origin:0 0}svg.leaflet-zoom-animated{will-change:transform}.leaflet-zoom-anim .leaflet-zoom-animated{-webkit-transition:-webkit-transform .25s cubic-bezier(0,0,.25,1);-moz-transition:-moz-transform .25s cubic-bezier(0,0,.25,1);transition:transform .25s cubic-bezier(0,0,.25,1)}.leaflet-zoom-anim .leaflet-tile,.leaflet-pan-anim .leaflet-tile{transition:none}.leaflet-zoom-anim .leaflet-zoom-hide{visibility:hidden}.leaflet-interactive{cursor:pointer}.leaflet-grab{cursor:-webkit-grab;cursor:-moz-grab;cursor:grab}.leaflet-crosshair,.leaflet-crosshair .leaflet-interactive{cursor:crosshair}.leaflet-popup-pane,.leaflet-control{cursor:auto}.leaflet-dragging .leaflet-grab,.leaflet-dragging .leaflet-grab .leaflet-interactive,.leaflet-dragging .leaflet-marker-draggable{cursor:move;cursor:-webkit-grabbing;cursor:-moz-grabbing;cursor:grabbing}.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-image-layer,.leaflet-pane>svg path,.leaflet-tile-container{pointer-events:none}.leaflet-marker-icon.leaflet-interactive,.leaflet-image-layer.leaflet-interactive,.leaflet-pane>svg path.leaflet-interactive,svg.leaflet-image-layer.leaflet-interactive path{pointer-events:visiblePainted;pointer-events:auto}.leaflet-container{outline-offset:1px;background:#ddd}.leaflet-container a{color:#0078a8}.leaflet-zoom-box{background:#ffffff80;border:2px dotted #38f}.leaflet-container{font-family:Helvetica Neue,Arial,Helvetica,sans-serif;font-size:.75rem;line-height:1.5}.leaflet-bar{border-radius:4px;box-shadow:0 1px 5px #000000a6}.leaflet-bar a{text-align:center;color:#000;background-color:#fff;border-bottom:1px solid #ccc;width:26px;height:26px;line-height:26px;text-decoration:none;display:block}.leaflet-bar a,.leaflet-control-layers-toggle{background-position:50%;background-repeat:no-repeat;display:block}.leaflet-bar a:hover,.leaflet-bar a:focus{background-color:#f4f4f4}.leaflet-bar a:first-child{border-top-left-radius:4px;border-top-right-radius:4px}.leaflet-bar a:last-child{border-bottom:none;border-bottom-right-radius:4px;border-bottom-left-radius:4px}.leaflet-bar a.leaflet-disabled{cursor:default;color:#bbb;background-color:#f4f4f4}.leaflet-touch .leaflet-bar a{width:30px;height:30px;line-height:30px}.leaflet-touch .leaflet-bar a:first-child{border-top-left-radius:2px;border-top-right-radius:2px}.leaflet-touch .leaflet-bar a:last-child{border-bottom-right-radius:2px;border-bottom-left-radius:2px}.leaflet-control-zoom-in,.leaflet-control-zoom-out{text-indent:1px;font:700 18px Lucida Console,Monaco,monospace}.leaflet-touch .leaflet-control-zoom-in,.leaflet-touch .leaflet-control-zoom-out{font-size:22px}.leaflet-control-layers{background:#fff;border-radius:5px;box-shadow:0 1px 5px #0006}.leaflet-control-layers-toggle{width:36px;height:36px}.leaflet-retina .leaflet-control-layers-toggle{background-size:26px 26px}.leaflet-touch .leaflet-control-layers-toggle{width:44px;height:44px}.leaflet-control-layers .leaflet-control-layers-list,.leaflet-control-layers-expanded .leaflet-control-layers-toggle{display:none}.leaflet-control-layers-expanded .leaflet-control-layers-list{display:block;position:relative}.leaflet-control-layers-expanded{color:#333;background:#fff;padding:6px 10px 6px 6px}.leaflet-control-layers-scrollbar{padding-right:5px;overflow:hidden scroll}.leaflet-control-layers-selector{margin-top:2px;position:relative;top:1px}.leaflet-control-layers label{font-size:1.08333em;display:block}.leaflet-control-layers-separator{border-top:1px solid #ddd;height:0;margin:5px -10px 5px -6px}.leaflet-container .leaflet-control-attribution{background:#fffc;margin:0}.leaflet-control-attribution,.leaflet-control-scale-line{color:#333;padding:0 5px;line-height:1.4}.leaflet-control-attribution a{text-decoration:none}.leaflet-control-attribution a:hover,.leaflet-control-attribution a:focus{text-decoration:underline}.leaflet-attribution-flag{width:1em;height:.6669em;vertical-align:baseline!important;display:inline!important}.leaflet-left .leaflet-control-scale{margin-left:5px}.leaflet-bottom .leaflet-control-scale{margin-bottom:5px}.leaflet-control-scale-line{white-space:nowrap;box-sizing:border-box;text-shadow:1px 1px #fff;background:#fffc;border:2px solid #777;border-top:none;padding:2px 5px 1px;line-height:1.1}.leaflet-control-scale-line:not(:first-child){border-top:2px solid #777;border-bottom:none;margin-top:-2px}.leaflet-control-scale-line:not(:first-child):not(:last-child){border-bottom:2px solid #777}.leaflet-touch .leaflet-control-attribution,.leaflet-touch .leaflet-control-layers,.leaflet-touch .leaflet-bar{box-shadow:none}.leaflet-touch .leaflet-control-layers,.leaflet-touch .leaflet-bar{background-clip:padding-box;border:2px solid #0003}.leaflet-popup{text-align:center;margin-bottom:20px;position:absolute}.leaflet-popup-content-wrapper{text-align:left;border-radius:12px;padding:1px}.leaflet-popup-content{min-height:1px;margin:13px 24px 13px 20px;font-size:1.08333em;line-height:1.3}.leaflet-popup-content p{margin:1.3em 0}.leaflet-popup-tip-container{pointer-events:none;width:40px;height:20px;margin-top:-1px;margin-left:-20px;position:absolute;left:50%;overflow:hidden}.leaflet-popup-tip{pointer-events:auto;width:17px;height:17px;margin:-10px auto 0;padding:1px;transform:rotate(45deg)}.leaflet-popup-content-wrapper,.leaflet-popup-tip{color:#333;background:#fff;box-shadow:0 3px 14px #0006}.leaflet-container a.leaflet-popup-close-button{text-align:center;color:#757575;background:0 0;border:none;width:24px;height:24px;font:16px/24px Tahoma,Verdana,sans-serif;text-decoration:none;position:absolute;top:0;right:0}.leaflet-container a.leaflet-popup-close-button:hover,.leaflet-container a.leaflet-popup-close-button:focus{color:#585858}.leaflet-popup-scrolled{overflow:auto}.leaflet-oldie .leaflet-popup-content-wrapper{-ms-zoom:1}.leaflet-oldie .leaflet-popup-tip{-ms-filter:"progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)";width:24px;filter:progid:DXImageTransform.Microsoft.Matrix(M11=.707107, M12=.707107, M21=-.707107, M22=.707107);margin:0 auto}.leaflet-oldie .leaflet-control-zoom,.leaflet-oldie .leaflet-control-layers,.leaflet-oldie .leaflet-popup-content-wrapper,.leaflet-oldie .leaflet-popup-tip{border:1px solid #999}.leaflet-div-icon{background:#fff;border:1px solid #666}.leaflet-tooltip{color:#222;white-space:nowrap;-webkit-user-select:none;user-select:none;pointer-events:none;background-color:#fff;border:1px solid #fff;border-radius:3px;padding:6px;position:absolute;box-shadow:0 1px 3px #0006}.leaflet-tooltip.leaflet-interactive{cursor:pointer;pointer-events:auto}.leaflet-tooltip-top:before,.leaflet-tooltip-bottom:before,.leaflet-tooltip-left:before,.leaflet-tooltip-right:before{pointer-events:none;content:"";background:0 0;border:6px solid #0000;position:absolute}.leaflet-tooltip-bottom{margin-top:6px}.leaflet-tooltip-top{margin-top:-6px}.leaflet-tooltip-bottom:before,.leaflet-tooltip-top:before{margin-left:-6px;left:50%}.leaflet-tooltip-top:before{border-top-color:#fff;margin-bottom:-12px;bottom:0}.leaflet-tooltip-bottom:before{border-bottom-color:#fff;margin-top:-12px;margin-left:-6px;top:0}.leaflet-tooltip-left{margin-left:-6px}.leaflet-tooltip-right{margin-left:6px}.leaflet-tooltip-left:before,.leaflet-tooltip-right:before{margin-top:-6px;top:50%}.leaflet-tooltip-left:before{border-left-color:#fff;margin-right:-12px;right:0}.leaflet-tooltip-right:before{border-right-color:#fff;margin-left:-12px;left:0}@media print{.leaflet-control{-webkit-print-color-adjust:exact;-moz-print-color-adjust:exact;print-color-adjust:exact}}`,O=`
* {
    box-sizing: border-box;
}
.root, .dialog {
    --tint: color-mix(in srgb, currentColor 6%, transparent);
    --hover: color-mix(in srgb, currentColor 10%, transparent);
    --frame: color-mix(in srgb, currentColor 16%, transparent);
    --muted: color-mix(in srgb, currentColor 66%, transparent);
    --faint: color-mix(in srgb, currentColor 45%, transparent);
    -webkit-tap-highlight-color: transparent;
}
.ellipsis {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.edit {
    pointer-events: none;
}
.hint {
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
    color: var(--muted, inherit);
    opacity: 0.8;
    font-size: clamp(11px, 5cqmin, 15px);
}
.hint svg {
    width: clamp(18px, 12cqmin, 36px);
    height: clamp(18px, 12cqmin, 36px);
    fill: currentColor;
}
`,k=`
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it - no loop between measuring and laying out */
    container-type: size;
}
.root {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}
`,ue=`
:host {
    display: block;
}
.dialog {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    min-width: min(640px, 80vw);
    color: inherit;
    font: inherit;
}
.dialog-map {
    position: relative;
    height: min(70vh, 560px);
    border-radius: calc(var(--iob-border-radius, 4px) * 2);
    overflow: hidden;
}
.dialog .hint {
    height: min(40vh, 240px);
}
`,A=`
.trip-panel {
    position: relative;
    width: 100%;
    height: 100%;
    container-type: size;
}
.map-view,
.leaflet-host {
    position: absolute;
    inset: 0;
}
.leaflet-host.leaflet-container {
    background: color-mix(in srgb, currentColor 8%, transparent);
    font-family: inherit;
    color: var(--iob-text);
}
/* the tiles of a light map, made dark for a dark theme */
.map-view.dark .leaflet-tile-pane {
    filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.6);
}
.leaflet-bar,
.leaflet-touch .leaflet-bar {
    border-color: color-mix(in srgb, var(--iob-text) 22%, transparent);
}
.leaflet-bar a,
.leaflet-bar a:hover,
.leaflet-bar a:focus {
    background-color: var(--iob-paper);
    color: var(--iob-text);
    border-bottom-color: var(--iob-divider);
}
.leaflet-bar a:hover {
    background-color: color-mix(in srgb, var(--iob-paper) 86%, var(--iob-text));
}
.leaflet-bar a.leaflet-disabled {
    background-color: var(--iob-paper);
    color: var(--iob-text-secondary);
    opacity: 0.5;
}
.trip-fit {
    display: flex !important;
    align-items: center;
    justify-content: center;
}
.trip-fit svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
}
.leaflet-container .leaflet-control-attribution {
    background: color-mix(in srgb, var(--iob-paper) 78%, transparent);
    color: var(--iob-text-secondary);
}
.leaflet-container .leaflet-control-attribution a {
    color: var(--iob-primary);
}
.leaflet-tooltip {
    background: var(--iob-paper);
    color: var(--iob-text);
    border-color: var(--iob-divider);
    font: inherit;
    font-size: 12px;
    line-height: 1.4;
}
.leaflet-tooltip-top::before {
    border-top-color: var(--iob-paper);
}
.leaflet-tooltip-bottom::before {
    border-bottom-color: var(--iob-paper);
}
.leaflet-tooltip-left::before {
    border-left-color: var(--iob-paper);
}
.leaflet-tooltip-right::before {
    border-right-color: var(--iob-paper);
}
.trip-tip div:first-child {
    font-weight: 600;
}
/* the paths take their colors from the theme: CSS wins over the attributes Leaflet sets */
.trip-casing {
    stroke: var(--iob-paper);
    stroke-opacity: 0.85;
}
.trip-track {
    stroke: var(--iob-primary);
    stroke-opacity: 0.95;
}
.trip-marker {
    stroke: var(--iob-paper);
    stroke-opacity: 1;
}
.trip-start {
    fill: var(--iob-success);
}
.trip-end {
    fill: var(--iob-error);
}
.trip-stop {
    fill: var(--iob-warning);
}
.trip-position .dot,
.trip-position .pulse {
    position: absolute;
    border-radius: 50%;
}
.trip-position .pulse {
    inset: 0;
    background: color-mix(in srgb, var(--iob-primary) 30%, transparent);
}
.trip-position .dot {
    inset: 4px;
    background: color-mix(in srgb, var(--iob-primary) 55%, var(--iob-text-secondary));
    border: 3px solid var(--iob-paper);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}
.trip-position.running .dot {
    background: var(--iob-primary);
}
.trip-position.running .pulse {
    animation: trip-pulse 1.8s ease-out infinite;
}
@keyframes trip-pulse {
    from {
        transform: scale(0.6);
        opacity: 1;
    }
    to {
        transform: scale(2.2);
        opacity: 0;
    }
}
.info {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    max-width: calc(100% - 64px);
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: calc(var(--iob-border-radius, 4px) * 2);
    background: color-mix(in srgb, var(--iob-paper) 90%, transparent);
    color: var(--iob-text);
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
    font-size: 12px;
    line-height: 1.35;
}
.info-status {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--iob-text-secondary);
}
.live-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--iob-success);
    animation: trip-blink 1.6s ease-in-out infinite;
}
@keyframes trip-blink {
    50% {
        opacity: 0.3;
    }
}
.info-route {
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.info-values {
    display: flex;
    flex-wrap: wrap;
    column-gap: 14px;
    row-gap: 2px;
    margin-top: 2px;
}
.info-value {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.info-number {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.info-label {
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--iob-text-secondary);
}
.info-note {
    max-width: 260px;
    font-size: 11px;
    color: var(--iob-warning);
}
@container (max-width: 320px) {
    .info-label {
        display: none;
    }
    .info-values {
        column-gap: 10px;
    }
    .info-number {
        font-size: 13px;
    }
}
@container (max-height: 200px) {
    .info-route,
    .info-note {
        display: none;
    }
}
@container (max-height: 130px) or (max-width: 220px) {
    .info,
    .leaflet-control-zoom,
    .trip-fit {
        display: none !important;
    }
}
@media (prefers-reduced-motion: reduce) {
    .trip-position.running .pulse,
    .live-dot {
        animation: none;
    }
}
`;`${O}${k}${D}${A}`,`${O}${ue}${D}${A}`,`${O}${k}${D}${A}`;var de=`${O}${k}
.diag {
    overflow: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 13px;
    line-height: 1.4;
}
.muted {
    color: var(--muted);
}
.small {
    font-size: 11px;
}
.nowrap {
    white-space: nowrap;
}
.banner {
    padding: 6px 10px;
    border-radius: var(--iob-border-radius, 4px);
    background: color-mix(in srgb, var(--iob-warning) 16%, transparent);
    color: var(--iob-text);
    border: 1px solid color-mix(in srgb, var(--iob-warning) 50%, transparent);
}
.object {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--frame);
    border-radius: calc(var(--iob-border-radius, 4px) * 2);
}
.object.single {
    padding: 0;
    border: none;
}
.object-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
}
.object-name {
    font-size: 16px;
    font-weight: 700;
}
.object-type {
    color: var(--muted);
}
.block-title,
.card-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
}
.block-title {
    margin-top: 4px;
}
.badges {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
}
.badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    background: var(--hover);
    color: var(--iob-text);
}
.badge.primary {
    background: var(--iob-primary);
    color: var(--iob-primary-contrast);
}
.badge.ok,
.badge.phase-trip {
    background: color-mix(in srgb, var(--iob-success) 22%, transparent);
    color: color-mix(in srgb, var(--iob-success) 70%, var(--iob-text));
}
.badge.warn,
.badge.phase-starting {
    background: color-mix(in srgb, var(--iob-warning) 24%, transparent);
    color: color-mix(in srgb, var(--iob-warning) 65%, var(--iob-text));
}
.badge.error {
    background: var(--iob-error);
    color: #fff;
}
.badge.neutral,
.badge.phase-parked {
    background: var(--hover);
    color: var(--muted);
}
.object-header .badge.phase {
    font-size: 12px;
    padding: 2px 10px;
}
.table-wrap {
    overflow-x: auto;
    max-width: 100%;
}
table {
    border-collapse: collapse;
}
.grid {
    width: 100%;
}
.grid th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
    padding: 4px 8px;
    border-bottom: 1px solid var(--frame);
}
.grid td {
    padding: 4px 8px;
    vertical-align: top;
    border-bottom: 1px solid var(--frame);
}
.grid .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.sources > tbody.active > tr.source-row > td {
    background: color-mix(in srgb, var(--iob-primary) 9%, transparent);
}
.sources > tbody.active > tr.source-row > td:first-child {
    box-shadow: inset 3px 0 0 var(--iob-primary);
}
.source-label {
    font-weight: 600;
    max-width: 280px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.states-row > td {
    padding-top: 0;
    padding-bottom: 8px;
}
.states {
    font-size: 12px;
}
.states th,
.states td {
    border-bottom-color: color-mix(in srgb, currentColor 8%, transparent);
    padding: 2px 8px;
}
.states .value {
    max-width: 220px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
}
.states .missing,
.stale,
.warn-text {
    color: var(--iob-warning);
    font-weight: 600;
}
.counts {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    font-size: 12px;
}
.count b {
    font-variant-numeric: tabular-nums;
}
.state-id {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    min-width: 0;
}
.state-id code {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    user-select: all;
    -webkit-user-select: all;
}
.copy {
    flex: none;
    display: inline-flex;
    padding: 2px;
    border: none;
    border-radius: var(--iob-border-radius, 4px);
    background: transparent;
    color: var(--faint);
    cursor: pointer;
}
.copy:hover {
    background: var(--hover);
    color: inherit;
}
.copy.copied {
    color: var(--iob-success);
}
.copy svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
}
.ignition,
.inputs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
}
.inputs-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
}
.input {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 10px;
    align-items: start;
}
.card {
    padding: 8px 10px;
    border-radius: calc(var(--iob-border-radius, 4px) * 2);
    background: var(--tint);
    min-width: 0;
}
.card-title {
    margin-bottom: 4px;
}
.kv {
    width: 100%;
}
.kv th {
    text-align: left;
    font-weight: 400;
    color: var(--muted);
    padding: 2px 10px 2px 0;
    vertical-align: top;
    width: 45%;
}
.kv td {
    padding: 2px 0;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
}
.kv tr.warn td {
    color: var(--iob-warning);
    font-weight: 600;
}
.general {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
`;function j(e){let t={en:{choose_instance:`Choose an instance of the Trips adapter in the settings`,no_objects:`%s tracks no object. Add a car, boat or person in its settings`,object_not_found:`%s has no object "%s"`,no_answer:`No answer from %s. Is the instance running?`,no_trips:`No trips yet`,loading:`Loading…`,phase_parked:`Parked`,phase_starting:`Starting`,phase_trip:`Trip`,manual:`started by hand`,type_car:`Car`,type_boat:`Boat`,type_person:`Person`,type_other:`Other`,sources:`Sources`,priority:`Prio.`,source:`Source`,status:`Status`,active:`active`,fresh:`fresh`,stale:`stale`,max_age:`max. age %s`,last_position:`Last position`,last_result:`Last result`,counts:`Positions`,count_accepted:`accepted`,count_unused:`unused`,count_inaccurate:`inaccurate`,count_old:`old`,count_outlier:`outliers`,count_invalid:`invalid`,count_confirmed:`confirmed`,role:`Role`,state_id:`State ID`,value:`Value`,unit:`Unit`,age:`Age`,role_position:`Position`,role_latitude:`Latitude`,role_longitude:`Longitude`,role_accuracy:`Accuracy`,role_altitude:`Altitude`,role_timestamp:`Time stamp`,role_alive:`Alive signal`,speed:`Speed`,ignition:`Ignition/engine`,no_value:`no value`,older_than:`older than %s`,ignition_from:`Ignition/engine from`,none:`none`,on:`on`,off:`off`,unknown:`unknown`,yes:`yes`,no:`no`,ago:`%s ago`,copy:`Copy`,copied:`Copied`,further_states:`Further states`,input_odometer:`Odometer`,input_price:`Price`,detector:`Trip detection`,phase:`Phase`,moving_since:`Moving since`,parked_at:`Parking position`,pending:`Waiting positions`,suspects:`Suspect positions`,running_trip:`Running trip`,reason:`Started by`,reason_movement:`movement`,reason_manual:`by hand`,start:`Start`,distance:`Distance`,duration:`Duration`,moving_time:`Moving time`,avg_speed:`Avg. speed`,max_speed:`Max. speed`,points:`Points`,stops:`Stops`,gaps:`Gaps`,engine_time:`Engine on`,engine_distance:`Distance with engine`,odometer_start:`Odometer at start`,watch:`Position watch`,centre:`Centre`,radius:`Radius`,max_distance:`Max. distance`,alarm:`Alarm`,signal_lost:`Signal lost`,active_since:`Active since`,signal_minutes:`Alarm without signal after`,auto:`Automatic`,meter:`Consumption meter`,estimate:`Estimated consumption`,meter_mode:`Mode`,meter_counter:`Counter`,meter_level:`Level`,meter_rate:`Rate`,estimate_distance:`By distance`,estimate_hours:`By engine hours`,meter_running:`Measuring`,used:`Used in this trip`,last_value:`Last value`,refills:`Refills`,consumption:`Consumption`,settings_in_use:`Settings in use`,start_speed:`Start speed`,start_seconds:`Start after`,start_distance:`Start distance`,stop_radius:`Stop radius`,min_stop:`Minimum stop`,trip_end:`Trip ends after`,min_distance:`Min. distance of points`,max_accuracy:`Max. inaccuracy`,use_ignition:`Use ignition`,trips:`Trips`,trip_count:`Number`,last_trip:`Last trip`,places:`Places`,name:`Name`,privacy:`Privacy zone`,home:`Home`,general:`General`,notification_instance:`Notifications`,live_interval:`Live states every`,not_updated:`Not updated: %s`,type:`Type`},de:{choose_instance:`Instanz des Trips-Adapters in den Einstellungen wählen`,no_objects:`%s verfolgt kein Objekt. Ein Auto, Boot oder eine Person in den Einstellungen hinzufügen`,object_not_found:`%s hat kein Objekt „%s“`,no_answer:`Keine Antwort von %s. Läuft die Instanz?`,no_trips:`Noch keine Fahrten`,loading:`Wird geladen…`,phase_parked:`Geparkt`,phase_starting:`Anfahrt`,phase_trip:`Fahrt`,manual:`von Hand gestartet`,type_car:`Auto`,type_boat:`Boot`,type_person:`Person`,type_other:`Sonstiges`,sources:`Quellen`,priority:`Prio.`,source:`Quelle`,status:`Status`,active:`aktiv`,fresh:`aktuell`,stale:`veraltet`,max_age:`max. Alter %s`,last_position:`Letzte Position`,last_result:`Letztes Ergebnis`,counts:`Positionen`,count_accepted:`verwendet`,count_unused:`ungenutzt`,count_inaccurate:`ungenau`,count_old:`alt`,count_outlier:`Ausreißer`,count_invalid:`ungültig`,count_confirmed:`bestätigt`,role:`Rolle`,state_id:`Datenpunkt`,value:`Wert`,unit:`Einheit`,age:`Alter`,role_position:`Position`,role_latitude:`Breitengrad`,role_longitude:`Längengrad`,role_accuracy:`Genauigkeit`,role_altitude:`Höhe`,role_timestamp:`Zeitstempel`,role_alive:`Lebenszeichen`,speed:`Geschwindigkeit`,ignition:`Zündung/Motor`,no_value:`kein Wert`,older_than:`älter als %s`,ignition_from:`Zündung/Motor von`,none:`keine`,on:`an`,off:`aus`,unknown:`unbekannt`,yes:`ja`,no:`nein`,ago:`vor %s`,copy:`Kopieren`,copied:`Kopiert`,further_states:`Weitere Datenpunkte`,input_odometer:`Kilometerstand`,input_price:`Preis`,detector:`Fahrterkennung`,phase:`Phase`,moving_since:`In Bewegung seit`,parked_at:`Parkposition`,pending:`Wartende Positionen`,suspects:`Verdächtige Positionen`,running_trip:`Laufende Fahrt`,reason:`Gestartet durch`,reason_movement:`Bewegung`,reason_manual:`von Hand`,start:`Start`,distance:`Strecke`,duration:`Dauer`,moving_time:`Fahrzeit`,avg_speed:`Ø Geschw.`,max_speed:`Max. Geschw.`,points:`Punkte`,stops:`Halte`,gaps:`Lücken`,engine_time:`Motor an`,engine_distance:`Strecke mit Motor`,odometer_start:`Kilometerstand bei Start`,watch:`Positionswache`,centre:`Mittelpunkt`,radius:`Radius`,max_distance:`Max. Abstand`,alarm:`Alarm`,signal_lost:`Signal verloren`,active_since:`Aktiv seit`,signal_minutes:`Alarm ohne Signal nach`,auto:`Automatisch`,meter:`Verbrauchszähler`,estimate:`Geschätzter Verbrauch`,meter_mode:`Modus`,meter_counter:`Zählerstand`,meter_level:`Füllstand`,meter_rate:`Durchfluss`,estimate_distance:`Nach Strecke`,estimate_hours:`Nach Betriebsstunden`,meter_running:`Misst`,used:`In dieser Fahrt verbraucht`,last_value:`Letzter Wert`,refills:`Nachfüllungen`,consumption:`Verbrauch`,settings_in_use:`Verwendete Einstellungen`,start_speed:`Startgeschwindigkeit`,start_seconds:`Start nach`,start_distance:`Startstrecke`,stop_radius:`Halteradius`,min_stop:`Mindesthalt`,trip_end:`Fahrtende nach`,min_distance:`Mindestabstand der Punkte`,max_accuracy:`Max. Ungenauigkeit`,use_ignition:`Zündung verwenden`,trips:`Fahrten`,trip_count:`Anzahl`,last_trip:`Letzte Fahrt`,places:`Orte`,name:`Name`,privacy:`Privatzone`,home:`Zuhause`,general:`Allgemein`,notification_instance:`Benachrichtigungen`,live_interval:`Live-Datenpunkte alle`,not_updated:`Nicht aktualisiert: %s`,type:`Typ`},ru:{choose_instance:`Выберите экземпляр адаптера Trips в настройках`,no_objects:`%s не отслеживает ни одного объекта. Добавьте автомобиль, лодку или человека в его настройках`,object_not_found:`В %s нет объекта «%s»`,no_answer:`Нет ответа от %s. Экземпляр запущен?`,no_trips:`Поездок пока нет`,loading:`Загрузка…`,phase_parked:`Стоит`,phase_starting:`Начало движения`,phase_trip:`Поездка`,manual:`запущена вручную`,type_car:`Автомобиль`,type_boat:`Лодка`,type_person:`Человек`,type_other:`Другое`,sources:`Источники`,priority:`Приор.`,source:`Источник`,status:`Статус`,active:`активен`,fresh:`свежий`,stale:`устарел`,max_age:`макс. возраст %s`,last_position:`Последнее положение`,last_result:`Последний результат`,counts:`Позиции`,count_accepted:`принято`,count_unused:`не использ.`,count_inaccurate:`неточные`,count_old:`старые`,count_outlier:`выбросы`,count_invalid:`неверные`,count_confirmed:`подтверждено`,role:`Роль`,state_id:`ID состояния`,value:`Значение`,unit:`Единица`,age:`Возраст`,role_position:`Позиция`,role_latitude:`Широта`,role_longitude:`Долгота`,role_accuracy:`Точность`,role_altitude:`Высота`,role_timestamp:`Метка времени`,role_alive:`Признак жизни`,speed:`Скорость`,ignition:`Зажигание/двигатель`,no_value:`нет значения`,older_than:`старше %s`,ignition_from:`Зажигание/двигатель из`,none:`нет`,on:`вкл.`,off:`выкл.`,unknown:`неизвестно`,yes:`да`,no:`нет`,ago:`%s назад`,copy:`Копировать`,copied:`Скопировано`,further_states:`Другие состояния`,input_odometer:`Одометр`,input_price:`Цена`,detector:`Распознавание поездок`,phase:`Фаза`,moving_since:`В движении с`,parked_at:`Место стоянки`,pending:`Ожидающие позиции`,suspects:`Подозрительные позиции`,running_trip:`Текущая поездка`,reason:`Причина начала`,reason_movement:`движение`,reason_manual:`вручную`,start:`Начало`,distance:`Расстояние`,duration:`Длительность`,moving_time:`В движении`,avg_speed:`Ср. скорость`,max_speed:`Макс. скорость`,points:`Точки`,stops:`Остановки`,gaps:`Разрывы`,engine_time:`Двигатель работал`,engine_distance:`Путь с двигателем`,odometer_start:`Одометр на старте`,watch:`Контроль позиции`,centre:`Центр`,radius:`Радиус`,max_distance:`Макс. расстояние`,alarm:`Тревога`,signal_lost:`Сигнал потерян`,active_since:`Активен с`,signal_minutes:`Тревога без сигнала через`,auto:`Автоматически`,meter:`Счётчик расхода`,estimate:`Расчётный расход`,meter_mode:`Режим`,meter_counter:`Счётчик`,meter_level:`Уровень`,meter_rate:`Расход в час`,estimate_distance:`По расстоянию`,estimate_hours:`По моточасам`,meter_running:`Измеряет`,used:`Израсходовано в поездке`,last_value:`Последнее значение`,refills:`Заправки`,consumption:`Расход`,settings_in_use:`Используемые настройки`,start_speed:`Скорость начала`,start_seconds:`Начало через`,start_distance:`Расстояние начала`,stop_radius:`Радиус остановки`,min_stop:`Мин. остановка`,trip_end:`Конец поездки через`,min_distance:`Мин. расстояние точек`,max_accuracy:`Макс. погрешность`,use_ignition:`Использовать зажигание`,trips:`Поездки`,trip_count:`Количество`,last_trip:`Последняя поездка`,places:`Места`,name:`Название`,privacy:`Приватная зона`,home:`Дом`,general:`Общее`,notification_instance:`Уведомления`,live_interval:`Живые состояния каждые`,not_updated:`Не обновлено: %s`,type:`Тип`},pt:{choose_instance:`Escolha uma instância do adaptador Trips nas configurações`,no_objects:`%s não acompanha nenhum objeto. Adicione um carro, barco ou pessoa nas suas configurações`,object_not_found:`%s não tem o objeto "%s"`,no_answer:`Sem resposta de %s. A instância está em execução?`,no_trips:`Ainda sem viagens`,loading:`A carregar…`,phase_parked:`Estacionado`,phase_starting:`A arrancar`,phase_trip:`Viagem`,manual:`iniciada manualmente`,type_car:`Carro`,type_boat:`Barco`,type_person:`Pessoa`,type_other:`Outro`,sources:`Fontes`,priority:`Prio.`,source:`Fonte`,status:`Estado`,active:`ativa`,fresh:`atual`,stale:`desatualizada`,max_age:`idade máx. %s`,last_position:`Última posição`,last_result:`Último resultado`,counts:`Posições`,count_accepted:`aceites`,count_unused:`não usadas`,count_inaccurate:`imprecisas`,count_old:`antigas`,count_outlier:`anómalas`,count_invalid:`inválidas`,count_confirmed:`confirmadas`,role:`Função`,state_id:`ID do estado`,value:`Valor`,unit:`Unidade`,age:`Idade`,role_position:`Posição`,role_latitude:`Latitude`,role_longitude:`Longitude`,role_accuracy:`Precisão`,role_altitude:`Altitude`,role_timestamp:`Carimbo de tempo`,role_alive:`Sinal de vida`,speed:`Velocidade`,ignition:`Ignição/motor`,no_value:`sem valor`,older_than:`mais antigo que %s`,ignition_from:`Ignição/motor de`,none:`nenhuma`,on:`ligado`,off:`desligado`,unknown:`desconhecido`,yes:`sim`,no:`não`,ago:`há %s`,copy:`Copiar`,copied:`Copiado`,further_states:`Outros estados`,input_odometer:`Conta-quilómetros`,input_price:`Preço`,detector:`Deteção de viagens`,phase:`Fase`,moving_since:`Em movimento desde`,parked_at:`Posição de estacionamento`,pending:`Posições em espera`,suspects:`Posições suspeitas`,running_trip:`Viagem em curso`,reason:`Iniciada por`,reason_movement:`movimento`,reason_manual:`manualmente`,start:`Partida`,distance:`Distância`,duration:`Duração`,moving_time:`Tempo em movimento`,avg_speed:`Vel. média`,max_speed:`Vel. máx.`,points:`Pontos`,stops:`Paragens`,gaps:`Lacunas`,engine_time:`Motor ligado`,engine_distance:`Distância com motor`,odometer_start:`Conta-quilómetros no início`,watch:`Vigilância de posição`,centre:`Centro`,radius:`Raio`,max_distance:`Distância máx.`,alarm:`Alarme`,signal_lost:`Sinal perdido`,active_since:`Ativa desde`,signal_minutes:`Alarme sem sinal após`,auto:`Automática`,meter:`Contador de consumo`,estimate:`Consumo estimado`,meter_mode:`Modo`,meter_counter:`Contador`,meter_level:`Nível`,meter_rate:`Caudal`,estimate_distance:`Por distância`,estimate_hours:`Por horas de motor`,meter_running:`A medir`,used:`Gasto nesta viagem`,last_value:`Último valor`,refills:`Reabastecimentos`,consumption:`Consumo`,settings_in_use:`Definições em uso`,start_speed:`Velocidade de início`,start_seconds:`Início após`,start_distance:`Distância de início`,stop_radius:`Raio de paragem`,min_stop:`Paragem mínima`,trip_end:`Fim da viagem após`,min_distance:`Distância mín. entre pontos`,max_accuracy:`Imprecisão máx.`,use_ignition:`Usar ignição`,trips:`Viagens`,trip_count:`Número`,last_trip:`Última viagem`,places:`Locais`,name:`Nome`,privacy:`Zona privada`,home:`Casa`,general:`Geral`,notification_instance:`Notificações`,live_interval:`Estados ao vivo a cada`,not_updated:`Não atualizado: %s`,type:`Tipo`},nl:{choose_instance:`Kies een instantie van de Trips-adapter in de instellingen`,no_objects:`%s volgt geen object. Voeg een auto, boot of persoon toe in de instellingen`,object_not_found:`%s heeft geen object "%s"`,no_answer:`Geen antwoord van %s. Draait de instantie?`,no_trips:`Nog geen ritten`,loading:`Laden…`,phase_parked:`Geparkeerd`,phase_starting:`Vertrekt`,phase_trip:`Rit`,manual:`handmatig gestart`,type_car:`Auto`,type_boat:`Boot`,type_person:`Persoon`,type_other:`Overig`,sources:`Bronnen`,priority:`Prio.`,source:`Bron`,status:`Status`,active:`actief`,fresh:`actueel`,stale:`verouderd`,max_age:`max. leeftijd %s`,last_position:`Laatste positie`,last_result:`Laatste resultaat`,counts:`Posities`,count_accepted:`gebruikt`,count_unused:`ongebruikt`,count_inaccurate:`onnauwkeurig`,count_old:`oud`,count_outlier:`uitschieters`,count_invalid:`ongeldig`,count_confirmed:`bevestigd`,role:`Rol`,state_id:`Datapunt`,value:`Waarde`,unit:`Eenheid`,age:`Leeftijd`,role_position:`Positie`,role_latitude:`Breedtegraad`,role_longitude:`Lengtegraad`,role_accuracy:`Nauwkeurigheid`,role_altitude:`Hoogte`,role_timestamp:`Tijdstempel`,role_alive:`Levensteken`,speed:`Snelheid`,ignition:`Contact/motor`,no_value:`geen waarde`,older_than:`ouder dan %s`,ignition_from:`Contact/motor van`,none:`geen`,on:`aan`,off:`uit`,unknown:`onbekend`,yes:`ja`,no:`nee`,ago:`%s geleden`,copy:`Kopiëren`,copied:`Gekopieerd`,further_states:`Overige datapunten`,input_odometer:`Kilometerstand`,input_price:`Prijs`,detector:`Ritdetectie`,phase:`Fase`,moving_since:`In beweging sinds`,parked_at:`Parkeerpositie`,pending:`Wachtende posities`,suspects:`Verdachte posities`,running_trip:`Lopende rit`,reason:`Gestart door`,reason_movement:`beweging`,reason_manual:`handmatig`,start:`Vertrek`,distance:`Afstand`,duration:`Duur`,moving_time:`Rijtijd`,avg_speed:`Gem. snelheid`,max_speed:`Max. snelheid`,points:`Punten`,stops:`Stops`,gaps:`Gaten`,engine_time:`Motor aan`,engine_distance:`Afstand op motor`,odometer_start:`Kilometerstand bij start`,watch:`Positiebewaking`,centre:`Middelpunt`,radius:`Straal`,max_distance:`Max. afstand`,alarm:`Alarm`,signal_lost:`Signaal verloren`,active_since:`Actief sinds`,signal_minutes:`Alarm zonder signaal na`,auto:`Automatisch`,meter:`Verbruiksmeter`,estimate:`Geschat verbruik`,meter_mode:`Modus`,meter_counter:`Meterstand`,meter_level:`Niveau`,meter_rate:`Debiet`,estimate_distance:`Op afstand`,estimate_hours:`Op motoruren`,meter_running:`Meet`,used:`Verbruikt in deze rit`,last_value:`Laatste waarde`,refills:`Tankbeurten`,consumption:`Verbruik`,settings_in_use:`Gebruikte instellingen`,start_speed:`Startsnelheid`,start_seconds:`Start na`,start_distance:`Startafstand`,stop_radius:`Stopstraal`,min_stop:`Minimale stop`,trip_end:`Rit eindigt na`,min_distance:`Min. afstand punten`,max_accuracy:`Max. onnauwkeurigheid`,use_ignition:`Contact gebruiken`,trips:`Ritten`,trip_count:`Aantal`,last_trip:`Laatste rit`,places:`Plaatsen`,name:`Naam`,privacy:`Privézone`,home:`Thuis`,general:`Algemeen`,notification_instance:`Meldingen`,live_interval:`Live-datapunten elke`,not_updated:`Niet bijgewerkt: %s`,type:`Type`},fr:{choose_instance:`Choisissez une instance de l'adaptateur Trips dans les paramètres`,no_objects:`%s ne suit aucun objet. Ajoutez une voiture, un bateau ou une personne dans ses paramètres`,object_not_found:`%s n'a pas d'objet « %s »`,no_answer:`Pas de réponse de %s. L'instance est-elle démarrée ?`,no_trips:`Aucun trajet pour l'instant`,loading:`Chargement…`,phase_parked:`Stationné`,phase_starting:`Démarrage`,phase_trip:`Trajet`,manual:`démarré manuellement`,type_car:`Voiture`,type_boat:`Bateau`,type_person:`Personne`,type_other:`Autre`,sources:`Sources`,priority:`Prio.`,source:`Source`,status:`État`,active:`active`,fresh:`à jour`,stale:`périmée`,max_age:`âge max. %s`,last_position:`Dernière position`,last_result:`Dernier résultat`,counts:`Positions`,count_accepted:`acceptées`,count_unused:`inutilisées`,count_inaccurate:`imprécises`,count_old:`anciennes`,count_outlier:`aberrantes`,count_invalid:`invalides`,count_confirmed:`confirmées`,role:`Rôle`,state_id:`ID d'état`,value:`Valeur`,unit:`Unité`,age:`Âge`,role_position:`Position`,role_latitude:`Latitude`,role_longitude:`Longitude`,role_accuracy:`Précision`,role_altitude:`Altitude`,role_timestamp:`Horodatage`,role_alive:`Signal de vie`,speed:`Vitesse`,ignition:`Contact/moteur`,no_value:`pas de valeur`,older_than:`plus ancien que %s`,ignition_from:`Contact/moteur depuis`,none:`aucune`,on:`marche`,off:`arrêt`,unknown:`inconnu`,yes:`oui`,no:`non`,ago:`il y a %s`,copy:`Copier`,copied:`Copié`,further_states:`Autres états`,input_odometer:`Compteur kilométrique`,input_price:`Prix`,detector:`Détection des trajets`,phase:`Phase`,moving_since:`En mouvement depuis`,parked_at:`Position de stationnement`,pending:`Positions en attente`,suspects:`Positions suspectes`,running_trip:`Trajet en cours`,reason:`Démarré par`,reason_movement:`mouvement`,reason_manual:`manuellement`,start:`Départ`,distance:`Distance`,duration:`Durée`,moving_time:`Temps en mouvement`,avg_speed:`Vitesse moy.`,max_speed:`Vitesse max.`,points:`Points`,stops:`Arrêts`,gaps:`Lacunes`,engine_time:`Moteur en marche`,engine_distance:`Distance au moteur`,odometer_start:`Compteur au départ`,watch:`Surveillance de position`,centre:`Centre`,radius:`Rayon`,max_distance:`Distance max.`,alarm:`Alarme`,signal_lost:`Signal perdu`,active_since:`Active depuis`,signal_minutes:`Alarme sans signal après`,auto:`Automatique`,meter:`Compteur de consommation`,estimate:`Consommation estimée`,meter_mode:`Mode`,meter_counter:`Compteur`,meter_level:`Niveau`,meter_rate:`Débit`,estimate_distance:`Selon la distance`,estimate_hours:`Selon les heures moteur`,meter_running:`Mesure en cours`,used:`Consommé pendant ce trajet`,last_value:`Dernière valeur`,refills:`Pleins`,consumption:`Consommation`,settings_in_use:`Paramètres utilisés`,start_speed:`Vitesse de départ`,start_seconds:`Départ après`,start_distance:`Distance de départ`,stop_radius:`Rayon d'arrêt`,min_stop:`Arrêt minimal`,trip_end:`Fin du trajet après`,min_distance:`Distance min. des points`,max_accuracy:`Imprécision max.`,use_ignition:`Utiliser le contact`,trips:`Trajets`,trip_count:`Nombre`,last_trip:`Dernier trajet`,places:`Lieux`,name:`Nom`,privacy:`Zone privée`,home:`Domicile`,general:`Général`,notification_instance:`Notifications`,live_interval:`États en direct toutes les`,not_updated:`Non mis à jour : %s`,type:`Type`},it:{choose_instance:`Scegli un'istanza dell'adattatore Trips nelle impostazioni`,no_objects:`%s non segue nessun oggetto. Aggiungi un'auto, una barca o una persona nelle sue impostazioni`,object_not_found:`%s non ha l'oggetto "%s"`,no_answer:`Nessuna risposta da %s. L'istanza è in esecuzione?`,no_trips:`Ancora nessun viaggio`,loading:`Caricamento…`,phase_parked:`Parcheggiato`,phase_starting:`In partenza`,phase_trip:`Viaggio`,manual:`avviato manualmente`,type_car:`Auto`,type_boat:`Barca`,type_person:`Persona`,type_other:`Altro`,sources:`Sorgenti`,priority:`Prio.`,source:`Sorgente`,status:`Stato`,active:`attiva`,fresh:`aggiornata`,stale:`obsoleta`,max_age:`età max. %s`,last_position:`Ultima posizione`,last_result:`Ultimo risultato`,counts:`Posizioni`,count_accepted:`accettate`,count_unused:`inutilizzate`,count_inaccurate:`imprecise`,count_old:`vecchie`,count_outlier:`anomale`,count_invalid:`non valide`,count_confirmed:`confermate`,role:`Ruolo`,state_id:`ID stato`,value:`Valore`,unit:`Unità`,age:`Età`,role_position:`Posizione`,role_latitude:`Latitudine`,role_longitude:`Longitudine`,role_accuracy:`Precisione`,role_altitude:`Altitudine`,role_timestamp:`Marca temporale`,role_alive:`Segnale di vita`,speed:`Velocità`,ignition:`Accensione/motore`,no_value:`nessun valore`,older_than:`più vecchio di %s`,ignition_from:`Accensione/motore da`,none:`nessuna`,on:`acceso`,off:`spento`,unknown:`sconosciuto`,yes:`sì`,no:`no`,ago:`%s fa`,copy:`Copia`,copied:`Copiato`,further_states:`Altri stati`,input_odometer:`Contachilometri`,input_price:`Prezzo`,detector:`Rilevamento viaggi`,phase:`Fase`,moving_since:`In movimento da`,parked_at:`Posizione di parcheggio`,pending:`Posizioni in attesa`,suspects:`Posizioni sospette`,running_trip:`Viaggio in corso`,reason:`Avviato da`,reason_movement:`movimento`,reason_manual:`manualmente`,start:`Partenza`,distance:`Distanza`,duration:`Durata`,moving_time:`Tempo in movimento`,avg_speed:`Vel. media`,max_speed:`Velocità max.`,points:`Punti`,stops:`Soste`,gaps:`Interruzioni`,engine_time:`Motore acceso`,engine_distance:`Distanza a motore`,odometer_start:`Contachilometri alla partenza`,watch:`Sorveglianza posizione`,centre:`Centro`,radius:`Raggio`,max_distance:`Distanza max.`,alarm:`Allarme`,signal_lost:`Segnale perso`,active_since:`Attiva da`,signal_minutes:`Allarme senza segnale dopo`,auto:`Automatica`,meter:`Contatore consumi`,estimate:`Consumo stimato`,meter_mode:`Modalità`,meter_counter:`Contatore`,meter_level:`Livello`,meter_rate:`Portata`,estimate_distance:`In base alla distanza`,estimate_hours:`In base alle ore motore`,meter_running:`In misura`,used:`Consumato in questo viaggio`,last_value:`Ultimo valore`,refills:`Rifornimenti`,consumption:`Consumo`,settings_in_use:`Impostazioni in uso`,start_speed:`Velocità di partenza`,start_seconds:`Partenza dopo`,start_distance:`Distanza di partenza`,stop_radius:`Raggio di sosta`,min_stop:`Sosta minima`,trip_end:`Fine viaggio dopo`,min_distance:`Distanza min. punti`,max_accuracy:`Imprecisione max.`,use_ignition:`Usa accensione`,trips:`Viaggi`,trip_count:`Numero`,last_trip:`Ultimo viaggio`,places:`Luoghi`,name:`Nome`,privacy:`Zona privata`,home:`Casa`,general:`Generale`,notification_instance:`Notifiche`,live_interval:`Stati live ogni`,not_updated:`Non aggiornato: %s`,type:`Tipo`},es:{choose_instance:`Elija una instancia del adaptador Trips en la configuración`,no_objects:`%s no sigue ningún objeto. Añada un coche, barco o persona en su configuración`,object_not_found:`%s no tiene el objeto "%s"`,no_answer:`Sin respuesta de %s. ¿Está la instancia en marcha?`,no_trips:`Todavía no hay viajes`,loading:`Cargando…`,phase_parked:`Aparcado`,phase_starting:`Arrancando`,phase_trip:`Viaje`,manual:`iniciado manualmente`,type_car:`Coche`,type_boat:`Barco`,type_person:`Persona`,type_other:`Otro`,sources:`Fuentes`,priority:`Prio.`,source:`Fuente`,status:`Estado`,active:`activa`,fresh:`actual`,stale:`desactualizada`,max_age:`antigüedad máx. %s`,last_position:`Última posición`,last_result:`Último resultado`,counts:`Posiciones`,count_accepted:`aceptadas`,count_unused:`sin usar`,count_inaccurate:`imprecisas`,count_old:`antiguas`,count_outlier:`atípicas`,count_invalid:`inválidas`,count_confirmed:`confirmadas`,role:`Función`,state_id:`ID de estado`,value:`Valor`,unit:`Unidad`,age:`Antigüedad`,role_position:`Posición`,role_latitude:`Latitud`,role_longitude:`Longitud`,role_accuracy:`Precisión`,role_altitude:`Altitud`,role_timestamp:`Marca de tiempo`,role_alive:`Señal de vida`,speed:`Velocidad`,ignition:`Encendido/motor`,no_value:`sin valor`,older_than:`más antiguo que %s`,ignition_from:`Encendido/motor de`,none:`ninguna`,on:`encendido`,off:`apagado`,unknown:`desconocido`,yes:`sí`,no:`no`,ago:`hace %s`,copy:`Copiar`,copied:`Copiado`,further_states:`Otros estados`,input_odometer:`Cuentakilómetros`,input_price:`Precio`,detector:`Detección de viajes`,phase:`Fase`,moving_since:`En movimiento desde`,parked_at:`Posición de aparcamiento`,pending:`Posiciones en espera`,suspects:`Posiciones sospechosas`,running_trip:`Viaje en curso`,reason:`Iniciado por`,reason_movement:`movimiento`,reason_manual:`manualmente`,start:`Salida`,distance:`Distancia`,duration:`Duración`,moving_time:`Tiempo en movimiento`,avg_speed:`Vel. media`,max_speed:`Vel. máx.`,points:`Puntos`,stops:`Paradas`,gaps:`Huecos`,engine_time:`Motor encendido`,engine_distance:`Distancia a motor`,odometer_start:`Cuentakilómetros al inicio`,watch:`Vigilancia de posición`,centre:`Centro`,radius:`Radio`,max_distance:`Distancia máx.`,alarm:`Alarma`,signal_lost:`Señal perdida`,active_since:`Activa desde`,signal_minutes:`Alarma sin señal tras`,auto:`Automática`,meter:`Contador de consumo`,estimate:`Consumo estimado`,meter_mode:`Modo`,meter_counter:`Contador`,meter_level:`Nivel`,meter_rate:`Caudal`,estimate_distance:`Por distancia`,estimate_hours:`Por horas de motor`,meter_running:`Midiendo`,used:`Consumido en este viaje`,last_value:`Último valor`,refills:`Repostajes`,consumption:`Consumo`,settings_in_use:`Ajustes en uso`,start_speed:`Velocidad de inicio`,start_seconds:`Inicio tras`,start_distance:`Distancia de inicio`,stop_radius:`Radio de parada`,min_stop:`Parada mínima`,trip_end:`Fin del viaje tras`,min_distance:`Distancia mín. entre puntos`,max_accuracy:`Imprecisión máx.`,use_ignition:`Usar encendido`,trips:`Viajes`,trip_count:`Número`,last_trip:`Último viaje`,places:`Lugares`,name:`Nombre`,privacy:`Zona privada`,home:`Casa`,general:`General`,notification_instance:`Notificaciones`,live_interval:`Estados en vivo cada`,not_updated:`No actualizado: %s`,type:`Tipo`},pl:{choose_instance:`Wybierz instancję adaptera Trips w ustawieniach`,no_objects:`%s nie śledzi żadnego obiektu. Dodaj samochód, łódź lub osobę w jej ustawieniach`,object_not_found:`%s nie ma obiektu „%s”`,no_answer:`Brak odpowiedzi od %s. Czy instancja działa?`,no_trips:`Brak podróży`,loading:`Wczytywanie…`,phase_parked:`Zaparkowany`,phase_starting:`Ruszanie`,phase_trip:`Podróż`,manual:`uruchomiona ręcznie`,type_car:`Samochód`,type_boat:`Łódź`,type_person:`Osoba`,type_other:`Inne`,sources:`Źródła`,priority:`Prio.`,source:`Źródło`,status:`Status`,active:`aktywne`,fresh:`aktualne`,stale:`nieaktualne`,max_age:`maks. wiek %s`,last_position:`Ostatnia pozycja`,last_result:`Ostatni wynik`,counts:`Pozycje`,count_accepted:`przyjęte`,count_unused:`nieużyte`,count_inaccurate:`niedokładne`,count_old:`stare`,count_outlier:`odstające`,count_invalid:`nieprawidłowe`,count_confirmed:`potwierdzone`,role:`Rola`,state_id:`ID stanu`,value:`Wartość`,unit:`Jednostka`,age:`Wiek`,role_position:`Pozycja`,role_latitude:`Szerokość`,role_longitude:`Długość`,role_accuracy:`Dokładność`,role_altitude:`Wysokość`,role_timestamp:`Znacznik czasu`,role_alive:`Sygnał życia`,speed:`Prędkość`,ignition:`Zapłon/silnik`,no_value:`brak wartości`,older_than:`starsze niż %s`,ignition_from:`Zapłon/silnik z`,none:`brak`,on:`wł.`,off:`wył.`,unknown:`nieznany`,yes:`tak`,no:`nie`,ago:`%s temu`,copy:`Kopiuj`,copied:`Skopiowano`,further_states:`Inne stany`,input_odometer:`Licznik przebiegu`,input_price:`Cena`,detector:`Wykrywanie podróży`,phase:`Faza`,moving_since:`W ruchu od`,parked_at:`Pozycja postoju`,pending:`Oczekujące pozycje`,suspects:`Podejrzane pozycje`,running_trip:`Bieżąca podróż`,reason:`Rozpoczęta przez`,reason_movement:`ruch`,reason_manual:`ręcznie`,start:`Start`,distance:`Dystans`,duration:`Czas trwania`,moving_time:`Czas jazdy`,avg_speed:`Śr. prędkość`,max_speed:`Maks. prędkość`,points:`Punkty`,stops:`Postoje`,gaps:`Przerwy`,engine_time:`Silnik pracował`,engine_distance:`Dystans na silniku`,odometer_start:`Przebieg na starcie`,watch:`Nadzór pozycji`,centre:`Środek`,radius:`Promień`,max_distance:`Maks. odległość`,alarm:`Alarm`,signal_lost:`Utrata sygnału`,active_since:`Aktywny od`,signal_minutes:`Alarm bez sygnału po`,auto:`Automatyczny`,meter:`Licznik zużycia`,estimate:`Szacowane zużycie`,meter_mode:`Tryb`,meter_counter:`Licznik`,meter_level:`Poziom`,meter_rate:`Przepływ`,estimate_distance:`Wg dystansu`,estimate_hours:`Wg motogodzin`,meter_running:`Mierzy`,used:`Zużyte w tej podróży`,last_value:`Ostatnia wartość`,refills:`Tankowania`,consumption:`Zużycie`,settings_in_use:`Używane ustawienia`,start_speed:`Prędkość startu`,start_seconds:`Start po`,start_distance:`Dystans startu`,stop_radius:`Promień postoju`,min_stop:`Min. postój`,trip_end:`Koniec podróży po`,min_distance:`Min. odległość punktów`,max_accuracy:`Maks. niedokładność`,use_ignition:`Użyj zapłonu`,trips:`Podróże`,trip_count:`Liczba`,last_trip:`Ostatnia podróż`,places:`Miejsca`,name:`Nazwa`,privacy:`Strefa prywatna`,home:`Dom`,general:`Ogólne`,notification_instance:`Powiadomienia`,live_interval:`Stany na żywo co`,not_updated:`Nie zaktualizowano: %s`,type:`Typ`},uk:{choose_instance:`Виберіть екземпляр адаптера Trips у налаштуваннях`,no_objects:`%s не відстежує жодного об'єкта. Додайте автомобіль, човен чи людину в його налаштуваннях`,object_not_found:`У %s немає об'єкта «%s»`,no_answer:`Немає відповіді від %s. Екземпляр запущено?`,no_trips:`Поїздок ще немає`,loading:`Завантаження…`,phase_parked:`Стоїть`,phase_starting:`Рушає`,phase_trip:`Поїздка`,manual:`запущена вручну`,type_car:`Автомобіль`,type_boat:`Човен`,type_person:`Людина`,type_other:`Інше`,sources:`Джерела`,priority:`Пріор.`,source:`Джерело`,status:`Статус`,active:`активне`,fresh:`свіже`,stale:`застаріле`,max_age:`макс. вік %s`,last_position:`Останнє положення`,last_result:`Останній результат`,counts:`Позиції`,count_accepted:`прийнято`,count_unused:`не використано`,count_inaccurate:`неточні`,count_old:`старі`,count_outlier:`викиди`,count_invalid:`недійсні`,count_confirmed:`підтверджено`,role:`Роль`,state_id:`ID стану`,value:`Значення`,unit:`Одиниця`,age:`Вік`,role_position:`Позиція`,role_latitude:`Широта`,role_longitude:`Довгота`,role_accuracy:`Точність`,role_altitude:`Висота`,role_timestamp:`Мітка часу`,role_alive:`Ознака життя`,speed:`Швидкість`,ignition:`Запалювання/двигун`,no_value:`немає значення`,older_than:`старше за %s`,ignition_from:`Запалювання/двигун з`,none:`немає`,on:`увімк.`,off:`вимк.`,unknown:`невідомо`,yes:`так`,no:`ні`,ago:`%s тому`,copy:`Копіювати`,copied:`Скопійовано`,further_states:`Інші стани`,input_odometer:`Одометр`,input_price:`Ціна`,detector:`Розпізнавання поїздок`,phase:`Фаза`,moving_since:`У русі з`,parked_at:`Місце стоянки`,pending:`Позиції в очікуванні`,suspects:`Підозрілі позиції`,running_trip:`Поточна поїздка`,reason:`Розпочата через`,reason_movement:`рух`,reason_manual:`вручну`,start:`Початок`,distance:`Відстань`,duration:`Тривалість`,moving_time:`Час руху`,avg_speed:`Сер. швидкість`,max_speed:`Макс. швидкість`,points:`Точки`,stops:`Зупинки`,gaps:`Розриви`,engine_time:`Двигун працював`,engine_distance:`Відстань з двигуном`,odometer_start:`Одометр на старті`,watch:`Контроль позиції`,centre:`Центр`,radius:`Радіус`,max_distance:`Макс. відстань`,alarm:`Тривога`,signal_lost:`Сигнал втрачено`,active_since:`Активний з`,signal_minutes:`Тривога без сигналу через`,auto:`Автоматично`,meter:`Лічильник витрати`,estimate:`Розрахункова витрата`,meter_mode:`Режим`,meter_counter:`Лічильник`,meter_level:`Рівень`,meter_rate:`Витрата за годину`,estimate_distance:`За відстанню`,estimate_hours:`За мотогодинами`,meter_running:`Вимірює`,used:`Витрачено в поїздці`,last_value:`Останнє значення`,refills:`Заправки`,consumption:`Витрата`,settings_in_use:`Використовувані налаштування`,start_speed:`Швидкість початку`,start_seconds:`Початок через`,start_distance:`Відстань початку`,stop_radius:`Радіус зупинки`,min_stop:`Мін. зупинка`,trip_end:`Кінець поїздки через`,min_distance:`Мін. відстань точок`,max_accuracy:`Макс. похибка`,use_ignition:`Використовувати запалювання`,trips:`Поїздки`,trip_count:`Кількість`,last_trip:`Остання поїздка`,places:`Місця`,name:`Назва`,privacy:`Приватна зона`,home:`Дім`,general:`Загальне`,notification_instance:`Сповіщення`,live_interval:`Живі стани кожні`,not_updated:`Не оновлено: %s`,type:`Тип`},"zh-cn":{choose_instance:`请在设置中选择 Trips 适配器实例`,no_objects:`%s 没有跟踪任何对象。请在其设置中添加汽车、船只或人员`,object_not_found:`%s 中没有对象“%s”`,no_answer:`%s 没有响应。实例是否正在运行？`,no_trips:`暂无行程`,loading:`加载中…`,phase_parked:`停放`,phase_starting:`起步中`,phase_trip:`行程中`,manual:`手动开始`,type_car:`汽车`,type_boat:`船`,type_person:`人员`,type_other:`其他`,sources:`数据源`,priority:`优先级`,source:`数据源`,status:`状态`,active:`使用中`,fresh:`新鲜`,stale:`过期`,max_age:`最长 %s`,last_position:`最后位置`,last_result:`最近结果`,counts:`位置统计`,count_accepted:`已采用`,count_unused:`未使用`,count_inaccurate:`不精确`,count_old:`过旧`,count_outlier:`异常值`,count_invalid:`无效`,count_confirmed:`已确认`,role:`作用`,state_id:`状态 ID`,value:`值`,unit:`单位`,age:`距今`,role_position:`位置`,role_latitude:`纬度`,role_longitude:`经度`,role_accuracy:`精度`,role_altitude:`海拔`,role_timestamp:`时间戳`,role_alive:`存活信号`,speed:`速度`,ignition:`点火/发动机`,no_value:`无值`,older_than:`超过 %s`,ignition_from:`点火/发动机来源`,none:`无`,on:`开`,off:`关`,unknown:`未知`,yes:`是`,no:`否`,ago:`%s前`,copy:`复制`,copied:`已复制`,further_states:`其他状态`,input_odometer:`里程表`,input_price:`价格`,detector:`行程检测`,phase:`阶段`,moving_since:`移动开始于`,parked_at:`停放位置`,pending:`等待中的位置`,suspects:`可疑位置`,running_trip:`进行中的行程`,reason:`开始原因`,reason_movement:`移动`,reason_manual:`手动`,start:`起点`,distance:`距离`,duration:`时长`,moving_time:`移动时间`,avg_speed:`平均速度`,max_speed:`最高速度`,points:`点数`,stops:`停留`,gaps:`中断`,engine_time:`发动机运行`,engine_distance:`发动机航程`,odometer_start:`起始里程`,watch:`位置监控`,centre:`中心`,radius:`半径`,max_distance:`最大距离`,alarm:`警报`,signal_lost:`信号丢失`,active_since:`启用于`,signal_minutes:`无信号报警延时`,auto:`自动`,meter:`能耗计量`,estimate:`估算能耗`,meter_mode:`模式`,meter_counter:`累计值`,meter_level:`液位`,meter_rate:`流量`,estimate_distance:`按距离`,estimate_hours:`按运行时长`,meter_running:`计量中`,used:`本次行程消耗`,last_value:`最近值`,refills:`加注次数`,consumption:`能耗`,settings_in_use:`当前设置`,start_speed:`起始速度`,start_seconds:`起始时长`,start_distance:`起始距离`,stop_radius:`停留半径`,min_stop:`最短停留`,trip_end:`行程结束时长`,min_distance:`最小点距`,max_accuracy:`最大误差`,use_ignition:`使用点火信号`,trips:`行程`,trip_count:`数量`,last_trip:`最近行程`,places:`地点`,name:`名称`,privacy:`隐私区`,home:`家`,general:`常规`,notification_instance:`通知`,live_interval:`实时状态间隔`,not_updated:`未更新：%s`,type:`类型`}}[e]||{},n={en:{choose_instance:`Choose an instance of the Trips adapter in the settings`,no_objects:`%s tracks no object. Add a car, boat or person in its settings`,object_not_found:`%s has no object "%s"`,no_answer:`No answer from %s. Is the instance running?`,no_trips:`No trips yet`,loading:`Loading…`,phase_parked:`Parked`,phase_starting:`Starting`,phase_trip:`Trip`,manual:`started by hand`,type_car:`Car`,type_boat:`Boat`,type_person:`Person`,type_other:`Other`,sources:`Sources`,priority:`Prio.`,source:`Source`,status:`Status`,active:`active`,fresh:`fresh`,stale:`stale`,max_age:`max. age %s`,last_position:`Last position`,last_result:`Last result`,counts:`Positions`,count_accepted:`accepted`,count_unused:`unused`,count_inaccurate:`inaccurate`,count_old:`old`,count_outlier:`outliers`,count_invalid:`invalid`,count_confirmed:`confirmed`,role:`Role`,state_id:`State ID`,value:`Value`,unit:`Unit`,age:`Age`,role_position:`Position`,role_latitude:`Latitude`,role_longitude:`Longitude`,role_accuracy:`Accuracy`,role_altitude:`Altitude`,role_timestamp:`Time stamp`,role_alive:`Alive signal`,speed:`Speed`,ignition:`Ignition/engine`,no_value:`no value`,older_than:`older than %s`,ignition_from:`Ignition/engine from`,none:`none`,on:`on`,off:`off`,unknown:`unknown`,yes:`yes`,no:`no`,ago:`%s ago`,copy:`Copy`,copied:`Copied`,further_states:`Further states`,input_odometer:`Odometer`,input_price:`Price`,detector:`Trip detection`,phase:`Phase`,moving_since:`Moving since`,parked_at:`Parking position`,pending:`Waiting positions`,suspects:`Suspect positions`,running_trip:`Running trip`,reason:`Started by`,reason_movement:`movement`,reason_manual:`by hand`,start:`Start`,distance:`Distance`,duration:`Duration`,moving_time:`Moving time`,avg_speed:`Avg. speed`,max_speed:`Max. speed`,points:`Points`,stops:`Stops`,gaps:`Gaps`,engine_time:`Engine on`,engine_distance:`Distance with engine`,odometer_start:`Odometer at start`,watch:`Position watch`,centre:`Centre`,radius:`Radius`,max_distance:`Max. distance`,alarm:`Alarm`,signal_lost:`Signal lost`,active_since:`Active since`,signal_minutes:`Alarm without signal after`,auto:`Automatic`,meter:`Consumption meter`,estimate:`Estimated consumption`,meter_mode:`Mode`,meter_counter:`Counter`,meter_level:`Level`,meter_rate:`Rate`,estimate_distance:`By distance`,estimate_hours:`By engine hours`,meter_running:`Measuring`,used:`Used in this trip`,last_value:`Last value`,refills:`Refills`,consumption:`Consumption`,settings_in_use:`Settings in use`,start_speed:`Start speed`,start_seconds:`Start after`,start_distance:`Start distance`,stop_radius:`Stop radius`,min_stop:`Minimum stop`,trip_end:`Trip ends after`,min_distance:`Min. distance of points`,max_accuracy:`Max. inaccuracy`,use_ignition:`Use ignition`,trips:`Trips`,trip_count:`Number`,last_trip:`Last trip`,places:`Places`,name:`Name`,privacy:`Privacy zone`,home:`Home`,general:`General`,notification_instance:`Notifications`,live_interval:`Live states every`,not_updated:`Not updated: %s`,type:`Type`},de:{choose_instance:`Instanz des Trips-Adapters in den Einstellungen wählen`,no_objects:`%s verfolgt kein Objekt. Ein Auto, Boot oder eine Person in den Einstellungen hinzufügen`,object_not_found:`%s hat kein Objekt „%s“`,no_answer:`Keine Antwort von %s. Läuft die Instanz?`,no_trips:`Noch keine Fahrten`,loading:`Wird geladen…`,phase_parked:`Geparkt`,phase_starting:`Anfahrt`,phase_trip:`Fahrt`,manual:`von Hand gestartet`,type_car:`Auto`,type_boat:`Boot`,type_person:`Person`,type_other:`Sonstiges`,sources:`Quellen`,priority:`Prio.`,source:`Quelle`,status:`Status`,active:`aktiv`,fresh:`aktuell`,stale:`veraltet`,max_age:`max. Alter %s`,last_position:`Letzte Position`,last_result:`Letztes Ergebnis`,counts:`Positionen`,count_accepted:`verwendet`,count_unused:`ungenutzt`,count_inaccurate:`ungenau`,count_old:`alt`,count_outlier:`Ausreißer`,count_invalid:`ungültig`,count_confirmed:`bestätigt`,role:`Rolle`,state_id:`Datenpunkt`,value:`Wert`,unit:`Einheit`,age:`Alter`,role_position:`Position`,role_latitude:`Breitengrad`,role_longitude:`Längengrad`,role_accuracy:`Genauigkeit`,role_altitude:`Höhe`,role_timestamp:`Zeitstempel`,role_alive:`Lebenszeichen`,speed:`Geschwindigkeit`,ignition:`Zündung/Motor`,no_value:`kein Wert`,older_than:`älter als %s`,ignition_from:`Zündung/Motor von`,none:`keine`,on:`an`,off:`aus`,unknown:`unbekannt`,yes:`ja`,no:`nein`,ago:`vor %s`,copy:`Kopieren`,copied:`Kopiert`,further_states:`Weitere Datenpunkte`,input_odometer:`Kilometerstand`,input_price:`Preis`,detector:`Fahrterkennung`,phase:`Phase`,moving_since:`In Bewegung seit`,parked_at:`Parkposition`,pending:`Wartende Positionen`,suspects:`Verdächtige Positionen`,running_trip:`Laufende Fahrt`,reason:`Gestartet durch`,reason_movement:`Bewegung`,reason_manual:`von Hand`,start:`Start`,distance:`Strecke`,duration:`Dauer`,moving_time:`Fahrzeit`,avg_speed:`Ø Geschw.`,max_speed:`Max. Geschw.`,points:`Punkte`,stops:`Halte`,gaps:`Lücken`,engine_time:`Motor an`,engine_distance:`Strecke mit Motor`,odometer_start:`Kilometerstand bei Start`,watch:`Positionswache`,centre:`Mittelpunkt`,radius:`Radius`,max_distance:`Max. Abstand`,alarm:`Alarm`,signal_lost:`Signal verloren`,active_since:`Aktiv seit`,signal_minutes:`Alarm ohne Signal nach`,auto:`Automatisch`,meter:`Verbrauchszähler`,estimate:`Geschätzter Verbrauch`,meter_mode:`Modus`,meter_counter:`Zählerstand`,meter_level:`Füllstand`,meter_rate:`Durchfluss`,estimate_distance:`Nach Strecke`,estimate_hours:`Nach Betriebsstunden`,meter_running:`Misst`,used:`In dieser Fahrt verbraucht`,last_value:`Letzter Wert`,refills:`Nachfüllungen`,consumption:`Verbrauch`,settings_in_use:`Verwendete Einstellungen`,start_speed:`Startgeschwindigkeit`,start_seconds:`Start nach`,start_distance:`Startstrecke`,stop_radius:`Halteradius`,min_stop:`Mindesthalt`,trip_end:`Fahrtende nach`,min_distance:`Mindestabstand der Punkte`,max_accuracy:`Max. Ungenauigkeit`,use_ignition:`Zündung verwenden`,trips:`Fahrten`,trip_count:`Anzahl`,last_trip:`Letzte Fahrt`,places:`Orte`,name:`Name`,privacy:`Privatzone`,home:`Zuhause`,general:`Allgemein`,notification_instance:`Benachrichtigungen`,live_interval:`Live-Datenpunkte alle`,not_updated:`Nicht aktualisiert: %s`,type:`Typ`},ru:{choose_instance:`Выберите экземпляр адаптера Trips в настройках`,no_objects:`%s не отслеживает ни одного объекта. Добавьте автомобиль, лодку или человека в его настройках`,object_not_found:`В %s нет объекта «%s»`,no_answer:`Нет ответа от %s. Экземпляр запущен?`,no_trips:`Поездок пока нет`,loading:`Загрузка…`,phase_parked:`Стоит`,phase_starting:`Начало движения`,phase_trip:`Поездка`,manual:`запущена вручную`,type_car:`Автомобиль`,type_boat:`Лодка`,type_person:`Человек`,type_other:`Другое`,sources:`Источники`,priority:`Приор.`,source:`Источник`,status:`Статус`,active:`активен`,fresh:`свежий`,stale:`устарел`,max_age:`макс. возраст %s`,last_position:`Последнее положение`,last_result:`Последний результат`,counts:`Позиции`,count_accepted:`принято`,count_unused:`не использ.`,count_inaccurate:`неточные`,count_old:`старые`,count_outlier:`выбросы`,count_invalid:`неверные`,count_confirmed:`подтверждено`,role:`Роль`,state_id:`ID состояния`,value:`Значение`,unit:`Единица`,age:`Возраст`,role_position:`Позиция`,role_latitude:`Широта`,role_longitude:`Долгота`,role_accuracy:`Точность`,role_altitude:`Высота`,role_timestamp:`Метка времени`,role_alive:`Признак жизни`,speed:`Скорость`,ignition:`Зажигание/двигатель`,no_value:`нет значения`,older_than:`старше %s`,ignition_from:`Зажигание/двигатель из`,none:`нет`,on:`вкл.`,off:`выкл.`,unknown:`неизвестно`,yes:`да`,no:`нет`,ago:`%s назад`,copy:`Копировать`,copied:`Скопировано`,further_states:`Другие состояния`,input_odometer:`Одометр`,input_price:`Цена`,detector:`Распознавание поездок`,phase:`Фаза`,moving_since:`В движении с`,parked_at:`Место стоянки`,pending:`Ожидающие позиции`,suspects:`Подозрительные позиции`,running_trip:`Текущая поездка`,reason:`Причина начала`,reason_movement:`движение`,reason_manual:`вручную`,start:`Начало`,distance:`Расстояние`,duration:`Длительность`,moving_time:`В движении`,avg_speed:`Ср. скорость`,max_speed:`Макс. скорость`,points:`Точки`,stops:`Остановки`,gaps:`Разрывы`,engine_time:`Двигатель работал`,engine_distance:`Путь с двигателем`,odometer_start:`Одометр на старте`,watch:`Контроль позиции`,centre:`Центр`,radius:`Радиус`,max_distance:`Макс. расстояние`,alarm:`Тревога`,signal_lost:`Сигнал потерян`,active_since:`Активен с`,signal_minutes:`Тревога без сигнала через`,auto:`Автоматически`,meter:`Счётчик расхода`,estimate:`Расчётный расход`,meter_mode:`Режим`,meter_counter:`Счётчик`,meter_level:`Уровень`,meter_rate:`Расход в час`,estimate_distance:`По расстоянию`,estimate_hours:`По моточасам`,meter_running:`Измеряет`,used:`Израсходовано в поездке`,last_value:`Последнее значение`,refills:`Заправки`,consumption:`Расход`,settings_in_use:`Используемые настройки`,start_speed:`Скорость начала`,start_seconds:`Начало через`,start_distance:`Расстояние начала`,stop_radius:`Радиус остановки`,min_stop:`Мин. остановка`,trip_end:`Конец поездки через`,min_distance:`Мин. расстояние точек`,max_accuracy:`Макс. погрешность`,use_ignition:`Использовать зажигание`,trips:`Поездки`,trip_count:`Количество`,last_trip:`Последняя поездка`,places:`Места`,name:`Название`,privacy:`Приватная зона`,home:`Дом`,general:`Общее`,notification_instance:`Уведомления`,live_interval:`Живые состояния каждые`,not_updated:`Не обновлено: %s`,type:`Тип`},pt:{choose_instance:`Escolha uma instância do adaptador Trips nas configurações`,no_objects:`%s não acompanha nenhum objeto. Adicione um carro, barco ou pessoa nas suas configurações`,object_not_found:`%s não tem o objeto "%s"`,no_answer:`Sem resposta de %s. A instância está em execução?`,no_trips:`Ainda sem viagens`,loading:`A carregar…`,phase_parked:`Estacionado`,phase_starting:`A arrancar`,phase_trip:`Viagem`,manual:`iniciada manualmente`,type_car:`Carro`,type_boat:`Barco`,type_person:`Pessoa`,type_other:`Outro`,sources:`Fontes`,priority:`Prio.`,source:`Fonte`,status:`Estado`,active:`ativa`,fresh:`atual`,stale:`desatualizada`,max_age:`idade máx. %s`,last_position:`Última posição`,last_result:`Último resultado`,counts:`Posições`,count_accepted:`aceites`,count_unused:`não usadas`,count_inaccurate:`imprecisas`,count_old:`antigas`,count_outlier:`anómalas`,count_invalid:`inválidas`,count_confirmed:`confirmadas`,role:`Função`,state_id:`ID do estado`,value:`Valor`,unit:`Unidade`,age:`Idade`,role_position:`Posição`,role_latitude:`Latitude`,role_longitude:`Longitude`,role_accuracy:`Precisão`,role_altitude:`Altitude`,role_timestamp:`Carimbo de tempo`,role_alive:`Sinal de vida`,speed:`Velocidade`,ignition:`Ignição/motor`,no_value:`sem valor`,older_than:`mais antigo que %s`,ignition_from:`Ignição/motor de`,none:`nenhuma`,on:`ligado`,off:`desligado`,unknown:`desconhecido`,yes:`sim`,no:`não`,ago:`há %s`,copy:`Copiar`,copied:`Copiado`,further_states:`Outros estados`,input_odometer:`Conta-quilómetros`,input_price:`Preço`,detector:`Deteção de viagens`,phase:`Fase`,moving_since:`Em movimento desde`,parked_at:`Posição de estacionamento`,pending:`Posições em espera`,suspects:`Posições suspeitas`,running_trip:`Viagem em curso`,reason:`Iniciada por`,reason_movement:`movimento`,reason_manual:`manualmente`,start:`Partida`,distance:`Distância`,duration:`Duração`,moving_time:`Tempo em movimento`,avg_speed:`Vel. média`,max_speed:`Vel. máx.`,points:`Pontos`,stops:`Paragens`,gaps:`Lacunas`,engine_time:`Motor ligado`,engine_distance:`Distância com motor`,odometer_start:`Conta-quilómetros no início`,watch:`Vigilância de posição`,centre:`Centro`,radius:`Raio`,max_distance:`Distância máx.`,alarm:`Alarme`,signal_lost:`Sinal perdido`,active_since:`Ativa desde`,signal_minutes:`Alarme sem sinal após`,auto:`Automática`,meter:`Contador de consumo`,estimate:`Consumo estimado`,meter_mode:`Modo`,meter_counter:`Contador`,meter_level:`Nível`,meter_rate:`Caudal`,estimate_distance:`Por distância`,estimate_hours:`Por horas de motor`,meter_running:`A medir`,used:`Gasto nesta viagem`,last_value:`Último valor`,refills:`Reabastecimentos`,consumption:`Consumo`,settings_in_use:`Definições em uso`,start_speed:`Velocidade de início`,start_seconds:`Início após`,start_distance:`Distância de início`,stop_radius:`Raio de paragem`,min_stop:`Paragem mínima`,trip_end:`Fim da viagem após`,min_distance:`Distância mín. entre pontos`,max_accuracy:`Imprecisão máx.`,use_ignition:`Usar ignição`,trips:`Viagens`,trip_count:`Número`,last_trip:`Última viagem`,places:`Locais`,name:`Nome`,privacy:`Zona privada`,home:`Casa`,general:`Geral`,notification_instance:`Notificações`,live_interval:`Estados ao vivo a cada`,not_updated:`Não atualizado: %s`,type:`Tipo`},nl:{choose_instance:`Kies een instantie van de Trips-adapter in de instellingen`,no_objects:`%s volgt geen object. Voeg een auto, boot of persoon toe in de instellingen`,object_not_found:`%s heeft geen object "%s"`,no_answer:`Geen antwoord van %s. Draait de instantie?`,no_trips:`Nog geen ritten`,loading:`Laden…`,phase_parked:`Geparkeerd`,phase_starting:`Vertrekt`,phase_trip:`Rit`,manual:`handmatig gestart`,type_car:`Auto`,type_boat:`Boot`,type_person:`Persoon`,type_other:`Overig`,sources:`Bronnen`,priority:`Prio.`,source:`Bron`,status:`Status`,active:`actief`,fresh:`actueel`,stale:`verouderd`,max_age:`max. leeftijd %s`,last_position:`Laatste positie`,last_result:`Laatste resultaat`,counts:`Posities`,count_accepted:`gebruikt`,count_unused:`ongebruikt`,count_inaccurate:`onnauwkeurig`,count_old:`oud`,count_outlier:`uitschieters`,count_invalid:`ongeldig`,count_confirmed:`bevestigd`,role:`Rol`,state_id:`Datapunt`,value:`Waarde`,unit:`Eenheid`,age:`Leeftijd`,role_position:`Positie`,role_latitude:`Breedtegraad`,role_longitude:`Lengtegraad`,role_accuracy:`Nauwkeurigheid`,role_altitude:`Hoogte`,role_timestamp:`Tijdstempel`,role_alive:`Levensteken`,speed:`Snelheid`,ignition:`Contact/motor`,no_value:`geen waarde`,older_than:`ouder dan %s`,ignition_from:`Contact/motor van`,none:`geen`,on:`aan`,off:`uit`,unknown:`onbekend`,yes:`ja`,no:`nee`,ago:`%s geleden`,copy:`Kopiëren`,copied:`Gekopieerd`,further_states:`Overige datapunten`,input_odometer:`Kilometerstand`,input_price:`Prijs`,detector:`Ritdetectie`,phase:`Fase`,moving_since:`In beweging sinds`,parked_at:`Parkeerpositie`,pending:`Wachtende posities`,suspects:`Verdachte posities`,running_trip:`Lopende rit`,reason:`Gestart door`,reason_movement:`beweging`,reason_manual:`handmatig`,start:`Vertrek`,distance:`Afstand`,duration:`Duur`,moving_time:`Rijtijd`,avg_speed:`Gem. snelheid`,max_speed:`Max. snelheid`,points:`Punten`,stops:`Stops`,gaps:`Gaten`,engine_time:`Motor aan`,engine_distance:`Afstand op motor`,odometer_start:`Kilometerstand bij start`,watch:`Positiebewaking`,centre:`Middelpunt`,radius:`Straal`,max_distance:`Max. afstand`,alarm:`Alarm`,signal_lost:`Signaal verloren`,active_since:`Actief sinds`,signal_minutes:`Alarm zonder signaal na`,auto:`Automatisch`,meter:`Verbruiksmeter`,estimate:`Geschat verbruik`,meter_mode:`Modus`,meter_counter:`Meterstand`,meter_level:`Niveau`,meter_rate:`Debiet`,estimate_distance:`Op afstand`,estimate_hours:`Op motoruren`,meter_running:`Meet`,used:`Verbruikt in deze rit`,last_value:`Laatste waarde`,refills:`Tankbeurten`,consumption:`Verbruik`,settings_in_use:`Gebruikte instellingen`,start_speed:`Startsnelheid`,start_seconds:`Start na`,start_distance:`Startafstand`,stop_radius:`Stopstraal`,min_stop:`Minimale stop`,trip_end:`Rit eindigt na`,min_distance:`Min. afstand punten`,max_accuracy:`Max. onnauwkeurigheid`,use_ignition:`Contact gebruiken`,trips:`Ritten`,trip_count:`Aantal`,last_trip:`Laatste rit`,places:`Plaatsen`,name:`Naam`,privacy:`Privézone`,home:`Thuis`,general:`Algemeen`,notification_instance:`Meldingen`,live_interval:`Live-datapunten elke`,not_updated:`Niet bijgewerkt: %s`,type:`Type`},fr:{choose_instance:`Choisissez une instance de l'adaptateur Trips dans les paramètres`,no_objects:`%s ne suit aucun objet. Ajoutez une voiture, un bateau ou une personne dans ses paramètres`,object_not_found:`%s n'a pas d'objet « %s »`,no_answer:`Pas de réponse de %s. L'instance est-elle démarrée ?`,no_trips:`Aucun trajet pour l'instant`,loading:`Chargement…`,phase_parked:`Stationné`,phase_starting:`Démarrage`,phase_trip:`Trajet`,manual:`démarré manuellement`,type_car:`Voiture`,type_boat:`Bateau`,type_person:`Personne`,type_other:`Autre`,sources:`Sources`,priority:`Prio.`,source:`Source`,status:`État`,active:`active`,fresh:`à jour`,stale:`périmée`,max_age:`âge max. %s`,last_position:`Dernière position`,last_result:`Dernier résultat`,counts:`Positions`,count_accepted:`acceptées`,count_unused:`inutilisées`,count_inaccurate:`imprécises`,count_old:`anciennes`,count_outlier:`aberrantes`,count_invalid:`invalides`,count_confirmed:`confirmées`,role:`Rôle`,state_id:`ID d'état`,value:`Valeur`,unit:`Unité`,age:`Âge`,role_position:`Position`,role_latitude:`Latitude`,role_longitude:`Longitude`,role_accuracy:`Précision`,role_altitude:`Altitude`,role_timestamp:`Horodatage`,role_alive:`Signal de vie`,speed:`Vitesse`,ignition:`Contact/moteur`,no_value:`pas de valeur`,older_than:`plus ancien que %s`,ignition_from:`Contact/moteur depuis`,none:`aucune`,on:`marche`,off:`arrêt`,unknown:`inconnu`,yes:`oui`,no:`non`,ago:`il y a %s`,copy:`Copier`,copied:`Copié`,further_states:`Autres états`,input_odometer:`Compteur kilométrique`,input_price:`Prix`,detector:`Détection des trajets`,phase:`Phase`,moving_since:`En mouvement depuis`,parked_at:`Position de stationnement`,pending:`Positions en attente`,suspects:`Positions suspectes`,running_trip:`Trajet en cours`,reason:`Démarré par`,reason_movement:`mouvement`,reason_manual:`manuellement`,start:`Départ`,distance:`Distance`,duration:`Durée`,moving_time:`Temps en mouvement`,avg_speed:`Vitesse moy.`,max_speed:`Vitesse max.`,points:`Points`,stops:`Arrêts`,gaps:`Lacunes`,engine_time:`Moteur en marche`,engine_distance:`Distance au moteur`,odometer_start:`Compteur au départ`,watch:`Surveillance de position`,centre:`Centre`,radius:`Rayon`,max_distance:`Distance max.`,alarm:`Alarme`,signal_lost:`Signal perdu`,active_since:`Active depuis`,signal_minutes:`Alarme sans signal après`,auto:`Automatique`,meter:`Compteur de consommation`,estimate:`Consommation estimée`,meter_mode:`Mode`,meter_counter:`Compteur`,meter_level:`Niveau`,meter_rate:`Débit`,estimate_distance:`Selon la distance`,estimate_hours:`Selon les heures moteur`,meter_running:`Mesure en cours`,used:`Consommé pendant ce trajet`,last_value:`Dernière valeur`,refills:`Pleins`,consumption:`Consommation`,settings_in_use:`Paramètres utilisés`,start_speed:`Vitesse de départ`,start_seconds:`Départ après`,start_distance:`Distance de départ`,stop_radius:`Rayon d'arrêt`,min_stop:`Arrêt minimal`,trip_end:`Fin du trajet après`,min_distance:`Distance min. des points`,max_accuracy:`Imprécision max.`,use_ignition:`Utiliser le contact`,trips:`Trajets`,trip_count:`Nombre`,last_trip:`Dernier trajet`,places:`Lieux`,name:`Nom`,privacy:`Zone privée`,home:`Domicile`,general:`Général`,notification_instance:`Notifications`,live_interval:`États en direct toutes les`,not_updated:`Non mis à jour : %s`,type:`Type`},it:{choose_instance:`Scegli un'istanza dell'adattatore Trips nelle impostazioni`,no_objects:`%s non segue nessun oggetto. Aggiungi un'auto, una barca o una persona nelle sue impostazioni`,object_not_found:`%s non ha l'oggetto "%s"`,no_answer:`Nessuna risposta da %s. L'istanza è in esecuzione?`,no_trips:`Ancora nessun viaggio`,loading:`Caricamento…`,phase_parked:`Parcheggiato`,phase_starting:`In partenza`,phase_trip:`Viaggio`,manual:`avviato manualmente`,type_car:`Auto`,type_boat:`Barca`,type_person:`Persona`,type_other:`Altro`,sources:`Sorgenti`,priority:`Prio.`,source:`Sorgente`,status:`Stato`,active:`attiva`,fresh:`aggiornata`,stale:`obsoleta`,max_age:`età max. %s`,last_position:`Ultima posizione`,last_result:`Ultimo risultato`,counts:`Posizioni`,count_accepted:`accettate`,count_unused:`inutilizzate`,count_inaccurate:`imprecise`,count_old:`vecchie`,count_outlier:`anomale`,count_invalid:`non valide`,count_confirmed:`confermate`,role:`Ruolo`,state_id:`ID stato`,value:`Valore`,unit:`Unità`,age:`Età`,role_position:`Posizione`,role_latitude:`Latitudine`,role_longitude:`Longitudine`,role_accuracy:`Precisione`,role_altitude:`Altitudine`,role_timestamp:`Marca temporale`,role_alive:`Segnale di vita`,speed:`Velocità`,ignition:`Accensione/motore`,no_value:`nessun valore`,older_than:`più vecchio di %s`,ignition_from:`Accensione/motore da`,none:`nessuna`,on:`acceso`,off:`spento`,unknown:`sconosciuto`,yes:`sì`,no:`no`,ago:`%s fa`,copy:`Copia`,copied:`Copiato`,further_states:`Altri stati`,input_odometer:`Contachilometri`,input_price:`Prezzo`,detector:`Rilevamento viaggi`,phase:`Fase`,moving_since:`In movimento da`,parked_at:`Posizione di parcheggio`,pending:`Posizioni in attesa`,suspects:`Posizioni sospette`,running_trip:`Viaggio in corso`,reason:`Avviato da`,reason_movement:`movimento`,reason_manual:`manualmente`,start:`Partenza`,distance:`Distanza`,duration:`Durata`,moving_time:`Tempo in movimento`,avg_speed:`Vel. media`,max_speed:`Velocità max.`,points:`Punti`,stops:`Soste`,gaps:`Interruzioni`,engine_time:`Motore acceso`,engine_distance:`Distanza a motore`,odometer_start:`Contachilometri alla partenza`,watch:`Sorveglianza posizione`,centre:`Centro`,radius:`Raggio`,max_distance:`Distanza max.`,alarm:`Allarme`,signal_lost:`Segnale perso`,active_since:`Attiva da`,signal_minutes:`Allarme senza segnale dopo`,auto:`Automatica`,meter:`Contatore consumi`,estimate:`Consumo stimato`,meter_mode:`Modalità`,meter_counter:`Contatore`,meter_level:`Livello`,meter_rate:`Portata`,estimate_distance:`In base alla distanza`,estimate_hours:`In base alle ore motore`,meter_running:`In misura`,used:`Consumato in questo viaggio`,last_value:`Ultimo valore`,refills:`Rifornimenti`,consumption:`Consumo`,settings_in_use:`Impostazioni in uso`,start_speed:`Velocità di partenza`,start_seconds:`Partenza dopo`,start_distance:`Distanza di partenza`,stop_radius:`Raggio di sosta`,min_stop:`Sosta minima`,trip_end:`Fine viaggio dopo`,min_distance:`Distanza min. punti`,max_accuracy:`Imprecisione max.`,use_ignition:`Usa accensione`,trips:`Viaggi`,trip_count:`Numero`,last_trip:`Ultimo viaggio`,places:`Luoghi`,name:`Nome`,privacy:`Zona privata`,home:`Casa`,general:`Generale`,notification_instance:`Notifiche`,live_interval:`Stati live ogni`,not_updated:`Non aggiornato: %s`,type:`Tipo`},es:{choose_instance:`Elija una instancia del adaptador Trips en la configuración`,no_objects:`%s no sigue ningún objeto. Añada un coche, barco o persona en su configuración`,object_not_found:`%s no tiene el objeto "%s"`,no_answer:`Sin respuesta de %s. ¿Está la instancia en marcha?`,no_trips:`Todavía no hay viajes`,loading:`Cargando…`,phase_parked:`Aparcado`,phase_starting:`Arrancando`,phase_trip:`Viaje`,manual:`iniciado manualmente`,type_car:`Coche`,type_boat:`Barco`,type_person:`Persona`,type_other:`Otro`,sources:`Fuentes`,priority:`Prio.`,source:`Fuente`,status:`Estado`,active:`activa`,fresh:`actual`,stale:`desactualizada`,max_age:`antigüedad máx. %s`,last_position:`Última posición`,last_result:`Último resultado`,counts:`Posiciones`,count_accepted:`aceptadas`,count_unused:`sin usar`,count_inaccurate:`imprecisas`,count_old:`antiguas`,count_outlier:`atípicas`,count_invalid:`inválidas`,count_confirmed:`confirmadas`,role:`Función`,state_id:`ID de estado`,value:`Valor`,unit:`Unidad`,age:`Antigüedad`,role_position:`Posición`,role_latitude:`Latitud`,role_longitude:`Longitud`,role_accuracy:`Precisión`,role_altitude:`Altitud`,role_timestamp:`Marca de tiempo`,role_alive:`Señal de vida`,speed:`Velocidad`,ignition:`Encendido/motor`,no_value:`sin valor`,older_than:`más antiguo que %s`,ignition_from:`Encendido/motor de`,none:`ninguna`,on:`encendido`,off:`apagado`,unknown:`desconocido`,yes:`sí`,no:`no`,ago:`hace %s`,copy:`Copiar`,copied:`Copiado`,further_states:`Otros estados`,input_odometer:`Cuentakilómetros`,input_price:`Precio`,detector:`Detección de viajes`,phase:`Fase`,moving_since:`En movimiento desde`,parked_at:`Posición de aparcamiento`,pending:`Posiciones en espera`,suspects:`Posiciones sospechosas`,running_trip:`Viaje en curso`,reason:`Iniciado por`,reason_movement:`movimiento`,reason_manual:`manualmente`,start:`Salida`,distance:`Distancia`,duration:`Duración`,moving_time:`Tiempo en movimiento`,avg_speed:`Vel. media`,max_speed:`Vel. máx.`,points:`Puntos`,stops:`Paradas`,gaps:`Huecos`,engine_time:`Motor encendido`,engine_distance:`Distancia a motor`,odometer_start:`Cuentakilómetros al inicio`,watch:`Vigilancia de posición`,centre:`Centro`,radius:`Radio`,max_distance:`Distancia máx.`,alarm:`Alarma`,signal_lost:`Señal perdida`,active_since:`Activa desde`,signal_minutes:`Alarma sin señal tras`,auto:`Automática`,meter:`Contador de consumo`,estimate:`Consumo estimado`,meter_mode:`Modo`,meter_counter:`Contador`,meter_level:`Nivel`,meter_rate:`Caudal`,estimate_distance:`Por distancia`,estimate_hours:`Por horas de motor`,meter_running:`Midiendo`,used:`Consumido en este viaje`,last_value:`Último valor`,refills:`Repostajes`,consumption:`Consumo`,settings_in_use:`Ajustes en uso`,start_speed:`Velocidad de inicio`,start_seconds:`Inicio tras`,start_distance:`Distancia de inicio`,stop_radius:`Radio de parada`,min_stop:`Parada mínima`,trip_end:`Fin del viaje tras`,min_distance:`Distancia mín. entre puntos`,max_accuracy:`Imprecisión máx.`,use_ignition:`Usar encendido`,trips:`Viajes`,trip_count:`Número`,last_trip:`Último viaje`,places:`Lugares`,name:`Nombre`,privacy:`Zona privada`,home:`Casa`,general:`General`,notification_instance:`Notificaciones`,live_interval:`Estados en vivo cada`,not_updated:`No actualizado: %s`,type:`Tipo`},pl:{choose_instance:`Wybierz instancję adaptera Trips w ustawieniach`,no_objects:`%s nie śledzi żadnego obiektu. Dodaj samochód, łódź lub osobę w jej ustawieniach`,object_not_found:`%s nie ma obiektu „%s”`,no_answer:`Brak odpowiedzi od %s. Czy instancja działa?`,no_trips:`Brak podróży`,loading:`Wczytywanie…`,phase_parked:`Zaparkowany`,phase_starting:`Ruszanie`,phase_trip:`Podróż`,manual:`uruchomiona ręcznie`,type_car:`Samochód`,type_boat:`Łódź`,type_person:`Osoba`,type_other:`Inne`,sources:`Źródła`,priority:`Prio.`,source:`Źródło`,status:`Status`,active:`aktywne`,fresh:`aktualne`,stale:`nieaktualne`,max_age:`maks. wiek %s`,last_position:`Ostatnia pozycja`,last_result:`Ostatni wynik`,counts:`Pozycje`,count_accepted:`przyjęte`,count_unused:`nieużyte`,count_inaccurate:`niedokładne`,count_old:`stare`,count_outlier:`odstające`,count_invalid:`nieprawidłowe`,count_confirmed:`potwierdzone`,role:`Rola`,state_id:`ID stanu`,value:`Wartość`,unit:`Jednostka`,age:`Wiek`,role_position:`Pozycja`,role_latitude:`Szerokość`,role_longitude:`Długość`,role_accuracy:`Dokładność`,role_altitude:`Wysokość`,role_timestamp:`Znacznik czasu`,role_alive:`Sygnał życia`,speed:`Prędkość`,ignition:`Zapłon/silnik`,no_value:`brak wartości`,older_than:`starsze niż %s`,ignition_from:`Zapłon/silnik z`,none:`brak`,on:`wł.`,off:`wył.`,unknown:`nieznany`,yes:`tak`,no:`nie`,ago:`%s temu`,copy:`Kopiuj`,copied:`Skopiowano`,further_states:`Inne stany`,input_odometer:`Licznik przebiegu`,input_price:`Cena`,detector:`Wykrywanie podróży`,phase:`Faza`,moving_since:`W ruchu od`,parked_at:`Pozycja postoju`,pending:`Oczekujące pozycje`,suspects:`Podejrzane pozycje`,running_trip:`Bieżąca podróż`,reason:`Rozpoczęta przez`,reason_movement:`ruch`,reason_manual:`ręcznie`,start:`Start`,distance:`Dystans`,duration:`Czas trwania`,moving_time:`Czas jazdy`,avg_speed:`Śr. prędkość`,max_speed:`Maks. prędkość`,points:`Punkty`,stops:`Postoje`,gaps:`Przerwy`,engine_time:`Silnik pracował`,engine_distance:`Dystans na silniku`,odometer_start:`Przebieg na starcie`,watch:`Nadzór pozycji`,centre:`Środek`,radius:`Promień`,max_distance:`Maks. odległość`,alarm:`Alarm`,signal_lost:`Utrata sygnału`,active_since:`Aktywny od`,signal_minutes:`Alarm bez sygnału po`,auto:`Automatyczny`,meter:`Licznik zużycia`,estimate:`Szacowane zużycie`,meter_mode:`Tryb`,meter_counter:`Licznik`,meter_level:`Poziom`,meter_rate:`Przepływ`,estimate_distance:`Wg dystansu`,estimate_hours:`Wg motogodzin`,meter_running:`Mierzy`,used:`Zużyte w tej podróży`,last_value:`Ostatnia wartość`,refills:`Tankowania`,consumption:`Zużycie`,settings_in_use:`Używane ustawienia`,start_speed:`Prędkość startu`,start_seconds:`Start po`,start_distance:`Dystans startu`,stop_radius:`Promień postoju`,min_stop:`Min. postój`,trip_end:`Koniec podróży po`,min_distance:`Min. odległość punktów`,max_accuracy:`Maks. niedokładność`,use_ignition:`Użyj zapłonu`,trips:`Podróże`,trip_count:`Liczba`,last_trip:`Ostatnia podróż`,places:`Miejsca`,name:`Nazwa`,privacy:`Strefa prywatna`,home:`Dom`,general:`Ogólne`,notification_instance:`Powiadomienia`,live_interval:`Stany na żywo co`,not_updated:`Nie zaktualizowano: %s`,type:`Typ`},uk:{choose_instance:`Виберіть екземпляр адаптера Trips у налаштуваннях`,no_objects:`%s не відстежує жодного об'єкта. Додайте автомобіль, човен чи людину в його налаштуваннях`,object_not_found:`У %s немає об'єкта «%s»`,no_answer:`Немає відповіді від %s. Екземпляр запущено?`,no_trips:`Поїздок ще немає`,loading:`Завантаження…`,phase_parked:`Стоїть`,phase_starting:`Рушає`,phase_trip:`Поїздка`,manual:`запущена вручну`,type_car:`Автомобіль`,type_boat:`Човен`,type_person:`Людина`,type_other:`Інше`,sources:`Джерела`,priority:`Пріор.`,source:`Джерело`,status:`Статус`,active:`активне`,fresh:`свіже`,stale:`застаріле`,max_age:`макс. вік %s`,last_position:`Останнє положення`,last_result:`Останній результат`,counts:`Позиції`,count_accepted:`прийнято`,count_unused:`не використано`,count_inaccurate:`неточні`,count_old:`старі`,count_outlier:`викиди`,count_invalid:`недійсні`,count_confirmed:`підтверджено`,role:`Роль`,state_id:`ID стану`,value:`Значення`,unit:`Одиниця`,age:`Вік`,role_position:`Позиція`,role_latitude:`Широта`,role_longitude:`Довгота`,role_accuracy:`Точність`,role_altitude:`Висота`,role_timestamp:`Мітка часу`,role_alive:`Ознака життя`,speed:`Швидкість`,ignition:`Запалювання/двигун`,no_value:`немає значення`,older_than:`старше за %s`,ignition_from:`Запалювання/двигун з`,none:`немає`,on:`увімк.`,off:`вимк.`,unknown:`невідомо`,yes:`так`,no:`ні`,ago:`%s тому`,copy:`Копіювати`,copied:`Скопійовано`,further_states:`Інші стани`,input_odometer:`Одометр`,input_price:`Ціна`,detector:`Розпізнавання поїздок`,phase:`Фаза`,moving_since:`У русі з`,parked_at:`Місце стоянки`,pending:`Позиції в очікуванні`,suspects:`Підозрілі позиції`,running_trip:`Поточна поїздка`,reason:`Розпочата через`,reason_movement:`рух`,reason_manual:`вручну`,start:`Початок`,distance:`Відстань`,duration:`Тривалість`,moving_time:`Час руху`,avg_speed:`Сер. швидкість`,max_speed:`Макс. швидкість`,points:`Точки`,stops:`Зупинки`,gaps:`Розриви`,engine_time:`Двигун працював`,engine_distance:`Відстань з двигуном`,odometer_start:`Одометр на старті`,watch:`Контроль позиції`,centre:`Центр`,radius:`Радіус`,max_distance:`Макс. відстань`,alarm:`Тривога`,signal_lost:`Сигнал втрачено`,active_since:`Активний з`,signal_minutes:`Тривога без сигналу через`,auto:`Автоматично`,meter:`Лічильник витрати`,estimate:`Розрахункова витрата`,meter_mode:`Режим`,meter_counter:`Лічильник`,meter_level:`Рівень`,meter_rate:`Витрата за годину`,estimate_distance:`За відстанню`,estimate_hours:`За мотогодинами`,meter_running:`Вимірює`,used:`Витрачено в поїздці`,last_value:`Останнє значення`,refills:`Заправки`,consumption:`Витрата`,settings_in_use:`Використовувані налаштування`,start_speed:`Швидкість початку`,start_seconds:`Початок через`,start_distance:`Відстань початку`,stop_radius:`Радіус зупинки`,min_stop:`Мін. зупинка`,trip_end:`Кінець поїздки через`,min_distance:`Мін. відстань точок`,max_accuracy:`Макс. похибка`,use_ignition:`Використовувати запалювання`,trips:`Поїздки`,trip_count:`Кількість`,last_trip:`Остання поїздка`,places:`Місця`,name:`Назва`,privacy:`Приватна зона`,home:`Дім`,general:`Загальне`,notification_instance:`Сповіщення`,live_interval:`Живі стани кожні`,not_updated:`Не оновлено: %s`,type:`Тип`},"zh-cn":{choose_instance:`请在设置中选择 Trips 适配器实例`,no_objects:`%s 没有跟踪任何对象。请在其设置中添加汽车、船只或人员`,object_not_found:`%s 中没有对象“%s”`,no_answer:`%s 没有响应。实例是否正在运行？`,no_trips:`暂无行程`,loading:`加载中…`,phase_parked:`停放`,phase_starting:`起步中`,phase_trip:`行程中`,manual:`手动开始`,type_car:`汽车`,type_boat:`船`,type_person:`人员`,type_other:`其他`,sources:`数据源`,priority:`优先级`,source:`数据源`,status:`状态`,active:`使用中`,fresh:`新鲜`,stale:`过期`,max_age:`最长 %s`,last_position:`最后位置`,last_result:`最近结果`,counts:`位置统计`,count_accepted:`已采用`,count_unused:`未使用`,count_inaccurate:`不精确`,count_old:`过旧`,count_outlier:`异常值`,count_invalid:`无效`,count_confirmed:`已确认`,role:`作用`,state_id:`状态 ID`,value:`值`,unit:`单位`,age:`距今`,role_position:`位置`,role_latitude:`纬度`,role_longitude:`经度`,role_accuracy:`精度`,role_altitude:`海拔`,role_timestamp:`时间戳`,role_alive:`存活信号`,speed:`速度`,ignition:`点火/发动机`,no_value:`无值`,older_than:`超过 %s`,ignition_from:`点火/发动机来源`,none:`无`,on:`开`,off:`关`,unknown:`未知`,yes:`是`,no:`否`,ago:`%s前`,copy:`复制`,copied:`已复制`,further_states:`其他状态`,input_odometer:`里程表`,input_price:`价格`,detector:`行程检测`,phase:`阶段`,moving_since:`移动开始于`,parked_at:`停放位置`,pending:`等待中的位置`,suspects:`可疑位置`,running_trip:`进行中的行程`,reason:`开始原因`,reason_movement:`移动`,reason_manual:`手动`,start:`起点`,distance:`距离`,duration:`时长`,moving_time:`移动时间`,avg_speed:`平均速度`,max_speed:`最高速度`,points:`点数`,stops:`停留`,gaps:`中断`,engine_time:`发动机运行`,engine_distance:`发动机航程`,odometer_start:`起始里程`,watch:`位置监控`,centre:`中心`,radius:`半径`,max_distance:`最大距离`,alarm:`警报`,signal_lost:`信号丢失`,active_since:`启用于`,signal_minutes:`无信号报警延时`,auto:`自动`,meter:`能耗计量`,estimate:`估算能耗`,meter_mode:`模式`,meter_counter:`累计值`,meter_level:`液位`,meter_rate:`流量`,estimate_distance:`按距离`,estimate_hours:`按运行时长`,meter_running:`计量中`,used:`本次行程消耗`,last_value:`最近值`,refills:`加注次数`,consumption:`能耗`,settings_in_use:`当前设置`,start_speed:`起始速度`,start_seconds:`起始时长`,start_distance:`起始距离`,stop_radius:`停留半径`,min_stop:`最短停留`,trip_end:`行程结束时长`,min_distance:`最小点距`,max_accuracy:`最大误差`,use_ignition:`使用点火信号`,trips:`行程`,trip_count:`数量`,last_trip:`最近行程`,places:`地点`,name:`名称`,privacy:`隐私区`,home:`家`,general:`常规`,notification_instance:`通知`,live_interval:`实时状态间隔`,not_updated:`未更新：%s`,type:`类型`}}.en||{};return(e,...r)=>{let i=t[e]||n[e]||e;for(let e of r)i=i.replace(`%s`,String(e));return i}}function M(e){return e===`zh-cn`?`zh-CN`:e||`en`}var fe=15e3,N=class extends Error{instance;constructor(e){super(`No answer from ${e}`),this.instance=e}};async function P(e,t,n,r){let i,a=new Promise((e,n)=>{i=setTimeout(()=>n(new N(t)),fe)});try{let i=await Promise.race([e.sendTo(t,n,r),a]);if(i&&typeof i==`object`&&!Array.isArray(i)&&`error`in i)throw Error(String(i.error));return i}finally{clearTimeout(i)}}async function pe(e,t){let n=await P(e,t,`getObjects`);return Array.isArray(n)?n.filter(e=>e&&typeof e.id==`string`&&e.id):[]}function me(e,t){if(!t)return e[0]||null;let n=t.toLowerCase();return e.find(e=>e.id===t||e.name===t)||e.find(e=>e.id.toLowerCase()===n||String(e.name).toLowerCase()===n)||null}async function he(e,t,n){let r=await P(e,t,`getDiagnostics`,n?{object:n}:{});if(!r||typeof r!=`object`||!Array.isArray(r.objects))throw Error(`getDiagnostics: no answer of ${t}`);return r}function F(e){return typeof e==`number`&&Number.isFinite(e)}var I={km:1e3,nm:1852,mi:1609.344},L={"km/h":1/3.6,kn:1852/3600,mph:1609.344/3600,"m/s":1};function R(e,t){return e/(I[t]||1e3)}function z(e,t){return e/(L[t]||1)}function B(e,t,n){try{return e.toLocaleString(M(n),{minimumFractionDigits:t,maximumFractionDigits:t})}catch{return e.toFixed(t)}}function V(e,t,n){return`${B(e,Math.abs(e)<10?2:1,n)} ${t}`}function H(e,t,n){return`${B(e,+(Math.abs(e)<10),n)} ${t}`}var ge={day:`d`,hour:`h`,minute:`min`,second:`s`};function U(e,t,n){try{return new Intl.NumberFormat(M(n),{style:`unit`,unit:t,unitDisplay:`short`}).format(e)}catch{return`${e} ${ge[t]}`}}function W(e,t){let n=Math.max(0,Math.round(e));if(n<60)return U(n,`second`,t);let r=Math.round(n/60);if(r<60)return U(r,`minute`,t);let i=Math.floor(r/60),a=r%60;return a?`${U(i,`hour`,t)} ${U(a,`minute`,t)}`:U(i,`hour`,t)}function G(e,t){return new Date(e).toLocaleTimeString(M(t),{hour:`2-digit`,minute:`2-digit`})}function K(e){let t=new Date(e);return new Date(t.getFullYear(),t.getMonth(),t.getDate()).getTime()}function _e(e,t){let n=M(t),r=Math.round((K(Date.now())-K(e))/864e5);if(r===0||r===1)try{let e=new Intl.RelativeTimeFormat(n,{numeric:`auto`}).format(-r,`day`);return e.charAt(0).toLocaleUpperCase(n)+e.slice(1)}catch{}let i=new Date(e);return i.toLocaleDateString(n,{weekday:`short`,day:`numeric`,month:`short`,year:i.getFullYear()===(/* @__PURE__ */ new Date()).getFullYear()?void 0:`numeric`})}function q(e,t){return K(e)===K(Date.now())?G(e,t):`${_e(e,t)} ${G(e,t)}`}function J(e,t){let n=Math.max(0,Math.round(e/1e3));if(n<120)return U(n,`second`,t);let r=Math.round(n/60);if(r<120)return U(r,`minute`,t);let i=Math.round(r/60);return i<48?U(i,`hour`,t):U(Math.round(i/24),`day`,t)}function Y(e,t,n){return!F(e)||!F(t)?`—`:`${B(e,5,n)}, ${B(t,5,n)}`}var ve={map:`M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M15 19l-6-2.11V5l6 2.11z`,route:`M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82`,pulse:`M9.3 20.6 6.8 13H2v-2h6.2l1.2 3.6 4.2-11.9L16.2 11H22v2h-7.2l-1.1-3.3z`};function ye({text:e,icon:t,editMode:i}){return/* @__PURE__ */ r(`div`,{className:`hint${i?` edit`:``}`,children:[/* @__PURE__ */ n(`svg`,{viewBox:`0 0 24 24`,"aria-hidden":`true`,children:/* @__PURE__ */ n(`path`,{d:ve[t]})}),/* @__PURE__ */ n(`span`,{children:e})]})}var be=3e4,xe=class extends ae{root;#e=null;#t=/* @__PURE__ */ new Set;constructor(t){super();let n=this.attachShadow({mode:`open`}),r=document.createElement(`style`);r.textContent=t;let i=document.createElement(`div`);i.className=`mount`,n.append(r,i),this.root=e(i)}disconnectedCallback(){super.disconnectedCallback();for(let e of this.#t)clearTimeout(e);this.#t.clear()}get word(){return j(this.systemLang)}refresh(){this.settings=this.settings}later(e){let t=setTimeout(()=>{this.#t.delete(t),this.refresh()},e);this.#t.add(t)}errorText(e){return e instanceof N?this.word(`no_answer`,e.instance):e instanceof Error?e.message:String(e)}getObjectsTarget(e){let t=this.word,{instance:n,object:r}=E(e);if(!n)return{status:`hint`,text:t(`choose_instance`)};let i=this.#e;return!this.socket||i?.instance!==n||i.socket!==this.socket?{status:`loading`,instance:n}:i.error?{status:`hint`,text:i.error}:i.objects?i.objects.length?{status:`ok`,instance:n,objects:i.objects,object:r}:{status:`hint`,text:t(`no_objects`,n)}:{status:`loading`,instance:n}}getTarget(e){let t=this.getObjectsTarget(e);if(t.status!==`ok`)return t;let n=me(t.objects,t.object);return n?{status:`ok`,instance:t.instance,object:n}:{status:`hint`,text:this.word(`object_not_found`,t.instance,t.object)}}liveValue(e){return t=>this.states[`${e}.live.${t}`]?.val}loadObjects(){let e=this.socket,{instance:t}=E(this.settings);if(!e||!t)return;let n=this.#e;if(n?.instance===t&&n.socket===e&&(!n.error||Date.now()-n.failedAt<3e4))return;let r={instance:t,socket:e,objects:null,error:null,failedAt:0};this.#e=r,pe(e,t).then(e=>{this.#e===r&&(r.objects=e,this.refresh())}).catch(e=>{this.#e===r&&(r.error=this.errorText(e),r.failedAt=Date.now(),this.refresh(),this.later(be))})}renderHint(e,t){return/* @__PURE__ */ n(ye,{text:e,icon:t,editMode:this.editMode})}},X=[{key:`accepted`,word:`count_accepted`},{key:`confirmed`,word:`count_confirmed`},{key:`unused`,word:`count_unused`},{key:`inaccurate`,word:`count_inaccurate`},{key:`old`,word:`count_old`},{key:`outlier`,word:`count_outlier`},{key:`invalid`,word:`count_invalid`}],Se={position:`role_position`,latitude:`role_latitude`,longitude:`role_longitude`,speed:`speed`,ignition:`ignition`,accuracy:`role_accuracy`,altitude:`role_altitude`,timestamp:`role_timestamp`,alive:`role_alive`},Z={parked:`phase_parked`,starting:`phase_starting`,trip:`phase_trip`},Ce={car:`type_car`,boat:`type_boat`,person:`type_person`,other:`type_other`},we={movement:`reason_movement`,ignition:`ignition`,manual:`reason_manual`},Q={counter:`meter_counter`,level:`meter_level`,rate:`meter_rate`,distance:`estimate_distance`,hours:`estimate_hours`},Te={odometer:`input_odometer`,price:`input_price`},Ee=1500,De=`M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2m0 16H8V7h11z`,Oe=`M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z`;function ke(e){switch(e.format){case`hdop`:return`HDOP`;case`meters`:return`m`;case`latlon`:return`lat;lon`;case`lonlat`:return`lon;lat`;case`json`:return`JSON`}return e.format?e.format:e.role===`latitude`||e.role===`longitude`?`°`:e.role===`altitude`?`m`:``}function Ae(e){return typeof e!=`number`||!Number.isFinite(e)?null:e>0xe8d4a51000?e:e>1e9?e*1e3:null}function je(e,t){let n=t.toLowerCase();return e.find(e=>e.id===t||e.name===t)||e.find(e=>e.id.toLowerCase()===n||String(e.name).toLowerCase()===n)||null}function $(e,t,i){return/* @__PURE__ */ r(`div`,{className:`card`,children:[/* @__PURE__ */ n(`div`,{className:`card-title`,children:e}),/* @__PURE__ */ n(`table`,{className:`kv`,children:/* @__PURE__ */ n(`tbody`,{children:t.map(e=>/* @__PURE__ */ r(`tr`,{className:e.warn?`warn`:void 0,children:[/* @__PURE__ */ n(`th`,{children:e.label}),/* @__PURE__ */ n(`td`,{children:e.value})]},e.label))})})]},i)}function Me(e){if(e==null)return``;if(typeof e==`object`)try{return JSON.stringify(e)}catch{return`{…}`}return typeof e==`string`?e:String(e)}oe(se,class extends xe{#e=``;#t=null;#n=null;#r=null;#i=!1;#a=null;#o=null;#s=null;#c=()=>{!document.hidden&&this.isConnected&&!this.#a&&!this.#i&&this.#u()};constructor(){super(de)}connectedCallback(){super.connectedCallback(),document.addEventListener(`visibilitychange`,this.#c),this.#e&&this.#c()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener(`visibilitychange`,this.#c),this.#l(),this.#s&&=(clearTimeout(this.#s),null)}#l(){this.#a&&=(clearTimeout(this.#a),null)}#u(){let e=this.socket,{instance:t,object:n}=E(this.settings);if(!e||!t||!this.isConnected||document.hidden||this.#i)return;let r=this.#e;this.#i=!0,he(e,t,n).then(e=>{r===this.#e&&(this.#n=e,this.#r=null)},e=>{r===this.#e&&(this.#r=this.errorText(e))}).finally(()=>{this.#i=!1,r===this.#e?(this.#f(),this.#l(),this.isConnected&&!document.hidden&&(this.#a=setTimeout(()=>{this.#a=null,this.#u()},ce))):this.#u()})}async#d(e,t){let n=!1;try{await navigator.clipboard.writeText(e),n=!0}catch{let t=document.createElement(`textarea`);t.value=e,t.style.position=`fixed`,t.style.opacity=`0`,this.shadowRoot?.append(t),t.select();try{n=document.execCommand(`copy`)}catch{n=!1}t.remove()}n?(this.#o=e,this.#f(),this.#s&&clearTimeout(this.#s),this.#s=setTimeout(()=>{this.#s=null,this.#o=null,this.#f()},Ee)):t&&window.getSelection()?.selectAllChildren(t)}render(){let{instance:e,object:t}=E(this.settings),n=`${e}|${t}`;(n!==this.#e||this.socket!==this.#t)&&(this.#e=n,this.#t=this.socket,this.#n=null,this.#r=null,this.#l(),this.#u()),this.#f()}#f(){let e=this.word,{instance:t,object:i}=E(this.settings);if(!t){this.root.render(this.renderHint(e(`choose_instance`),`pulse`));return}let a=this.#n;if(!a){this.root.render(this.renderHint(this.#r||e(`loading`),`pulse`));return}let o=a.objects;if(i){let n=je(o,i);if(!n){this.root.render(this.renderHint(e(`object_not_found`,t,i),`pulse`));return}o=[n]}else if(!o.length){this.root.render(this.renderHint(e(`no_objects`,t),`pulse`));return}let s=o.length===1;this.root.render(/* @__PURE__ */ r(`div`,{className:`root diag${this.editMode?` edit`:``}`,children:[this.#r?/* @__PURE__ */ n(`div`,{className:`banner`,children:e(`not_updated`,this.#r)}):null,o.map(e=>this.#_(a,e,s)),this.#O(a)]}))}#p(e,t){return typeof t==`number`&&t>0?J(e.now-t,this.systemLang):`—`}#m(e){return this.word(e?`yes`:`no`)}#h(e){return this.word(e===null?`unknown`:e?`on`:`off`)}#g(e){let t=this.word,i=this.#o===e;return/* @__PURE__ */ r(`span`,{className:`state-id`,children:[/* @__PURE__ */ n(`code`,{title:e,children:e}),/* @__PURE__ */ n(`button`,{type:`button`,className:`copy${i?` copied`:``}`,title:t(i?`copied`:`copy`),"aria-label":t(i?`copied`:`copy`),onClick:t=>void this.#d(e,t.currentTarget.previousElementSibling),children:/* @__PURE__ */ n(`svg`,{viewBox:`0 0 24 24`,"aria-hidden":`true`,children:/* @__PURE__ */ n(`path`,{d:i?Oe:De})})})]})}#_(e,t,i){let a=this.word,o=t.detector.phase,s=t.inputs??[];return/* @__PURE__ */ r(`section`,{className:`object${i?` single`:``}`,children:[/* @__PURE__ */ r(`header`,{className:`object-header`,children:[/* @__PURE__ */ n(`span`,{className:`object-name`,children:t.name}),/* @__PURE__ */ n(`span`,{className:`object-type`,children:[a(Ce[t.type]||`type_other`),t.distanceUnit,t.speedUnit].join(` · `)}),/* @__PURE__ */ n(`span`,{className:`badge phase phase-${o}`,children:a(Z[o]||`phase_parked`)}),t.detector.manual?/* @__PURE__ */ n(`span`,{className:`badge`,children:a(`manual`)}):null]}),/* @__PURE__ */ n(`div`,{className:`block-title`,children:a(`sources`)}),this.#v(e,t),this.#x(e,t),s.length?/* @__PURE__ */ r(`div`,{className:`inputs`,children:[/* @__PURE__ */ n(`span`,{className:`inputs-title`,children:a(`further_states`)}),s.map(e=>/* @__PURE__ */ r(`span`,{className:`input`,children:[/* @__PURE__ */ n(`span`,{className:`muted`,children:a(Te[e.role]||`value`)}),this.#g(e.id)]},`${e.role}|${e.id}`))]}):null,/* @__PURE__ */ r(`div`,{className:`cards`,children:[this.#S(e,t),this.#C(e,t),this.#w(e,t),this.#T(e,t),this.#E(t),this.#D(t)]})]},t.id)}#v(e,t){let i=this.word;if(!t.sources.length)return/* @__PURE__ */ n(`div`,{className:`muted`,children:i(`none`)});let a=[...t.sources].sort((e,t)=>e.priority-t.priority);return/* @__PURE__ */ n(`div`,{className:`table-wrap`,children:/* @__PURE__ */ r(`table`,{className:`grid sources`,children:[/* @__PURE__ */ n(`thead`,{children:/* @__PURE__ */ r(`tr`,{children:[/* @__PURE__ */ n(`th`,{className:`num`,children:i(`priority`)}),/* @__PURE__ */ n(`th`,{children:i(`source`)}),/* @__PURE__ */ n(`th`,{children:i(`status`)}),/* @__PURE__ */ n(`th`,{children:i(`last_position`)}),/* @__PURE__ */ n(`th`,{children:i(`last_result`)}),/* @__PURE__ */ n(`th`,{children:i(`counts`)})]})}),a.map(t=>this.#y(e,t))]})})}#y(e,i){let a=this.word,o=this.systemLang,s=X.filter(({key:e})=>(i.counts[e]||0)>0),c=i.lastResult,l=X.find(({key:e})=>e===c)?.word,u=`warn`;return c===`accepted`||c===`confirmed`?u=`ok`:c===`unused`&&(u=`neutral`),/* @__PURE__ */ r(`tbody`,{className:i.active?`active`:void 0,children:[/* @__PURE__ */ r(`tr`,{className:`source-row`,children:[/* @__PURE__ */ n(`td`,{className:`num`,children:i.priority}),/* @__PURE__ */ r(`td`,{children:[/* @__PURE__ */ n(`div`,{className:`source-label`,title:i.label,children:i.label}),/* @__PURE__ */ r(`div`,{className:`muted small`,children:[i.type,` · `,a(`max_age`,W(i.maxAge,o))]})]}),/* @__PURE__ */ n(`td`,{children:/* @__PURE__ */ r(`span`,{className:`badges`,children:[i.active?/* @__PURE__ */ n(`span`,{className:`badge primary`,children:a(`active`)}):null,/* @__PURE__ */ n(`span`,{className:`badge ${i.fresh?`ok`:`warn`}`,children:a(i.fresh?`fresh`:`stale`)})]})}),/* @__PURE__ */ n(`td`,{children:i.lastFix?/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ n(`div`,{className:i.fresh?void 0:`warn-text`,children:a(`ago`,this.#p(e,i.lastFixAt))}),/* @__PURE__ */ n(`div`,{className:`muted small`,children:Y(i.lastFix.lat,i.lastFix.lon,o)})]}):/* @__PURE__ */ n(`span`,{className:`muted`,children:`—`})}),/* @__PURE__ */ n(`td`,{children:l?/* @__PURE__ */ n(`span`,{className:`badge ${u}`,children:a(l)}):`—`}),/* @__PURE__ */ n(`td`,{children:s.length?/* @__PURE__ */ n(`span`,{className:`counts`,children:s.map(({key:e,word:t})=>/* @__PURE__ */ r(`span`,{className:`count`,children:[a(t),` `,/* @__PURE__ */ n(`b`,{children:B(i.counts[e]||0,0,o)})]},e))}):`—`})]}),/* @__PURE__ */ r(`tr`,{className:`states-row`,children:[/* @__PURE__ */ n(`td`,{}),/* @__PURE__ */ n(`td`,{colSpan:5,children:this.#b(e,i)})]})]},`${i.priority}|${i.label}`)}#b(e,t){let i=this.word,a=this.systemLang,o=t.maxAge*1e3;return/* @__PURE__ */ r(`table`,{className:`grid states`,children:[/* @__PURE__ */ n(`thead`,{children:/* @__PURE__ */ r(`tr`,{children:[/* @__PURE__ */ n(`th`,{children:i(`role`)}),/* @__PURE__ */ n(`th`,{children:i(`state_id`)}),/* @__PURE__ */ n(`th`,{children:i(`value`)}),/* @__PURE__ */ n(`th`,{children:i(`unit`)}),/* @__PURE__ */ n(`th`,{children:i(`age`)})]})}),/* @__PURE__ */ n(`tbody`,{children:t.states.map(s=>{let c=s.val===null||s.val===void 0,l=typeof s.ts==`number`?e.now-s.ts:null,u=l!==null&&l>o,d=c?i(`no_value`):Me(s.val),f=s.role===`timestamp`&&!c?Ae(s.val):null;return f&&(d=`${d} (${q(f,a)})`),/* @__PURE__ */ r(`tr`,{children:[/* @__PURE__ */ n(`td`,{className:`nowrap`,children:i(Se[s.role]||`value`)}),/* @__PURE__ */ n(`td`,{children:this.#g(s.id)}),/* @__PURE__ */ n(`td`,{className:`value${c?` missing`:``}`,title:c?void 0:d,children:d}),/* @__PURE__ */ n(`td`,{className:`nowrap muted`,children:ke(s)}),/* @__PURE__ */ n(`td`,{className:`nowrap${u?` stale`:``}`,title:u?i(`older_than`,W(t.maxAge,a)):void 0,children:this.#p(e,s.ts)})]},`${s.role}|${s.id}`)})})]})}#x(e,i){let a=this.word,o=i.ignitionSource,s=o?i.sources.find(e=>e.label===o):void 0,c=s?.states.find(e=>e.role===`ignition`);return/* @__PURE__ */ r(`div`,{className:`ignition`,children:[/* @__PURE__ */ n(`span`,{className:`muted`,children:a(`ignition_from`)}),o?/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ n(`b`,{title:o,children:o}),s?/* @__PURE__ */ n(`span`,{className:`badge ${s.ignition?`ok`:`neutral`}`,children:this.#h(s.ignition)}):null,s?.ignitionTs?/* @__PURE__ */ n(`span`,{className:`muted`,children:a(`ago`,this.#p(e,s.ignitionTs))}):null,c?this.#g(c.id):null]}):/* @__PURE__ */ n(`span`,{children:a(`none`)})]})}#S(e,t){let r=this.word,i=this.systemLang,a=t.detector,o=t.speedUnit,s=[{label:r(`phase`),value:/* @__PURE__ */ n(`span`,{className:`badge phase phase-${a.phase}`,children:r(Z[a.phase])})},{label:r(`ignition`),value:this.#h(a.ignition)},{label:r(`speed`),value:H(z(a.speed,o),o,i)},{label:r(`last_position`),value:a.lastFix?`${Y(a.lastFix.lat,a.lastFix.lon,i)} · ${r(`ago`,this.#p(e,a.lastReceived??a.lastFix.ts))}`:`—`}];return a.movingSince&&s.push({label:r(`moving_since`),value:`${q(a.movingSince,i)} · ${r(`ago`,this.#p(e,a.movingSince))}`}),a.parked&&s.push({label:r(`parked_at`),value:`${Y(a.parked.lat,a.parked.lon,i)} · ${r(`ago`,this.#p(e,a.parked.ts))}`}),s.push({label:r(`pending`),value:String(a.pending)},{label:r(`suspects`),value:String(a.suspects),warn:a.suspects>0}),$(r(`detector`),s,`detector`)}#C(e,t){let n=t.detector.trip;if(!n)return null;let r=this.word,i=this.systemLang,a=t.distanceUnit,o=t.speedUnit,s=e=>V(R(e,a),a,i),c=e=>H(z(e,o),o,i),l=[{label:r(`start`),value:`${q(n.start,i)} · ${r(`ago`,this.#p(e,n.start))}`},{label:r(`reason`),value:r(we[n.reason]||`unknown`)},{label:r(`distance`),value:s(n.distance)},{label:r(`duration`),value:W(n.duration/1e3,i)},{label:r(`moving_time`),value:W(n.movingTime/1e3,i)},{label:r(`avg_speed`),value:c(n.avgSpeed)},{label:r(`max_speed`),value:c(n.maxSpeed)}];return n.engineKnown&&l.push({label:r(`engine_time`),value:W(n.engineTime/1e3,i)},{label:r(`engine_distance`),value:s(n.engineDistance)}),l.push({label:r(`points`),value:B(n.points,0,i)},{label:r(`stops`),value:String(n.stops)},{label:r(`gaps`),value:String(n.gaps),warn:n.gaps>0},{label:r(`last_position`),value:`${Y(n.lat,n.lon,i)} · ${r(`ago`,this.#p(e,n.last))}`}),t.odometerStart!==null&&t.odometerStart!==void 0&&l.push({label:r(`odometer_start`),value:B(t.odometerStart,1,i)}),$(r(`running_trip`),l,`trip`)}#w(e,t){let i=this.word,a=this.systemLang,o=t.watch,s=e=>`${B(e,0,a)} m`,c=/* @__PURE__ */ r(`span`,{className:`badges`,children:[/* @__PURE__ */ n(`span`,{className:`badge ${o.active?`primary`:`neutral`}`,children:i(o.active?`active`:`off`)}),o.alarm?/* @__PURE__ */ n(`span`,{className:`badge error`,children:i(`alarm`)}):null,o.signalLost?/* @__PURE__ */ n(`span`,{className:`badge error`,children:i(`signal_lost`)}):null]}),l=[{label:i(`status`),value:c}];return o.active&&(l.push({label:i(`centre`),value:Y(o.lat,o.lon,a)},{label:i(`distance`),value:o.distance===null?`—`:s(o.distance),warn:o.alarm},{label:i(`max_distance`),value:s(o.maxDistance)}),o.since&&l.push({label:i(`active_since`),value:`${q(o.since,a)} · ${i(`ago`,this.#p(e,o.since))}`})),l.push({label:i(`radius`),value:s(o.radius)},{label:i(`signal_minutes`),value:o.signalMinutes?`${B(o.signalMinutes,o.signalMinutes%1?1:0,a)} min`:i(`off`)},{label:i(`auto`),value:this.#m(o.auto)}),$(i(`watch`),l,`watch`)}#T(e,t){let n=this.word,r=this.systemLang,i=t.meter;if(i){let t=[{label:n(`meter_mode`),value:n(Q[i.mode]||`unknown`)},{label:n(`state_id`),value:i.stateId?this.#g(i.stateId):`—`},{label:n(`unit`),value:i.unit},{label:n(`meter_running`),value:this.#m(i.running)}];return i.running&&t.push({label:n(`used`),value:`${B(i.used,2,r)} ${i.unit}`}),t.push({label:n(`last_value`),value:i.last?`${B(i.last.value,2,r)} · ${n(`ago`,this.#p(e,i.last.ts))}`:n(`no_value`),warn:!i.last},{label:n(`refills`),value:String(i.refills)}),$(n(`meter`),t,`meter`)}let a=t.estimate;if(a){let e=a.mode===`hours`?`${a.unit}/h`:`${a.unit} / 100 ${t.distanceUnit}`;return $(n(`estimate`),[{label:n(`meter_mode`),value:n(Q[a.mode]||`unknown`)},{label:n(`consumption`),value:`${B(a.value,1,r)} ${e}`}],`estimate`)}return null}#E(e){let t=this.word,n=this.systemLang,r=e.settings,i=e.speedUnit,a=e=>H(z(e,i),i,n),o=e=>`${B(e,0,n)} m`,s=`${B(r.tripEndSeconds/60,r.tripEndSeconds%60?1:0,n)} min`;return $(t(`settings_in_use`),[{label:t(`start_speed`),value:a(r.startSpeed)},{label:t(`start_seconds`),value:W(r.startSeconds,n)},{label:t(`start_distance`),value:o(r.startDistance)},{label:t(`stop_radius`),value:o(r.stopRadius)},{label:t(`min_stop`),value:W(r.minStopSeconds,n)},{label:t(`trip_end`),value:s},{label:t(`min_distance`),value:o(r.minDistance)},{label:t(`max_accuracy`),value:o(r.maxAccuracy)},{label:t(`max_speed`),value:a(r.maxSpeed)},{label:t(`use_ignition`),value:this.#m(r.useIgnition)}],`settings`)}#D(e){let t=this.word,n=this.systemLang,i=e.trips.last,a=e.distanceUnit;return $(t(`trips`),[{label:t(`trip_count`),value:B(e.trips.count,0,n)},{label:t(`last_trip`),value:i?/* @__PURE__ */ r(`span`,{title:i.id,children:[q(i.start,n),` ·`,` `,V(R(i.distance,a),a,n)]}):t(`none`)}],`trips`)}#O(e){let t=this.word,i=this.systemLang;return/* @__PURE__ */ r(`section`,{className:`general`,children:[/* @__PURE__ */ n(`div`,{className:`block-title`,children:t(`places`)}),e.places.length?/* @__PURE__ */ n(`div`,{className:`table-wrap`,children:/* @__PURE__ */ r(`table`,{className:`grid places`,children:[/* @__PURE__ */ n(`thead`,{children:/* @__PURE__ */ r(`tr`,{children:[/* @__PURE__ */ n(`th`,{children:t(`name`)}),/* @__PURE__ */ n(`th`,{className:`num`,children:t(`radius`)}),/* @__PURE__ */ n(`th`,{children:t(`privacy`)}),/* @__PURE__ */ n(`th`,{children:t(`home`)})]})}),/* @__PURE__ */ n(`tbody`,{children:e.places.map(e=>/* @__PURE__ */ r(`tr`,{children:[/* @__PURE__ */ n(`td`,{children:e.name}),/* @__PURE__ */ r(`td`,{className:`num`,children:[B(e.radius,0,i),` m`]}),/* @__PURE__ */ n(`td`,{children:e.privacy?/* @__PURE__ */ n(`span`,{className:`badge warn`,children:t(`yes`)}):t(`no`)}),/* @__PURE__ */ n(`td`,{children:e.home?/* @__PURE__ */ n(`span`,{className:`badge primary`,children:t(`home`)}):``})]},e.name))})]})}):/* @__PURE__ */ n(`div`,{className:`muted`,children:t(`none`)}),/* @__PURE__ */ n(`div`,{className:`cards`,children:$(t(`general`),[{label:t(`notification_instance`),value:e.notificationInstance||t(`none`)},{label:t(`live_interval`),value:W(e.liveInterval,i)}],`general`)})]})}});