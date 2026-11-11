import os

from hypothesis import settings

# Perfil "a_fondo" para buscar contraejemplos con muchos más casos:
#   HYPOTHESIS_PROFILE=a_fondo pytest tests/test_properties.py
settings.register_profile("a_fondo", max_examples=600, deadline=None)
# El reconocedor de instrumentos se simula en los tests: que no lance procesos hijo.
os.environ.setdefault("ARMONIA_TAGGER_INPROCESS", "1")
# …y el modelo real no se descarga nunca en los tests (cada test que lo necesita lo simula).
os.environ.setdefault("ARMONIA_TAGGER", "off")
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "default"))
