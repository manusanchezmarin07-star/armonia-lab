from app.application import assistant_service as svc
from app.infrastructure.ollama_client import OllamaClient


class FakeLLM(OllamaClient):
    """Simula Ollama para comprobar qué se le envía sin tener el modelo."""

    def __init__(self):
        super().__init__()
        self.sent = []

    def status(self):
        return {"available": True, "models": ["fake"], "model": "fake", "model_ready": True}

    def chat(self, messages, temperature=0.2, max_tokens=900):
        self.sent.append(messages)
        if max_tokens == 3:  # clasificador
            return "NO"
        return "respuesta simulada [1]"


class Offline(OllamaClient):
    def status(self):
        return {"available": False, "models": [], "model": "x", "model_ready": False}


def ask(q, llm=None):
    return svc.answer([{"role": "user", "content": q}], llm=llm or Offline())


def test_rejects_non_music():
    r = ask("¿Me das una receta de arroz con pollo?")
    assert r["mode"] == "rechazo"
    r = ask("¿Me das una receta de arroz con pollo?", FakeLLM())
    assert r["mode"] == "rechazo"


def test_bot_mode_answers_from_knowledge():
    r = ask("¿Qué es la armonía negativa?")
    assert r["mode"] == "bot"
    assert any("negativa" in s["title"].lower() for s in r["sources"])


def test_extract_chords_latin_and_solfege():
    syms = [c.symbol for c in svc.extract_chords("¿Por qué Sol7 va a Do? ¿Y Dm7 G7 Cmaj7? La nota Mi")]
    assert syms[:3] == ["Dm7", "G7", "Cmaj7"] and "G7" in syms and "C" not in syms
    assert [c.symbol for c in svc.extract_chords("el acorde de La menor")] == ["A"]
    assert svc.extract_chords("A veces toco en E") == []


def test_extract_key():
    assert svc.extract_key("en Do mayor").name == "C mayor"
    assert svc.extract_key("en la tonalidad de Mi bemol").name == "Eb mayor"
    assert svc.extract_key("en La menor").name == "A menor"


def test_facts_are_computed_by_engine():
    facts = svc.compute_facts("¿Cuál es la armonía negativa de G7 en Do mayor?")
    assert any("G - B - D - F" in f for f in facts)
    assert any("Dm7b5" in f and "Fm6" in f for f in facts)


def test_llm_receives_verified_facts_and_context():
    llm = FakeLLM()
    r = ask("¿Cómo funciona el sustituto tritonal de G7 en Do mayor?", llm)
    assert r["mode"] == "ia"
    prompt = llm.sent[-1][-1]["content"]
    assert "HECHOS VERIFICADOS" in prompt and "G7" in prompt and "CONTEXTO" in prompt
    assert "Solo hablas de música" in llm.sent[-1][0]["content"]


def test_off_topic_follow_up_is_rejected():
    history = [{"role": "user", "content": "¿Qué es el modo dórico?"}, {"role": "assistant", "content": "..."}]
    r = svc.answer(history + [{"role": "user", "content": "¿Me das una receta de paella?"}], llm=Offline())
    assert r["mode"] == "rechazo"
    r = svc.answer(history + [{"role": "user", "content": "¿Y por qué?"}], llm=Offline())
    assert r["mode"] == "bot"
