variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-west-2"
}

variable "allowed_origins" {
  description = "Comma-separated list of allowed CORS origins (leave empty for native-only)"
  type        = string
  default     = "http://localhost:5173,http://localhost:3000"
}
