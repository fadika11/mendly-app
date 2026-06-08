import os
from typing import List, Literal, TypedDict

import requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3")

ALLOWED_TOPICS = [
    "mood",
    "anxiety",
    "stress",
    "sadness",
    "low mood",
    "motivation",
    "sleep",
    "burnout",
    "overthinking",
    "panic",
    "lonely",
    "self-esteem",
    "confidence",
    "routine",
    "habits",
    "coping",
    "emotions",
    "wellbeing",
    "therapy",
    "psychology",
    "mental health",
    "breathing",
    "grounding",
    "relationships",
    "school stress",
    "work stress",
    "feeling overwhelmed",
    "journal",
    "check-in",
    "Mendly",
]

REFUSAL_MESSAGE = (
    "I’m here only for emotional wellbeing, mood, stress, anxiety, coping, "
    "and other Mendly-related support topics. I can’t help with unrelated topics here. "
    "Try asking about how you feel, stress, sleep, motivation, routines, or coping strategies."
)


class ChatMessage(TypedDict):
    role: Literal["user", "assistant"]
    content: str


def is_in_scope(message: str) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return False

    blocked_keywords = [
        "car", "cars", "engine", "football", "soccer", "basketball",
        "iphone", "android phone", "laptop", "gpu", "python code",
        "javascript", "bug", "programming", "politics", "election",
        "bitcoin", "crypto", "stock market", "recipe", "cooking",
        "hotel", "flight", "weather"
    ]

    if any(keyword in text for keyword in blocked_keywords):
        return False

    return True


def build_system_prompt() -> str:
    return (
        "You are Mendly, a supportive emotional wellbeing assistant inside a mental wellness app. "
        "You only answer questions related to mood, stress, anxiety, sleep, coping, daily routines, "
        "motivation, self-reflection, burnout, loneliness, relationships, and general psychology-style wellbeing support. "
        "You are not a general-purpose assistant here. "
        "If the user asks about unrelated topics like cars, sports, shopping, politics, programming, or random trivia, "
        "politely refuse and say this chat is only for Mendly wellbeing support. "
        "Keep answers warm, clear, and practical. "
        "Do not diagnose. "
        "Do not give emergency or crisis instructions. "
        "Prefer short supportive answers with one or two useful next steps."
    )


def ask_local_ai(message: str, history: List[ChatMessage]) -> str:
    if not is_in_scope(message):
        return REFUSAL_MESSAGE

    messages = [{"role": "system", "content": build_system_prompt()}]
    messages.extend(history[-12:])
    messages.append({"role": "user", "content": message})

    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "keep_alive": "10m",
        "options": {
            "temperature": 0.6,
            "num_predict": 220,
        },
    }

    resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()

    content = (
        data.get("message", {}).get("content", "").strip()
        if isinstance(data, dict)
        else ""
    )

    return content or "I’m here with you. Could you say a little more about how you’re feeling?"