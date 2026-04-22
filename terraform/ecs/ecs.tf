# ─── ECS Cluster ─────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${var.project}-cluster"

  # Container Insights: 클러스터 수준 메트릭 수집 (비용 발생 — 필요 없으면 "disabled")
  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

# ─── ECS Task Definition ──────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "ai_worker" {
  family                   = "${var.project}-ai-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"  # Fargate는 awsvpc 고정
  cpu                      = var.task_cpu
  memory                   = var.task_memory

  execution_role_arn = aws_iam_role.ecs_task_execution.arn  # ECR pull + CW Logs
  task_role_arn      = aws_iam_role.ecs_task.arn            # 컨테이너 내 앱 권한

  container_definitions = jsonencode([
    {
      name      = "ai-worker"
      image     = var.ecr_image_uri
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      # 환경변수 — 평문
      # 실무 팁: 민감 값(API 키 등)은 아래 environment 대신
      # secrets 블록 + AWS SSM Parameter Store 또는 Secrets Manager 사용 권장
      environment = [
        { name = "PORT",                        value = tostring(var.container_port) },
        { name = "LLM_PROVIDER",                value = var.llm_provider },
        { name = "OPENAI_MODEL",                value = var.openai_model },
        { name = "SUPABASE_URL",                value = var.supabase_url },
      ]

      # 민감 환경변수 — SSM Parameter Store에서 주입 (값이 로그에 노출되지 않음)
      # 실무에서 권장하는 방식
      secrets = [
        {
          name      = "OPENAI_API_KEY"
          valueFrom = aws_ssm_parameter.openai_api_key.arn
        },
        {
          name      = "SUPABASE_SERVICE_KEY"
          valueFrom = aws_ssm_parameter.supabase_service_key.arn
        },
        {
          name      = "MEMORY_TEXT_ENCRYPTION_KEY"
          valueFrom = aws_ssm_parameter.memory_text_encryption_key.arn
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ai_worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      # 헬스체크 — /health 엔드포인트 사용
      healthCheck = {
        command     = ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:${var.container_port}/health')\" || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }
    }
  ])

  tags = {
    Project = var.project
  }
}

# ─── SSM Parameter Store (민감 값 보관) ──────────────────────────────────────

resource "aws_ssm_parameter" "openai_api_key" {
  name  = "/${var.project}/ai-worker/OPENAI_API_KEY"
  type  = "SecureString"  # KMS로 암호화
  value = var.openai_api_key
}

resource "aws_ssm_parameter" "supabase_service_key" {
  name  = "/${var.project}/ai-worker/SUPABASE_SERVICE_KEY"
  type  = "SecureString"
  value = var.supabase_service_key
}

resource "aws_ssm_parameter" "memory_text_encryption_key" {
  name  = "/${var.project}/ai-worker/MEMORY_TEXT_ENCRYPTION_KEY"
  type  = "SecureString"
  value = var.memory_text_encryption_key
}

# SSM 읽기 권한을 Task Execution Role에 추가
resource "aws_iam_role_policy" "ecs_ssm_read" {
  name = "${var.project}-ecs-ssm-read"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["ssm:GetParameters", "kms:Decrypt"]
      Resource = [
        aws_ssm_parameter.openai_api_key.arn,
        aws_ssm_parameter.supabase_service_key.arn,
        aws_ssm_parameter.memory_text_encryption_key.arn,
      ]
    }]
  })
}

# ─── ECS Service ─────────────────────────────────────────────────────────────

resource "aws_ecs_service" "ai_worker" {
  name            = "${var.project}-ai-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ai_worker.arn
  launch_type     = "FARGATE"

  # 0으로 설정하면 task가 실행되지 않아 비용 발생 없음
  desired_count = var.desired_count

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [aws_security_group.ai_worker.id]
    assign_public_ip = true  # ALB 없이 직접 접근하므로 필수
  }

  # 새 task가 연속 실패하면 ECS가 직전 성공한 Task Definition으로 자동 복구
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  # task definition이 변경되어도 Terraform이 강제로 재배포하지 않도록 설정
  # CI/CD에서 직접 배포하는 경우 유용
  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = {
    Project = var.project
  }
}
