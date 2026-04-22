# ─── AWS 기본 설정 ────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS 리전"
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "프로젝트 이름 (리소스 이름 prefix로 사용)"
  type        = string
  default     = "moodot"
}

# ─── 네트워크 ─────────────────────────────────────────────────────────────────

variable "vpc_id" {
  description = "ECS Service를 배포할 VPC ID (예: vpc-0abc1234def56789)"
  type        = string
  # ✏️ 직접 입력: AWS 콘솔 → VPC → VPC ID 복사
}

variable "public_subnet_ids" {
  description = "ECS Task를 배포할 public subnet ID 목록 (public IP 할당용)"
  type        = list(string)
  # ✏️ 직접 입력: AWS 콘솔 → VPC → Subnets → public subnet ID 복사
  # 예: ["subnet-0abc123", "subnet-0def456"]
}

# ─── ECR ─────────────────────────────────────────────────────────────────────

variable "ecr_image_uri" {
  description = "ECR 이미지 전체 URI (태그 포함)"
  type        = string
  # ✏️ 직접 입력: 예) 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/moodot-ai-worker:sha-abc1234
}

# ─── ECS 컨테이너 설정 ────────────────────────────────────────────────────────

variable "container_port" {
  description = "AI Worker가 사용하는 포트"
  type        = number
  default     = 8000
}

variable "task_cpu" {
  description = "Fargate task CPU 단위 (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Fargate task 메모리 (MB)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "실행할 ECS task 수. 0으로 설정하면 서비스 중단 (비용 절감)"
  type        = number
  default     = 1
}

# ─── AI Worker 환경변수 ───────────────────────────────────────────────────────

variable "llm_provider" {
  description = "LLM 프로바이더 (openai 또는 ollama)"
  type        = string
  default     = "openai"
}

variable "openai_api_key" {
  description = "OpenAI API 키"
  type        = string
  sensitive   = true
  # ✏️ 직접 입력: terraform.tfvars에 넣거나 TF_VAR_openai_api_key 환경변수로 주입
}

variable "openai_model" {
  description = "사용할 OpenAI 모델명"
  type        = string
  default     = "gpt-4o-mini"
}

variable "supabase_url" {
  description = "Supabase 프로젝트 URL"
  type        = string
  # ✏️ 직접 입력: 예) https://xxxxxxxxxxxx.supabase.co
}

variable "supabase_service_key" {
  description = "Supabase service_role 키 (RLS 우회용, 절대 프론트에 노출 금지)"
  type        = string
  sensitive   = true
  # ✏️ 직접 입력: terraform.tfvars에 넣거나 TF_VAR_supabase_service_key 환경변수로 주입
}

variable "memory_text_encryption_key" {
  description = "메모리 텍스트 암호화 키 (Next.js 앱과 동일한 값)"
  type        = string
  sensitive   = true
  # ✏️ 직접 입력: Next.js .env.local의 MEMORY_TEXT_ENCRYPTION_KEY와 동일한 값
}
