# Variables for the SaaS Platform Terraform configuration

variable "project_name" {
  description = "The name of the project"
  type        = string
  default     = "saas-platform"
}

variable "environment" {
  description = "The environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "The AWS region to deploy to"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "The CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "The availability zones to deploy to"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "private_subnet_cidrs" {
  description = "The CIDR blocks for the private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "The CIDR blocks for the public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "kubernetes_version" {
  description = "The Kubernetes version to use"
  type        = string
  default     = "1.23"
}

variable "min_node_count" {
  description = "The minimum number of nodes in the EKS cluster"
  type        = number
  default     = 2
}

variable "max_node_count" {
  description = "The maximum number of nodes in the EKS cluster"
  type        = number
  default     = 10
}

variable "desired_node_count" {
  description = "The desired number of nodes in the EKS cluster"
  type        = number
  default     = 3
}

variable "db_instance_class" {
  description = "The instance class for the RDS instance"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "The allocated storage for the RDS instance in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "The maximum allocated storage for the RDS instance in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "The name of the database"
  type        = string
  default     = "saas_platform"
}

variable "db_username" {
  description = "The username for the database"
  type        = string
  default     = "postgres"
}

variable "redis_instance_type" {
  description = "The instance type for the Redis cluster"
  type        = string
  default     = "cache.t3.medium"
}

variable "domain_name" {
  description = "The domain name for the application"
  type        = string
  default     = "example.com"
}
