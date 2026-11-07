import os

from hypothesis import settings

# Perfil "a_fondo" para buscar contraejemplos con muchos más casos:
#   HYPOTHESIS_PROFILE=a_fondo pytest tests/test_properties.py
settings.register_profile("a_fondo", max_examples=600, deadline=None)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "default"))
