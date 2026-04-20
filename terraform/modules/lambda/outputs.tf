output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.this.function_name
}

output "function_url" {
  description = "Public URL of the Lambda function"
  value       = aws_lambda_function_url.this.function_url
}

output "role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.this.arn
}
