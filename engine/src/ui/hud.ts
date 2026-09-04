import { FP_ONE } from '../core/fixed';
import { ResourceKind, UnitClass } from '../ecs/components';
import { entityIndex } from '../ecs/world';
import {
  BUILDINGS,
  BuildingId,
  RESOURCE_NAMES,
  UNITS,
  buildingName,
  unitName,
  type UnitDef,
} from '../game/data';
import type { Objective, Scenario } from '../game/scenario';
import type { CommandQueue } from '../sim/commands';
import { DiploStance } from '../sim/parias';
import type { Simulation } from '../sim/sim';
import { presionMilitar } from '../sim/step';
import type { InputController } from '../input/input';
import type { GameRenderer } from '../render/renderer';
import type { LoopStats } from '../core/loop';

/**
 * HUD en DOM, no en el canvas.
 *
 * Motivo: el texto en WebGL es caro de hacer bien (fuentes, acentos,
 * accesibilidad) y no aporta nada aqui. El canvas pinta el mundo; la interfaz
 * es HTML y CSS por encima. Ademas asi el HUD no gasta ni un draw call del
 * presupuesto de 60 fps.
 */

const RES_COLOR: Record<ResourceKind, string> = {
  [ResourceKind.Food]: '#c8543c',
  [ResourceKind.Wood]: '#4a8a3a',
  [ResourceKind.Gold]: '#d8b04a',
  [ResourceKind.Stone]: '#9aa1a9',
};

export class Hud {
  private root: HTMLElement;
  private recursos!: HTMLElement;
  private perf!: HTMLElement;
  private objetivosEl!: HTMLElement;
  private seleccionEl!: HTMLElement;
  private botonesEl!: HTMLElement;
  private avisosEl!: HTMLElement;
  private diploEl!: HTMLElement;
  private minimapa!: HTMLCanvasElement;
  private minimapaCtx!: CanvasRenderingContext2D;
  private minimapaBase!: ImageData;
  private modal!: HTMLElement;
  private avisos: Array<{ txt: string; clase: string; t: number }> = [];
  private minimapaTick = 0;

  input!: InputController;

  constructor(
    private readonly scenario: Scenario,
    private readonly sim: Simulation,
    private readonly renderer: GameRenderer,
    private readonly queue: CommandQueue,
    private readonly player: number,
    host: HTMLElement,
  ) {
    this.root = host;
    this.build();
  }

  private el(tag: string, cls?: string, parent?: HTMLElement): HTMLElement {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    (parent ?? this.root).appendChild(e);
    return e;
  }

  private build(): void {
    this.perf = this.el('div', 'panel');
    this.perf.id = 'perf';

    this.recursos = this.el('div', 'panel');
    this.recursos.id = 'barra-recursos';

    const obj = this.el('div', 'panel');
    obj.id = 'objetivos';
    obj.innerHTML = '<h3>Objetivos</h3>';
    this.objetivosEl = document.createElement('ul');
    this.objetivosEl.style.margin = '0';
    this.objetivosEl.style.padding = '0';
    obj.appendChild(this.objetivosEl);

    const mini = this.el('div', 'panel');
    mini.id = 'minimapa';
    this.minimapa = document.createElement('canvas');
    this.minimapa.width = this.sim.terrain.width;
    this.minimapa.height = this.sim.terrain.height;
    this.minimapa.style.width = '196px';
    this.minimapa.style.height = '196px';
    mini.appendChild(this.minimapa);
    this.minimapaCtx = this.minimapa.getContext('2d')!;
    this.minimapaBase = this.minimapaCtx.createImageData(this.minimapa.width, this.minimapa.height);
    this.minimapa.addEventListener('pointerdown', (e) => {
      const r = this.minimapa.getBoundingClientRect();
      const tx = ((e.clientX - r.left) / r.width) * this.sim.terrain.width;
      const ty = ((e.clientY - r.top) / r.height) * this.sim.terrain.height;
      this.renderer.camera.centerOn(tx, ty);
    });

    this.diploEl = this.el('div', 'panel');
    this.diploEl.id = 'diplomacia';

    const mando = this.el('div');
    mando.id = 'mando';
    const sel = this.el('div', 'panel', mando);
    sel.id = 'seleccion';
    this.seleccionEl = sel;
    const bot = this.el('div', 'panel', mando);
    bot.id = 'botonera';
    this.botonesEl = document.createElement('div');
    this.botonesEl.id = 'botones';
    bot.appendChild(this.botonesEl);

    this.avisosEl = this.el('div');
    this.avisosEl.id = 'avisos';

    const ayuda = this.el('div');
    ayuda.id = 'ayuda';
    ayuda.innerHTML =
      '<kbd>WASD</kbd> mover camara · <kbd>rueda</kbd> zoom · <kbd>clic der.</kbd> orden<br>' +
      '<kbd>Q</kbd>/<kbd>R</kbd>/<kbd>E</kbd> postura · <kbd>X</kbd> detener · <kbd>F</kbd> niebla · <kbd>P</kbd> pausa · <kbd>+</kbd>/<kbd>-</kbd> velocidad';

    this.modal = this.el('div', 'modal oculto');
    this.mostrarBriefing();
  }

