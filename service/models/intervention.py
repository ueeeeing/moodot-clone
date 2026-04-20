
"""
Intervention 모델 (최소 버전)
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from enum import Enum


class InterventionStatus(Enum):
    """개입 상태"""
    PENDING = "pending"
    SHOWN = "shown"
    INTERACTED = "interacted"
    DISMISSED = "dismissed"


class InterventionReason(Enum):
    """개입 이유"""
    NO_RECENT_RECORD = "no_recent_record"
    NEGATIVE_PATTERN = "negative_pattern"
    POSITIVE_REINFORCEMENT = "positive_reinforcement"


class MessageType(Enum):
    """메시지 유형 — 피드백 수집 대상 분류"""
    EMPATHY = "empathy"           # 부정 감정 패턴 공감
    ENCOURAGEMENT = "encouragement"  # 긍정 패턴 격려
    CHECKIN = "checkin"           # 장기 미기록 안부

REASON_TO_MESSAGE_TYPE: dict[str, str] = {
    "negative_pattern":      MessageType.EMPATHY.value,
    "negative_ratio":        MessageType.EMPATHY.value,
    "positive_reinforcement": MessageType.ENCOURAGEMENT.value,
    "no_recent_record":      MessageType.CHECKIN.value,
}


@dataclass
class Intervention:
    """
    개입 모델 (최소 버전)

    필수 필드만 포함. 나중에 필요하면 추가 가능.
    """
    # 필수 필드
    user_id: str
    reason: str
    message: str

    # 선택 필드
    id: Optional[str] = None
    status: str = InterventionStatus.PENDING.value
    message_type: Optional[str] = None
    created_at: Optional[datetime] = None

    def to_db_dict(self):
        """DB 저장용 딕셔너리 변환"""
        return {
            'user_id': self.user_id,
            'reason': self.reason,
            'message': self.message,
            'status': self.status,
            'message_type': self.message_type,
        }

    @classmethod
    def from_db_dict(cls, data: dict) -> 'Intervention':
        """DB 데이터에서 객체 생성"""
        return cls(
            id=data.get('id'),
            user_id=data['user_id'],
            reason=data['reason'],
            message=data['message'],
            status=data.get('status', 'pending'),
            message_type=data.get('message_type'),
            created_at=data.get('created_at')
        )
    
    def __repr__(self):
        return f"Intervention(id={self.id}, reason={self.reason}, status={self.status})"
