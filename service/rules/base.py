# agents/rules/base.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from enum import Enum

class InterventionTone(Enum):
    """
    메시지 톤 (확장판)
    
    감정 상황에 따라 적절한 톤을 선택합니다.
    새로운 톤이 필요하면 여기에 추가하세요.
    """
    
    # === 부정 상황 대응 ===
    EMPATHETIC = "empathetic"        # 공감하는 - 연속 부정 감정
    SUPPORTIVE = "supportive"        # 지지하는 - 부정 비율 높음
    CONCERNED = "concerned"          # 걱정하는 - 장기 미기록, 심각한 상황
    COMFORTING = "comforting"        # 위로하는 - 스트레스 상황
    GENTLE = "gentle"                # 부드러운 - 민감한 주제
    
    # === 긍정 상황 대응 ===
    CHEERFUL = "cheerful"            # 밝은 - 긍정 강화
    ENCOURAGING = "encouraging"      # 격려하는 - 개선 추세
    CELEBRATING = "celebrating"      # 축하하는 - 연속 긍정
    PROUD = "proud"                  # 자랑스러운 - 큰 성취
    
    # === 일상/중립 ===
    CURIOUS = "curious"              # 궁금한 - 일반 미기록
    FRIENDLY = "friendly"            # 친근한 - 일상 체크인
    CASUAL = "casual"                # 편안한 - 가벼운 대화
    PLAYFUL = "playful"              # 장난스러운 - 친밀한 관계
    
    # === 기본 ===
    NEUTRAL = "neutral"              # 중립 - 기본값
    
    @classmethod
    def from_context(cls, reason: str, severity: int = 1, context: Dict[str, Any] = None) -> 'InterventionTone':
        """
        상황에 따라 자동으로 톤 선택
        
        Args:
            reason: 개입 이유
            severity: 심각도 (1: 보통, 2: 중간, 3: 심각)
            context: 추가 컨텍스트
        
        Returns:
            적절한 톤
        
        Example:
            >>> tone = InterventionTone.from_context('negative_pattern', severity=2)
            >>> print(tone.value)  # 'supportive'
        """
        context = context or {}
        
        # 규칙별 톤 매핑
        tone_mapping = {
            'negative_pattern': {
                1: cls.SUPPORTIVE,      # 부정 비율 70% → 지지
                2: cls.COMFORTING,      # 부정 비율 80% → 위로
                3: cls.CONCERNED        # 부정 비율 90%+ → 걱정
            },
            'no_recent_record': {
                1: cls.CURIOUS,         # 3일 미기록 → 궁금
                2: cls.FRIENDLY,        # 5일 미기록 → 친근
                3: cls.CONCERNED        # 7일+ 미기록 → 걱정
            },
            'positive_reinforcement': {
                1: cls.ENCOURAGING,     # 긍정 추세 → 격려
                2: cls.CHEERFUL,        # 연속 긍정 → 밝은
                3: cls.CELEBRATING      # 장기 긍정 → 축하
            },
            'schedule_overload': {
                1: cls.SUPPORTIVE,      # 일정 많음 → 지지
                2: cls.COMFORTING,      # 일정+스트레스 → 위로
                3: cls.GENTLE           # 심각한 과부하 → 부드럽게
            },
            'achievement': {
                1: cls.CHEERFUL,        # 작은 성취 → 밝은
                2: cls.CELEBRATING,     # 중간 성취 → 축하
                3: cls.PROUD            # 큰 성취 → 자랑스러운
            },
            'check_in': {
                1: cls.CASUAL,          # 일상 체크 → 편안
                2: cls.FRIENDLY,        # 정기 체크 → 친근
                3: cls.PLAYFUL          # 친밀한 체크 → 장난스럽게
            }
        }
        
        # 매핑에서 톤 선택
        tone = tone_mapping.get(reason, {}).get(severity, cls.NEUTRAL)
        
        return tone
    
    def get_description(self) -> str:
        """톤 설명 반환"""
        descriptions = {
            self.EMPATHETIC: "공감하고 이해하는 톤",
            self.SUPPORTIVE: "든든하게 지지하는 톤",
            self.CONCERNED: "걱정하고 염려하는 톤",
            self.COMFORTING: "따뜻하게 위로하는 톤",
            self.GENTLE: "부드럽고 조심스러운 톤",
            self.CHEERFUL: "밝고 긍정적인 톤",
            self.ENCOURAGING: "힘을 주고 격려하는 톤",
            self.CELEBRATING: "함께 기뻐하고 축하하는 톤",
            self.PROUD: "자랑스러워하는 톤",
            self.CURIOUS: "궁금해하고 관심있는 톤",
            self.FRIENDLY: "친근하고 편안한 톤",
            self.CASUAL: "가볍고 편안한 톤",
            self.PLAYFUL: "장난스럽고 재미있는 톤",
            self.NEUTRAL: "중립적이고 객관적인 톤"
        }
        return descriptions.get(self, "알 수 없는 톤")


class Rule(ABC):
    """
    개입 규칙 추상 클래스
    
    모든 규칙은 이 클래스를 상속받아야 합니다.
    
    Attributes:
        priority: 우선순위 (낮을수록 먼저 실행, 0이 최우선)
        name: 규칙 이름
        last_context: 마지막 평가 컨텍스트 (캐시용)
    """
    
    priority: int = 99  # 기본 낮은 우선순위
    name: str = "base_rule"
    last_context: Optional[Dict[str, Any]] = None  # 추가
    
    @abstractmethod
    async def check(self, context: Dict[str, Any]) -> bool:
        """
        규칙 조건을 확인합니다.
        
        Args:
            context: 판단에 필요한 모든 데이터
        
        Returns:
            True: 규칙 조건 충족 (개입 필요)
            False: 조건 불충족
        """
        pass
    
    @abstractmethod
    def get_reason(self) -> str:
        """
        개입 이유를 반환합니다.
        
        Returns:
            InterventionReason enum 값
        """
        pass
    
    def get_tone(self) -> InterventionTone:
        """
        메시지 톤을 반환합니다.
        
        기본값: NEUTRAL
        Override 권장: 규칙별로 적절한 톤 지정
        
        Returns:
            InterventionTone
        """
        return InterventionTone.NEUTRAL
    
    def get_severity(self, context: Dict[str, Any]) -> int:
        """
        심각도를 계산합니다 (1~3)
        
        Override 가능: 컨텍스트 기반 동적 계산
        
        Args:
            context: 평가 컨텍스트
        
        Returns:
            1: 보통, 2: 중간, 3: 심각
        """
        return 1  # 기본값
    
    def get_template(self) -> str:
        """
        메시지 템플릿 이름을 반환합니다.
        
        Returns:
            템플릿 키 (기본값: 규칙 이름)
        """
        return self.name
    
    def get_context_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        메시지 생성에 필요한 컨텍스트 데이터를 추출합니다.
        
        Args:
            context: 전체 컨텍스트
        
        Returns:
            규칙별 필요 데이터
        """
        return {}
    
    def __repr__(self):
        return f"<{self.__class__.__name__} priority={self.priority}>"