  private mostrarBriefing(): void {
    const s = this.scenario;
    this.modal.className = 'modal';
    this.modal.innerHTML = '';
    const caja = document.createElement('div');
    caja.className = 'caja';
    caja.innerHTML =
      `<h1>${s.title}</h1><div class="anno">${s.year}</div>` +
      s.briefing.map((p) => `<p>${p}</p>`).join('') +
      '<p class="aparte">Valencia en 1094 es una ciudad andalusi con un senor cristiano. ' +
      'Su poblacion, su qadi y su administracion siguen en su sitio. Aqui no hay dos bandos ' +
      'sino tres, y el tercero cobra tributo de los otros.</p>';
    const b = document.createElement('button');
    b.textContent = 'Empezar';
    b.onclick = () => this.modal.classList.add('oculto');
    caja.appendChild(b);
    this.modal.appendChild(caja);
  }

  mostrarDesenlace(victoria: boolean): void {
    this.modal.className = 'modal';
    this.modal.innerHTML = '';
    const caja = document.createElement('div');
    caja.className = 'caja';
    caja.innerHTML = victoria
      ? '<h1>Cuarte</h1><div class="anno">Octubre de 1094</div>' +
        '<p>La hueste sale por la puerta y cae sobre el campamento. Los almoravides levantan el cerco.</p>' +
        '<p class="aparte">Historicamente fue asi: el Cid rompio el sitio con una salida, no aguantando ' +
        'tras los muros. Valencia siguio siendo suya hasta su muerte en 1099; su viuda Jimena la mantuvo ' +
        'tres anos mas antes de abandonarla e incendiarla.</p>'
      : '<h1>Valencia cae</h1><div class="anno">Octubre de 1094</div>' +
        '<p>El alcazar ha caido. La ciudad cambia de manos otra vez.</p>' +
        '<p class="aparte">Es lo que habria pasado sin la salida de Cuarte, y lo que acabo pasando ' +
        'en 1102: Valencia volvio a manos almoravides tres anos despues de la muerte de Rodrigo.</p>';
    const b = document.createElement('button');
    b.textContent = 'Volver a empezar';
    b.onclick = () => location.reload();
    caja.appendChild(b);
    this.modal.appendChild(caja);
  }

  aviso(txt: string, clase = ''): void {
    this.avisos.push({ txt, clase, t: performance.now() });
    if (this.avisos.length > 6) this.avisos.shift();
    this.renderAvisos();
  }

  private renderAvisos(): void {
    this.avisosEl.innerHTML = '';
    for (const a of this.avisos) {
      const d = document.createElement('div');
      d.className = `aviso ${a.clase}`;
      d.textContent = a.txt;
      this.avisosEl.appendChild(d);
    }
  }

  /** Refresco del HUD. No se llama cada frame: 8 veces por segundo basta. */
  update(loop: LoopStats, pausado: boolean, velocidad: number): void {
    this.updateRecursos();
    this.updatePerf(loop, pausado, velocidad);
    this.updateObjetivos();
    this.updateSeleccion();
    this.updateDiplomacia();
    if (this.minimapaTick++ % 3 === 0) this.updateMinimapa();
    const ahora = performance.now();
    if (this.avisos.length > 0 && ahora - this.avisos[0].t > 9000) {
      this.avisos.shift();
      this.renderAvisos();
    }
  }

