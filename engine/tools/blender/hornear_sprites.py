"""
Horneado de sprites isometricos desde Blender.

    blender modelo.blend --background --python tools/blender/hornear_sprites.py -- \
        --salida build/sprites --nombre caballero --animaciones andar,atacar,morir,quieto \
        --frames 15 --alto 96

Es el metodo que uso Age of Empires II y sigue siendo el correcto para 2D
isometrico: se modela en 3D, se renderiza con camara ortografica desde ocho
angulos y se empaqueta el resultado en atlas. Las unidades se ven a unos 60 px
de alto, asi que el modelo puede ser muy pobre: importan la silueta y la
lectura de la direccion, no los poligonos.

Dos optimizaciones que no son opcionales:

  1. Solo se renderizan CINCO de las ocho direcciones (E, SE, S, SO, O). Las
     tres restantes (NO, N, NE) se obtienen volteando horizontalmente. Ahorra
     el 37% del render y el 37% del atlas. Este script ya solo genera cinco.

  2. Se renderiza un PASE DE MASCARA aparte: una imagen en blanco y negro
     donde las zonas tenibles con el color del jugador estan en blanco. En el
     juego se pinta el sprite base y encima el de mascara con tint. Una sola
     textura sirve para los ocho jugadores.

Haz la cuenta antes de comprometerte con esto:

    1 unidad x 4 animaciones x 5 direcciones x 15 frames = 300 imagenes
    (x2 por el pase de mascara = 600 archivos por unidad)

Con cinco unidades por faccion y dos facciones son 6.000 imagenes. Si ese
volumen no es asumible, el brief lo dice claro: replantear hacia 3D con
InstancedMesh antes de gastar un mes en arte.
"""

from __future__ import annotations

import argparse
import math
import os
import sys

try:
    import bpy
except ImportError:  # pragma: no cover - solo corre dentro de Blender
    bpy = None


# Las cinco direcciones que se renderizan. Las otras tres salen de voltear.
# El nombre coincide con el indice de octante que usa el motor
# (0 = este, sentido horario en pantalla).
DIRECCIONES = [
    ("e", 0, 0),
    ("se", 45, 1),
    ("s", 90, 2),
    ("so", 135, 3),
    ("o", 180, 4),
]
# indice_octante -> (direccion_renderizada, volteado)
ESPEJADAS = {5: ("so", True), 6: ("s", True), 7: ("se", True)}

# Elevacion de la camara. AoE2 uso ~30 grados. El angulo exacto para una
# proyeccion 2:1 pura es atan(0.5) = 26.565 grados; 30 se ve algo mas "de
# pie" y perdona mejor los modelos pobres. Se deja configurable porque
# cambiarlo despues obliga a rehornear todo.
ELEVACION_POR_DEFECTO = 30.0


def parse_args(argv: list[str]) -> argparse.Namespace:
    if "--" in argv:
        # Blender se come todo lo anterior a "--".
        argv = argv[argv.index("--") + 1 :]
    elif bpy is None:
        # Ejecutado con python a secas, para hacer la cuenta de imagenes.
        argv = argv[1:]
    else:
        argv = []
    p = argparse.ArgumentParser(description="Hornea sprites isometricos desde Blender")
    p.add_argument("--salida", required=True, help="Carpeta de salida")
    p.add_argument("--nombre", required=True, help="Nombre de la unidad (p. ej. caballero)")
    p.add_argument("--animaciones", default="quieto", help="Acciones de Blender separadas por coma")
    p.add_argument("--frames", type=int, default=15, help="Fotogramas por animacion")
    p.add_argument("--alto", type=int, default=96, help="Alto del render en pixeles")
    p.add_argument("--elevacion", type=float, default=ELEVACION_POR_DEFECTO)
    p.add_argument("--objeto", default="", help="Nombre del objeto a rotar (por defecto, el activo)")
    p.add_argument("--solo-cuenta", action="store_true", help="No renderiza: solo dice cuantas imagenes saldrian")
    return p.parse_args(argv)


def cuenta_imagenes(animaciones: list[str], frames: int) -> int:
    """Numero de archivos, contando el pase de mascara."""
    return len(animaciones) * len(DIRECCIONES) * frames * 2


