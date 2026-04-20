output "lambda_function_url" {
  description = "The public URL of the Lambda function"
  value       = module.app.function_url
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for note storage"
  value       = module.note_storage.bucket_name
}

output "lambda_function_name" {
  description = "Name of the Lambda function (used by CD pipeline)"
  value       = module.app.function_name
}
