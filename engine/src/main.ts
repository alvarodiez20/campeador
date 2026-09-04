import './ui/style.css';
import { Graphics } from 'pixi.js';
import { FixedLoop } from './core/loop';
import { toFloat } from './core/fixed';
import { InputController } from './input/input';
import { WorkerPathService } from './path/service';
import { GameRenderer } from './render/renderer';
import { CommandQueue } from './sim/commands';
import { HZ, type SimEvent, type Simulation } from './sim/sim';
import { stepSimulation } from './sim/step';
import { Hud } from './ui/hud';
import { PERSONALIDADES, SimpleAI } from './game/ai';
import { Benchmark, benchOptionsFromUrl } from './game/benchmark';
import { createValencia1094, PLAYER_ALBARRACIN, PLAYER_ALMORAVIDES, type Scenario } from './game/scenario';

/**
 * Punto de entrada. Cablea las piezas y no hace nada mas: aqui no vive
 * ninguna regla de juego.
 *
 *   ?modo=banco   banco de pruebas de rendimiento (criterio de aceptacion)
 *   ?modo=valencia (por defecto) escenario de Cuarte, 1094
 */

const params = new URLSearchParams(location.search);
const modo = params.get('modo') ?? 'valencia';

const app = document.getElementById('app')!;
const viewport = document.getElementById('viewport') as HTMLElement;

async function main(): Promise<void> {
  if (modo === 'banco') await arrancarBanco();
  else await arrancarEscenario();
}

/** Capa de dibujo para el rectangulo de seleccion, encima de todo. */
function overlayGraphics(renderer: GameRenderer): Graphics {
  const g = new Graphics();
  renderer.app.stage.addChild(g);
  return g;
}

async function arrancarEscenario(): Promise<void> {
  const scenario: Scenario = createValencia1094();
  const sim = scenario.sim;
  const queue = new CommandQueue();

  const renderer = new GameRenderer(sim, viewport);
  await renderer.init();
  renderer.localPlayer = scenario.localPlayer;
  renderer.camera.centerOn(scenario.focus.x, scenario.focus.y);
  const dragGfx = overlayGraphics(renderer);

  sim.attachPath(new WorkerPathService(sim.terrain.width, sim.terrain.height, sim.terrain.cost));

  const hud = new Hud(scenario, sim, renderer, queue, scenario.localPlayer, app);
  const input = new InputController(sim, renderer, queue, scenario.localPlayer, {
    onToggleFog: () => (renderer.showFog = !renderer.showFog),
    onTogglePause: () => (pausado = !pausado),
    onSpeed: (d) => (velocidad = Math.max(1, Math.min(4, velocidad + d))),
  });
  hud.input = input;
  input.attach(renderer.app.canvas as HTMLCanvasElement);

  const ias = [
    new SimpleAI(sim, PLAYER_ALMORAVIDES, queue, PERSONALIDADES.agresivo),
    new SimpleAI(sim, PLAYER_ALBARRACIN, queue, PERSONALIDADES.economico),
  ];

  let pausado = false;
  let velocidad = 1;
  let hudTick = 0;

  const loop = new FixedLoop(
    () => {
      if (pausado || scenario.outcome !== 'jugando') return;
      for (let s = 0; s < velocidad; s++) {
        renderer.snapshot();
        for (const ia of ias) ia.tick();
        stepSimulation(sim, queue.drain());
        procesarEventos(sim, hud, renderer);
        scenario.handleEvents(ultimosEventos);
      }
      if (scenario.outcome !== 'jugando') hud.mostrarDesenlace(scenario.outcome === 'victoria');
    },
    (alpha) => {
      input.update(loop.stepMs);
      renderer.draw(pausado || scenario.outcome !== 'jugando' ? 1 : alpha);
      renderer.drawDragRect(dragGfx);
      if (hudTick++ % 8 === 0) hud.update(loop.stats, pausado, velocidad);
    },
    HZ,
  );
  loop.start();
  (window as unknown as { juego: unknown }).juego = { sim, scenario, renderer, loop };
}

let ultimosEventos: SimEvent[] = [];

