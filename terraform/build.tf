provider "aws" {
  profile = "me"
  region  = "us-east-1"
}

# Create IAM user
resource "aws_iam_user" "docker_builder" {
  name = "docker_builder"
  path = "/system/"
}

# Create access key for the user
resource "aws_iam_access_key" "docker_builder_user_key" {
  user = aws_iam_user.docker_builder.name
}

# Create IAM policy for ECR, ECS, and S3 access
resource "aws_iam_policy" "docker_builder_policy" {
  name        = "Docker_builder-policy"
  path        = "/"
  description = "IAM policy for Docker_builder user with ECR, ECS, and S3 access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:*",
          "ecs:*",
          "s3:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach the policy to the user
resource "aws_iam_user_policy_attachment" "docker_builder_policy_attach" {
  user       = aws_iam_user.docker_builder.name
  policy_arn = aws_iam_policy.docker_builder_policy.arn
}

# Output the access key and secret
output "access_key_id" {
  value     = aws_iam_access_key.docker_builder_user_key.id
  sensitive = true
}

output "secret_access_key" {
  value     = aws_iam_access_key.docker_builder_user_key.secret
  sensitive = true
}

###########################################################
#                     S3                                  #
###########################################################


resource "aws_s3_bucket" "hostify-output-projects" {
  bucket        = "hostify-output-projects"
  force_destroy = true
}


resource "aws_s3_bucket_ownership_controls" "hostify_bucket_ownership" {
  bucket = aws_s3_bucket.hostify-output-projects.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}


resource "aws_s3_bucket_public_access_block" "hostify_bucket_access" {
  bucket = aws_s3_bucket.hostify-output-projects.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_acl" "hostify_bucket_acl" {
  bucket = aws_s3_bucket.hostify-output-projects.id
  acl    = "public-read"
  depends_on = [
    aws_s3_bucket_ownership_controls.hostify_bucket_ownership,
    aws_s3_bucket_public_access_block.hostify_bucket_access
  ]
}


resource "aws_s3_bucket_policy" "public_read_policy" {
  bucket = aws_s3_bucket.hostify-output-projects.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowWebAccess"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.hostify-output-projects.arn}/*"
      },
    ]
  })
}


###########################################################
#                     ECR                                  #
###########################################################

resource "aws_ecr_repository" "builder_server" {
  name                 = "hostify-builder-server" # Replace with your desired repository name
  image_tag_mutability = "MUTABLE"                # vulnerabilities

  image_scanning_configuration {
    scan_on_push = true # scans for vulnerabilities
  }
}


resource "aws_ecr_repository_policy" "builder_repo_policy" {
  repository = aws_ecr_repository.builder_server.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPushPull"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::533267046219:user/docker-builder" # Be cautious with this. It's better to specify exact ARNs.
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

output "ecr_repository_url" {
  value = aws_ecr_repository.builder_server.repository_url
}





###########################################################
#                     ECS                                  #
###########################################################


resource "aws_ecs_cluster" "hostify_cluster" {
  name = "hostify_cluster" # Replace with your desired cluster name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = "production"
    Project     = "Hostify"
  }
}

resource "aws_ecs_cluster_capacity_providers" "hostify_cluster_capacity" {
  cluster_name = aws_ecs_cluster.hostify_cluster.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

output "cluster_arn" {
  value       = aws_ecs_cluster.hostify_cluster.arn
  description = "ARN of the ECS Cluster"
}

output "cluster_name" {
  value       = aws_ecs_cluster.hostify_cluster.name
  description = "Name of the ECS Cluster"
}
