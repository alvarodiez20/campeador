// El Cid — arte procedural pintado · unidades (20 + únicas + héroes), frente y perfil
(function () {
'use strict';
const A = window.CidArt; const {shade, rng, mk, path, outline, face, shadowBlob, dab, lerp, CIV_STYLE, PCOLORS} = A;
const line = (x, a, b, col, w = 1) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
const limb = (x, a, b, w, col, lit) => { line(x, a, b, 'rgba(30,15,5,.65)', w + 1.3); line(x, a, b, col, w); if (lit !== false) line(x, [a[0] - w * 0.25, a[1]], [b[0] - w * 0.25, b[1]], shade(col, 0.28), w * 0.3); };
const USTYLE = {
  aldeano: {weapon: 'tool', helmet: 'hood'}, milicia: {weapon: 'sword', helmet: 'cap', shield: 'round'}, espada: {weapon: 'sword', helmet: 'nasal', shield: 'round', armor: 1}, campeon: {weapon: 'sword', helmet: 'full', shield: 'kite', armor: 2},
  lancero: {weapon: 'spear', helmet: 'cap'}, piquero: {weapon: 'spear', helmet: 'nasal', armor: 1}, alabardero: {weapon: 'halberd', helmet: 'nasal', armor: 1},
  arquero: {weapon: 'bow', quiver: 1}, ballestero: {weapon: 'crossbow', helmet: 'cap', quiver: 1}, arbalestero: {weapon: 'crossbow', helmet: 'nasal', armor: 1, shield: 'pavise', quiver: 1},
  explorador: {weapon: 'spear', mounted: 1, horse: '#8a6a4a'}, jinete: {weapon: 'spear', helmet: 'cap', mounted: 1, horse: '#8a6a4a', shield: 'round'}, caballero: {weapon: 'lance', helmet: 'nasal', armor: 1, shield: 'kite', mounted: 1, horse: '#6b4a2b'}, paladin: {weapon: 'lance', helmet: 'full', armor: 2, shield: 'kite', mounted: 1, horse: '#3f3229', barding: 1},
  catapulta: {siege: 'catapulta'}, trabuco: {siege: 'trabuco'}, ariete: {siege: 'ariete'}, monje: {weapon: 'staff', robe: 1},
  caballero_villano: {weapon: 'spear', helmet: 'cap', shield: 'round', mounted: 1, horse: '#a08060'}, infanzon: {weapon: 'sword', helmet: 'nasal', armor: 2, shield: 'kite', cape: 1}, almogavar: {weapon: 'spear', wild: 1, beard: 1}, arquero_saraqusta: {weapon: 'bow', turban: 1, quiver: 1}, jinete_andalusi: {weapon: 'spear', turban: 1, mounted: 1, horse: '#d8c8a8', shield: 'round'}, lamtuna: {weapon: 'spear', veil: 1, shield: 'round', armor: 1},
  rodrigo: {weapon: 'sword', helmet: 'nasal', armor: 2, shield: 'kite', cape: 1, mounted: 1, horse: '#ece6da', hero: 1, beard: 1}, alvar: {weapon: 'lance', helmet: 'nasal', armor: 2, shield: 'kite', cape: 1, mounted: 1, horse: '#6b4a2b', hero: 1, beard: 1}, jimena: {robe: 1, cape: 1, hero: 1, lady: 1}, sancho: {weapon: 'sword', helmet: 'crown', armor: 2, cape: 1, shield: 'kite', mounted: 1, horse: '#4a3a2a', hero: 1}, vellido: {weapon: 'spear', helmet: 'cap', mounted: 1, horse: '#3a2a1a', hero: 1, beard: 1}, berenguer: {weapon: 'sword', helmet: 'crown', armor: 2, cape: 1, shield: 'kite', mounted: 1, horse: '#8a6a4a', hero: 1, beard: 1}, abubakr: {weapon: 'sword', veil: 1, armor: 2, cape: 1, mounted: 1, horse: '#d8c8a8', hero: 1, shield: 'round'}, yusuf: {weapon: 'sword', veil: 1, armor: 2, cape: 1, mounted: 1, horse: '#d8c8a8', hero: 1, shield: 'round'},
};
const UNAME = {aldeano: 'Aldeano', milicia: 'Peón', espada: 'Espadachín', campeon: 'Adalid', lancero: 'Lancero', piquero: 'Piquero', alabardero: 'Alabardero', arquero: 'Arquero', ballestero: 'Ballestero', arbalestero: 'Arbalestero', explorador: 'Explorador', jinete: 'Caballería ligera', caballero: 'Caballero', paladin: 'Caballero pesado', catapulta: 'Catapulta', trabuco: 'Trabuquete', ariete: 'Ariete', monje: 'Monje', caballero_villano: 'Caballero villano', infanzon: 'Infanzón', almogavar: 'Almogávar', arquero_saraqusta: 'Arquero de Saraqusta', jinete_andalusi: 'Jinete andalusí', lamtuna: 'Lamtuna', rodrigo: 'Rodrigo Díaz, el Cid', alvar: 'Álvar Fáñez, Minaya', jimena: 'Doña Jimena', sancho: 'Sancho II', vellido: 'Vellido Dolfos', berenguer: 'Berenguer Ramón II', abubakr: 'Abu Bakr ibn Ibrahim', yusuf: 'Yusuf ibn Tasufin'};

function shieldDevice(x, cx, cy, r, device, trim) { x.save(); x.strokeStyle = trim; x.fillStyle = trim; x.lineWidth = 1.2;
  switch (device) { case 'castle': x.fillRect(cx - r * 0.45, cy - r * 0.2, r * 0.9, r * 0.6); x.fillRect(cx - r * 0.5, cy - r * 0.45, r * 0.25, r * 0.3); x.fillRect(cx + r * 0.25, cy - r * 0.45, r * 0.25, r * 0.3); break;
    case 'lion': x.beginPath(); x.ellipse(cx, cy, r * 0.35, r * 0.5, 0, 0, 7); x.fill(); break;
    case 'bars': for (let i = -1; i <= 1; i++) x.fillRect(cx - r * 0.7, cy + i * r * 0.4 - r * 0.12, r * 1.4, r * 0.24); break;
    case 'star': for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(x, [cx, cy], [cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6], trim, 1); } break;
    case 'crescent': x.beginPath(); x.arc(cx, cy, r * 0.5, 0.5, Math.PI * 2 - 0.5); x.stroke(); break;
    default: line(x, [cx, cy - r * 0.6], [cx, cy + r * 0.6], trim, 1.4); line(x, [cx - r * 0.5, cy - r * 0.1], [cx + r * 0.5, cy - r * 0.1], trim, 1.4); }
  x.restore(); }
function shield(x, kind, cx, cy, pcol, s, side) {
  const g = x.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 8); g.addColorStop(0, shade(pcol, 0.25)); g.addColorStop(1, shade(pcol, -0.35));
  if (side) { x.fillStyle = shade(pcol, -0.1); x.beginPath(); x.ellipse(cx, cy, 2.4, kind === 'kite' ? 8 : 6.5, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(30,15,5,.7)'; x.lineWidth = 0.9; x.stroke(); line(x, [cx - 0.5, cy - 5], [cx - 0.5, cy + 4], shade(pcol, 0.3), 0.8); return; }
  if (kind === 'kite') { const pts = [[cx - 5, cy - 6], [cx - 5.2, cy - 3], [cx - 4, cy + 2], [cx, cy + 8], [cx + 4, cy + 2], [cx + 5.2, cy - 3], [cx + 5, cy - 6]]; x.fillStyle = g; x.beginPath(); x.moveTo(cx - 5, cy - 6); x.arc(cx, cy - 6, 5, Math.PI, 0); x.lineTo(cx + 5.2, cy - 3); x.lineTo(cx + 4, cy + 2); x.lineTo(cx, cy + 8); x.lineTo(cx - 4, cy + 2); x.lineTo(cx - 5.2, cy - 3); x.closePath(); x.fill(); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 1; x.stroke(); x.strokeStyle = s.trim; x.lineWidth = 0.9; x.beginPath(); x.moveTo(cx - 3.8, cy - 6); x.arc(cx, cy - 6, 3.8, Math.PI, 0); x.lineTo(cx + 3.9, cy - 3); x.lineTo(cx + 3, cy + 1.5); x.lineTo(cx, cy + 6); x.lineTo(cx - 3, cy + 1.5); x.lineTo(cx - 3.9, cy - 3); x.closePath(); x.stroke(); shieldDevice(x, cx, cy - 1, 4.5, s.device, s.trim); }
  else if (kind === 'pavise') { x.fillStyle = g; x.fillRect(cx - 4.5, cy - 7, 9, 15); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 1; x.strokeRect(cx - 4.5, cy - 7, 9, 15); x.fillStyle = s.trim; x.fillRect(cx - 1, cy - 7, 2, 15); }
  else { x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, 5.5, 6.5, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 1; x.stroke(); x.strokeStyle = '#6a6a72'; x.lineWidth = 1.1; x.beginPath(); x.ellipse(cx, cy, 4.6, 5.6, 0, 0, 7); x.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; dab(x, cx + Math.cos(a) * 4.6, cy + Math.sin(a) * 5.6, 0.5, '#d8dce4'); } shieldDevice(x, cx, cy, 4, s.device, s.trim); const bg = x.createRadialGradient(cx - 0.5, cy - 0.5, 0, cx, cy, 2); bg.addColorStop(0, '#f0f0f4'); bg.addColorStop(1, '#5a5a62'); x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, 1.8, 0, 7); x.fill(); }
}
function weapon(x, w, px, py, side, pcol, s, rot) {
  x.save(); x.translate(px, py); x.rotate((side ? -0.2 : 0) + (rot || 0));
  const steel = (a, b, wd) => { line(x, a, b, 'rgba(20,20,30,.8)', wd + 1.2); line(x, a, b, '#c9cdd6', wd); line(x, [a[0] - 0.4, a[1]], [b[0] - 0.4, b[1]], '#f4f6fa', wd * 0.3); };
  const wood = (a, b, wd) => { line(x, a, b, 'rgba(30,15,5,.8)', wd + 1.2); line(x, a, b, '#8a6a3a', wd); line(x, [a[0] - 0.3, a[1]], [b[0] - 0.3, b[1]], '#c9a66a', wd * 0.3); };
  switch (w) {
    case 'sword': steel([0, -1], [0, -19], 2.2); x.fillStyle = '#c9cdd6'; path(x, [[-1.1, -19], [0, -22], [1.1, -19]]); x.fill(); line(x, [-4, -2.5], [4, -2.5], 'rgba(30,15,5,.8)', 3); line(x, [-4, -2.5], [4, -2.5], '#c8a24a', 1.8); line(x, [0, -1], [0, 3], '#5a3d22', 2.2); dab(x, 0, 3.6, 1.5, '#c8a24a'); break;
    case 'spear': wood([0, 6], [0, -25], 1.7); x.fillStyle = '#c9cdd6'; path(x, [[-2.2, -25], [0, -33], [2.2, -25], [0, -23.5]]); x.fill(); x.strokeStyle = 'rgba(20,20,30,.8)'; x.lineWidth = 0.6; x.stroke(); line(x, [0, -32], [0, -25], '#f4f6fa', 0.5); line(x, [-1.5, -22], [1.5, -22], '#3a2a1a', 1.4); break;
    case 'halberd': wood([0, 8], [0, -27], 1.9); x.fillStyle = '#c9cdd6'; path(x, [[0, -34], [4.5, -28], [3.5, -22], [0, -19], [-5.5, -24], [-4, -29]]); x.fill(); x.strokeStyle = 'rgba(20,20,30,.8)'; x.lineWidth = 0.7; x.stroke(); line(x, [-4, -28], [-1, -21], '#f4f6fa', 0.6); break;
    case 'lance': wood([0, 12], [0, -36], 1.9); x.fillStyle = '#c9cdd6'; path(x, [[-1.6, -36], [0, -42], [1.6, -36]]); x.fill(); x.fillStyle = pcol; path(x, [[0, -33], [9, -31.5], [3, -29.5], [9, -27.5], [0, -26]]); x.fill(); outline(x, [[0, -33], [9, -31.5], [3, -29.5], [9, -27.5], [0, -26]], 0.6, 0.7); x.fillStyle = '#7a7a82'; x.beginPath(); x.ellipse(0, 4, 3, 1.6, 0, 0, 7); x.fill(); break;
    case 'bow': x.strokeStyle = 'rgba(30,15,5,.85)'; x.lineWidth = 3; x.beginPath(); x.moveTo(1.5, -18); x.quadraticCurveTo(13, -6, 1.5, 6); x.stroke(); x.strokeStyle = '#a8804a'; x.lineWidth = 1.8; x.stroke(); x.strokeStyle = '#e0c48a'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(1.5, -17); x.quadraticCurveTo(11, -6, 1.5, 5); x.stroke(); line(x, [1.5, -18], [1.5, 6], '#eee', 0.6); line(x, [-3, -7], [4, -5], '#5a3d22', 1.4); x.fillStyle = '#c9cdd6'; path(x, [[-3, -7], [-5.5, -7.5], [-4, -6]]); x.fill(); break;
    case 'crossbow': wood([0, 3], [0, -14], 2.8); line(x, [-9, -12], [9, -12], 'rgba(30,15,5,.85)', 2.8); line(x, [-9, -12], [9, -12], '#a8804a', 1.8); x.strokeStyle = '#eee'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(-9, -12); x.lineTo(0, -9); x.lineTo(9, -12); x.stroke(); x.fillStyle = '#5a5a62'; x.fillRect(-1.5, -9.5, 3, 2); line(x, [0, -8], [0, -15], '#5a3d22', 1); break;
    case 'staff': wood([0, 9], [0, -25], 1.7); if (s.arch === 'horseshoe') { x.strokeStyle = '#f0d060'; x.lineWidth = 1.6; x.beginPath(); x.arc(0, -28, 3, 0.5, Math.PI - 0.5, true); x.stroke(); } else { line(x, [0, -25], [0, -33], 'rgba(30,15,5,.8)', 3); line(x, [-3.5, -30], [3.5, -30], 'rgba(30,15,5,.8)', 3); line(x, [0, -25], [0, -33], '#f0d060', 1.8); line(x, [-3.5, -30], [3.5, -30], '#f0d060', 1.8); } break;
    case 'tool': wood([0, 5], [0, -14], 1.7); x.fillStyle = '#9a9ea8'; path(x, [[-5, -16.5], [5, -16.5], [5.5, -13.5], [-5.5, -13.5]]); x.fill(); x.strokeStyle = 'rgba(20,20,30,.8)'; x.lineWidth = 0.7; x.stroke(); line(x, [-4.5, -16], [4.5, -16], '#eef0f4', 0.6); break;
  }
  x.restore();
}
function horse(x, st, pcol, side, s, an) {
  const A = an || {}, gt = A.h || 0, hb = A.hb || 0; // gt: galope, hb: vaivén del lomo
  const col = st.horse, dark = shade(col, -0.35), lit = shade(col, 0.18); const tack = st.hero ? '#c8a24a' : '#4a2e18';
  if (side) {
    // patas traseras
    limb(x, [-9, -9 + hb], [-12 + gt, -1], 3.2, dark); limb(x, [-5, -9 + hb], [-3 - gt, -1], 3.2, col); for (const [hx, hy] of [[-12 + gt, 0], [-3 - gt, 0]]) { x.fillStyle = '#1a1410'; x.beginPath(); x.ellipse(hx, hy, 2.2, 1.2, 0, 0, 7); x.fill(); }
    // cuerpo
    const g = x.createRadialGradient(-2, -18, 2, 0, -14, 16); g.addColorStop(0, lit); g.addColorStop(0.65, col); g.addColorStop(1, dark); x.fillStyle = g; x.beginPath(); x.ellipse(0, -14 + hb, 15.5, 7.5, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 1; x.stroke();
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(0, -10, 13, 3.5, 0, 0, Math.PI); x.fill();
    // cola
    x.strokeStyle = dark; x.lineWidth = 2.6; x.beginPath(); x.moveTo(-14, -16); x.quadraticCurveTo(-20, -10, -18, -1); x.stroke(); x.strokeStyle = shade(col, -0.1); x.lineWidth = 0.8; x.beginPath(); x.moveTo(-14.5, -15); x.quadraticCurveTo(-19, -10, -17.5, -3); x.moveTo(-15, -14); x.quadraticCurveTo(-21, -8, -19, -1); x.stroke();
    // patas delanteras
    limb(x, [7, -9 + hb], [5 - gt, -1], 3.2, dark); limb(x, [11, -9 + hb], [13 + gt, -1], 3.2, col); for (const [hx, hy] of [[5 - gt, 0], [13 + gt, 0]]) { x.fillStyle = '#1a1410'; x.beginPath(); x.ellipse(hx, hy, 2.2, 1.2, 0, 0, 7); x.fill(); }
    // cuello y cabeza
    x.fillStyle = col; path(x, [[9, -18], [18, -28], [23, -21], [17, -11]]); x.fill(); outline(x, [[9, -18], [18, -28], [23, -21], [17, -11]], 0.7); x.fillStyle = shade(col, -0.15); path(x, [[13, -20], [18, -27], [21, -22], [17, -14]]); x.fill();
    const hg = x.createLinearGradient(18, -28, 26, -20); hg.addColorStop(0, lit); hg.addColorStop(1, dark); x.fillStyle = hg; x.beginPath(); x.ellipse(23, -24, 6.5, 4, 0.45, 0, 7); x.fill(); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 0.9; x.stroke();
    x.fillStyle = dark; path(x, [[19, -28], [20, -32], [21.5, -28]]); x.fill(); path(x, [[16.5, -27], [17, -31], [18.8, -27.5]]); x.fill(); // orejas
    dab(x, 24.5, -25.5, 0.9, '#111'); dab(x, 27.5, -21.5, 0.7, '#2a1a10'); // ojo y ollar
    // crin
    x.strokeStyle = dark; x.lineWidth = 1.8; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(10 + i * 1.6, -19 - i * 1.7); x.quadraticCurveTo(8 + i * 1.6, -15 - i * 1.7, 9.5 + i * 1.6, -13 - i * 1.5); x.stroke(); }
    // arreos y silla
    line(x, [14, -22], [25, -21], tack, 1); line(x, [22, -19], [26, -20], tack, 1); line(x, [14, -22], [7, -17], tack, 0.9);
    if (st.barding) { const bg = x.createLinearGradient(-13, 0, 13, 0); bg.addColorStop(0, shade(pcol, 0.12)); bg.addColorStop(1, shade(pcol, -0.3)); x.fillStyle = bg; path(x, [[-14, -15], [-8, -21], [8, -21], [14, -15], [12, -6], [-12, -6]]); x.fill(); outline(x, [[-14, -15], [-8, -21], [8, -21], [14, -15], [12, -6], [-12, -6]], 0.7); line(x, [-12, -9], [12, -9], s.trim, 1); for (let i = -9; i <= 9; i += 6) shieldDevice(x, i, -14, 2.6, s.device, s.trim); }
    x.fillStyle = shade(pcol, -0.05); path(x, [[-7, -20], [6, -20], [7, -12], [-8, -12]]); x.fill(); outline(x, [[-7, -20], [6, -20], [7, -12], [-8, -12]], 0.6); line(x, [-7.5, -13], [6.5, -13], s.trim, 0.8);
    x.fillStyle = '#4a2e18'; path(x, [[-6, -21], [5, -21], [5, -17], [-6, -17]]); x.fill(); outline(x, [[-6, -21], [5, -21], [5, -17], [-6, -17]], 0.6); line(x, [-6, -22.5], [-6, -19], '#3a2010', 2);
    line(x, [4, -17], [5.5, -8], tack, 0.8); x.fillStyle = '#6a6a72'; x.fillRect(4, -8.5, 3, 1.6);
  } else {
    limb(x, [-6, -9 + hb], [-7, -1 + Math.abs(gt) * 0.2], 3.2, dark); limb(x, [6, -9 + hb], [7, -1 - Math.abs(gt) * 0.2], 3.2, col); for (const hx of [-7, 7]) { x.fillStyle = '#1a1410'; x.beginPath(); x.ellipse(hx, 0, 2.2, 1.1, 0, 0, 7); x.fill(); }
    const g = x.createRadialGradient(-2, -18, 2, 0, -14, 12); g.addColorStop(0, lit); g.addColorStop(0.6, col); g.addColorStop(1, dark); x.fillStyle = g; x.beginPath(); x.ellipse(0, -14, 9.5, 10, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 1; x.stroke();
    limb(x, [-3.5, -11], [-3.5, -3], 2.8, dark); limb(x, [3.5, -11], [3.5, -3], 2.8, col); for (const hx of [-3.5, 3.5]) { x.fillStyle = '#1a1410'; x.beginPath(); x.ellipse(hx, -2, 2, 1, 0, 0, 7); x.fill(); }
    if (st.barding) { x.fillStyle = shade(pcol, -0.1); path(x, [[-9.5, -14], [-4, -21], [4, -21], [9.5, -14], [8.5, -6], [-8.5, -6]]); x.fill(); outline(x, [[-9.5, -14], [-4, -21], [4, -21], [9.5, -14], [8.5, -6], [-8.5, -6]], 0.7); line(x, [-8.5, -9], [8.5, -9], s.trim, 1); }
    x.fillStyle = shade(pcol, -0.05); path(x, [[-7, -21], [7, -21], [7.5, -15], [-7.5, -15]]); x.fill(); outline(x, [[-7, -21], [7, -21], [7.5, -15], [-7.5, -15]], 0.6); line(x, [-7.5, -16], [7.5, -16], s.trim, 0.8);
    x.fillStyle = '#4a2e18'; path(x, [[-6, -22], [6, -22], [6, -18], [-6, -18]]); x.fill(); outline(x, [[-6, -22], [6, -22], [6, -18], [-6, -18]], 0.6);
  }
}
// cabeza del caballo de frente: se pinta después del jinete, por delante del pecho
function horseHeadFront(x, st, s) {
  const col = st.horse, dark = shade(col, -0.35), lit = shade(col, 0.18); const tack = st.hero ? '#c8a24a' : '#4a2e18';
  const ng = x.createLinearGradient(-5, 0, 5, 0); ng.addColorStop(0, lit); ng.addColorStop(1, dark); x.fillStyle = ng; path(x, [[-5.5, -23], [5.5, -23], [4.5, -13], [-4.5, -13]]); x.fill(); outline(x, [[-5.5, -23], [5.5, -23], [4.5, -13], [-4.5, -13]], 0.7);
  x.strokeStyle = dark; x.lineWidth = 1.8; x.beginPath(); x.moveTo(0, -23); x.quadraticCurveTo(-1.5, -19, -0.5, -14); x.stroke(); x.strokeStyle = shade(col, -0.2); x.lineWidth = 0.8; x.beginPath(); x.moveTo(-1.5, -22); x.quadraticCurveTo(-2.5, -18, -2, -15); x.stroke();
  const hg = x.createRadialGradient(-1.5, -15, 1, 0, -12, 8); hg.addColorStop(0, lit); hg.addColorStop(0.7, col); hg.addColorStop(1, dark); x.fillStyle = hg; x.beginPath(); x.ellipse(0, -11.5, 5, 7, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 0.9; x.stroke();
  x.fillStyle = dark; path(x, [[-4.2, -17], [-5.5, -22], [-2.2, -18.5]]); x.fill(); path(x, [[4.2, -17], [5.5, -22], [2.2, -18.5]]); x.fill(); x.strokeStyle = 'rgba(30,15,5,.7)'; x.lineWidth = 0.6; x.stroke();
  x.fillStyle = shade(col, 0.35); x.beginPath(); x.ellipse(0, -9, 2.2, 3.8, 0, 0, 7); x.fill(); dab(x, -2.8, -14, 1, '#111'); dab(x, 2.8, -14, 1, '#111'); dab(x, -2.4, -14.3, 0.35, '#fff', 0.8); dab(x, 3.2, -14.3, 0.35, '#fff', 0.8); dab(x, -1.2, -6, 0.7, '#2a1a10'); dab(x, 1.2, -6, 0.7, '#2a1a10');
  line(x, [-4.6, -10.5], [4.6, -10.5], tack, 1); line(x, [-4.8, -14.5], [-4.2, -8], tack, 0.8); line(x, [4.8, -14.5], [4.2, -8], tack, 0.8); line(x, [-4.6, -10.5], [-8, -16], tack, 0.8); line(x, [4.6, -10.5], [8, -16], tack, 0.8);
}
// an: pose del fotograma — leg [dx trasera, dx delantera], lift (pie que se despega),
// bob (el tronco sube y baja sobre las caderas), sw (giro del brazo del arma, en radianes)
function figure(x, st, pcol, side, hy0, s, civ, an) {
  const A = an || {}; const leg = A.leg || [0, 0], lift = A.lift || 0, sw = A.sw || 0;
  const hy = hy0 + (A.bob || 0); // los pies quedan en el suelo (hy0); de cintura arriba se mece
  const wx = A.wx || 0; // la mano armada se adelanta o retrasa (estocada, tensar el arco)
  const swing = (sx, sy, hx2, hy2) => { const dx = hx2 - sx, dy = hy2 - sy, c = Math.cos(sw), si = Math.sin(sw); return [sx + dx * c - dy * si + wx, sy + dx * si + dy * c]; };
  const pdark = shade(pcol, -0.4); const mail = st.armor >= 2, scale = st.armor === 1; const christian = ['castilla', 'leon', 'aragon'].includes(civ);
  const skin = st.veil ? '#8d5a3a' : civ === 'almoravide' ? '#9a6a48' : '#e6c39a'; const hair = christian ? '#4a2e18' : '#1e1410';
  const tunic = mail ? '#aeb2bb' : pcol, tunicD = mail ? '#7a7e88' : pdark;
  // piernas y botas
  if (!st.mounted) { const hose = st.robe ? '#e6dfd0' : '#5a4636';
    const f0 = hy0 - 1 - (leg[0] > 0 ? lift : 0), f1 = hy0 - 1 - (leg[1] > 0 ? lift : 0); // el pie que avanza se despega
    if (side) { limb(x, [-1.5, hy - 9], [-3.5 + leg[0], f0], 3.4, shade(hose, -0.15)); limb(x, [2.5, hy - 9], [3.5 + leg[1], f1], 3.4, hose); }
    else { limb(x, [-3, hy - 9], [-3.5 + leg[0] * 0.35, f0], 3.4, shade(hose, -0.12)); limb(x, [3, hy - 9], [3.5 + leg[1] * 0.35, f1], 3.4, hose); }
    const bs = side ? [[-3.5 + leg[0], f0], [3.5 + leg[1], f1]] : [[-3.5 + leg[0] * 0.35, f0], [3.5 + leg[1] * 0.35, f1]];
    for (const [bx, by] of bs) { x.fillStyle = '#2e1e10'; x.beginPath(); x.ellipse(bx + (side ? 1 : 0.5), by + 0.5, 2.8, 1.7, 0, 0, 7); x.fill(); x.fillStyle = '#3f2c18'; x.fillRect(bx - 2, by - 3, 4, 3.5); x.strokeStyle = 'rgba(30,15,5,.7)'; x.lineWidth = 0.6; x.strokeRect(bx - 2, by - 3, 4, 3.5); } }
  else { const legCol = mail ? '#9a9ea8' : '#5a4636'; if (!side) limb(x, [-4.5, hy - 6], [-7, hy + 5], 3, legCol); limb(x, [4.5, hy - 6], [7, hy + 5], 3, legCol); for (const bx of side ? [7] : [-7, 7]) { x.fillStyle = '#2e1e10'; x.beginPath(); x.ellipse(bx, hy + 5.5, 2.4, 1.6, 0, 0, 7); x.fill(); } }
  // capa
  if (st.cape) { const cg = x.createLinearGradient(-8, 0, 8, 0); cg.addColorStop(0, shade(pcol, -0.15)); cg.addColorStop(1, shade(pcol, -0.5)); x.fillStyle = cg; x.beginPath(); x.moveTo(-6.5, hy - 22); x.lineTo(6.5, hy - 22); x.quadraticCurveTo(9.5, hy - 10, 10, hy - 1); x.quadraticCurveTo(6, hy - 3, 2, hy - 1); x.quadraticCurveTo(-3, hy - 3, -9.5, hy - 1); x.quadraticCurveTo(-9, hy - 10, -6.5, hy - 22); x.closePath(); x.fill(); x.strokeStyle = 'rgba(30,15,5,.7)'; x.lineWidth = 0.9; x.stroke(); line(x, [-4, hy - 20], [-6.5, hy - 4], 'rgba(0,0,0,.25)', 1.2); line(x, [3, hy - 20], [5.5, hy - 4], 'rgba(0,0,0,.25)', 1.2); }
  // torso
  if (st.robe) { const rc = st.lady ? shade(pcol, 0.5) : christian ? '#e9e2d3' : '#f1ead8'; const rg = x.createLinearGradient(-7, 0, 7, 0); rg.addColorStop(0, shade(rc, 0.05)); rg.addColorStop(1, shade(rc, -0.28)); x.fillStyle = rg; path(x, [[-7.5, hy], [7.5, hy], [5, hy - 23], [-5, hy - 23]]); x.fill(); outline(x, [[-7.5, hy], [7.5, hy], [5, hy - 23], [-5, hy - 23]], 0.75); for (let i = -1; i <= 1; i++) line(x, [i * 3, hy - 14], [i * 4.5, hy - 1], 'rgba(60,40,20,.25)', 1); x.fillStyle = pcol; x.fillRect(-1.6, hy - 20, 3.2, 19); line(x, [-6, hy - 11], [6, hy - 11], '#7a5a34', 1.4); if (st.lady) { line(x, [-5, hy - 11], [5, hy - 11], '#c8a24a', 1.2); } }
  else {
    const tg = x.createLinearGradient(-6, 0, 6, 0); tg.addColorStop(0, shade(tunic, 0.14)); tg.addColorStop(0.55, tunic); tg.addColorStop(1, shade(tunic, -0.3)); x.fillStyle = tg; x.beginPath(); x.roundRect(-6.5, hy - 23, 13, 16, 3); x.fill(); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 1; x.stroke();
    if (mail) { x.save(); x.beginPath(); x.roundRect(-6.5, hy - 23, 13, 16, 3); x.clip(); for (let yy = hy - 22; yy < hy - 7; yy += 1.6) for (let xx = -6 + ((yy * 5) % 2 ? 0.8 : 0); xx < 7; xx += 1.6) { dab(x, xx, yy, 0.55, '#6a6e78', 0.8); dab(x, xx - 0.25, yy - 0.25, 0.3, '#e8ecf4', 0.7); } x.restore(); // tabardo
      x.fillStyle = pcol; path(x, [[-4, hy - 22], [4, hy - 22], [3.5, hy - 8], [0, hy - 6.5], [-3.5, hy - 8]]); x.fill(); outline(x, [[-4, hy - 22], [4, hy - 22], [3.5, hy - 8], [0, hy - 6.5], [-3.5, hy - 8]], 0.6); shieldDevice(x, 0, hy - 15, 3, s.device, s.trim); }
    else if (scale) { x.save(); x.beginPath(); x.roundRect(-6.5, hy - 23, 13, 9, 3); x.clip(); x.fillStyle = '#8f939d'; x.fillRect(-7, hy - 24, 14, 10); for (let yy = hy - 22; yy < hy - 13; yy += 1.8) for (let xx = -6 + ((Math.round(yy) % 2) ? 1 : 0); xx < 7; xx += 2) { x.strokeStyle = '#4a4e58'; x.lineWidth = 0.6; x.beginPath(); x.arc(xx, yy, 1, 0, Math.PI); x.stroke(); x.strokeStyle = '#d4d8e0'; x.beginPath(); x.arc(xx, yy - 0.4, 0.8, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); } x.restore(); }
    else { line(x, [-3, hy - 21], [-4, hy - 9], 'rgba(0,0,0,.18)', 1.2); line(x, [3, hy - 21], [4, hy - 9], 'rgba(0,0,0,.18)', 1.2); x.fillStyle = shade(tunic, -0.1); path(x, [[-2.5, hy - 23], [2.5, hy - 23], [0, hy - 19.5]]); x.fill(); }
    // cinturón y falda
    x.fillStyle = tunicD; x.fillRect(-6.5, hy - 9.5, 13, 3); x.fillStyle = '#3a2814'; x.fillRect(-6.5, hy - 10.5, 13, 1.8); x.fillStyle = '#c8a24a'; x.fillRect(-1.2, hy - 11, 2.4, 2.6); x.strokeStyle = 'rgba(30,15,5,.6)'; x.lineWidth = 0.5; x.strokeRect(-1.2, hy - 11, 2.4, 2.6);
    if (st.wild) { x.fillStyle = '#6b4a2e'; path(x, [[-6.5, hy - 23], [-2, hy - 23], [-1, hy - 16], [-6, hy - 12]]); x.fill(); path(x, [[6.5, hy - 23], [2, hy - 23], [1, hy - 16], [6, hy - 12]]); x.fill(); }
  }
  // brazos
  const armCol = mail ? '#8f939d' : st.robe ? (st.lady ? shade(pcol, 0.5) : '#e9e2d3') : tunic;
  const arm = (a, b) => { limb(x, a, b, 3, armCol); dab(x, b[0], b[1] + 0.5, 1.7, skin); x.strokeStyle = 'rgba(30,15,5,.6)'; x.lineWidth = 0.6; x.beginPath(); x.arc(b[0], b[1] + 0.5, 1.7, 0, 7); x.stroke(); };
  const wh = swing(5, hy - 19, 8, hy - 10); // mano armada, girada sobre el hombro
  if (side) { arm([-2, hy - 19], [-4.5 - leg[1] * 0.25, hy - 10]); if (st.shield) shield(x, st.shield, -4 - leg[1] * 0.25, hy - 13, pcol, s, true); arm([5, hy - 19], wh); if (st.weapon) weapon(x, st.weapon, wh[0], wh[1], side, pcol, s, sw); }
  else { arm([-5.5, hy - 19], [-8 - leg[1] * 0.25, hy - 10]); if (st.shield) shield(x, st.shield, -8.5 - leg[1] * 0.25, hy - 13, pcol, s, false); if (st.quiver) { x.fillStyle = '#6b4a2e'; x.save(); x.translate(6, hy - 20); x.rotate(0.35); x.fillRect(-1.6, -8, 3.2, 12); x.restore(); for (let i = 0; i < 3; i++) line(x, [7.5 + i * 1.2, hy - 26], [7.5 + i * 1.2, hy - 29], '#8a6a3a', 0.8); } arm([5.5, hy - 19], wh); if (st.weapon) weapon(x, st.weapon, wh[0], wh[1], side, pcol, s, sw); }
  // cabeza
  const hy2 = hy - 28;
  const sg = x.createRadialGradient(-1.5, hy2 - 1.5, 0.5, 0, hy2, 6); sg.addColorStop(0, shade(skin, 0.15)); sg.addColorStop(1, shade(skin, -0.3)); x.fillStyle = sg; x.beginPath(); x.arc(0, hy2, 5.2, 0, 7); x.fill(); x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 0.9; x.stroke();
  if (!st.veil && st.helmet !== 'full') { if (!side) { dab(x, -1.9, hy2 - 0.2, 0.7, '#1a1008'); dab(x, 1.9, hy2 - 0.2, 0.7, '#1a1008'); line(x, [0, hy2 - 0.5], [0.4, hy2 + 1.5], 'rgba(60,30,10,.35)', 0.8); } else { dab(x, 2.4, hy2 - 0.2, 0.7, '#1a1008'); } if (st.beard) { x.fillStyle = hair; x.beginPath(); x.ellipse(side ? 1.5 : 0, hy2 + 3.4, side ? 3 : 4, 2.4, 0, 0, Math.PI); x.fill(); } }
  const hl = 'rgba(255,255,255,.45)';
  if (st.veil) { x.fillStyle = '#233a6a'; x.beginPath(); x.arc(0, hy2 - 0.5, 5.6, Math.PI, 0); x.lineTo(5.6, hy2 + 5); x.lineTo(-5.6, hy2 + 5); x.closePath(); x.fill(); x.strokeStyle = 'rgba(10,10,30,.7)'; x.lineWidth = 0.9; x.stroke(); x.fillStyle = skin; x.fillRect(-4, hy2 - 1.6, 8, 2.6); if (!side) { dab(x, -1.9, hy2 - 0.3, 0.7, '#1a1008'); dab(x, 1.9, hy2 - 0.3, 0.7, '#1a1008'); } line(x, [-5, hy2 + 2], [5, hy2 + 1], 'rgba(255,255,255,.2)', 1); x.fillStyle = '#2a4a80'; x.fillRect(-5.8, hy2 - 3.5, 11.6, 2); }
  else if (st.turban) { const tg2 = x.createLinearGradient(-6, 0, 6, 0); tg2.addColorStop(0, '#ffffff'); tg2.addColorStop(1, '#c9bc9c'); x.fillStyle = tg2; x.beginPath(); x.ellipse(0, hy2 - 3.6, 6.4, 4.2, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(60,40,20,.65)'; x.lineWidth = 0.9; x.stroke(); x.strokeStyle = 'rgba(90,70,40,.5)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(-5.5, hy2 - 3); x.quadraticCurveTo(0, hy2 - 8.5, 5.5, hy2 - 3.5); x.moveTo(-4, hy2 - 5.5); x.quadraticCurveTo(1, hy2 - 8, 5, hy2 - 5); x.stroke(); dab(x, 0, hy2 - 6.5, 1.3, s.accent); dab(x, -0.3, hy2 - 6.8, 0.5, '#fff', 0.8); }
  else switch (st.helmet) {
    case 'cap': x.fillStyle = '#8a8e98'; x.beginPath(); x.moveTo(-7, hy2 - 0.5); x.lineTo(-5, hy2 - 3); x.quadraticCurveTo(0, hy2 - 11, 5, hy2 - 3); x.lineTo(7, hy2 - 0.5); x.closePath(); x.fill(); x.strokeStyle = 'rgba(20,20,30,.8)'; x.lineWidth = 0.9; x.stroke(); line(x, [-2.5, hy2 - 4], [-1, hy2 - 8], hl, 1); x.fillStyle = '#5a3d22'; x.fillRect(-5.5, hy2 - 3.2, 11, 1.4); break;
    case 'nasal': { const ng = x.createLinearGradient(-5, 0, 5, 0); ng.addColorStop(0, '#d0d4dc'); ng.addColorStop(0.5, '#9a9ea8'); ng.addColorStop(1, '#5a5e68'); x.fillStyle = ng; x.beginPath(); x.moveTo(-5.6, hy2 - 0.5); x.quadraticCurveTo(-5, hy2 - 8, 0, hy2 - 10.5); x.quadraticCurveTo(5, hy2 - 8, 5.6, hy2 - 0.5); x.closePath(); x.fill(); x.strokeStyle = 'rgba(20,20,30,.8)'; x.lineWidth = 0.9; x.stroke(); x.fillStyle = '#b0b4bc'; x.fillRect(-5.6, hy2 - 1.5, 11.2, 1.6); if (!side) x.fillRect(-0.9, hy2 - 1.5, 1.8, 5.5); else x.fillRect(4, hy2 - 1.5, 1.5, 5); line(x, [-3, hy2 - 3], [-0.5, hy2 - 8.5], hl, 1); for (let i = -1; i <= 1; i++) dab(x, i * 3.2, hy2 - 0.7, 0.5, '#e8ecf4'); break; }
    case 'full': { const fg = x.createLinearGradient(-6, 0, 6, 0); fg.addColorStop(0, '#d0d4dc'); fg.addColorStop(0.5, '#9a9ea8'); fg.addColorStop(1, '#5a5e68'); x.fillStyle = fg; x.beginPath(); x.moveTo(-6, hy2 + 4.5); x.lineTo(-6, hy2 - 2); x.arc(0, hy2 - 2, 6, Math.PI, 0); x.lineTo(6, hy2 + 4.5); x.closePath(); x.fill(); x.strokeStyle = 'rgba(20,20,30,.8)'; x.lineWidth = 0.9; x.stroke(); x.fillStyle = '#0d0b10'; x.fillRect(side ? 1 : -4.5, hy2 - 1.8, side ? 5 : 9, 1.6); if (!side) x.fillRect(-0.7, hy2 - 1.8, 1.4, 5); for (let i = 0; i < 4; i++) dab(x, -4 + i * 2.7, hy2 + 1.8, 0.45, '#0d0b10'); line(x, [-3.5, hy2 - 4], [-1.5, hy2 - 7], hl, 1); x.fillStyle = pcol; path(x, [[-1.5, hy2 - 8], [1.5, hy2 - 8], [1, hy2 - 13], [-1, hy2 - 13]]); x.fill(); line(x, [-1.2, hy2 - 8], [1.2, hy2 - 8], 'rgba(30,15,5,.7)', 0.8); x.fillStyle = '#c8a24a'; x.fillRect(-6, hy2 - 2.2, 12, 1.2); break; }
    case 'crown': { x.fillStyle = hair; x.beginPath(); x.arc(0, hy2 - 1, 5.4, Math.PI, 0); x.fill(); x.fillStyle = '#e8c04a'; path(x, [[-5.5, hy2 - 3], [-5.5, hy2 - 9], [-2.7, hy2 - 5.5], [0, hy2 - 10.5], [2.7, hy2 - 5.5], [5.5, hy2 - 9], [5.5, hy2 - 3]]); x.fill(); x.strokeStyle = 'rgba(80,50,0,.8)'; x.lineWidth = 0.8; x.stroke(); line(x, [-5, hy2 - 3.6], [5, hy2 - 3.6], '#f8e08a', 0.8); dab(x, 0, hy2 - 4.8, 1, '#e0483f'); dab(x, -3.4, hy2 - 4.8, 0.7, '#3f8cff'); dab(x, 3.4, hy2 - 4.8, 0.7, '#3f8cff'); dab(x, 0, hy2 - 10.5, 0.8, '#f8e08a'); break; }
    case 'hood': { const hc = christian ? '#8a6a3a' : '#c9b58c'; x.fillStyle = hc; x.beginPath(); x.arc(0, hy2 - 0.5, 5.8, Math.PI, 0); x.lineTo(6.5, hy2 + 1.5); x.lineTo(-6.5, hy2 + 1.5); x.closePath(); x.fill(); x.strokeStyle = 'rgba(30,15,5,.7)'; x.lineWidth = 0.9; x.stroke(); line(x, [-3, hy2 - 3.5], [-1, hy2 - 5.5], hl, 0.8); if (christian) { x.fillStyle = hair; x.fillRect(-4.5, hy2 + 0.5, 9, 1.4); } break; }
    default: if (st.robe && !st.hero) { x.fillStyle = hair; x.beginPath(); x.arc(0, hy2 - 1.5, 5.3, Math.PI * 0.9, Math.PI * 0.1); x.fill(); if (christian) { x.fillStyle = skin; x.beginPath(); x.arc(0, hy2 - 3.6, 2.4, 0, 7); x.fill(); } } else if (st.lady) { x.fillStyle = '#efe8d8'; x.beginPath(); x.arc(0, hy2 - 1.5, 6, Math.PI, 0); x.lineTo(6, hy2 + 10); x.lineTo(-6, hy2 + 10); x.closePath(); x.fill(); x.strokeStyle = 'rgba(60,40,20,.6)'; x.lineWidth = 0.9; x.stroke(); x.fillStyle = sg; x.beginPath(); x.arc(0, hy2, 4.2, 0, 7); x.fill(); dab(x, -1.6, hy2 - 0.2, 0.6, '#1a1008'); dab(x, 1.6, hy2 - 0.2, 0.6, '#1a1008'); x.fillStyle = '#c8a24a'; x.fillRect(-6, hy2 - 3.2, 12, 1.2); } else { x.fillStyle = hair; x.beginPath(); x.arc(0, hy2 - 1.2, 5.3, Math.PI * 0.95, Math.PI * 0.05); x.fill(); line(x, [-3, hy2 - 4], [-1, hy2 - 5.5], 'rgba(255,255,255,.25)', 1); }
  }
}
function siege(x, type, side, pcol) {
  shadowBlob(x, 0, 0, 18, 7, 0.5);
  const wheel = (wx, wy, r) => { x.fillStyle = '#2a1a0a'; x.beginPath(); x.ellipse(wx, wy, side ? r : r * 0.6, r, 0, 0, 7); x.fill(); x.fillStyle = '#6b4a2e'; x.beginPath(); x.ellipse(wx, wy, side ? r - 1.2 : (r - 1.2) * 0.6, r - 1.2, 0, 0, 7); x.fill(); x.fillStyle = '#2a1a0a'; x.beginPath(); x.ellipse(wx, wy, side ? r - 2.4 : (r - 2.4) * 0.6, r - 2.4, 0, 0, 7); x.fill(); x.strokeStyle = '#c9a66a'; x.lineWidth = 0.9; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; x.beginPath(); x.moveTo(wx - Math.cos(a) * (side ? r : r * 0.6), wy - Math.sin(a) * r); x.lineTo(wx + Math.cos(a) * (side ? r : r * 0.6), wy + Math.sin(a) * r); x.stroke(); } dab(x, wx, wy, 1.2, '#5a5a62'); x.strokeStyle = 'rgba(30,15,5,.8)'; x.lineWidth = 0.9; x.beginPath(); x.ellipse(wx, wy, side ? r : r * 0.6, r, 0, 0, 7); x.stroke(); };
  const plank = (pts, k, seed) => face(x, pts, '#8a6a3a', {k, tex: 'planks', ground: [pts[0], pts[1]], ht: Math.abs(pts[2][1] - pts[1][1]) || 6, seed, amp: 0.14});
  if (type === 'ariete') {
    wheel(-11, -2, 5); wheel(9, -2, 5);
    // tejadillo a dos aguas con tablillas
    face(x, [[-17, -7], [0, -23], [17, -7]], '#7a5a36', {k: 0, seed: 3, amp: 0.15}); x.save(); path(x, [[-17, -7], [0, -23], [17, -7]]); x.clip(); for (let yy = -9; yy > -23; yy -= 3) { line(x, [-17, yy], [17, yy], 'rgba(30,15,5,.45)', 0.8); for (let xx = -16 + ((yy / 3) % 2 ? 2 : 0); xx < 17; xx += 4) line(x, [xx, yy], [xx, yy + 3], 'rgba(30,15,5,.4)', 0.6); } x.fillStyle = 'rgba(0,0,0,.3)'; path(x, [[-17, -7], [0, -23], [0, -7]]); x.fill(); x.restore(); outline(x, [[-17, -7], [0, -23], [17, -7]], 0.75);
    plank([[-18, -3], [18, -3], [18, -8], [-18, -8]], -0.1, 4);
    // cabeza de carnero
    const rg = x.createLinearGradient(-20, 0, 20, 0); rg.addColorStop(0, '#5a3d22'); rg.addColorStop(1, '#3a2814'); x.fillStyle = rg; x.fillRect(-20, -11, 40, 4); outline(x, [[-20, -11], [20, -11], [20, -7], [-20, -7]], 0.7);
    const hx = side ? 20 : -20; x.fillStyle = '#9a9ea8'; path(x, [[hx, -13], [hx + (side ? 6 : -6), -12], [hx + (side ? 6 : -6), -6], [hx, -5]]); x.fill(); outline(x, [[hx, -13], [hx + (side ? 6 : -6), -12], [hx + (side ? 6 : -6), -6], [hx, -5]], 0.8); line(x, [hx + (side ? 1 : -1), -12], [hx + (side ? 5 : -5), -11.5], '#eef0f4', 0.7);
    for (const rx of [-10, 0, 10]) line(x, [rx, -9], [rx, -14], '#5a4a3a', 1); x.fillStyle = pcol; path(x, [[-6, -21], [6, -21], [6, -17], [-6, -17]]); x.fill(); outline(x, [[-6, -21], [6, -21], [6, -17], [-6, -17]], 0.6);
    for (let i = 0; i < 6; i++) dab(x, -15 + i * 6, -7.5, 0.6, '#3a3a40');
  } else {
    const treb = type === 'trabuco';
    wheel(-10, -3, 5); wheel(10, -3, 5);
    plank([[-14, -5], [14, -5], [14, -12], [-14, -12]], 0, 5); line(x, [-15, -12], [15, -12], '#5a3d22', 2.4); for (const rx of [-12, -4, 4, 12]) dab(x, rx, -8.5, 0.7, '#3a3a40');
    // bastidor en A
    line(x, [-8, -12], [-1, -34], 'rgba(30,15,5,.8)', 4.2); line(x, [-8, -12], [-1, -34], '#7a5a36', 3); line(x, [6, -12], [-1, -34], 'rgba(30,15,5,.8)', 4.2); line(x, [6, -12], [-1, -34], '#7a5a36', 3); line(x, [-5, -22], [3, -22], '#5a3d22', 2);
    // brazo
    const L = treb ? 34 : 26; x.save(); x.translate(-1, -30); x.rotate(-0.95); line(x, [0, 6], [0, -L], 'rgba(30,15,5,.85)', 4); line(x, [0, 6], [0, -L], '#c9b48a', 2.8); line(x, [-0.6, 4], [-0.6, -L + 2], '#e8dcb0', 0.8);
    if (treb) { x.fillStyle = '#4a4a50'; x.fillRect(-5, 3, 10, 9); outline(x, [[-5, 3], [5, 3], [5, 12], [-5, 12]], 0.8); line(x, [-3, 5], [3, 5], '#8a8e98', 0.8); line(x, [-3, 8], [3, 8], '#8a8e98', 0.8); x.strokeStyle = '#a88a5a'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(0, -L); x.quadraticCurveTo(-6, -L - 4, -8, -L + 2); x.stroke(); dab(x, -8, -L + 3, 2.6, '#6a6a72'); }
    else { x.fillStyle = '#5a3d22'; x.beginPath(); x.ellipse(0, -L, 4.5, 3, 0, 0, 7); x.fill(); outline(x, [[-4.5, -L], [0, -L - 3], [4.5, -L], [0, -L + 3]], 0.7); dab(x, 0, -L - 0.5, 2.6, '#7a7a82'); dab(x, -0.6, -L - 1.2, 1, '#b8bcc4'); }
    x.restore();
    // torsión y cabestrante
    for (let i = 0; i < 5; i++) line(x, [-6 + i * 3, -12], [-6 + i * 3, -16], '#c9a66a', 1.1); dab(x, 10, -14, 2.4, '#5a3d22'); line(x, [10, -14], [14, -18], '#8a6a3a', 1.2);
    x.fillStyle = pcol; path(x, [[-7, -11], [7, -11], [7, -7], [-7, -7]]); x.fill(); outline(x, [[-7, -11], [7, -11], [7, -7], [-7, -7]], 0.6);
  }
}
function unitSprite(type, civ = 'castilla', colIdx = 0, side = false, an = null) {
  const st = Object.assign({}, USTYLE[type] || {}); const s = CIV_STYLE[civ] || CIV_STYLE.castilla;
  if ((civ === 'zaragoza' || civ === 'sevilla') && !st.hero && st.turban === undefined && st.helmet !== 'full') st.turban = !['nasal', 'crown'].includes(st.helmet) ? 1 : 0; if (civ === 'almoravide' && !st.hero && st.veil === undefined) st.veil = 1;
  const pcol = PCOLORS[colIdx]; const [c, x] = mk(64, 80); x.translate(32, 76);
  if (st.siege) { siege(x, st.siege, side, pcol); return {c, ax: 32, ay: 76}; }
  shadowBlob(x, 0, 0, st.mounted ? 17 : 9.5, st.mounted ? 7 : 4.2, 0.55);
  if (st.hero) { x.strokeStyle = 'rgba(240,201,74,.9)'; x.lineWidth = 1.4; x.beginPath(); x.ellipse(0, 0, st.mounted ? 19 : 12.5, st.mounted ? 8 : 5.4, 0, 0, 7); x.stroke(); x.strokeStyle = 'rgba(255,230,140,.35)'; x.lineWidth = 3.5; x.stroke(); }
  let hy = 0; if (st.mounted) { horse(x, st, pcol, side, s, an); hy = -18 + ((an && an.hb) || 0); }
  figure(x, st, pcol, side, hy, s, civ, st.mounted ? Object.assign({}, an, {leg: [0, 0], bob: 0}) : an);
  if (st.mounted && !side) { x.save(); x.translate(0, (an && an.hb) || 0); horseHeadFront(x, st, s); x.restore(); }
  return {c, ax: 32, ay: 76};
}
const unitSvg = (type, civ, colIdx, side, an) => unitSprite(type, civ, colIdx, side, an).c;
Object.assign(A, {USTYLE, UNAME, unitSprite, unitSvg, shield, weapon, horse, figure});
})();
