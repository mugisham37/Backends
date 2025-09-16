# Main Terraform configuration for SaaS Platform

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "saas-platform-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "saas-platform-terraform-locks"
  }

  required_version = ">= 1.0.0"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "SaaS Platform"
      ManagedBy   = "Terraform"
    }
  }
}

# Random string for password generation
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Create a KMS key for encryption
resource "aws_kms_key" "saas_key" {
  description             = "KMS key for SaaS Platform encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-kms-key"
  }
}

# Create a VPC for the SaaS Platform
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "3.14.0"

  name = "${var.project_name}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "production"
  one_nat_gateway_per_az = var.environment == "production"

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# Create an EKS cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "18.20.5"

  cluster_name    = "${var.project_name}-${var.environment}"
  cluster_version = var.kubernetes_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # EKS Managed Node Group(s)
  eks_managed_node_group_defaults = {
    disk_size      = 50
    instance_types = ["t3.medium"]
  }

  eks_managed_node_groups = {
    general = {
      min_size     = var.min_node_count
      max_size     = var.max_node_count
      desired_size = var.desired_node_count

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"
      labels = {
        role = "general"
      }
    }

    # Conditionally create a high-performance node group for production
    high_performance = var.environment == "production" ? {
      min_size     = 2
      max_size     = 10
      desired_size = 2

      instance_types = ["c5.xlarge"]
      capacity_type  = "ON_DEMAND"
      labels = {
        role = "high-performance"
      }
    } : null
  }

  # Enable OIDC provider for service accounts
  cluster_identity_providers = [
    {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-node", "kube-system:cluster-autoscaler"]
    }
  ]

  # Enable cluster autoscaler
  cluster_autoscaler = {
    create_role = true
  }

  tags = {
    Name = "${var.project_name}-eks-cluster"
  }
}

# Create an RDS PostgreSQL instance
module "db" {
  source  = "terraform-aws-modules/rds/aws"
  version = "4.4.0"

  identifier = "${var.project_name}-${var.environment}-db"

  engine               = "postgres"
  engine_version       = "14.3"
  family               = "postgres14"
  major_engine_version = "14"
  instance_class       = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result
  port     = 5432

  multi_az               = var.environment == "production"
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]

  maintenance_window              = "Mon:00:00-Mon:03:00"
  backup_window                   = "03:00-06:00"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  create_cloudwatch_log_group     = true

  backup_retention_period = var.environment == "production" ? 30 : 7
  skip_final_snapshot     = var.environment != "production"
  deletion_protection     = var.environment == "production"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  create_monitoring_role                = true
  monitoring_interval                   = 60

  parameters = [
    {
      name  = "autovacuum"
      value = 1
    },
    {
      name  = "client_encoding"
      value = "utf8"
    }
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-db"
  }
}

# Create a DB subnet group
resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# Create a security group for the database
resource "aws_security_group" "db" {
  name        = "${var.project_name}-${var.environment}-db-sg"
  description = "Security group for ${var.project_name} database"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-db-sg"
  }
}

# Create an ElastiCache Redis cluster
module "redis" {
  source  = "cloudposse/elasticache-redis/aws"
  version = "0.40.1"

  name                          = "${var.project_name}-${var.environment}-redis"
  vpc_id                        = module.vpc.vpc_id
  subnets                       = module.vpc.private_subnets
  cluster_size                  = var.environment == "production" ? 3 : 1
  instance_type                 = var.redis_instance_type
  apply_immediately             = true
  automatic_failover_enabled    = var.environment == "production"
  multi_az_enabled              = var.environment == "production"
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  auth_token                    = random_password.redis_auth_token.result
  engine_version                = "6.x"
  family                        = "redis6.x"
  port                          = 6379
  maintenance_window            = "sun:05:00-sun:07:00"
  snapshot_window               = "03:00-05:00"
  snapshot_retention_limit      = var.environment == "production" ? 7 : 1
  security_group_ids            = [aws_security_group.redis.id]
  allowed_security_group_ids    = [module.eks.cluster_security_group_id]
  parameter_group_description   = "${var.project_name} Redis parameter group"
  security_group_description    = "${var.project_name} Redis security group"

  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}

# Generate a random auth token for Redis
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

# Create a security group for Redis
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  description = "Security group for ${var.project_name} Redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Redis from EKS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  }
}