  private updateRecursos(): void {
    const p = this.sim.players[this.player];
    const pop = this.sim.popOf(this.player);
    const renta = this.sim.diplomacy.incomeOf(this.player);
    let html = '';
    for (let k = 0; k < 4; k++) {
      html += `<div class="rec"><span class="pip" style="background:${RES_COLOR[k as ResourceKind]}"></span>` +
        `<span class="val">${p.resources[k]}</span><span class="etq">${RESOURCE_NAMES[k as ResourceKind]}</span></div>`;
    }
    html += `<div class="rec"><span class="val">${pop.pop}/${pop.cap}</span><span class="etq">Poblacion</span></div>`;
    if (renta > 0) html += `<div class="rec"><span class="val" style="color:var(--oro)">+${renta}</span><span class="etq">parias</span></div>`;
    this.recursos.innerHTML = html;
  }

  private updatePerf(loop: LoopStats, pausado: boolean, velocidad: number): void {
    const fpsClase = loop.fps >= 55 ? 'ok' : loop.fps >= 40 ? '' : 'mal';
    const ents = this.sim.world.liveCount;
    this.perf.innerHTML =
      `<b class="${fpsClase}">${loop.fps} fps</b> · ${loop.tps} tps<br>` +
      `sim <b>${loop.tickMs.toFixed(2)} ms</b> · render <b>${loop.renderMs.toFixed(2)} ms</b><br>` +
      `entidades <b>${ents}</b> · pintadas <b>${this.renderer.stats.drawnEntities}</b><br>` +
      `rutas: ${this.sim.path?.pending ?? 0} en cola · ultimo ${(this.sim.path?.lastMs ?? 0).toFixed(1)} ms<br>` +
      `tick ${this.sim.tick}${pausado ? ' · PAUSA' : ''}${velocidad !== 1 ? ` · x${velocidad}` : ''}`;
  }

  private updateObjetivos(): void {
    const html = this.scenario.objectives
      .map((o: Objective) => {
        const cls = o.done ? 'hecho' : o.failed ? 'fallo' : '';
        return `<li class="${cls}">${o.text}${o.optional ? ' <i>(opcional)</i>' : ''}` +
          (o.hint && !o.done ? `<span class="pista">${o.hint}</span>` : '') + '</li>';
      })
      .join('');
    if (this.objetivosEl.innerHTML !== html) this.objetivosEl.innerHTML = html;
  }

  private updateSeleccion(): void {
    const sel = [...this.renderer.selection].filter((i) => this.sim.world.alive[i] === 1);
    const C = this.sim.C;
    const bloc = this.sim.players[this.player].bloc;
    if (sel.length === 0) {
      this.seleccionEl.innerHTML = '<div class="titulo">Sin seleccion</div><div class="detalle">Arrastra para seleccionar unidades.</div>';
      this.botonesEl.innerHTML = '';
      return;
    }
    const first = sel[0];
    const isB = this.sim.world.has(this.sim.world.entityAt(first), C.building);
    if (sel.length === 1) {
      const nombre = isB ? buildingName(C.typeId[first] as BuildingId, bloc) : unitName(C.typeId[first], bloc);
      const extra = isB
        ? C.buildProgress[first] < C.buildTotal[first]
          ? `En obra · ${Math.round((C.buildProgress[first] / C.buildTotal[first]) * 100)}%`
          : 'En pie'
        : `Ataque ${C.attack[first]} · Armadura ${C.armorMelee[first]}/${C.armorPierce[first]}`;
      this.seleccionEl.innerHTML =
        `<div class="titulo">${nombre}</div>` +
        `<div class="detalle">${C.hp[first]}/${C.maxHp[first]} de vida · ${extra}</div>`;
    } else {
      const cuenta = new Map<string, number>();
      for (const i of sel) {
        const n = this.sim.world.has(this.sim.world.entityAt(i), C.building)
          ? buildingName(C.typeId[i] as BuildingId, bloc)
          : unitName(C.typeId[i], bloc);
        cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
      }
      this.seleccionEl.innerHTML =
        `<div class="titulo">${sel.length} seleccionados</div>` +
        `<div class="detalle">${[...cuenta].map(([n, c]) => `${c} ${n}`).join(' · ')}</div>`;
    }
    this.updateBotones(sel, isB);
  }

