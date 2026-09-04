/** Mensajes entre el hilo principal y el worker de rutas. */

export interface InitMsg {
  t: 'init';
  width: number;
  height: number;
  cost: Uint8Array;
}

/** Parche de coste (un edificio que se levanta o cae). */
export interface PatchMsg {
  t: 'patch';
  cells: Int32Array; // indices de casilla
  values: Uint8Array;
}

export interface RequestMsg {
  t: 'req';
  id: number;
  /** Casillas meta. Varias para metas anchas (un edificio de 4x4). */
  goals: Int32Array;
  /** Casilla de origen representativa, para acotar el pasillo. */
  fromTile: number;
}

export interface CancelMsg {
  t: 'cancel';
  id: number;
}

export type ToWorker = InitMsg | PatchMsg | RequestMsg | CancelMsg;

export interface FieldMsg {
  t: 'field';
  id: number;
  goal: number;
  dir: Uint8Array;
  dist: Uint16Array;
  /** false si el origen no conecta con la meta. */
  reachable: boolean;
  /** Milisegundos que costo calcularlo, para el HUD de rendimiento. */
  ms: number;
}

export interface ReadyMsg {
  t: 'ready';
}

export type FromWorker = FieldMsg | ReadyMsg;
