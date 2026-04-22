# ECS Task Execution Role
# - ECR에서 이미지를 pull하는 권한
# - CloudWatch Logs에 로그를 쓰는 권한
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# AWS 관리형 정책 연결 (ECR pull + CloudWatch Logs 쓰기)
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role
# - 컨테이너 안에서 실행되는 애플리케이션이 AWS 서비스를 사용할 때 필요
# - 현재 AI Worker는 AWS 서비스를 직접 호출하지 않으므로 기본 정책만 연결
resource "aws_iam_role" "ecs_task" {
  name = "${var.project}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}
