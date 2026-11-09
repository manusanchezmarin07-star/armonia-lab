"""Guitarra flamenca: tonos, cadencia andaluza y compás con rasgueo."""
import pytest

from app.domain.chords import parse_symbol
from app.domain.flamenco import RASGUEOS, TONOS, compas
from app.domain.transpose import transpose


def test_por_arriba_y_por_medio():
    t = {x["id"]: x for x in TONOS}
    assert t["arriba"]["cadence"] == ["Am", "G", "F", "E"]
    assert t["medio"]["cadence"] == ["Dm", "C", "Bb", "A"]


@pytest.mark.parametrize("tono", TONOS)
def test_cadencia_andaluza_es_la_misma_en_cada_tono(tono):
    """iv–III–II♭–I del modo de Mi: la de «por arriba» transportada a la tónica del tono."""
    shift = (parse_symbol(tono["tonic"]).root.pc - 4) % 12
    expected = transpose(" ".join(["Am", "G", "F", "E"]), semitones=shift)["chords"]
    assert [parse_symbol(c).pcs for c in tono["cadence"]] == [parse_symbol(c).pcs for c in expected]


def test_rasgueo_continuo_usa_cuatro_dedos_hacia_abajo():
    r = next(x for x in RASGUEOS if x["id"] == "continuo4")
    assert [s["f"] for s in r["strokes"]] == ["c", "a", "m", "i"] and all(s["dir"] == "down" for s in r["strokes"])


def test_solea_acentos_y_reposo():
    c = compas("solea", "arriba")
    assert [b["count"] for b in c["beats"] if b["accent"]] == [3, 6, 8, 10, 12]
    by_count = {b["count"]: b["chord"] for b in c["beats"]}
    assert by_count[1] == "Am" and by_count[10] == "E" and by_count[12] == "E"
    assert all(b["strokes"][0]["golpe"] for b in c["beats"] if b["accent"])
    assert set(c["shapes"]) == {"Am", "G", "F", "E"} and c["shapes"]["E"]["diagram"] == "022100"


def test_buleria_empieza_a_contar_en_12():
    c = compas("buleria", "medio")
    assert c["beats"][0]["count"] == 12 and c["beats"][0]["chord"] == "A"  # el 12 es reposo
    assert c["beats"][1]["count"] == 1 and c["beats"][1]["chord"] == "Dm"


def test_alegrias_es_mayor_y_tangos_ocupa_cuatro_ciclos():
    assert {b["chord"] for b in compas("alegrias", "arriba")["beats"]} == {"E", "B7"}
    t = compas("tangos", "arriba")
    assert len(t["beats"]) == 16 and [t["beats"][i]["chord"] for i in (0, 4, 8, 12)] == ["Am", "G", "F", "E"]


def test_estilo_continuo_en_los_acentos_y_cejilla():
    c = compas("solea", "arriba", style="continuo", capo=2)
    acc = next(b for b in c["beats"] if b["accent"])
    assert [s["f"] for s in acc["strokes"]] == ["c", "a", "m", "i"]
    assert c["shapes"]["E"]["capo"] == 2 and c["shapes"]["E"]["shape_of"] == "D"


@pytest.mark.parametrize("bad", [("nada", "arriba", "basico"), ("solea", "nada", "basico"), ("solea", "arriba", "nada")])
def test_errores(bad):
    with pytest.raises(ValueError):
        compas(*bad)