def preparar_camara(scene, elevacion: float, alto: int) -> None:
    cam_data = bpy.data.cameras.new("CamaraIso")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.6
    cam = bpy.data.objects.new("CamaraIso", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    # Camara fija: lo que rota es el objeto. Asi el encuadre no cambia entre
    # direcciones y los sprites quedan alineados sin recortar a mano.
    dist = 8.0
    rad = math.radians(elevacion)
    cam.location = (0.0, -dist * math.cos(rad), dist * math.sin(rad))
    cam.rotation_euler = (math.radians(90.0) - rad, 0.0, 0.0)

    scene.render.resolution_x = alto
    scene.render.resolution_y = alto
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    # Sin antialias agresivo: el atlas se muestrea con filtro nearest y el
    # borde semitransparente ensucia la silueta.
    scene.render.filter_size = 0.8


def material_mascara() -> "bpy.types.Material":
    """Material emisivo blanco para el pase de color de jugador."""
    mat = bpy.data.materials.new("MascaraJugador")
    mat.use_nodes = True
    nodos = mat.node_tree.nodes
    nodos.clear()
    salida = nodos.new("ShaderNodeOutputMaterial")
    emision = nodos.new("ShaderNodeEmission")
    emision.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    emision.inputs[1].default_value = 1.0
    mat.node_tree.links.new(emision.outputs[0], salida.inputs[0])
    return mat


def material_negro() -> "bpy.types.Material":
    mat = bpy.data.materials.new("SinColorJugador")
    mat.use_nodes = True
    nodos = mat.node_tree.nodes
    nodos.clear()
    salida = nodos.new("ShaderNodeOutputMaterial")
    emision = nodos.new("ShaderNodeEmission")
    emision.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
    mat.node_tree.links.new(emision.outputs[0], salida.inputs[0])
    return mat


def render(scene, ruta: str) -> None:
    scene.render.filepath = ruta
    bpy.ops.render.render(write_still=True)


def main() -> int:
    args = parse_args(sys.argv)
    animaciones = [a.strip() for a in args.animaciones.split(",") if a.strip()]
    total = cuenta_imagenes(animaciones, args.frames)

    print(f"[hornear] unidad '{args.nombre}'")
    print(f"[hornear] {len(animaciones)} animaciones x {len(DIRECCIONES)} direcciones "
          f"x {args.frames} frames x 2 pases = {total} imagenes")
    print("[hornear] direcciones espejadas en tiempo de ejecucion: "
          + ", ".join(f"{k}<-{v[0]}" for k, v in ESPEJADAS.items()))
    if args.solo_cuenta:
        return 0
    if bpy is None:
        print("[hornear] este script tiene que ejecutarse dentro de Blender", file=sys.stderr)
        return 1

    scene = bpy.context.scene
    obj = bpy.data.objects.get(args.objeto) if args.objeto else bpy.context.active_object
    if obj is None:
        print("[hornear] no hay objeto que rotar", file=sys.stderr)
        return 1

    preparar_camara(scene, args.elevacion, args.alto)
    os.makedirs(args.salida, exist_ok=True)

    rot_original = tuple(obj.rotation_euler)
    materiales_originales = [s.material for s in obj.material_slots]
    mascara = material_mascara()

    for anim in animaciones:
        accion = bpy.data.actions.get(anim)
        if accion is not None and obj.animation_data is not None:
            obj.animation_data.action = accion
        for nombre_dir, grados, octante in DIRECCIONES:
            obj.rotation_euler = (rot_original[0], rot_original[1], rot_original[2] + math.radians(grados))
            for f in range(args.frames):
                if accion is not None:
                    span = accion.frame_range[1] - accion.frame_range[0]
                    scene.frame_set(int(accion.frame_range[0] + (span * f) / max(1, args.frames - 1)))
                base = os.path.join(args.salida, f"{args.nombre}_{anim}_{octante}_{f:02d}")
                # Pase 1: el sprite tal cual.
                for i, slot in enumerate(obj.material_slots):
                    slot.material = materiales_originales[i]
                render(scene, base + "_base.png")
                # Pase 2: mascara de color de jugador. Las ranuras cuyo
                # material se llame "jugador*" salen en blanco; el resto, negro.
                negro = material_negro()
                for i, slot in enumerate(obj.material_slots):
                    orig = materiales_originales[i]
                    tenible = orig is not None and orig.name.lower().startswith("jugador")
                    slot.material = mascara if tenible else negro
                render(scene, base + "_mask.png")

    obj.rotation_euler = rot_original
    for i, slot in enumerate(obj.material_slots):
        slot.material = materiales_originales[i]
    print(f"[hornear] listo -> {args.salida}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
