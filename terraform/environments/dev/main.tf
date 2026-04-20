terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "notto-terraform-state"
    key    = "dev/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = var.aws_region
}

module "note_storage" {
  source      = "../../modules/s3"
  bucket_name = "notto-note-storage-dev"
}

module "app" {
  source        = "../../modules/lambda"
  function_name = "notto-backend"
  environment   = "dev"
  memory_size   = 128
  s3_bucket_arn = module.note_storage.bucket_arn

  environment_variables = {
    NODE_ENV        = "development"
    S3_BUCKET_NAME  = module.note_storage.bucket_name
    AWS_REGION_NAME = var.aws_region
    ALLOWED_ORIGINS = var.allowed_origins
  }
}
