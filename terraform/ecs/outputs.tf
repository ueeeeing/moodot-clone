# apply 후 확인용 출력값

output "ecs_cluster_name" {
  description = "ECS 클러스터 이름"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS 서비스 이름"
  value       = aws_ecs_service.ai_worker.name
}

output "cloudwatch_log_group" {
  description = "CloudWatch 로그 그룹 이름"
  value       = aws_cloudwatch_log_group.ai_worker.name
}

output "task_definition_family" {
  description = "Task Definition 이름 (콘솔에서 확인용)"
  value       = aws_ecs_task_definition.ai_worker.family
}

# public IP는 task가 실행될 때마다 바뀌므로 아래 CLI로 직접 확인
# aws ecs list-tasks --cluster moodot-cluster --service-name moodot-ai-worker
# aws ecs describe-tasks --cluster moodot-cluster --tasks <TASK_ARN>
# → attachments[].details 에서 networkInterfaceId 확인 후
# aws ec2 describe-network-interfaces --network-interface-ids <ENI_ID>
# → Association.PublicIp 값이 현재 public IP
output "how_to_get_public_ip" {
  description = "ECS task의 public IP 확인 방법"
  value       = "aws ecs list-tasks --cluster ${aws_ecs_cluster.main.name} --service-name ${aws_ecs_service.ai_worker.name} --region ${var.aws_region}"
}