# Create an S3 bucket for file storage
module "s3_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "3.3.0"

  bucket = "${var.project_name}-${var.environment}-storage"
  acl    = "private"

  versioning = {
    enabled = true
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        kms_master_key_id = aws_kms_key.saas_key.arn
        sse_algorithm     = "aws:kms"
      }
    }
  }

  lifecycle_rule = [
    {
      id      = "log"
      enabled = true
      prefix  = "log/"

      transition = [
        {
          days          = 30
          storage_class = "STANDARD_IA"
        },
        {
          days          = 60
          storage_class = "GLACIER"
        }
      ]

      expiration = {
        days = 90
      }
    }
  ]

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  tags = {
    Name = "${var.project_name}-${var.environment}-storage"
  }
}

# Create an IAM policy for S3 access
resource "aws_iam_policy" "s3_access" {
  name        = "${var.project_name}-${var.environment}-s3-access"
  description = "Policy for accessing the ${var.project_name} S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = [
          module.s3_bucket.s3_bucket_arn,
          "${module.s3_bucket.s3_bucket_arn}/*"
        ]
      }
    ]
  })
}

# Create a CloudFront distribution for the frontend
module "cloudfront" {
  source  = "terraform-aws-modules/cloudfront/aws"
  version = "2.9.3"

  aliases = var.environment == "production" ? ["app.${var.domain_name}"] : []

  comment             = "${var.project_name} ${var.environment} frontend"
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"
  retain_on_delete    = false
  wait_for_deployment = false

  create_origin_access_identity = true
  origin_access_identities = {
    s3_bucket_one = "Access identity for ${var.project_name} frontend bucket"
  }

  origin = {
    s3_frontend = {
      domain_name = module.s3_frontend_bucket.s3_bucket_bucket_regional_domain_name
      s3_origin_config = {
        origin_access_identity = "s3_bucket_one"
      }
    }
  }

  default_cache_behavior = {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3_frontend"

    forwarded_values = {
      query_string = false
      cookies = {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  ordered_cache_behavior = [
    {
      path_pattern     = "/api/*"
      allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods   = ["GET", "HEAD"]
      target_origin_id = "api_gateway"

      forwarded_values = {
        query_string = true
        headers      = ["Authorization", "Origin", "X-Tenant-ID"]
        cookies = {
          forward = "all"
        }
      }

      viewer_protocol_policy = "redirect-to-https"
      min_ttl                = 0
      default_ttl            = 0
      max_ttl                = 0
    }
  ]

  viewer_certificate = {
    acm_certificate_arn      = var.environment == "production" ? aws_acm_certificate.cert[0].arn : null
    ssl_support_method       = var.environment == "production" ? "sni-only" : null
    minimum_protocol_version = var.environment == "production" ? "TLSv1.2_2021" : null
    cloudfront_default_certificate = var.environment != "production"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cloudfront"
  }
}

# Create an S3 bucket for the frontend
module "s3_frontend_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "3.3.0"

  bucket = "${var.project_name}-${var.environment}-frontend"
  acl    = "private"

  versioning = {
    enabled = true
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
    }
  }

  website = {
    index_document = "index.html"
    error_document = "index.html"
  }

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  tags = {
    Name = "${var.project_name}-${var.environment}-frontend"
  }
}

# Create an ACM certificate for the domain (only in production)
resource "aws_acm_certificate" "cert" {
  count = var.environment == "production" ? 1 : 0

  domain_name       = "*.${var.domain_name}"
  validation_method = "DNS"

  subject_alternative_names = [var.domain_name]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cert"
  }
}

# Create a Route53 zone for the domain (only in production)
resource "aws_route53_zone" "main" {
  count = var.environment == "production" ? 1 : 0

  name = var.domain_name

  tags = {
    Name = "${var.project_name}-${var.environment}-zone"
  }
}

# Create Route53 records for certificate validation (only in production)
resource "aws_route53_record" "cert_validation" {
  count = var.environment == "production" ? length(aws_acm_certificate.cert[0].domain_validation_options) : 0

  zone_id = aws_route53_zone.main[0].zone_id
  name    = element(aws_acm_certificate.cert[0].domain_validation_options.*.resource_record_name, count.index)
  type    = element(aws_acm_certificate.cert[0].domain_validation_options.*.resource_record_type, count.index)
  records = [element(aws_acm_certificate.cert[0].domain_validation_options.*.resource_record_value, count.index)]
  ttl     = 60
}