  private updateBotones(sel: number[], isBuilding: boolean): void {
    const C = this.sim.C;
    const bloc = this.sim.players[this.player].bloc;
    this.botonesEl.innerHTML = '';
    const add = (label: string, sub: string, enabled: boolean, onClick: () => void, activo = false): void => {
      const b = document.createElement('button');
      b.className = 'cmd' + (activo ? ' activo' : '');
      b.innerHTML = `${label}${sub ? `<span class="coste">${sub}</span>` : ''}`;
      b.disabled = !enabled;
      b.onclick = onClick;
      this.botonesEl.appendChild(b);
    };

    if (isBuilding) {
      const bi = sel[0];
      const def = BUILDINGS[C.typeId[bi]];
      const e = this.sim.world.entityAt(bi);
      for (const u of def.trains) {
        const ud: UnitDef = UNITS[u];
        add(unitName(u, bloc).split(' ')[0], costeCorto(ud), this.sim.canAfford(this.player, ud.cost), () => {
          this.queue.push({ t: 'train', player: this.player, building: e, unit: u });
        });
      }
      const q = this.sim.trainQueues.get(e);
      if (q && q.length > 0) {
        add('Cancelar', `${q.length} en cola`, true, () => {
          this.queue.push({ t: 'cancelTrain', player: this.player, building: e });
        });
      }
      return;
    }

    const hayAldeanos = sel.some((i) => C.unitClass[i] === UnitClass.Villager);
    if (hayAldeanos) {
      for (const bd of BUILDINGS) {
        add(buildingName(bd.id as BuildingId, bloc).split(' ')[0], costeCorto(bd), this.sim.canAfford(this.player, bd.cost), () => {
          this.input.setBuildMode(this.input.buildMode === bd.id ? null : (bd.id as BuildingId));
        }, this.input?.buildMode === bd.id);
      }
    }
  }

  private updateDiplomacia(): void {
    const d = this.sim.diplomacy;
    let html = '<h3>Parias y diplomacia</h3>';
    const nivel = Math.min(100, Math.round((d.presionAlmoravide / 1000) * 100));
    html +=
      `<div class="medidor"><div style="width:${nivel}%"></div></div>` +
      `<div class="est">Llamada a los almoravides: ${nivel}%` +
      (d.almoravidesLlegaron ? ' — <b style="color:var(--sangre)">han desembarcado</b>' : '') +
      '</div>';

    for (const p of this.sim.players) {
      if (p.id === this.player) continue;
      const st = d.stance(this.player, p.id);
      const contratoPago = d.contractBetween(this.player, p.id);
      const contratoCobro = d.contractBetween(p.id, this.player);
      html += `<div class="fila"><div class="nom"><span class="pip" style="background:#${p.color.toString(16).padStart(6, '0')}"></span>${p.name}</div>`;
      html += `<div class="est">${nombreEstado(st)}${p.defeated ? ' · derrotado' : ''}`;
      if (contratoCobro) html += ` · te paga <b style="color:var(--oro)">${contratoCobro.rate}</b> de oro`;
      if (contratoPago) html += ` · le pagas <b style="color:var(--sangre)">${contratoPago.rate}</b> de oro`;
      html += '</div>';
      html += `<div data-acciones="${p.id}"></div>`;
      html += `<div class="nota">${notaHistorica(this.sim, p.id)}</div></div>`;
    }
    if (this.diploEl.innerHTML !== html) {
      this.diploEl.innerHTML = html;
      for (const p of this.sim.players) {
        if (p.id === this.player) continue;
        const cont = this.diploEl.querySelector(`[data-acciones="${p.id}"]`) as HTMLElement | null;
        if (!cont) continue;
        const presion = presionMilitar(this.sim, this.player, p.id);
        const cobro = d.contractBetween(p.id, this.player);
        const pago = d.contractBetween(this.player, p.id);
        const mk = (txt: string, on: () => void, enabled = true): void => {
          const b = document.createElement('button');
          b.className = 'cmd';
          b.style.height = 'auto';
          b.style.padding = '4px 8px';
          b.style.fontSize = '11px';
          b.style.marginRight = '4px';
          b.textContent = txt;
          b.disabled = !enabled;
          b.onclick = on;
          cont.appendChild(b);
        };
        if (!cobro && !pago && this.sim.blocOf(p.id) === 1 && !d.almoravidesLlegaron) {
          mk(`Exigir parias (presion ${presion})`, () => {
            this.queue.push({ t: 'demandParias', player: this.player, from: p.id });
          }, presion >= 25 || d.stance(this.player, p.id) !== DiploStance.Guerra);
        }
        if (cobro) {
          mk('Romper la paria y atacar', () => {
            this.queue.push({ t: 'breakParias', player: this.player, other: p.id });
          });
        }
        if (pago) {
          mk('Dejar de pagar', () => {
            this.queue.push({ t: 'breakParias', player: this.player, other: p.id });
          });
        }
        if (!cobro && !pago && d.stance(this.player, p.id) === DiploStance.Guerra) {
          mk('Ofrecer tregua', () => {
            this.queue.push({ t: 'offerTruce', player: this.player, other: p.id });
          });
        } else if (!cobro && !pago && d.stance(this.player, p.id) !== DiploStance.Guerra) {
          mk('Declarar la guerra', () => {
            this.queue.push({ t: 'declareWar', player: this.player, other: p.id });
          });
        }
      }
    }
  }

