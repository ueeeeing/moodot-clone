terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # 실무에서는 state를 S3에 저장합니다.
  # 아래 주석을 풀고 본인 S3 버킷명 / DynamoDB 테이블명을 입력하세요.
  # backend "s3" {
  #   bucket         = "YOUR_TERRAFORM_STATE_BUCKET"
  #   key            = "moodot/ecs/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   dynamodb_table = "YOUR_TERRAFORM_LOCK_TABLE"  # state lock용
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}