function procesarEventos(sim: Simulation, hud: Hud, renderer: GameRenderer): void {
  ultimosEventos = sim.drainEvents();
  for (const e of ultimosEventos) {
    switch (e.t) {
      case 'obraTerminada':
        if (e.player === renderer.localPlayer) hud.aviso('Obra terminada.', 'bueno');
        break;
      case 'sinRecursos':
        if (e.player === renderer.localPlayer) hud.aviso('No hay recursos suficientes.', 'malo');
        break;
      case 'sinPoblacion':
        if (e.player === renderer.localPlayer) hud.aviso('Hace falta mas poblacion: levanta casas.', 'malo');
        break;
      case 'sitioOcupado':
        if (e.player === renderer.localPlayer) hud.aviso('Ahi no se puede construir.', 'malo');
        break;
      case 'pariaFirmada':
        hud.aviso(`Parias firmadas: ${sim.players[e.payer as number].name} pagara ${e.rate} de oro.`, 'oro');
        break;
      case 'pariaPagada':
        if (e.receiver === renderer.localPlayer) hud.aviso(`Llegan ${e.amount} de oro en parias.`, 'oro');
        break;
      case 'pariaImpagada':
        hud.aviso(`${sim.players[e.payer as number].name} no puede pagar la paria.`, 'malo');
        break;
      case 'pariaRota':
        hud.aviso(
          e.byPayer
            ? `${sim.players[e.breaker as number].name} se rebela y deja de pagar.`
            : `${sim.players[e.breaker as number].name} rompe la paria y ataca a quien protegia.`,
          'malo',
        );
        break;
      case 'almoravidesDesembarcan':
        hud.aviso('Los almoravides han cruzado el Estrecho. Se acabaron las parias.', 'malo');
        break;
      case 'llamadaAlmoravide':
        hud.aviso('Las taifas exprimidas miran hacia el Magreb.', 'malo');
        break;
      case 'oleada':
        if (e.player !== renderer.localPlayer) hud.aviso(`Se acerca una hueste de ${e.tamano} enemigos.`, 'malo');
        break;
      case 'objetivo':
        hud.aviso(String(e.texto), 'bueno');
        break;
      case 'muerte':
        if (e.isBuilding && e.player === renderer.localPlayer) {
          hud.aviso('Han derribado un edificio.', 'malo');
          renderer.floatingText('!', toFloat(e.x as number), toFloat(e.y as number), 0xd35f5f);
        }
        break;
      default:
        break;
    }
  }
}

async function arrancarBanco(): Promise<void> {
  const opts = benchOptionsFromUrl(params);
  const bench = new Benchmark(opts);
  const sim = bench.sim;

  const renderer = new GameRenderer(sim, viewport);
  await renderer.init();
  renderer.showFog = false;
  renderer.camera.centerOn(opts.mapSize / 2, opts.mapSize / 2);
  renderer.camera.zoom = 0.5;

  sim.attachPath(new WorkerPathService(sim.terrain.width, sim.terrain.height, sim.terrain.cost));

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'perf';
  app.appendChild(panel);

  const ayuda = document.createElement('div');
  ayuda.id = 'ayuda';
  ayuda.innerHTML =
    `Banco de pruebas · <b>${opts.units}</b> unidades · mapa ${opts.mapSize}² · ` +
    `${opts.combat ? 'con combate' : 'solo movimiento'}<br>` +
    'Parametros: <kbd>?modo=banco&n=500&mapa=128&combate=1&obstaculos=0</kbd>';
  app.appendChild(ayuda);

  let peorTick = 0;
  let peorRender = 0;
  let minFps = 999;
  let muestras = 0;

  const loop = new FixedLoop(
    () => {
      renderer.snapshot();
      bench.update();
      stepSimulation(sim, bench.queue.drain());
      sim.drainEvents();
    },
    (alpha) => {
      renderer.draw(alpha);
      if (loop.stats.fps > 0 && ++muestras > 60) {
        peorTick = Math.max(peorTick, loop.stats.tickMs);
        peorRender = Math.max(peorRender, loop.stats.renderMs);
        minFps = Math.min(minFps, loop.stats.fps);
      }
      const veredicto =
        muestras < 120
          ? '<span style="color:var(--tenue)">midiendo…</span>'
          : minFps >= 58 && peorTick < 1000 / 15
            ? '<span class="ok">CRITERIO CUMPLIDO</span>'
            : '<span class="mal">NO CUMPLE</span>';
      panel.innerHTML =
        `<b>${loop.stats.fps} fps</b> (minimo ${minFps === 999 ? '—' : minFps}) · ${loop.stats.tps} tps<br>` +
        `sim <b>${loop.stats.tickMs.toFixed(2)} ms</b> (peor ${peorTick.toFixed(2)})<br>` +
        `render <b>${loop.stats.renderMs.toFixed(2)} ms</b> (peor ${peorRender.toFixed(2)})<br>` +
        `entidades <b>${sim.world.liveCount}</b> · pintadas <b>${renderer.stats.drawnEntities}</b><br>` +
        `rutas en cola ${sim.path.pending} · ultimo campo ${sim.path.lastMs.toFixed(1)} ms<br>` +
        `ticks perdidos ${loop.stats.droppedTicks} · tick ${sim.tick}<br>${veredicto}`;
    },
    HZ,
  );
  loop.start();
  (window as unknown as { banco: unknown }).banco = { sim, bench, loop, renderer };
}

main().catch((err) => {
  console.error(err);
  const d = document.createElement('pre');
  d.style.cssText = 'position:absolute;inset:20px;color:#e08a7a;font-size:13px;white-space:pre-wrap';
  d.textContent = `Error al arrancar:\n${String(err instanceof Error ? err.stack : err)}`;
  app.appendChild(d);
});
