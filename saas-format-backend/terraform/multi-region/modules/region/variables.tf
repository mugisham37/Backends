variable "region" {
  description = "The AWS region"
  type        = string
}

variable "environment" {
  description = "The deployment environment (e.g., dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "The name of the project"
  type        = string
}

variable "domain_name" {
  description = "The domain name for the application"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "availability_zones" {
  description = "Availability zones in the region"
  type        = list(string)
}

variable "database_username" {
  description = "Username for the RDS database"
  type        = string
  sensitive   = true
}

variable "database_password" {
  description = "Password for the RDS database"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Name of the RDS database"
  type        = string
}

variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
}

variable "eks_node_instance_type" {
  description = "Instance type for the EKS worker nodes"
  type        = string
}

variable "eks_node_desired_size" {
  description = "Desired number of worker nodes in the EKS cluster"
  type        = number
}

variable "eks_node_max_size" {
  description = "Maximum number of worker nodes in the EKS cluster"
  type        = number
}

variable "eks_node_min_size" {
  description = "Minimum number of worker nodes in the EKS cluster"
  type        = number
}

variable "is_primary" {
  description = "Whether this is the primary region"
  type        = bool
  default     = false
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS"
  type        = string
}