  private updateMinimapa(): void {
    const t = this.sim.terrain;
    const img = this.minimapaBase;
    const data = img.data;
    const fog = this.sim.fog[this.player];
    for (let i = 0; i < t.tiles.length; i++) {
      const c = COLOR_TERRENO[t.tiles[i]] ?? 0x4f6b3a;
      const v = fog[i];
      const f = v === 2 ? 1 : v === 1 ? 0.5 : 0.12;
      data[i * 4] = ((c >> 16) & 255) * f;
      data[i * 4 + 1] = ((c >> 8) & 255) * f;
      data[i * 4 + 2] = (c & 255) * f;
      data[i * 4 + 3] = 255;
    }
    const C = this.sim.C;
    this.sim.world.each(this.sim.mBody, (i) => {
      const tx = Math.floor(C.tx[i] / FP_ONE);
      const ty = Math.floor(C.ty[i] / FP_ONE);
      if (!t.inBounds(tx, ty)) return;
      if (fog[ty * t.width + tx] === 0) return;
      const col = this.sim.players[C.player[i]]?.color ?? 0xffffff;
      const isB = this.sim.world.has(this.sim.world.entityAt(i), C.building);
      const r = isB ? 1 : 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = tx + dx;
          const py = ty + dy;
          if (!t.inBounds(px, py)) continue;
          const o = (py * t.width + px) * 4;
          data[o] = (col >> 16) & 255;
          data[o + 1] = (col >> 8) & 255;
          data[o + 2] = col & 255;
        }
      }
    });
    this.minimapaCtx.putImageData(img, 0, 0);
    // Rectangulo de la vista.
    const v = this.renderer.camera.visibleTiles(0);
    this.minimapaCtx.strokeStyle = 'rgba(255,255,255,.6)';
    this.minimapaCtx.lineWidth = 1;
    this.minimapaCtx.strokeRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }
}

const COLOR_TERRENO: Record<number, number> = {
  0: 0x4f6b3a,
  1: 0x7a6244,
  2: 0x2b4d6b,
  3: 0x5d5d5d,
  4: 0x8d7f63,
  5: 0x6a7a35,
  6: 0x47563c,
};

function nombreEstado(s: DiploStance): string {
  return s === DiploStance.Guerra ? 'En guerra' : s === DiploStance.Tregua ? 'En tregua' : 'Aliados';
}

function costeCorto(d: { cost: Readonly<Record<number, number>> }): string {
  const partes: string[] = [];
  const etq = ['C', 'M', 'O', 'P'];
  for (let k = 0; k < 4; k++) if (d.cost[k]) partes.push(`${d.cost[k]}${etq[k]}`);
  return partes.join(' ');
}

/**
 * Contexto historico por faccion. Esta en el HUD a proposito: la nota es
 * parte del tratamiento, no un extra. Si el jugador no ve nunca por que la
 * taifa esta ahi, el juego acaba tratandola como enemigo generico.
 */
function notaHistorica(sim: Simulation, player: number): string {
  const f = sim.players[player];
  const d = sim.diplomacy;
  if (f.name.includes('Albarracin')) {
    return d.contractBetween(player, 0)
      ? 'Paga por no ser atacada, como pagaba a Castilla antes. El tributo la desangra.'
      : 'Taifa pequena entre dos fuegos. Ya pago parias a Alfonso VI; ahora tantea con quien entenderse.';
  }
  if (f.name.includes('almoravide')) {
    return 'No vienen a cobrar tributo sino a acabar con el. Con ellos la diplomacia de parias deja de existir.';
  }
  return '';
}

export function entidadEnPantalla(sim: Simulation, e: number): boolean {
  return sim.world.alive[entityIndex(e)] === 1;
}
