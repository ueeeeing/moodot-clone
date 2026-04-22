resource "aws_cloudwatch_log_group" "ai_worker" {
  name              = "/ecs/${var.project}-ai-worker"
  retention_in_days = 30  # 30일 보관 후 자동 삭제 (비용 절감)
}
