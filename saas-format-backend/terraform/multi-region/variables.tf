variable "primary_region" {
  description = "The primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "The secondary AWS region for high availability"
  type        = string
  default     = "us-west-2"
}

variable "tertiary_region" {
  description = "The tertiary AWS region for disaster recovery"
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "The deployment environment (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "The name of the project"
  type        = string
  default     = "saas-platform"
}

variable "domain_name" {
  description = "The domain name for the application"
  type        = string
}

variable "primary_vpc_cidr" {
  description = "CIDR block for the primary VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "secondary_vpc_cidr" {
  description = "CIDR block for the secondary VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "tertiary_vpc_cidr" {
  description = "CIDR block for the tertiary VPC"
  type        = string
  default     = "10.2.0.0/16"
}

variable "primary_availability_zones" {
  description = "Availability zones in the primary region"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "secondary_availability_zones" {
  description = "Availability zones in the secondary region"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "tertiary_availability_zones" {
  description = "Availability zones in the tertiary region"
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
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
  default     = "saas_platform"
}

variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.27"
}

variable "eks_node_instance_type" {
  description = "Instance type for the EKS worker nodes"
  type        = string
  default     = "m5.large"
}

variable "eks_node_desired_size" {
  description = "Desired number of worker nodes in the EKS cluster"
  type        = number
  default     = 3
}

variable "eks_node_max_size" {
  description = "Maximum number of worker nodes in the EKS cluster"
  type        = number
  default     = 6
}

variable "eks_node_min_size" {
  description = "Minimum number of worker nodes in the EKS cluster"
  type        = number
  default     = 2
}