# Create a Route53 record for the CloudFront distribution (only in production)
resource "aws_route53_record" "app" {
  count = var.environment == "production" ? 1 : 0

  zone_id = aws_route53_zone.main[0].zone_id
  name    = "app.${var.domain_name}"
  type    = "A"

  alias {
    name                   = module.cloudfront.cloudfront_distribution_domain_name
    zone_id                = module.cloudfront.cloudfront_distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

# Create a Route53 record for the API (only in production)
resource "aws_route53_record" "api" {
  count = var.environment == "production" ? 1 : 0

  zone_id = aws_route53_zone.main[0].zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

# Create an Application Load Balancer for the API
resource "aws_lb" "api" {
  name               = "${var.project_name}-${var.environment}-api-lb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.api_lb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "production"

  access_logs {
    bucket  = module.s3_bucket.s3_bucket_id
    prefix  = "lb-logs"
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-lb"
  }
}

# Create a security group for the API load balancer
resource "aws_security_group" "api_lb" {
  name        = "${var.project_name}-${var.environment}-api-lb-sg"
  description = "Security group for ${var.project_name} API load balancer"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from anywhere (for redirect)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-lb-sg"
  }
}

# Create a target group for the API gateway
resource "aws_lb_target_group" "api_gateway" {
  name     = "${var.project_name}-${var.environment}-api-gateway"
  port     = 80
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    enabled             = true
    interval            = 30
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-gateway"
  }
}

# Create an HTTPS listener for the API load balancer
resource "aws_lb_listener" "api_https" {
  count = var.environment == "production" ? 1 : 0

  load_balancer_arn = aws_lb.api.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = aws_acm_certificate.cert[0].arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_gateway.arn
  }
}

# Create an HTTP listener for the API load balancer (redirects to HTTPS)
resource "aws_lb_listener" "api_http" {
  load_balancer_arn = aws_lb.api.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Create a Secrets Manager secret for database credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}/${var.environment}/db-credentials"
  description = "Database credentials for ${var.project_name} ${var.environment}"
  kms_key_id  = aws_kms_key.saas_key.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-db-credentials"
  }
}

# Create a Secrets Manager secret version for database credentials
resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    engine   = "postgres"
    host     = module.db.db_instance_address
    port     = 5432
    dbname   = var.db_name
  })
}

# Create a Secrets Manager secret for Redis credentials
resource "aws_secretsmanager_secret" "redis_credentials" {
  name        = "${var.project_name}/${var.environment}/redis-credentials"
  description = "Redis credentials for ${var.project_name} ${var.environment}"
  kms_key_id  = aws_kms_key.saas_key.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-credentials"
  }
}

# Create a Secrets Manager secret version for Redis credentials
resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    host     = module.redis.endpoint
    port     = 6379
    password = random_password.redis_auth_token.result
  })
}

# Create a Secrets Manager secret for JWT
resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.project_name}/${var.environment}/jwt-secret"
  description = "JWT secret for ${var.project_name} ${var.environment}"
  kms_key_id  = aws_kms_key.saas_key.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-jwt-secret"
  }
}

# Create a Secrets Manager secret version for JWT
resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id
  secret_string = jsonencode({
    secret            = random_password.jwt_secret.result
    accessTokenExpiry = "15m"
    refreshTokenExpiry = "7d"
  })
}

# Generate a random JWT secret
resource "random_password" "jwt_secret" {
  length  = 32
  special = true
}

# Output the database connection string
output "database_url" {
  description = "The connection string for the database"
  value       = "postgresql://${var.db_username}:${random_password.db_password.result}@${module.db.db_instance_address}:5432/${var.db_name}"
  sensitive   = true
}

# Output the Redis connection string
output "redis_url" {
  description = "The connection string for Redis"
  value       = "redis://:${random_password.redis_auth_token.result}@${module.redis.endpoint}:6379"
  sensitive   = true
}

# Output the S3 bucket name
output "s3_bucket_name" {
  description = "The name of the S3 bucket"
  value       = module.s3_bucket.s3_bucket_id
}

# Output the CloudFront distribution domain name
output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = module.cloudfront.cloudfront_distribution_domain_name
}

# Output the API load balancer domain name
output "api_lb_domain_name" {
  description = "The domain name of the API load balancer"
  value       = aws_lb.api.dns_name
}

# Output the EKS cluster name
output "eks_cluster_name" {
  description = "The name of the EKS cluster"
  value       = module.eks.cluster_name
}

# Output the EKS cluster endpoint
output "eks_cluster_endpoint" {
  description = "The endpoint for the EKS cluster"
  value       = module.eks.cluster_endpoint
}

# Output the Secrets Manager secret ARNs
output "db_credentials_secret_arn" {
  description = "The ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "redis_credentials_secret_arn" {
  description = "The ARN of the Redis credentials secret"
  value       = aws_secretsmanager_secret.redis_credentials.arn
}

output "jwt_secret_arn" {
  description = "The ARN of the JWT secret"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}
