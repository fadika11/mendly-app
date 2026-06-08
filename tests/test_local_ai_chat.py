import requests

from server.services import local_ai_chat as la


# Checks that normal wellbeing message is allowed.
def test_is_in_scope_allows_normal_wellbeing_message():
    assert la.is_in_scope("I feel stressed and overwhelmed today") is True


# Checks that unrelated message is blocked.
def test_is_in_scope_blocks_clearly_unrelated_message():
    assert la.is_in_scope("Tell me about cars and engines") is False


# Checks that prompt includes the AI scope.
def test_build_system_prompt_mentions_scope():
    prompt = la.build_system_prompt().lower()
    assert "mood" in prompt
    assert "not a general-purpose assistant" in prompt


# Checks that prompt includes the AI scope.
def test_ask_local_ai_returns_refusal_without_network_for_blocked_message(monkeypatch):
    called = {"value": False}

    def fake_post(*args, **kwargs):
        called["value"] = True
        raise AssertionError("network should not be called")

    monkeypatch.setattr(requests, "post", fake_post)
    reply = la.ask_local_ai("Tell me about bitcoin", [])
    assert "emotional wellbeing" in reply
    assert called["value"] is False


# Checks local AI returns a normal reply.
def test_ask_local_ai_success(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"message": {"content": "Take one slow breath and name one next step."}}

    monkeypatch.setattr(requests, "post", lambda *a, **k: FakeResponse())
    reply = la.ask_local_ai("I feel anxious today", [])
    assert "slow breath" in reply.lower()


# Checks empty AI reply returns fallback message.
def test_ask_local_ai_empty_content_returns_fallback(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"message": {"content": "   "}}

    monkeypatch.setattr(requests, "post", lambda *a, **k: FakeResponse())
    reply = la.ask_local_ai("I feel low", [])
    assert "could you say a little more" in reply.lower()
