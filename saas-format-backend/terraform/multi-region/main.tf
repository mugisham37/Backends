# Multi-region deployment infrastructure for SaaS Platform
# This Terraform configuration sets up infrastructure across multiple AWS regions
# for high availability and disaster recovery

provider "aws" {
  alias  = "primary"
  region = var.primary_region
}

provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

provider "aws" {
  alias  = "tertiary"
  region = var.tertiary_region
}

# Global resources
# Route53 for global DNS management
resource "aws_route53_zone" "primary" {
  provider = aws.primary
  name     = var.domain_name
}

# ACM certificate for HTTPS (in primary region)
resource "aws_acm_certificate" "primary" {
  provider                  = aws.primary
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ACM certificate for HTTPS (in secondary region)
resource "aws_acm_certificate" "secondary" {
  provider                  = aws.secondary
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ACM certificate for HTTPS (in tertiary region)
resource "aws_acm_certificate" "tertiary" {
  provider                  = aws.tertiary
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# DNS validation records
resource "aws_route53_record" "cert_validation_primary" {
  provider = aws.primary
  for_each = {
    for dvo in aws_acm_certificate.primary.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.primary.zone_id
}

# Certificate validation
resource "aws_acm_certificate_validation" "primary" {
  provider                = aws.primary
  certificate_arn         = aws_acm_certificate.primary.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation_primary : record.fqdn]
}

# Global CloudFront distribution for CDN
resource "aws_cloudfront_distribution" "global" {
  provider = aws.primary
  enabled  = true
  aliases  = [var.domain_name, "www.${var.domain_name}"]

  origin_group {
    origin_id = "multi-region-group"

    failover_criteria {
      status_codes = [500, 502, 503, 504]
    }

    member {
      origin_id = "primary"
    }

    member {
      origin_id = "secondary"
    }
  }

  origin {
    domain_name = aws_lb.primary.dns_name
    origin_id   = "primary"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  origin {
    domain_name = aws_lb.secondary.dns_name
    origin_id   = "secondary"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "multi-region-group"

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
      headers = ["Host", "Origin", "Authorization", "X-Tenant-ID"]
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.primary.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "${var.project_name}-cloudfront"
    Environment = var.environment
  }
}

# Route53 record for CloudFront
resource "aws_route53_record" "cloudfront" {
  provider = aws.primary
  zone_id  = aws_route53_zone.primary.zone_id
  name     = var.domain_name
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.global.domain_name
    zone_id                = aws_cloudfront_distribution.global.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route53 record for www subdomain
resource "aws_route53_record" "www" {
  provider = aws.primary
  zone_id  = aws_route53_zone.primary.zone_id
  name     = "www.${var.domain_name}"
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.global.domain_name
    zone_id                = aws_cloudfront_distribution.global.hosted_zone_id
    evaluate_target_health = false
  }
}

# Global DynamoDB tables for cross-region replication
resource "aws_dynamodb_table" "global_locks" {
  provider     = aws.primary
  name         = "${var.project_name}-global-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  replica {
    region_name = var.secondary_region
  }

  replica {
    region_name = var.tertiary_region
  }

  tags = {
    Name        = "${var.project_name}-global-locks"
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "global_config" {
  provider     = aws.primary
  name         = "${var.project_name}-global-config"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ConfigKey"

  attribute {
    name = "ConfigKey"
    type = "S"
  }

  replica {
    region_name = var.secondary_region
  }

  replica {
    region_name = var.tertiary_region
  }

  tags = {
    Name        = "${var.project_name}-global-config"
    Environment = var.environment
  }
}

# Primary region resources
module "primary_region" {
  source = "./modules/region"
  providers = {
    aws = aws.primary
  }

  region                = var.primary_region
  environment           = var.environment
  project_name          = var.project_name
  domain_name           = var.domain_name
  vpc_cidr              = var.primary_vpc_cidr
  availability_zones    = var.primary_availability_zones
  database_username     = var.database_username
  database_password     = var.database_password
  database_name         = var.database_name
  eks_cluster_version   = var.eks_cluster_version
  eks_node_instance_type = var.eks_node_instance_type
  eks_node_desired_size = var.eks_node_desired_size
  eks_node_max_size     = var.eks_node_max_size
  eks_node_min_size     = var.eks_node_min_size
  is_primary            = true
  certificate_arn       = aws_acm_certificate.primary.arn
}

# Secondary region resources
module "secondary_region" {
  source = "./modules/region"
  providers = {
    aws = aws.secondary
  }

  region                = var.secondary_region
  environment           = var.environment
  project_name          = var.project_name
  domain_name           = var.domain_name
  vpc_cidr              = var.secondary_vpc_cidr
  availability_zones    = var.secondary_availability_zones
  database_username     = var.database_username
  database_password     = var.database_password
  database_name         = var.database_name
  eks_cluster_version   = var.eks_cluster_version
  eks_node_instance_type = var.eks_node_instance_type
  eks_node_desired_size = var.eks_node_desired_size
  eks_node_max_size     = var.eks_node_max_size
  eks_node_min_size     = var.eks_node_min_size
  is_primary            = false
  certificate_arn       = aws_acm_certificate.secondary.arn
}

# Tertiary region resources (optional, for disaster recovery)
module "tertiary_region" {
  source = "./modules/region"
  providers = {
    aws = aws.tertiary
  }

  region                = var.tertiary_region
  environment           = var.environment
  project_name          = var.project_name
  domain_name           = var.domain_name
  vpc_cidr              = var.tertiary_vpc_cidr
  availability_zones    = var.tertiary_availability_zones
  database_username     = var.database_username
  database_password     = var.database_password
  database_name         = var.database_name
  eks_cluster_version   = var.eks_cluster_version
  eks_node_instance_type = var.eks_node_instance_type
  eks_node_desired_size = 1  # Smaller footprint for DR region
  eks_node_max_size     = 3
  eks_node_min_size     = 1
  is_primary            = false
  certificate_arn       = aws_acm_certificate.tertiary.arn
}

# VPC Peering between regions
resource "aws_vpc_peering_connection" "primary_to_secondary" {
  provider    = aws.primary
  vpc_id      = module.primary_region.vpc_id
  peer_vpc_id = module.secondary_region.vpc_id
  peer_region = var.secondary_region
  auto_accept = false

  tags = {
    Name        = "${var.project_name}-primary-to-secondary"
    Environment = var.environment
  }
}

resource "aws_vpc_peering_connection_accepter" "secondary_accept_primary" {
  provider                  = aws.secondary
  vpc_peering_connection_id = aws_vpc_peering_connection.primary_to_secondary.id
  auto_accept               = true

  tags = {
    Name        = "${var.project_name}-secondary-accept-primary"
    Environment = var.environment
  }
}

# Route tables for VPC peering
resource "aws_route" "primary_to_secondary" {
  provider                  = aws.primary
  count                     = length(module.primary_region.private_route_table_ids)
  route_table_id            = module.primary_region.private_route_table_ids[count.index]
  destination_cidr_block    = var.secondary_vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.primary_to_secondary.id
}

resource "aws_route" "secondary_to_primary" {
  provider                  = aws.secondary
  count                     = length(module.secondary_region.private_route_table_ids)
  route_table_id            = module.secondary_region.private_route_table_ids[count.index]
  destination_cidr_block    = var.primary_vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.primary_to_secondary.id
}

# Global Route53 health checks
resource "aws_route53_health_check" "primary" {
  provider          = aws.primary
  fqdn              = module.primary_region.load_balancer_dns
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name        = "${var.project_name}-primary-health"
    Environment = var.environment
  }
}

resource "aws_route53_health_check" "secondary" {
  provider          = aws.primary
  fqdn              = module.secondary_region.load_balancer_dns
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name        = "${var.project_name}-secondary-health"
    Environment = var.environment
  }
}

# Route53 failover records
resource "aws_route53_record" "api_primary" {
  provider = aws.primary
  zone_id  = aws_route53_zone.primary.zone_id
  name     = "api.${var.domain_name}"
  type     = "A"
  
  failover_routing_policy {
    type = "PRIMARY"
  }
  
  set_identifier = "primary"
  health_check_id = aws_route53_health_check.primary.id
  
  alias {
    name                   = module.primary_region.load_balancer_dns
    zone_id                = module.primary_region.load_balancer_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_secondary" {
  provider = aws.primary
  zone_id  = aws_route53_zone.primary.zone_id
  name     = "api.${var.domain_name}"
  type     = "A"
  
  failover_routing_policy {
    type = "SECONDARY"
  }
  
  set_identifier = "secondary"
  health_check_id = aws_route53_health_check.secondary.id
  
  alias {
    name                   = module.secondary_region.load_balancer_dns
    zone_id                = module.secondary_region.load_balancer_zone_id
    evaluate_target_health = true
  }
}

# Global IAM roles for cross-region access
resource "aws_iam_role" "cross_region_access" {
  provider = aws.primary
  name     = "${var.project_name}-cross-region-access"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
  
  tags = {
    Name        = "${var.project_name}-cross-region-access"
    Environment = var.environment
  }
}

resource "aws_iam_policy" "cross_region_access" {
  provider = aws.primary
  name     = "${var.project_name}-cross-region-access"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:*",
          "s3:*",
          "rds:*",
          "elasticache:*",
          "eks:*"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cross_region_access" {
  provider   = aws.primary
  role       = aws_iam_role.cross_region_access.name
  policy_arn = aws_iam_policy.cross_region_access.arn
}

# Outputs
output "primary_region" {
  value = var.primary_region
}

output "secondary_region" {
  value = var.secondary_region
}

output "tertiary_region" {
  value = var.tertiary_region
}

output "primary_eks_cluster_name" {
  value = module.primary_region.eks_cluster_name
}

output "secondary_eks_cluster_name" {
  value = module.secondary_region.eks_cluster_name
}

output "tertiary_eks_cluster_name" {
  value = module.tertiary_region.eks_cluster_name
}

output "primary_rds_endpoint" {
  value = module.primary_region.rds_endpoint
}

output "secondary_rds_endpoint" {
  value = module.secondary_region.rds_endpoint
}

output "tertiary_rds_endpoint" {
  value = module.tertiary_region.rds_endpoint
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.global.id
}

output "domain_name" {
  value = var.domain_name
}

output "api_endpoint" {
  value = "https://api.${var.domain_name}"
}
