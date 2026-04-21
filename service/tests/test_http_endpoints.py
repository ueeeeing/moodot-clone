# test_http_endpoints.py
"""
FastAPI HTTP 엔드포인트 테스트
  - GET  /health
  - POST /ai/process
"""
import sys
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture()
def ready_client():
    """lifespan을 mock으로 대체해 _pipeline이 정상 초기화된 TestClient를 반환."""
    mock_pipeline = MagicMock()

    with ExitStack() as stack:
        stack.enter_context(patch("main.acreate_client", new=AsyncMock(return_value=MagicMock())))
        stack.enter_context(patch("main.InterventionRepository", return_value=MagicMock()))
        stack.enter_context(patch("main.RuleEngine", return_value=MagicMock()))
        mock_factory = stack.enter_context(patch("main.LLMFactory"))
        mock_factory.create.return_value = MagicMock(model_name="mock-model")
        stack.enter_context(patch("main.MessageGenerator", return_value=MagicMock()))
        stack.enter_context(patch("main.Pipeline", return_value=mock_pipeline))

        import main
        with TestClient(main.app) as client:
            yield client, mock_pipeline


@pytest.fixture()
def unready_client():
    """startup 후 _pipeline을 강제로 None으로 설정 — worker not ready 상태 재현."""
    mock_pipeline = MagicMock()

    with ExitStack() as stack:
        stack.enter_context(patch("main.acreate_client", new=AsyncMock(return_value=MagicMock())))
        stack.enter_context(patch("main.InterventionRepository", return_value=MagicMock()))
        stack.enter_context(patch("main.RuleEngine", return_value=MagicMock()))
        mock_factory = stack.enter_context(patch("main.LLMFactory"))
        mock_factory.create.return_value = MagicMock(model_name="mock-model")
        stack.enter_context(patch("main.MessageGenerator", return_value=MagicMock()))
        stack.enter_context(patch("main.Pipeline", return_value=mock_pipeline))

        import main
        with TestClient(main.app) as client:
            main._pipeline = None
            yield client


# ─── GET /health ──────────────────────────────────────────────────────────────

def test_health_returns_200(ready_client):
    client, _ = ready_client
    response = client.get("/health")
    assert response.status_code == 200


def test_health_response_body(ready_client):
    client, _ = ready_client
    response = client.get("/health")
    assert response.json() == {"status": "ok"}


# ─── POST /ai/process ─────────────────────────────────────────────────────────

VALID_PAYLOAD = {
    "id": 123,
    "user_id": "test-user-uuid",
    "emotion_id": 2,
    "created_at": "2024-01-01T00:00:00Z",
}


def test_process_accepted(ready_client):
    client, _ = ready_client
    response = client.post("/ai/process", json=VALID_PAYLOAD)
    assert response.status_code == 200
    assert response.json() == {"status": "accepted"}


def test_process_schedules_background_task(ready_client):
    """process_emotion이 BackgroundTask로 등록되는지 확인."""
    client, mock_pipeline = ready_client
    client.post("/ai/process", json=VALID_PAYLOAD)
    # BackgroundTasks가 sync 실행하므로 TestClient 내에서 즉시 호출됨
    mock_pipeline.process_emotion.assert_called_once()
    call_args = mock_pipeline.process_emotion.call_args[0][0]
    assert call_args["record"] == VALID_PAYLOAD


def test_process_worker_not_ready_returns_503(unready_client):
    response = unready_client.post("/ai/process", json=VALID_PAYLOAD)
    assert response.status_code == 503
    assert response.json() == {"error": "worker not ready"}


def test_process_empty_payload(ready_client):
    """빈 페이로드도 accepted — 페이로드 검증은 pipeline 책임."""
    client, _ = ready_client
    response = client.post("/ai/process", json={})
    assert response.status_code == 200
    assert response.json() == {"status": "accepted"}
