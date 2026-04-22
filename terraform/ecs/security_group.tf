resource "aws_security_group" "ai_worker" {
  name        = "${var.project}-ai-worker-sg"
  description = "AI Worker ECS task security group"
  vpc_id      = var.vpc_id

  # Vercel → AI Worker HTTP 요청 허용 (8000 포트)
  # Vercel의 outbound IP가 고정되지 않으므로 0.0.0.0/0 허용
  ingress {
    description = "AI Worker HTTP"
    from_port   = var.container_port
    to_port     = var.container_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # 외부 호출 전체 허용
  # - ECR 이미지 pull
  # - OpenAI API 호출
  # - Supabase 호출
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project = var.project
  }
}
