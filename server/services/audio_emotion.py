import os
import tempfile
import logging
import warnings
from pathlib import Path
from typing import Dict, Any, Optional

import librosa
import soundfile as sf

logger = logging.getLogger(__name__)

# Keep noisy libraries quieter
logging.getLogger("speechbrain").setLevel(logging.ERROR)
logging.getLogger("transformers").setLevel(logging.ERROR)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

warnings.filterwarnings("ignore", message=".*torchaudio._backend.list_audio_backends.*")
warnings.filterwarnings("ignore", message=".*gradient_checkpointing.*")
warnings.filterwarnings("ignore", message=".*speechbrain.pretrained.*")

_classifier = None
_classifier_error: Optional[str] = None
_classifier_attempted = False

MAX_AUDIO_SECONDS = 8.0


def _safe_audio_path(path_str: str) -> str:
    """
    Convert Windows temp paths into a normalized absolute path string that
    SpeechBrain / torchaudio can reliably open.
    """
    p = Path(path_str).resolve()
    # Use forward slashes to avoid backend/path parsing issues on Windows
    return p.as_posix()


def _get_classifier():
    global _classifier, _classifier_error, _classifier_attempted

    if _classifier is not None:
        return _classifier

    if _classifier_attempted:
        return None

    _classifier_attempted = True

    try:
        from speechbrain.inference.interfaces import foreign_class
        from speechbrain.utils.fetching import LocalStrategy

        _classifier = foreign_class(
            source="speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
            pymodule_file="custom_interface.py",
            classname="CustomEncoderWav2vec2Classifier",
            savedir=None,
            local_strategy=LocalStrategy.COPY,
        )

        logger.info("[audio service] classifier loaded successfully")
        return _classifier

    except Exception as e:
        _classifier_error = str(e)
        logger.exception("[audio service] classifier load failed: %s", e)
        return None


def preload_classifier() -> bool:
    return _get_classifier() is not None


def map_emotion_to_mendly_state(emotion):
    e = str(emotion or "").strip().lower()

    if e in ("sad", "sadness", "low"):
        return "low_mood_candidate"

    if e in ("angry", "anger", "ang", "fear", "fea", "fearful", "anxious", "stress", "stressed", "frustrated"):
        return "stress_candidate"

    if e in ("happy", "hap", "joy", "positive"):
        return "positive_candidate"

    return "calm_or_neutral"


def normalize_audio_to_wav16k(input_path: str) -> str:
    safe_input = _safe_audio_path(input_path)

    audio, _original_sr = librosa.load(
        safe_input,
        sr=16000,
        mono=True,
        duration=MAX_AUDIO_SECONDS,
    )

    fd, out_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)

    sf.write(out_path, audio, 16000)

    # Return normalized safe absolute path
    return _safe_audio_path(out_path)


def analyze_audio_file(input_path: str) -> Dict[str, Any]:
    classifier = _get_classifier()
    if classifier is None:
        return {
            "ok": False,
            "error": "Audio emotion model is unavailable",
            "detail": _classifier_error,
        }

    normalized_path = normalize_audio_to_wav16k(input_path)

    try:
        _out_prob, score, _index, text_lab = classifier.classify_file(normalized_path)
        print("RAW AUDIO MODEL OUTPUT:")
        print("out_prob:", _out_prob)
        print("score:", score)
        print("index:", _index)
        print("text_lab:", text_lab)

        emotion = (
            str(text_lab[0])
            if hasattr(text_lab, "__len__") and not isinstance(text_lab, str)
            else str(text_lab)
        )
        confidence = float(score[0]) if hasattr(score, "__len__") else float(score)

        mendly_state = map_emotion_to_mendly_state(emotion)

        if mendly_state == "stress_candidate":
            message = "You may sound a bit stressed. Would you like a short breathing exercise?"
        elif mendly_state == "low_mood_candidate":
            message = "You may be having a heavy moment. Would you like to do a quick check-in?"
        elif mendly_state == "positive_candidate":
            message = "You sound a bit brighter right now. Keep going gently."
        else:
            message = "You sound fairly neutral right now."

        return {
            "ok": True,
            "emotion": emotion,
            "confidence": round(confidence, 4),
            "mendly_state": mendly_state,
            "message": message,
        }

    except Exception as e:
        logger.exception("[audio service] classification failed: %s", e)
        return {
            "ok": False,
            "error": "Audio analysis failed",
            "detail": str(e),
        }

    finally:
        try:
            # normalized_path is now posix string; convert back to Path safely
            p = Path(normalized_path)
            if p.exists():
                p.unlink()
        except Exception:
            pass